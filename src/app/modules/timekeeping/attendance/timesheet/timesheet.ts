import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { finalize, interval } from 'rxjs';

import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AttendanceService } from '../services/attendance.service';
import {
  AttendanceEvent,
  AttendanceEventType,
  AttendanceRecord,
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
  imports: [
    TableModule,
    ButtonModule,
    DialogModule,
    TagModule,
    ToastModule,
    DatePipe,
  ],
  providers: [MessageService],
  templateUrl: './timesheet.html',
  styleUrl: './timesheet.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Timesheet implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

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

  // Today's computed attendance + timeline.
  readonly summary = signal<DailyAttendanceSummary | null>(null);
  readonly isLoadingSummary = signal(false);

  // History table (server-side pagination).
  readonly history = signal<AttendanceRecord[]>([]);
  readonly totalRecords = signal(0);
  readonly rows = signal(10);
  readonly isLoadingHistory = signal(false);

  private first = 0;
  private historyRequestId = 0;

  // Live clock for the elapsed counter and confirmation timestamp.
  readonly now = signal(Date.now());

  readonly firstIn = computed(() => this.summary()?.firstIn ?? null);
  readonly lastOut = computed(() => this.summary()?.lastOut ?? null);
  readonly billableHours = computed(() => this.summary()?.billableHours ?? null);
  readonly events = computed<AttendanceEvent[]>(() => this.summary()?.events ?? []);

  readonly hasClockedIn = computed(() => this.firstIn() !== null);

  /** The most recent event today — drives Time Out's inferred work type. */
  readonly lastEvent = computed<AttendanceEvent | null>(() => {
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

    interval(SUMMARY_POLL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadSummary(true));

    interval(CLOCK_TICK_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
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

    this.isPunching.set(true);
    this.attendanceService
      .recordEvent({ eventType })
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
          // Reflect the punch immediately, then refresh history in the background.
          this.loadSummary(true);
          this.refreshHistory();
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

  onHistoryLazyLoad(event: TableLazyLoadEvent): void {
    this.first = event.first ?? 0;
    this.rows.set(event.rows ?? 10);
    this.fetchHistory();
  }

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

  private refreshHistory(): void {
    this.first = 0;
    this.fetchHistory();
  }

  private fetchHistory(): void {
    const requestId = ++this.historyRequestId;
    this.isLoadingHistory.set(true);

    this.attendanceService
      .getHistory({
        page: Math.floor(this.first / this.rows()) + 1,
        limit: this.rows(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingHistory.set(false)),
      )
      .subscribe({
        next: (res) => {
          if (requestId !== this.historyRequestId) return;
          this.history.set(res.data);
          this.totalRecords.set(res.meta.total);
        },
        error: (err: unknown) => {
          if (requestId !== this.historyRequestId) return;
          console.error('Error loading attendance history:', err);
          this.history.set([]);
          this.totalRecords.set(0);
        },
      });
  }

  /* ─── Helpers ────────────────────────────────────────── */

  private workTypeForSource(source: AttendanceSource): WorkTypeOption {
    return this.workTypes.find((option) => option.source === source) ?? this.workTypes[0];
  }

  eventTypeLabel(eventType: AttendanceEventType): string {
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

  sourceSeverity(source: string): 'info' | 'success' | 'warn' {
    const map: Record<string, 'info' | 'success' | 'warn'> = {
      OFFICE: 'info',
      FIELD: 'warn',
      WFH: 'success',
    };
    return map[source] ?? 'info';
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
