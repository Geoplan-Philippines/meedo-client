import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { Table, TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';

import { AttendanceService } from '../services/attendance.service';
import { RosterEntry } from '../models/attendance.model';

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-attendance-roster',
  imports: [
    TableModule,
    ButtonModule,
    InputTextModule,
    DatePickerModule,
    ReactiveFormsModule,
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

  private readonly table = viewChild<Table>('dt');

  readonly entries = signal<RosterEntry[]>([]);
  readonly totalRecords = signal(0);
  readonly rows = signal(10);
  readonly isLoading = signal(false);

  /** Only org managers see the whole roster, so only they get the employee search. */
  readonly canSearch = signal(false);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly dateControl = new FormControl<Date>(this.startOfToday(), { nonNullable: true });

  /** Future days have no attendance yet, so the picker and next-day step are capped at today. */
  readonly maxDate = this.startOfToday();
  readonly isToday = signal(true);

  private first = 0;
  private requestId = 0;

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetToFirstPage());

    this.dateControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.isToday.set(this.isSameDay(value, this.maxDate));
        this.resetToFirstPage();
      });
  }

  ngOnInit(): void {
    // The lazy p-table fires (onLazyLoad) on init, loading the first page.
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.first = event.first ?? 0;
    this.rows.set(event.rows ?? 10);
    this.fetchRoster();
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
      queryParams: { date: this.toDateParam(this.dateControl.value) },
    });
  }

  private shiftDay(deltaDays: number): void {
    const next = new Date(this.dateControl.value.getTime() + deltaDays * DAY_MS);
    next.setHours(0, 0, 0, 0);
    this.dateControl.setValue(next);
  }

  private resetToFirstPage(): void {
    this.first = 0;
    // Sync the paginator UI back to page 1 without relying on table.reset(),
    // which does not reliably re-emit (onLazyLoad) for a lazy table.
    const table = this.table();
    if (table) {
      table.first = 0;
    }
    this.fetchRoster();
  }

  private fetchRoster(): void {
    const requestId = ++this.requestId;
    this.isLoading.set(true);

    this.attendanceService
      .getRoster({
        page: Math.floor(this.first / this.rows()) + 1,
        limit: this.rows(),
        date: this.toDateParam(this.dateControl.value),
        search: this.searchControl.value.trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoading.set(false)))
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
          this.entries.set([]);
          this.totalRecords.set(0);
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
