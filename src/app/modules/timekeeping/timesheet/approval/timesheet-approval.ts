import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  TimesheetAuditLog,
  TimesheetEntry,
  TimesheetPeriodLock,
  TimesheetProject,
  TimesheetSummary,
  TimesheetSummaryEmployee,
} from '../models/timesheet.model';
import { TimesheetService } from '../services/timesheet.service';

@Component({
  selector: 'app-timesheet-approval',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DatePickerModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [MessageService],
  templateUrl: './timesheet-approval.html',
  styleUrl: './timesheet-approval.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetApproval implements OnInit {
  private readonly timesheetService = inject(TimesheetService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  private readonly approvalTable = viewChild<Table>('approvalTable');

  readonly selectedDate = signal<Date>(new Date());
  readonly selectedWeek = computed(() => startOfWeek(this.selectedDate()));
  readonly summary = signal<TimesheetSummary | null>(null);
  readonly periodLock = signal<TimesheetPeriodLock | null>(null);
  readonly auditLogs = signal<TimesheetAuditLog[]>([]);
  readonly projects = signal<TimesheetProject[]>([]);

  readonly selectedEntryIds = signal<Set<string>>(new Set());
  readonly selectedEmployee = signal<TimesheetSummaryEmployee | null>(null);
  readonly activeTab = signal<'SUBMITTED' | 'APPROVED' | 'REJECTED' | null>(null);
  readonly taskPreviewContent = signal<string | null>(null);

  readonly isLoading = signal(false);
  readonly isApproving = signal(false);
  readonly isRejecting = signal(false);
  readonly isExporting = signal(false);
  readonly isLocking = signal(false);
  readonly isUnlocking = signal(false);
  readonly showRejectDialog = signal(false);
  readonly showUnlockDialog = signal(false);
  readonly rejectReason = signal('');
  readonly unlockReason = signal('');

  readonly employeeFilter = signal('');
  readonly projectFilter = signal<string | null>(null);

  readonly periodStart = computed(() => toDateInputValue(this.selectedWeek()));
  readonly periodEnd = computed(() => toDateInputValue(addDays(this.selectedWeek(), 6)));
  readonly weekLabel = computed(() => `${formatShortDate(this.selectedWeek())} – ${formatShortDate(addDays(this.selectedWeek(), 6))}`);

  readonly employees = computed(() => this.summary()?.employees ?? []);
  readonly selectedCount = computed(() => this.selectedEntryIds().size);
  readonly isPeriodLocked = computed(() => this.periodLock()?.isLocked ?? this.summary()?.isLocked ?? false);

  readonly weekDays = computed(() => {
    const start = this.selectedWeek();
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  });

  readonly filteredEmployees = computed(() => {
    let list = this.employees();

    const search = this.employeeFilter().toLowerCase().trim();
    if (search) {
      list = list.filter(e =>
        e.employeeName.toLowerCase().includes(search) ||
        e.employeeEmail.toLowerCase().includes(search) ||
        (e.department ?? '').toLowerCase().includes(search),
      );
    }

    const tab = this.activeTab();
    if (tab === 'SUBMITTED') {
      list = list.filter(e => e.entries.some(en => en.status === 'SUBMITTED'));
    } else if (tab === 'APPROVED') {
      list = list.filter(e => e.status === 'APPROVED');
    } else if (tab === 'REJECTED') {
      list = list.filter(e => e.entries.some(en => en.status === 'REJECTED'));
    }

    return list;
  });

  readonly tabCounts = computed(() => {
    const list = this.employees();
    return {
      all: list.length,
      submitted: list.filter(e => e.entries.some(en => en.status === 'SUBMITTED')).length,
      approved: list.filter(e => e.status === 'APPROVED').length,
      rejected: list.filter(e => e.entries.some(en => en.status === 'REJECTED')).length,
    };
  });

  readonly totalOvertimeHours = computed(() =>
    this.employees().reduce((sum, e) => sum + e.overtimeHours, 0),
  );

  readonly submittedEntryIds = computed(() =>
    this.employees().flatMap(e => e.entries)
      .filter(e => isActionable(e.status))
      .map(e => e.id),
  );

  ngOnInit(): void {
    this.loadData();
  }

  onWeekChange(date: Date | Date[] | null): void {
    const selected = Array.isArray(date) ? date[0] : date;
    if (!selected) return;
    this.selectedDate.set(selected);
    this.loadData();
  }

  previousWeek(): void { this.changeWeekBy(-7); }
  nextWeek(): void     { this.changeWeekBy(7); }

  private changeWeekBy(days: number): void {
    this.selectedDate.set(addDays(this.selectedDate(), days));
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.selectedEntryIds.set(new Set());

    forkJoin({
      summary: this.timesheetService.getSummary(this.currentFilters()),
      projects: this.timesheetService.getProjects(),
      lock: this.timesheetService.getPeriodLock(this.periodStart(), this.periodEnd()),
      auditLogs: this.timesheetService.getAuditLogs(1, 8, this.periodStart(), this.periodEnd()),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ summary, projects, lock, auditLogs }) => {
          this.summary.set(summary);
          this.projects.set(projects);
          this.periodLock.set(lock);
          this.auditLogs.set(auditLogs.data);

          const selected = this.selectedEmployee();
          if (selected) {
            const refreshed = summary.employees?.find(e => e.userId === selected.userId) ?? null;
            this.selectedEmployee.set(refreshed);
          }
        },
        error: (err: unknown) => {
          console.error('Error loading timesheet approval:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to load approval summary') });
        },
      });
  }

  applyFilters(): void {
    this.loadData();
  }

  clearFilters(): void {
    this.employeeFilter.set('');
    this.projectFilter.set(null);
    this.loadData();
  }

  setActiveTab(tab: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | null): void {
    this.activeTab.set(tab);
    this.resetPage();
  }

  onEmployeeFilterChange(value: string): void {
    this.employeeFilter.set(value);
    this.resetPage();
  }

  /** Snap the client-side paginator back to the first page after the row set changes. */
  private resetPage(): void {
    const table = this.approvalTable();
    if (table) table.first = 0;
  }

  selectEmployee(employee: TimesheetSummaryEmployee): void {
    this.selectedEmployee.set(employee);
  }

  closePanel(): void {
    this.selectedEmployee.set(null);
  }

  openTaskPreview(entry: TimesheetEntry): void {
    this.taskPreviewContent.set(entry.task);
  }

  closeTaskPreview(): void {
    this.taskPreviewContent.set(null);
  }

  toggleEntry(entry: TimesheetEntry, checked: boolean): void {
    if (!isActionable(entry.status)) return;
    this.selectedEntryIds.update(ids => {
      const next = new Set(ids);
      checked ? next.add(entry.id) : next.delete(entry.id);
      return next;
    });
  }

  isSelected(entry: TimesheetEntry): boolean {
    return this.selectedEntryIds().has(entry.id);
  }

  toggleAllSubmitted(checked: boolean): void {
    this.selectedEntryIds.set(checked ? new Set(this.submittedEntryIds()) : new Set());
  }

  employeeAllSubmittedSelected(employee: TimesheetSummaryEmployee): boolean {
    const ids = employee.entries.filter(e => isActionable(e.status)).map(e => e.id);
    if (ids.length === 0) return false;
    return ids.every(id => this.selectedEntryIds().has(id));
  }

  employeeSomeSubmittedSelected(employee: TimesheetSummaryEmployee): boolean {
    const ids = employee.entries.filter(e => isActionable(e.status)).map(e => e.id);
    return ids.length > 0 && ids.some(id => this.selectedEntryIds().has(id)) && !this.employeeAllSubmittedSelected(employee);
  }

  toggleEmployeeSubmitted(employee: TimesheetSummaryEmployee, checked: boolean): void {
    const ids = employee.entries.filter(e => isActionable(e.status)).map(e => e.id);
    this.selectedEntryIds.update(set => {
      const next = new Set(set);
      ids.forEach(id => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  approveSelected(): void {
    const entryIds = [...this.selectedEntryIds()];
    if (entryIds.length === 0) return;

    this.isApproving.set(true);
    this.timesheetService.bulkApprove(entryIds)
      .pipe(finalize(() => this.isApproving.set(false)))
      .subscribe({
        next: result => {
          this.messageService.add({ severity: 'success', summary: 'Approved', detail: `${result.approvedCount} row(s) approved` });
          this.loadData();
        },
        error: (err: unknown) => {
          console.error('Error approving entries:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to approve selected rows') });
        },
      });
  }

  approveEmployee(employee: TimesheetSummaryEmployee): void {
    const entryIds = employee.entries.filter(e => isActionable(e.status)).map(e => e.id);
    if (entryIds.length === 0) return;
    this.selectedEntryIds.set(new Set(entryIds));
    this.approveSelected();
  }

  rejectEmployee(employee: TimesheetSummaryEmployee): void {
    const entryIds = employee.entries.filter(e => isActionable(e.status)).map(e => e.id);
    if (entryIds.length === 0) return;
    this.selectedEntryIds.set(new Set(entryIds));
    this.openRejectDialog();
  }

  hasSubmittedEntries(employee: TimesheetSummaryEmployee): boolean {
    return employee.entries.some(e => isActionable(e.status));
  }

  openRejectDialog(): void {
    if (this.selectedCount() === 0) return;
    this.rejectReason.set('');
    this.showRejectDialog.set(true);
  }

  cancelReject(): void {
    this.showRejectDialog.set(false);
    this.rejectReason.set('');
  }

  rejectSelected(): void {
    const reason = this.rejectReason().trim();
    if (!reason) {
      this.messageService.add({ severity: 'warn', summary: 'Reason required', detail: 'Please enter a rejection reason.' });
      return;
    }

    const entryIds = [...this.selectedEntryIds()];
    this.isRejecting.set(true);
    this.timesheetService.bulkReject(entryIds, reason)
      .pipe(finalize(() => this.isRejecting.set(false)))
      .subscribe({
        next: result => {
          this.messageService.add({ severity: 'success', summary: 'Rejected', detail: `${result.rejectedCount} row(s) rejected` });
          this.cancelReject();
          this.loadData();
        },
        error: (err: unknown) => {
          console.error('Error rejecting entries:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to reject selected rows') });
        },
      });
  }

  exportWorkbook(): void {
    this.isExporting.set(true);
    this.timesheetService.exportTimesheet(this.currentFilters())
      .pipe(finalize(() => this.isExporting.set(false)))
      .subscribe({
        next: response => {
          const blob = response.body;
          if (!blob) return;
          const filename = filenameFromDisposition(response.headers.get('content-disposition'))
            ?? `timesheet-${this.periodStart()}-to-${this.periodEnd()}.xlsx`;
          downloadBlob(blob, filename);
          this.messageService.add({ severity: 'success', summary: 'Export ready', detail: 'Timesheet workbook downloaded' });
        },
        error: (err: unknown) => {
          console.error('Error exporting timesheet:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to export workbook') });
        },
      });
  }

  lockPeriod(): void {
    if (this.isPeriodLocked()) return;
    const pendingCount = (this.summary()?.totalsByStatus?.['SUBMITTED'] ?? 0) + (this.summary()?.totalsByStatus?.['REJECTED'] ?? 0);
    const confirmed = pendingCount === 0 || window.confirm(`This week still has ${pendingCount} submitted/rejected row(s). Lock it anyway?`);
    if (!confirmed) return;

    this.isLocking.set(true);
    this.timesheetService.lockPeriod(this.periodStart(), this.periodEnd())
      .pipe(finalize(() => this.isLocking.set(false)))
      .subscribe({
        next: lock => {
          this.periodLock.set(lock);
          this.messageService.add({ severity: 'success', summary: 'Week locked', detail: 'No further changes allowed for this week.' });
          this.loadData();
        },
        error: (err: unknown) => {
          console.error('Error locking period:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to lock week') });
        },
      });
  }

  openUnlockDialog(): void {
    if (!this.isPeriodLocked()) return;
    this.unlockReason.set('');
    this.showUnlockDialog.set(true);
  }

  cancelUnlock(): void {
    this.showUnlockDialog.set(false);
    this.unlockReason.set('');
  }

  unlockPeriod(): void {
    const reason = this.unlockReason().trim();
    if (!reason) {
      this.messageService.add({ severity: 'warn', summary: 'Reason required', detail: 'Please enter an unlock reason.' });
      return;
    }

    this.isUnlocking.set(true);
    this.timesheetService.unlockPeriod(this.periodStart(), this.periodEnd(), reason)
      .pipe(finalize(() => this.isUnlocking.set(false)))
      .subscribe({
        next: lock => {
          this.periodLock.set(lock);
          this.cancelUnlock();
          this.messageService.add({ severity: 'success', summary: 'Week unlocked', detail: 'The week can be edited again.' });
          this.loadData();
        },
        error: (err: unknown) => {
          console.error('Error unlocking period:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to unlock week') });
        },
      });
  }

  statusClass(status: string): string {
    return `status-badge status-badge--${status.toLowerCase()}`;
  }

  employeeSubmittedCount(employee: TimesheetSummaryEmployee): number {
    return employee.entries.filter(e => isActionable(e.status)).length;
  }

  employeeLeaveAndNightHours(employee: TimesheetSummaryEmployee): number {
    const nightDifferentialHours = employee.entries
      .filter(e => e.isNightDifferential)
      .reduce((sum, e) => sum + e.hours, 0);
    return employee.leaveHours + nightDifferentialHours;
  }

  projectLabel(entry: TimesheetEntry): string {
    if (!entry.project) return '—';
    const customer = entry.project.customerName?.trim() || entry.project.client?.customerName?.trim();
    const workOrder = entry.project.workOrderNumber?.trim() || '';
    return customer ? `${customer} — ${workOrder}` : (workOrder || '—');
  }

  approvedBy(entry: TimesheetEntry): string {
    return entry.approvedBy?.user?.name || entry.approvedBy?.user?.email || '—';
  }

  personLabel(person: { user?: { name?: string | null; email: string } } | null | undefined): string {
    return person?.user?.name || person?.user?.email || '';
  }

  navigateToReview(event: Event, employee: TimesheetSummaryEmployee): void {
    event.stopPropagation();
    this.router.navigate(
      ['/timekeeping/timesheet/approval/review'],
      {
        queryParams: {
          userId: employee.userId,
          periodStart: this.periodStart(),
          periodEnd: this.periodEnd(),
        },
        state: { employee },
      },
    );
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  dayLabel(date: Date): string {
    return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date);
  }

  employeeDayHours(employee: TimesheetSummaryEmployee, date: Date): number {
    const key = toDateInputValue(date);
    return employee.dailyTotals?.[key] ?? 0;
  }

  private currentFilters() {
    return {
      periodStart: this.periodStart(),
      periodEnd: this.periodEnd(),
      projectId: this.projectFilter() ?? undefined,
    };
  }
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/** Entries a manager can act on: not-yet-decided drafts and submitted rows. */
function isActionable(status: string): boolean {
  return status === 'DRAFT' || status === 'SUBMITTED';
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const maybe = err as { error?: { message?: string | string[] } };
  const message = maybe.error?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

function filenameFromDisposition(disposition: string | null): string | null {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
