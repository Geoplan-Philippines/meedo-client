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
import { auditTime, finalize, fromEvent } from 'rxjs';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';

import { AttendanceService } from '../services/attendance.service';
import { RosterEntry } from '../models/attendance.model';

import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { injectListState } from '../../../../shared/data/url-list-state';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-attendance-roster',
  imports: [
    ListPaginator,
    EmptyState,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    ButtonModule,
    DatePickerModule,
    FormsModule,
    DatePipe,
  ],
  templateUrl: './roster.html',
  styleUrl: './roster.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Roster implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);


  /** Page, page size, search and day live in the URL (`rosterPage`, `rosterQ`, `rosterDate`...). */
  readonly list = injectListState({ pageSize: 10, prefix: 'roster', filters: { date: null as string | null } });

  readonly entries = signal<RosterEntry[]>([]);
  readonly totalRecords = signal(0);
  readonly rows = this.list.pageSize;
  readonly page = this.list.page;
  readonly isLoading = signal(false);

  /** Admins/superadmins see the whole roster, so only they get the employee
   *  search; a plain "user" gets just their own row and no search box. The
   *  backend resolves the role and returns it as `meta.viewerIsManager`. */
  readonly canSearch = signal(false);

  /** Future days have no attendance yet, so the picker and next-day step are capped at today. */
  readonly maxDate = this.startOfToday();
  /** The chosen day (`?rosterDate=YYYY-MM-DD`), today when unset or in the future. */
  readonly selectedDate = computed(() => {
    const value = this.list.filters().date;
    const date = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : this.maxDate;
    return Number.isNaN(date.getTime()) || date > this.maxDate ? this.maxDate : date;
  });
  readonly isToday = computed(() => this.isSameDay(this.selectedDate(), this.maxDate));
  private requestId = 0;
  private pendingRealtimeRefresh = false;

  constructor() {
    // Any change to the URL state (page, size, search, day) loads that page.
    effect(() => {
      this.list.query();
      this.selectedDate();
      untracked(() => this.fetchRoster());
    });
  }

  onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  setDate(date: Date | null): void {
    if (!date) return;
    this.list.setFilter('date', this.isSameDay(date, this.maxDate) ? null : this.toDateParam(date));
  }

  ngOnInit(): void {

    fromEvent(this.document, 'visibilitychange')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.document.visibilityState !== 'visible' || !this.pendingRealtimeRefresh) return;
        this.pendingRealtimeRefresh = false;
        this.fetchRoster(true);
      });

    this.attendanceService.updates$
      .pipe(auditTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe((update) => {
        const selectedDate = this.toDateParam(this.selectedDate());
        const targeted = Boolean(update.affected?.length);
        const affectsSelectedDate = update.affected?.some(
          (target) => target.date === selectedDate,
        ) ?? false;
        if (!(targeted ? affectsSelectedDate : this.isToday())) return;
        if (this.document.visibilityState === 'visible') {
          this.fetchRoster(true);
          return;
        }
        this.pendingRealtimeRefresh = true;
      });
  }


  previousDay(): void {
    this.shiftDay(-1);
  }

  nextDay(): void {
    if (this.isToday()) return;
    this.shiftDay(1);
  }

  /** Re-fetch the current page (e.g. after the user punches in/out). */
  reload(): void {
    this.fetchRoster();
  }

  openEmployee(entry: RosterEntry): void {
    this.router.navigate(['/timekeeping/attendance', entry.employeeId], {
      queryParams: { date: this.toDateParam(this.selectedDate()) },
      // Identity for the detail header; the day-summary endpoint only returns times.
      state: { employee: entry },
    });
  }

  private shiftDay(deltaDays: number): void {
    const next = new Date(this.selectedDate().getTime() + deltaDays * DAY_MS);
    next.setHours(0, 0, 0, 0);
    this.setDate(next);
  }

  /** `silent` skips the loading overlay and keeps current data on failure — used
   *  by the background poll so the live refresh never flickers or blanks. */
  private fetchRoster(silent = false): void {
    const requestId = ++this.requestId;
    if (!silent) this.isLoading.set(true);

    this.attendanceService
      .getRoster({
        page: this.page(),
        limit: this.rows(),
        date: this.toDateParam(this.selectedDate()),
        search: this.list.search() || undefined,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!silent) this.isLoading.set(false);
        }),
      )
      .subscribe({
        next: (res) => {
          if (requestId !== this.requestId) return;
          this.entries.set(res.data);
          this.totalRecords.set(res.meta.total);
          this.canSearch.set(res.meta.viewerIsManager);
        },
        error: (err: unknown) => {
          if (requestId !== this.requestId) return;
          console.error('Error loading attendance roster:', err);
          // A failed silent poll keeps the last good board on screen.
          if (!silent) {
            this.entries.set([]);
            this.totalRecords.set(0);
          }
        },
      });
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
