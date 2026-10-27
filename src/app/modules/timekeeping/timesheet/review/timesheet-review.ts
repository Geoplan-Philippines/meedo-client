import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  TimesheetAuditLog,
  TimesheetEntry,
  TimesheetPeriodLock,
  TimesheetSummaryEmployee,
} from '../models/timesheet.model';
import { TimesheetService } from '../services/timesheet.service';
import { timesheetProjectName } from '../shared/timesheet-project.util';

@Component({
  selector: 'app-timesheet-review',
  imports: [CommonModule, FormsModule, ButtonModule, TextareaModule, ToastModule, TooltipModule],
  providers: [MessageService],
  templateUrl: './timesheet-review.html',
  styleUrl: './timesheet-review.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetReview implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly timesheetService = inject(TimesheetService);
  private readonly messageService = inject(MessageService);

  readonly isLoading = signal(false);
  readonly isApproving = signal(false);
  readonly isRejecting = signal(false);
  readonly showRejectDialog = signal(false);
  readonly showHistoryDialog = signal(false);
  readonly rejectMode = signal<'reject' | 'changes'>('reject');
  readonly rejectReason = signal('');
  readonly rejectTargetIds = signal<string[]>([]);
  readonly approvingEntryIds = signal<Set<string>>(new Set());

  readonly employee = signal<TimesheetSummaryEmployee | null>(null);
  readonly periodLock = signal<TimesheetPeriodLock | null>(null);
  readonly auditLogs = signal<TimesheetAuditLog[]>([]);

  readonly userId = signal('');
  readonly periodStart = signal('');
  readonly periodEnd = signal('');

  readonly expandedDates = signal<Set<string>>(new Set());
  readonly taskPreviewContent = signal<string | null>(null);

  readonly isPeriodLocked = computed(() => this.periodLock()?.isLocked ?? false);

  readonly weekLabel = computed(() => {
    const ps = this.periodStart();
    const pe = this.periodEnd();
    if (!ps || !pe) return '';
    return `${formatShortDate(new Date(ps + 'T00:00:00'))} – ${formatShortDate(new Date(pe + 'T00:00:00'))}`;
  });

  readonly dayGroups = computed(() => {
    const emp = this.employee();
    if (!emp) return [];

    const map = new Map<string, TimesheetEntry[]>();
    for (const entry of emp.entries) {
      const key = entry.workDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entries]) => ({ date, entries }));
  });

  readonly allExpanded = computed(() => {
    const total = this.dayGroups().length;
    return total > 0 && this.expandedDates().size >= total;
  });

  readonly submittedEntryIds = computed(() =>
    this.employee()?.entries.filter(e => isActionable(e.status)).map(e => e.id) ?? [],
  );

  readonly hasSubmittedEntries = computed(() => this.submittedEntryIds().length > 0);

  readonly pendingHours = computed(() =>
    this.employee()?.entries.filter(e => isActionable(e.status)).reduce((s, e) => s + e.hours, 0) ?? 0,
  );

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const userId = params.get('userId') ?? '';
    const periodStart = params.get('periodStart') ?? '';
    const periodEnd = params.get('periodEnd') ?? '';

    if (!userId || !periodStart || !periodEnd) {
      this.router.navigate(['/timekeeping/timesheet/approval']);
      return;
    }

    this.userId.set(userId);
    this.periodStart.set(periodStart);
    this.periodEnd.set(periodEnd);

    // Use router state for instant render when navigating from approval list
    const state = history.state as { employee?: TimesheetSummaryEmployee };
    if (state?.employee && state.employee.userId === userId) {
      this.employee.set(state.employee);
      this.expandAll();
    }

    this.loadData();
  }

  loadData(): void {
    const periodStart = this.periodStart();
    const periodEnd = this.periodEnd();
    const userId = this.userId();

    this.isLoading.set(true);

    forkJoin({
      summary: this.timesheetService.getSummary({ periodStart, periodEnd }),
      lock: this.timesheetService.getPeriodLock(periodStart, periodEnd),
      auditLogs: this.timesheetService.getAuditLogs(1, 20, periodStart, periodEnd),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ summary, lock, auditLogs }) => {
          const emp = summary.employees?.find(e => e.userId === userId) ?? null;
          this.employee.set(emp);
          this.periodLock.set(lock);
          this.auditLogs.set(auditLogs.data);

          if (emp && this.expandedDates().size === 0) {
            this.expandAll();
          }
        },
        error: (err: unknown) => {
          console.error('Error loading review:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to load timesheet review') });
        },
      });
  }

  toggleDate(date: string): void {
    this.expandedDates.update(dates => {
      const next = new Set(dates);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  isDateExpanded(date: string): boolean {
    return this.expandedDates().has(date);
  }

  expandAll(): void {
    this.expandedDates.set(new Set(this.dayGroups().map(g => g.date)));
  }

  openTaskPreview(entry: TimesheetEntry): void {
    this.taskPreviewContent.set(entry.task);
  }

  closeTaskPreview(): void {
    this.taskPreviewContent.set(null);
  }

  collapseAll(): void {
    this.expandedDates.set(new Set());
  }

  approveTimesheet(): void {
    const entryIds = this.submittedEntryIds();
    if (entryIds.length === 0) return;

    this.isApproving.set(true);
    this.timesheetService.bulkApprove(entryIds)
      .pipe(finalize(() => this.isApproving.set(false)))
      .subscribe({
        next: result => {
          this.messageService.add({ severity: 'success', summary: 'Approved', detail: `${result.approvedCount} entry/entries approved` });
          this.loadData();
        },
        error: (err: unknown) => {
          console.error('Error approving:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to approve timesheet') });
        },
      });
  }

  isEntryApproving(entry: TimesheetEntry): boolean {
    return this.approvingEntryIds().has(entry.id);
  }

  isEntryActionable(entry: TimesheetEntry): boolean {
    return isActionable(entry.status);
  }

  approveEntry(entry: TimesheetEntry): void {
    if (!isActionable(entry.status)) return;

    this.approvingEntryIds.update(ids => new Set(ids).add(entry.id));
    this.timesheetService.bulkApprove([entry.id])
      .pipe(finalize(() => this.approvingEntryIds.update(ids => {
        const next = new Set(ids);
        next.delete(entry.id);
        return next;
      })))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Approved', detail: 'Entry approved' });
          this.loadData();
        },
        error: (err: unknown) => {
          console.error('Error approving entry:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to approve entry') });
        },
      });
  }

  rejectEntry(entry: TimesheetEntry): void {
    if (!isActionable(entry.status)) return;
    this.openRejectDialog('reject', [entry.id]);
  }

  openRejectDialog(mode: 'reject' | 'changes' = 'reject', entryIds?: string[]): void {
    this.rejectMode.set(mode);
    this.rejectReason.set('');
    this.rejectTargetIds.set(entryIds ?? this.submittedEntryIds());
    this.showRejectDialog.set(true);
  }

  cancelReject(): void {
    this.showRejectDialog.set(false);
    this.rejectReason.set('');
  }

  confirmReject(): void {
    const reason = this.rejectReason().trim();
    if (!reason) {
      this.messageService.add({ severity: 'warn', summary: 'Required', detail: 'Please enter a reason.' });
      return;
    }

    const entryIds = this.rejectTargetIds();
    this.isRejecting.set(true);
    this.timesheetService.bulkReject(entryIds, reason)
      .pipe(finalize(() => this.isRejecting.set(false)))
      .subscribe({
        next: result => {
          this.messageService.add({ severity: 'success', summary: 'Done', detail: `${result.rejectedCount} entry/entries returned` });
          this.cancelReject();
          this.loadData();
        },
        error: (err: unknown) => {
          console.error('Error rejecting:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to process request') });
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/timekeeping/timesheet/approval'], {
      queryParams: {
        periodStart: this.periodStart(),
        periodEnd: this.periodEnd(),
      },
    });
  }

  groupTotal(entries: TimesheetEntry[]): number {
    return entries.reduce((s, e) => s + e.hours, 0);
  }

  formatDayHeader(dateStr: string): string {
    return new Intl.DateTimeFormat('en', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr + 'T00:00:00'));
  }

  statusClass(status: string): string {
    return `status-badge status-badge--${status.toLowerCase()}`;
  }

  projectLabel(entry: TimesheetEntry): string {
    return timesheetProjectName(entry.project) || '—';
  }

  workOrderLabel(entry: TimesheetEntry): string {
    return entry.project?.workOrderNumber ?? '—';
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  auditLabel(log: TimesheetAuditLog): string {
    return log.action.replace(/_/g, ' ').toLowerCase();
  }

  actorName(log: TimesheetAuditLog): string {
    return log.actor?.user?.name || log.actor?.user?.email || 'System';
  }

  dialogTitle(): string {
    return this.rejectMode() === 'changes' ? 'Request Changes' : 'Reject Timesheet';
  }

  dialogBody(): string {
    return this.rejectMode() === 'changes'
      ? 'Describe what needs to be corrected. The employee will see this note.'
      : 'Enter the reason the employee will see for the rejected entries.';
  }

  dialogConfirmLabel(): string {
    return this.rejectMode() === 'changes' ? 'Send Request' : 'Reject Entries';
  }
}

/** Entries a manager can act on: not-yet-decided drafts and submitted rows. */
function isActionable(status: string): boolean {
  return status === 'DRAFT' || status === 'SUBMITTED';
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const maybe = err as { error?: { message?: string | string[] } };
  const message = maybe.error?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}
