import { CommonModule, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  TimesheetAuditLog,
  TimesheetEntry,
  TimesheetPeriodLock,
  TimesheetProject,
  TimesheetSummaryEmployee,
  TimesheetSummaryTab,
} from '../models/timesheet.model';
import { TimesheetService } from '../services/timesheet.service';
import { TimesheetEntryForm } from '../entry-form/timesheet-entry-form';
import { manilaTodayKey } from '../entry-form/timesheet-entry-form';
import { TimesheetProjectPicker } from '../entry-form/timesheet-project-picker';
import { timesheetProjectLabel } from '../shared/timesheet-project.util';

import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { StatStrip, StatItem } from '../../../../shared/ui/stat-strip/stat-strip';
import { injectListState } from '../../../../shared/data/url-list-state';
import { pagedList } from '../../../../shared/data/paged-list';

/** Approvals: week, tab, search, project and page live in the URL. */
const APPROVALS_LIST = {
  pageSize: 25,
  filters: { week: null as string | null, tab: 'ALL', project: null as string | null },
};
const SUMMARY_TABS: readonly string[] = ['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED'];
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { BadgeModule } from 'primeng/badge';
@Component({
  selector: 'app-timesheet-approval',
  imports: [
    BadgeModule,
    PageLayout,
    ListPaginator,
    EmptyState,
    StatStrip,
    TagModule,
    TabsModule,
    IconFieldModule,
    InputIconModule,
    TitleCasePipe,
    CommonModule,
    TimesheetEntryForm,
    TimesheetProjectPicker,
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
export class TimesheetApproval {
  private readonly timesheetService = inject(TimesheetService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  readonly list = injectListState(APPROVALS_LIST);
  /** A date in the chosen week (from `?week=YYYY-MM-DD`, else today in Manila). */
  readonly selectedDate = computed(() => {
    const week = this.list.filters().week;
    return new Date((week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : manilaTodayKey()) + 'T12:00:00');
  });
  readonly selectedWeek = computed(() => startOfWeek(this.selectedDate()));
  readonly periodLock = signal<TimesheetPeriodLock | null>(null);
  readonly auditLogs = signal<TimesheetAuditLog[]>([]);
  /** Projects already seen in this week's entries, so the filter keeps its label. */
  readonly projects = computed<TimesheetProject[]>(() => {
    const seen = new Map<string, TimesheetProject>();
    for (const entry of this.employees().flatMap((employee) => employee.entries)) {
      if (entry.project) seen.set(entry.project.id, entry.project);
    }
    return [...seen.values()];
  });

  readonly selectedEntryIds = signal<Set<string>>(new Set());
  readonly selectedEmployee = signal<TimesheetSummaryEmployee | null>(null);
  readonly activeTab = computed<'SUBMITTED' | 'APPROVED' | 'REJECTED' | null>(() => {
    const tab = this.list.filters().tab;
    return tab === 'SUBMITTED' || tab === 'APPROVED' || tab === 'REJECTED' ? tab : null;
  });
  readonly editingEntry = signal<TimesheetEntry | null>(null);
  editEntry(entry: TimesheetEntry) { if (!this.isPeriodLocked() && entry.status === 'SUBMITTED') this.editingEntry.set(entry); }
  entrySaved() { this.editingEntry.set(null); this.loadData(); }
  readonly taskPreviewContent = signal<string | null>(null);

  readonly isLoading = computed(() => !this.summaryPage.loaded() || this.summaryPage.loading());
  readonly isApproving = signal(false);
  readonly isRejecting = signal(false);
  readonly isExporting = signal(false);
  readonly isLocking = signal(false);
  readonly isUnlocking = signal(false);
  readonly showRejectDialog = signal(false);
  readonly showUnlockDialog = signal(false);
  readonly rejectReason = signal('');
  readonly unlockReason = signal('');

  readonly employeeFilter = this.list.searchInput;
  readonly projectFilter = computed(() => this.list.filters().project);

  readonly periodStart = computed(() => toDateInputValue(this.selectedWeek()));
  readonly periodEnd = computed(() => toDateInputValue(addDays(this.selectedWeek(), 6)));
  readonly weekLabel = computed(() => `${formatShortDate(this.selectedWeek())} – ${formatShortDate(addDays(this.selectedWeek(), 6))}`);

  /** One page of employees for the week; tab, search and project are applied by the API. */
  readonly summaryPage = pagedList({
    params: () => ({
      periodStart: this.periodStart(),
      periodEnd: this.periodEnd(),
      page: this.list.page(),
      limit: this.list.pageSize(),
      search: this.list.search() || undefined,
      tab: (SUMMARY_TABS.includes(this.list.filters().tab) ? this.list.filters().tab : 'ALL') as TimesheetSummaryTab,
      projectId: this.list.filters().project ?? undefined,
    }),
    load: (query) => this.timesheetService.getSummaryPage(query),
    refreshOn: ['timesheet'],
  });
  readonly summary = this.summaryPage.meta;
  readonly employees = this.summaryPage.rows;
  readonly selectedCount = computed(() => this.selectedEntryIds().size);
  readonly isPeriodLocked = computed(() => this.periodLock()?.isLocked ?? this.summary()?.isLocked ?? false);

  readonly weekDays = computed(() => {
    const start = this.selectedWeek();
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  });

  readonly tabCounts = computed(() => this.summary()?.tabCounts ?? { all: 0, submitted: 0, approved: 0, rejected: 0 });

  readonly totalOvertimeHours = computed(() => this.summary()?.overtimeHours ?? 0);

  /** Headline numbers for the week. Zero shows as "no data", as before. */
  readonly weekStats = computed<StatItem[]>(() => {
    const summary = this.summary();
    const byStatus = summary?.totalsByStatus ?? {};
    const orNull = (value: number) => (value > 0 ? value : null);
    const hours = (value: number) => (value > 0 ? `${Math.round(value).toLocaleString('en-US')}h` : null);
    return [
      { label: 'Pending approvals', value: orNull((byStatus['SUBMITTED'] ?? 0) + (byStatus['DRAFT'] ?? 0)), tone: 'warning' },
      { label: 'Approved this week', value: orNull(byStatus['APPROVED'] ?? 0), tone: 'success' },
      { label: 'Rejected', value: orNull(byStatus['REJECTED'] ?? 0), tone: 'danger' },
      { label: 'Submitted hours', value: hours(summary?.totalHours ?? 0) },
      { label: 'Overtime hours', value: hours(this.totalOvertimeHours()) },
    ];
  });

  /** Actionable entries of the employees on this page ("select all" acts on the page). */
  readonly submittedEntryIds = computed(() =>
    this.employees().flatMap(e => e.entries)
      .filter(e => isActionable(e.status))
      .map(e => e.id),
  );

  constructor() {
    effect(() => {
      if (this.isPeriodLocked()) {
        this.selectedEntryIds.set(new Set());
        this.showRejectDialog.set(false);
      }
    });
    this.list.clampToTotal(this.summaryPage);

    // A new week (or a page of different employees) clears the selection and reloads the lock and history.
    effect(() => {
      const periodStart = this.periodStart();
      const periodEnd = this.periodEnd();
      untracked(() => this.loadWeekState(periodStart, periodEnd));
    });
    effect(() => {
      this.list.query();
      untracked(() => this.selectedEntryIds.set(new Set()));
    });
    // Keep the open details panel in step with the reloaded page.
    effect(() => {
      const rows = this.employees();
      untracked(() => {
        const selected = this.selectedEmployee();
        if (selected) this.selectedEmployee.set(rows.find(e => e.userId === selected.userId) ?? selected);
      });
    });
  }

  onWeekChange(date: Date | Date[] | null): void {
    const selected = Array.isArray(date) ? date[0] : date;
    if (!selected) return;
    this.list.setFilter('week', toDateInputValue(startOfWeek(selected)));
  }

  previousWeek(): void { this.changeWeekBy(-7); }
  nextWeek(): void     { this.changeWeekBy(7); }

  private changeWeekBy(days: number): void {
    this.list.setFilter('week', toDateInputValue(addDays(this.selectedWeek(), days)));
  }

  /** Reloads the page of employees and the week's lock and history. */
  loadData(): void {
    this.selectedEntryIds.set(new Set());
    this.summaryPage.reload();
    this.loadWeekState(this.periodStart(), this.periodEnd());
  }

  private loadWeekState(periodStart: string, periodEnd: string): void {
    forkJoin({
      lock: this.timesheetService.getPeriodLock(periodStart, periodEnd),
      auditLogs: this.timesheetService.getAuditLogs(1, 8, periodStart, periodEnd),
    }).subscribe({
      next: ({ lock, auditLogs }) => {
        this.periodLock.set(lock);
        this.auditLogs.set(auditLogs.data);
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
    this.list.clearFilters();
  }

  setActiveTab(tab: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | null): void {
    this.list.setFilter('tab', tab ?? 'ALL');
  }

  onEmployeeFilterChange(value: string): void {
    this.list.setSearch(value);
  }

  setProjectFilter(project: TimesheetProject | null): void {
    this.list.setFilter('project', project?.id ?? null);
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
    if (checked && this.isPeriodLocked()) return;
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
    this.selectedEntryIds.set(checked && !this.isPeriodLocked() ? new Set(this.submittedEntryIds()) : new Set());
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
    if (checked && this.isPeriodLocked()) return;
    const ids = employee.entries.filter(e => isActionable(e.status)).map(e => e.id);
    this.selectedEntryIds.update(set => {
      const next = new Set(set);
      ids.forEach(id => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  approveSelected(): void {
    if (this.isPeriodLocked()) return;
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
    if (this.isPeriodLocked()) return;
    const entryIds = employee.entries.filter(e => isActionable(e.status)).map(e => e.id);
    if (entryIds.length === 0) return;
    this.selectedEntryIds.set(new Set(entryIds));
    this.approveSelected();
  }

  rejectEmployee(employee: TimesheetSummaryEmployee): void {
    if (this.isPeriodLocked()) return;
    const entryIds = employee.entries.filter(e => isActionable(e.status)).map(e => e.id);
    if (entryIds.length === 0) return;
    this.selectedEntryIds.set(new Set(entryIds));
    this.openRejectDialog();
  }

  hasSubmittedEntries(employee: TimesheetSummaryEmployee): boolean {
    return employee.entries.some(e => isActionable(e.status));
  }

  openRejectDialog(): void {
    if (this.isPeriodLocked()) return;
    if (this.selectedCount() === 0) return;
    this.rejectReason.set('');
    this.showRejectDialog.set(true);
  }

  cancelReject(): void {
    this.showRejectDialog.set(false);
    this.rejectReason.set('');
  }

  rejectSelected(): void {
    if (this.isPeriodLocked()) return;
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

  statusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status.toUpperCase()) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      case 'SUBMITTED':
      case 'PENDING': return 'info';
      default: return 'secondary';
    }
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
    return timesheetProjectLabel(entry.project);
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
