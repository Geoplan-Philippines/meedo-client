import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { auditTime, finalize, fromEvent } from 'rxjs';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';

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
import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { injectListState } from '../../../../shared/data/url-list-state';

const PERIODS: readonly string[] = ['daily', 'weekly', 'monthly'];
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
    TableModule,
    ButtonModule,
    DatePickerModule,
    FormsModule,
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
  /** The day (`?date=`) is shared by the summary, the roster and the scoreboard. */
  private readonly day = injectListState({ filters: { date: null as string | null } });
  readonly maxDate = this.startOfToday();
  readonly selectedDate = computed(() => {
    const value = this.day.filters().date;
    const date = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : this.maxDate;
    return Number.isNaN(date.getTime()) || date > this.maxDate ? this.maxDate : date;
  });
  readonly isToday = computed(() => this.isSameDay(this.selectedDate(), this.maxDate));

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
  /** Page, size, search and status live in the URL (`rosterPage`, `rosterQ`, `rosterStatus`...). */
  readonly rosterList = injectListState({ pageSize: 10, prefix: 'roster', filters: { status: null as string | null } });
  readonly rosterEntries = signal<BoardRosterEntry[]>([]);
  readonly rosterTotal = signal(0);
  readonly rosterRows = this.rosterList.pageSize;
  readonly isLoadingRoster = signal(false);
  readonly statusFilter = computed(() => this.rosterList.filters().status as BoardStatusFilter | null);
  readonly rosterPage = this.rosterList.page;
  private rosterRequestId = 0;

  // Tardiness scoreboard.
  readonly periodOptions: readonly PeriodOption[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];
  /** Page, size, search and period live in the URL (`latePage`, `lateQ`, `latePeriod`...). */
  readonly tardList = injectListState({ pageSize: 10, prefix: 'late', filters: { period: 'weekly' } });
  readonly period = computed(() => (PERIODS.includes(this.tardList.filters().period) ? this.tardList.filters().period : 'weekly') as TardinessPeriod);
  readonly tardEntries = signal<TardinessEntry[]>([]);
  readonly tardTotal = signal(0);
  readonly tardRows = this.tardList.pageSize;
  readonly isLoadingTard = signal(false);
  readonly tardMeta = signal<TardinessMeta | null>(null);
  readonly tardPage = this.tardList.page;
  private tardRequestId = 0;

  private pendingRealtimeRefresh = false;

  constructor() {
    // Each part reloads when its URL state (or the shared day) changes.
    effect(() => {
      this.selectedDate();
      untracked(() => this.loadSummary());
    });
    effect(() => {
      this.rosterList.query();
      this.selectedDate();
      untracked(() => this.fetchRoster());
    });
    effect(() => {
      this.tardList.query();
      this.period();
      this.selectedDate();
      untracked(() => this.fetchTardiness());
    });
  }

  onRosterSearch(event: Event): void {
    this.rosterList.setSearch((event.target as HTMLInputElement).value);
  }

  onTardSearch(event: Event): void {
    this.tardList.setSearch((event.target as HTMLInputElement).value);
  }

  setDate(date: Date | null): void {
    if (!date) return;
    this.day.setFilter('date', this.isSameDay(date, this.maxDate) ? null : this.toDateParam(date));
  }

  ngOnInit(): void {

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
        const selectedDate = this.toDateParam(this.selectedDate());
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
      .getBoardSummary(this.toDateParam(this.selectedDate()))
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

  toggleStatusFilter(key: BoardStatusFilter): void {
    this.rosterList.setFilter('status', this.statusFilter() === key ? null : key);
  }

  private fetchRoster(silent = false): void {
    const requestId = ++this.rosterRequestId;
    if (!silent) this.isLoadingRoster.set(true);

    this.attendanceService
      .getBoardRoster({
        page: this.rosterPage(),
        limit: this.rosterRows(),
        date: this.toDateParam(this.selectedDate()),
        search: this.rosterList.search() || undefined,
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

  /* ─── Tardiness scoreboard ────────────────────────────── */

  setPeriod(period: TardinessPeriod): void {
    if (this.period() === period) return;
    this.tardList.setFilter('period', period);
  }

  private fetchTardiness(silent = false): void {
    const requestId = ++this.tardRequestId;
    if (!silent) this.isLoadingTard.set(true);

    this.attendanceService
      .getTardiness({
        page: this.tardPage(),
        limit: this.tardRows(),
        period: this.period(),
        date: this.toDateParam(this.selectedDate()),
        search: this.tardList.search() || undefined,
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
      queryParams: { date: this.toDateParam(this.selectedDate()) },
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
    const next = new Date(this.selectedDate().getTime() + deltaDays * DAY_MS);
    next.setHours(0, 0, 0, 0);
    this.setDate(next);
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
