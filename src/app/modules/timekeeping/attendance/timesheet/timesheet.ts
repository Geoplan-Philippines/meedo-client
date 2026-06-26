import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { finalize, interval } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AttendanceService } from '../services/attendance.service';
import { Roster } from '../roster/roster';
import {
  AttendanceEvent,
  AttendanceEventType,
  AttendanceSource,
  DailyAttendanceSummary,
  ManualEventType,
  WorkType,
} from '../models/attendance.model';

/** How often we silently re-pull today's summary so externally-sourced
 *  (e.g. biometric office) events surface without a manual refresh. */
const SUMMARY_POLL_MS = 15_000;
/** Clock tick driving the live "elapsed" counter while clocked in. */
const CLOCK_TICK_MS = 1_000;

interface WorkTypeOption {
  readonly type: WorkType;
  readonly label: string;
  readonly icon: string;
  readonly source: AttendanceSource;
  readonly inEvent: ManualEventType;
  readonly outEvent: ManualEventType;
}

type PunchMode = 'in' | 'out';

@Component({
  selector: 'app-attendance-timesheet',
  imports: [ButtonModule, DialogModule, ToastModule, DatePipe, Roster],
  providers: [MessageService],
  templateUrl: './timesheet.html',
  styleUrl: './timesheet.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Timesheet implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly roster = viewChild(Roster);

  readonly workTypes: readonly WorkTypeOption[] = [
    {
      type: 'HOME',
      label: 'Home',
      icon: 'pi pi-home',
      source: 'WFH',
      inEvent: 'WFH_IN',
      outEvent: 'WFH_OUT',
    },
    {
      type: 'OFFICE',
      label: 'Office',
      icon: 'pi pi-briefcase',
      source: 'OFFICE',
      inEvent: 'OFFICE_IN',
      outEvent: 'OFFICE_OUT',
    },
    {
      type: 'FIELD',
      label: 'Field',
      icon: 'pi pi-map-marker',
      source: 'FIELD',
      inEvent: 'FIELD_IN',
      outEvent: 'FIELD_OUT',
    },
  ];

  // Punch dialog state.
  readonly dialogVisible = signal(false);
  readonly dialogMode = signal<PunchMode>('in');
  readonly dialogStep = signal<'select' | 'confirm'>('select');
  readonly selectedWorkType = signal<WorkTypeOption | null>(null);
  readonly isPunching = signal(false);

  // Current user's computed attendance for today.
  readonly summary = signal<DailyAttendanceSummary | null>(null);
  readonly isLoadingSummary = signal(false);

  // Live clock for the elapsed counter and confirmation timestamp.
  readonly now = signal(Date.now());

  // Geolocation — punches are gated until the browser yields a fix.
  readonly coords = signal<{ latitude: number; longitude: number } | null>(null);
  readonly locationStatus = signal<'pending' | 'ready' | 'denied' | 'unavailable'>('pending');
  readonly hasLocation = computed(() => this.coords() !== null);

  /** Human-readable address resolved from the current fix (null while resolving). */
  readonly locationLabel = signal<string | null>(null);
  /** Raw coordinate fallback shown until the address resolves. */
  readonly coordinateLabel = computed(() => {
    const c = this.coords();
    return c ? `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}` : null;
  });
  private lastGeocodeKey = '';

  readonly firstIn = computed(() => this.summary()?.firstIn ?? null);
  readonly lastOut = computed(() => this.summary()?.lastOut ?? null);
  readonly billableHours = computed(() => this.summary()?.billableHours ?? null);
  private readonly events = computed<AttendanceEvent[]>(() => this.summary()?.events ?? []);

  readonly hasClockedIn = computed(() => this.firstIn() !== null);

  /** The most recent event today — drives Time Out's inferred work type. */
  private readonly lastEvent = computed<AttendanceEvent | null>(() => {
    const events = this.events();
    return events.length ? events[events.length - 1] : null;
  });

  readonly canTimeOut = computed(() => this.lastEvent() !== null);

  readonly dialogTitle = computed(() =>
    this.dialogStep() === 'select'
      ? 'Work Type'
      : this.dialogMode() === 'in'
        ? 'Confirm Time In'
        : 'Confirm Time Out',
  );

  /** Whether a distinct clock-out exists; otherwise the day is still open. */
  private readonly hasClosed = computed(() => {
    const first = this.firstIn();
    const last = this.lastOut();
    return !!first && !!last && new Date(last).getTime() > new Date(first).getTime();
  });

  /** Live span from first-in to last-out (or now while still clocked in). */
  readonly elapsedLabel = computed(() => {
    const first = this.firstIn();
    if (!first) return '—';
    const start = new Date(first).getTime();
    const end = this.hasClosed() ? new Date(this.lastOut()!).getTime() : this.now();
    return this.formatDuration(Math.max(0, end - start));
  });

  ngOnInit(): void {
    this.loadSummary(false);
    this.watchLocation();

    interval(SUMMARY_POLL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadSummary(true));

    interval(CLOCK_TICK_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  /* ─── Geolocation ────────────────────────────────────── */

  private watchLocation(): void {
    if (!('geolocation' in navigator)) {
      this.locationStatus.set('unavailable');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        this.coords.set({ latitude, longitude });
        this.locationStatus.set('ready');
        void this.resolveAddress(latitude, longitude);
      },
      (error) => {
        this.coords.set(null);
        this.locationStatus.set(
          error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
        );
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 27_000 },
    );

    this.destroyRef.onDestroy(() => navigator.geolocation.clearWatch(watchId));
  }

  /**
   * Reverse-geocode the fix into a readable address via OSM Nominatim. Uses
   * native fetch so the auth interceptor's credentialed/withCredentials clone
   * (which Nominatim's wildcard CORS rejects) never touches the request. Skips
   * refetching while the rounded position is unchanged to respect rate limits.
   */
  private async resolveAddress(latitude: number, longitude: number): Promise<void> {
    const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    if (key === this.lastGeocodeKey) return;
    this.lastGeocodeKey = key;

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Reverse geocode failed: ${response.status}`);

      const data = (await response.json()) as { display_name?: string };
      this.locationLabel.set(data.display_name ?? null);
    } catch (err) {
      console.error('Error resolving address:', err);
      this.locationLabel.set(null);
    }
  }

  /* ─── Dialog flow ────────────────────────────────────── */

  openTimeIn(): void {
    this.dialogMode.set('in');
    this.dialogStep.set('select');
    this.selectedWorkType.set(null);
    this.dialogVisible.set(true);
  }

  openTimeOut(): void {
    const last = this.lastEvent();
    if (!last) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No time in',
        detail: 'Record a time in before timing out.',
      });
      return;
    }

    // Time Out mirrors the source of the most recent event of the day.
    const workType = this.workTypeForSource(last.source);
    this.dialogMode.set('out');
    this.dialogStep.set('confirm');
    this.selectedWorkType.set(workType);
    this.dialogVisible.set(true);
  }

  selectWorkType(option: WorkTypeOption): void {
    this.selectedWorkType.set(option);
    this.dialogStep.set('confirm');
  }

  backToSelect(): void {
    this.dialogStep.set('select');
  }

  closeDialog(): void {
    if (this.isPunching()) return;
    this.dialogVisible.set(false);
  }

  confirmPunch(): void {
    const option = this.selectedWorkType();
    if (!option) return;

    const eventType = this.dialogMode() === 'in' ? option.inEvent : option.outEvent;
    const coords = this.coords();

    this.isPunching.set(true);
    this.attendanceService
      .recordEvent({ eventType, latitude: coords?.latitude, longitude: coords?.longitude })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isPunching.set(false)),
      )
      .subscribe({
        next: (event) => {
          this.messageService.add({
            severity: 'success',
            summary: this.dialogMode() === 'in' ? 'Timed in' : 'Timed out',
            detail: `${this.eventTypeLabel(event.eventType)} at ${this.formatTime(event.timestamp)}`,
          });
          this.dialogVisible.set(false);
          // Reflect the punch immediately, then refresh the roster row.
          this.loadSummary(true);
          this.roster()?.reload();
        },
        error: (err: unknown) => {
          console.error('Error recording attendance event:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Failed',
            detail: 'Could not record attendance. Try again.',
          });
        },
      });
  }

  /* ─── Data loading ───────────────────────────────────── */

  private loadSummary(silent: boolean): void {
    if (!silent) this.isLoadingSummary.set(true);

    this.attendanceService
      .getDailySummary()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingSummary.set(false)),
      )
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: (err: unknown) => {
          console.error('Error loading attendance summary:', err);
          if (!silent) {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: "Failed to load today's attendance.",
            });
          }
        },
      });
  }

  /* ─── Helpers ────────────────────────────────────────── */

  private workTypeForSource(source: AttendanceSource): WorkTypeOption {
    return this.workTypes.find((option) => option.source === source) ?? this.workTypes[0];
  }

  private eventTypeLabel(eventType: AttendanceEventType): string {
    const labels: Record<AttendanceEventType, string> = {
      OFFICE_ACCESS: 'Office Access',
      OFFICE_IN: 'Office In',
      OFFICE_OUT: 'Office Out',
      FIELD_IN: 'Field In',
      FIELD_OUT: 'Field Out',
      WFH_IN: 'WFH In',
      WFH_OUT: 'WFH Out',
    };
    return labels[eventType] ?? eventType;
  }

  private formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
}
