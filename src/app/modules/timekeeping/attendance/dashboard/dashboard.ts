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
import { DatePipe, DOCUMENT } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { auditTime, debounceTime, distinctUntilChanged, finalize, fromEvent } from 'rxjs';

import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';

import { AttendanceService } from '../services/attendance.service';
import {
  BoardRosterEntry,
  BoardStatusFilter,
  BoardSummary,
  TardinessEntry,
  TardinessMeta,
  TardinessPeriod,
} from '../models/attendance.model';
import { AttendanceStatusBadge } from '../shared/attendance-status-badge';
import { formatHours, formatLate } from '../shared/attendance-status.util';

import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { ListPaginator, ListPageChange } from '../../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
const DAY_MS = 24 * 60 * 60 * 1000;

/** A clickable summary card: a status bucket, its count, and its tone. */
interface StatusCard {
  key: BoardStatusFilter;
  label: string;
  count: number;
  tone: 'success' | 'warning' | 'destructive';
  /** Small qualifier under the label, e.g. "incl. 3 late". */
  hint: string;
}

interface PeriodOption {
  key: TardinessPeriod;
  label: string;
}

@Component({
  selector: 'app-attendance-dashboard',
  imports: [
    PageLayout,
    ListPaginator,
    EmptyState,
    TableModule,
    ButtonModule,
    DatePickerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectButtonModule,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    AttendanceStatusBadge,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceDashboard implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);


  // Shared day context.
  readonly dateControl = new FormControl<Date>(this.startOfToday(), { nonNullable: true });
  readonly maxDate = this.startOfToday();
  readonly isToday = signal(true);

  /** True once any request returns 403: the viewer isn't an org admin. */
  readonly accessDenied = signal(false);

  // Summary.
  readonly summary = signal<BoardSummary | null>(null);
  readonly isLoadingSummary = signal(false);

  readonly statusCards = computed<StatusCard[]>(() => {
    const summary = this.summary();
    const late = summary?.late ?? 0;
    return [
      {
        key: 'present',
        label: 'Present',
        count: summary?.present ?? 0,
        tone: 'success',
        hint: late > 0 ? `incl. ${late} late` : '',
      },
      { key: 'late', label: 'Late', count: late, tone: 'warning', hint: '' },
      { key: 'absent', label: 'Absent', count: summary?.absent ?? 0, tone: 'destructive', hint: '' },
    ];
  });

  // Roster (member-centric, filterable by status).
  readonly rosterEntries = signal<BoardRosterEntry[]>([]);
  readonly rosterTotal = signal(0);
  readonly rosterRows = signal(10);
  readonly isLoadingRoster = signal(false);
  readonly rosterSearch = new FormControl('', { nonNullable: true });
  readonly statusFilter = signal<BoardStatusFilter | null>(null);
  readonly rosterFirst = signal(0);
  readonly rosterPage = computed(() => Math.floor(this.rosterFirst() / this.rosterRows()) + 1);
  private rosterRequestId = 0;

  // Tardiness scoreboard.
  readonly periodOptions: PeriodOption[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];
  readonly period = signal<TardinessPeriod>('weekly');
  readonly tardEntries = signal<TardinessEntry[]>([]);
  readonly tardTotal = signal(0);
  readonly tardRows = signal(10);
  readonly isLoadingTard = signal(false);
  readonly tardMeta = signal<TardinessMeta | null>(null);
  readonly tardSearch = new FormControl('', { nonNullable: true });
  readonly tardFirst = signal(0);
  readonly tardPage = computed(() => Math.floor(this.tardFirst() / this.tardRows()) + 1);
  private tardRequestId = 0;

  private pendingRealtimeRefresh = false;

  constructor() {
    this.rosterSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetRoster());

    this.tardSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetTardiness());

    this.dateControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.isToday.set(this.isSameDay(value, this.maxDate));
        this.loadSummary();
        this.resetRoster();
        this.resetTardiness();
      });
  }

  ngOnInit(): void {
    this.loadSummary();

    fromEvent(this.document, 'visibilitychange')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.document.visibilityState !== 'visible' || !this.pendingRealtimeRefresh) return;
        this.pendingRealtimeRefresh = false;
        this.refreshLive();
      });

    this.attendanceService.updates$
      .pipe(auditTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe((update) => {
        const selectedDate = this.toDateParam(this.dateControl.value);
        const targeted = Boolean(update.affected?.length);
        const affectsSelectedDate =
          update.affected?.some((target) => target.date === selectedDate) ?? false;
        // Availability is always "now", so any punch can change it while viewing today.
        if (!(targeted ? affectsSelectedDate : this.isToday())) return;
        if (this.document.visibilityState === 'visible') {
          this.refreshLive();
          return;
        }
        this.pendingRealtimeRefresh = true;
      });
  }

  /* ─── Summary ─────────────────────────────────────────── */

  loadSummary(): void {
    this.isLoadingSummary.set(true);
    this.attendanceService
      .getBoardSummary(this.toDateParam(this.dateControl.value))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingSummary.set(false)),
      )
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: (err: unknown) => this.handleError(err),
      });
  }

  /* ─── Roster ──────────────────────────────────────────── */

  onRosterLazyLoad(event: TableLazyLoadEvent): void {
    this.rosterFirst.set(event.first ?? 0);
    this.rosterRows.set(event.rows ?? 10);
    this.fetchRoster();
  }

  toggleStatusFilter(key: BoardStatusFilter): void {
    this.statusFilter.update((current) => (current === key ? null : key));
    this.resetRoster();
  }

  private fetchRoster(silent = false): void {
    const requestId = ++this.rosterRequestId;
    if (!silent) this.isLoadingRoster.set(true);

    this.attendanceService
      .getBoardRoster({
        page: this.rosterPage(),
        limit: this.rosterRows(),
        date: this.toDateParam(this.dateControl.value),
        search: this.rosterSearch.value.trim() || undefined,
        status: this.statusFilter() ?? undefined,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!silent) this.isLoadingRoster.set(false);
        }),
      )
      .subscribe({
        next: (res) => {
          if (requestId !== this.rosterRequestId) return;
          this.rosterEntries.set(res.data);
          this.rosterTotal.set(res.meta.total);
        },
        error: (err: unknown) => {
          if (requestId !== this.rosterRequestId) return;
          this.handleError(err);
          if (!silent) {
            this.rosterEntries.set([]);
            this.rosterTotal.set(0);
          }
        },
      });
  }

  private resetRoster(): void {
    this.rosterFirst.set(0);
    this.fetchRoster();
  }

  /** Shared list footer for the roster. */
  onRosterPage(change: ListPageChange): void {
    this.rosterRows.set(change.pageSize);
    this.rosterFirst.set(change.first);
    this.fetchRoster();
  }

  /** Shared list footer for the scoreboard. */
  onTardPage(change: ListPageChange): void {
    this.tardRows.set(change.pageSize);
    this.tardFirst.set(change.first);
    this.fetchTardiness();
  }

  /* ─── Tardiness scoreboard ────────────────────────────── */

  onTardLazyLoad(event: TableLazyLoadEvent): void {
    this.tardFirst.set(event.first ?? 0);
    this.tardRows.set(event.rows ?? 10);
    this.fetchTardiness();
  }

  setPeriod(period: TardinessPeriod): void {
    if (this.period() === period) return;
    this.period.set(period);
    this.resetTardiness();
  }

  private fetchTardiness(silent = false): void {
    const requestId = ++this.tardRequestId;
    if (!silent) this.isLoadingTard.set(true);

    this.attendanceService
      .getTardiness({
        page: this.tardPage(),
        limit: this.tardRows(),
        period: this.period(),
        date: this.toDateParam(this.dateControl.value),
        search: this.tardSearch.value.trim() || undefined,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!silent) this.isLoadingTard.set(false);
        }),
      )
      .subscribe({
        next: (res) => {
          if (requestId !== this.tardRequestId) return;
          this.tardEntries.set(res.data);
          this.tardTotal.set(res.meta.total);
          this.tardMeta.set(res.meta);
        },
        error: (err: unknown) => {
          if (requestId !== this.tardRequestId) return;
          this.handleError(err);
          if (!silent) {
            this.tardEntries.set([]);
            this.tardTotal.set(0);
          }
        },
      });
  }

  private resetTardiness(): void {
    this.tardFirst.set(0);
    this.fetchTardiness();
  }

  /* ─── Day navigation ──────────────────────────────────── */

  previousDay(): void {
    this.shiftDay(-1);
  }

  nextDay(): void {
    if (this.isToday()) return;
    this.shiftDay(1);
  }

  openEmployee(entry: BoardRosterEntry): void {
    this.router.navigate(['/timekeeping/attendance', entry.employeeId], {
      queryParams: { date: this.toDateParam(this.dateControl.value) },
      // Identity for the detail header; the day-summary endpoint only returns times.
      state: { employee: entry },
    });
  }

  /* ─── Presentation helpers ────────────────────────────── */

  /** Lateness detail for a row, e.g. "12 min late"; empty unless the row is late. */
  lateDetail(entry: BoardRosterEntry): string {
    return entry.status.status === 'late' ? formatLate(entry.status.lateMinutes) : '';
  }

  expectedHours(entry: BoardRosterEntry): string {
    return entry.status.expectedHours > 0 ? formatHours(entry.status.expectedHours) : '—';
  }

  lateTotalLabel(entry: TardinessEntry): string {
    return formatLate(entry.totalLateMinutes) || '0 min';
  }

  lateAvgLabel(entry: TardinessEntry): string {
    return entry.avgLateMinutes > 0 ? `${entry.avgLateMinutes} min` : '—';
  }

  private refreshLive(): void {
    this.loadSummary();
    this.fetchRoster(true);
  }

  private handleError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 403) {
      this.accessDenied.set(true);
      return;
    }
    console.error('Attendance board request failed:', err);
  }

  private shiftDay(deltaDays: number): void {
    const next = new Date(this.dateControl.value.getTime() + deltaDays * DAY_MS);
    next.setHours(0, 0, 0, 0);
    this.dateControl.setValue(next);
  }

  /** Local YYYY-MM-DD so the day matches the company-timezone day on the server. */
  private toDateParam(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private startOfToday(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
