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
import { DatePipe, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';

import { AttendanceService } from '../services/attendance.service';
import {
  AttendanceEvent,
  AttendanceEventType,
  AttendanceRecord,
  DailyAttendanceSummary,
} from '../models/attendance.model';

@Component({
  selector: 'app-attendance-employee-detail',
  imports: [ButtonModule, TagModule, TableModule, DatePipe],
  templateUrl: './employee-detail.html',
  styleUrl: './employee-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeDetail implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  private employeeId = '';

  // Selected day timeline.
  readonly summary = signal<DailyAttendanceSummary | null>(null);
  readonly isLoading = signal(false);

  // Full history (server-side pagination).
  readonly history = signal<AttendanceRecord[]>([]);
  readonly totalRecords = signal(0);
  readonly rows = signal(10);
  readonly isLoadingHistory = signal(false);

  private first = 0;
  private historyRequestId = 0;

  readonly firstIn = computed(() => this.summary()?.firstIn ?? null);
  readonly lastOut = computed(() => this.summary()?.lastOut ?? null);
  readonly billableHours = computed(() => this.summary()?.billableHours ?? null);
  readonly events = computed<AttendanceEvent[]>(() => this.summary()?.events ?? []);

  ngOnInit(): void {
    const employeeId = this.route.snapshot.paramMap.get('employeeId');
    const date = this.route.snapshot.queryParamMap.get('date') ?? undefined;
    if (!employeeId) return;
    this.employeeId = employeeId;

    this.loadDay(date);
  }

  onHistoryLazyLoad(event: TableLazyLoadEvent): void {
    this.first = event.first ?? 0;
    this.rows.set(event.rows ?? 10);
    this.fetchHistory();
  }

  goBack(): void {
    this.location.back();
  }

  private loadDay(date: string | undefined): void {
    this.isLoading.set(true);
    this.attendanceService
      .getEmployeeDay(this.employeeId, date)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: (err: unknown) => console.error('Error loading employee attendance:', err),
      });
  }

  private fetchHistory(): void {
    const requestId = ++this.historyRequestId;
    this.isLoadingHistory.set(true);

    this.attendanceService
      .getEmployeeHistory(this.employeeId, {
        page: Math.floor(this.first / this.rows()) + 1,
        limit: this.rows(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoadingHistory.set(false)))
      .subscribe({
        next: (res) => {
          if (requestId !== this.historyRequestId) return;
          this.history.set(res.data);
          this.totalRecords.set(res.meta.total);
        },
        error: (err: unknown) => {
          if (requestId !== this.historyRequestId) return;
          console.error('Error loading employee history:', err);
          this.history.set([]);
          this.totalRecords.set(0);
        },
      });
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
}
