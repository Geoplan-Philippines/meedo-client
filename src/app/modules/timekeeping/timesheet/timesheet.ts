import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, Observable } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import {
  TimesheetEntry,
  TimesheetEntryPayload,
  TimesheetEntryStatus,
  TimesheetProject,
  TimesheetWorkType,
} from './models/timesheet.model';
import { TimesheetService } from './services/timesheet.service';

interface TimesheetGridCell {
  date: string;
  entryId?: string;
  hours: number | null;
  status: TimesheetEntryStatus;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  dirty: boolean;
}

interface TimesheetGridRow {
  localId: string;
  projectId: string | null;
  customerId: string | null;
  location: string;
  workType: TimesheetWorkType;
  task: string;
  isOvertime: boolean;
  isNightDifferential: boolean;
  projectDescription: string;
  targetDate?: string;
  cells: TimesheetGridCell[];
  dirty: boolean;
  isNew: boolean;
  saving: boolean;
}

interface TimesheetDayItem {
  row: TimesheetGridRow;
  cell: TimesheetGridCell;
}

interface TimesheetActivityItem {
  title: string;
  time: string;
  tone: 'success' | 'info' | 'warning';
}

interface TaskPopover {
  rowId: string;
  task: string;
  readonly: boolean;
}

const LOCATION_OPTIONS = [
  { label: 'OFC - DW', value: 'OFC - DW', workType: 'OFFICE_DIRECT_WORK' as TimesheetWorkType },
  { label: 'WFH', value: 'WFH', workType: 'WFH' as TimesheetWorkType },
  { label: 'FIELD', value: 'FIELD', workType: 'FIELD' as TimesheetWorkType },
  { label: 'LEAVE', value: 'LEAVE', workType: 'LEAVE' as TimesheetWorkType },
  { label: 'HOLIDAY', value: 'HOLIDAY', workType: 'HOLIDAY' as TimesheetWorkType },
  { label: 'OFFSET', value: 'OFFSET', workType: 'OFFSET' as TimesheetWorkType },
];

@Component({
  selector: 'app-timesheet',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DatePickerModule,
    SelectModule,
    ToastModule,
    DatePipe,
  ],
  providers: [MessageService],
  templateUrl: './timesheet.html',
  styleUrl: './timesheet.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeunload)': 'beforeUnload($event)',
  },
})
export class Timesheet implements OnInit {
  private readonly timesheetService = inject(TimesheetService);
  private readonly messageService = inject(MessageService);

  readonly selectedDate = signal<Date>(new Date());
  readonly selectedWeek = computed(() => startOfWeek(this.selectedDate()));
  readonly rows = signal<TimesheetGridRow[]>([]);
  readonly projects = signal<TimesheetProject[]>([]);
  readonly isLoading = signal(false);
  readonly isSavingAll = signal(false);
  readonly isSubmitting = signal(false);
  readonly isLocked = signal(false);
  readonly lockMessage = signal<string | null>(null);
  readonly showHistoryDialog = signal(false);
  readonly collapsedDays = signal<Set<string>>(new Set());
  readonly taskPopover = signal<TaskPopover | null>(null);

  readonly locationOptions = LOCATION_OPTIONS;

  readonly weekDays = computed(() => {
    const start = this.selectedWeek();
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  });

  readonly weekDates = computed(() => this.weekDays().map((day) => toDateInputValue(day)));
  readonly periodStart = computed(() => this.weekDates()[0]);
  readonly periodEnd = computed(() => this.weekDates()[6]);

  readonly weekLabel = computed(() => {
    const [start, , , , , , end] = this.weekDays();
    return `${formatShortDate(start)} – ${formatShortDate(end)}`;
  });

  readonly totalHours = computed(() =>
    this.rows().reduce((total, row) => total + this.rowTotal(row), 0),
  );

  readonly regularHours = computed(() => this.sumHours((row) => !row.isOvertime && !row.isNightDifferential && !['LEAVE', 'HOLIDAY', 'OFFSET'].includes(row.workType)));
  readonly overtimeHours = computed(() => this.sumHours((row) => row.isOvertime));
  readonly leaveNightHours = computed(() => this.sumHours((row) => row.isNightDifferential || ['LEAVE', 'HOLIDAY'].includes(row.workType)));
  readonly offsetHours = computed(() => this.sumHours((row) => row.workType === 'OFFSET'));

  readonly unsavedCount = computed(() => this.rows().filter((row) => row.dirty || row.cells.some((cell) => cell.dirty)).length);

  readonly dailyTotals = computed(() => {
    const totals = new Map<string, number>();
    this.weekDates().forEach((date) => totals.set(date, 0));
    this.rows().forEach((row) => {
      row.cells.forEach((cell) => totals.set(cell.date, (totals.get(cell.date) ?? 0) + (Number(cell.hours) || 0)));
    });
    return totals;
  });

  readonly recentActivity = computed<TimesheetActivityItem[]>(() => {
    const activities = this.rows()
      .flatMap((row) => row.cells.map((cell) => ({ row, cell })))
      .filter(({ cell }) => cell.entryId && (cell.createdAt || cell.updatedAt))
      .sort((a, b) => new Date(b.cell.updatedAt ?? b.cell.createdAt ?? 0).getTime() - new Date(a.cell.updatedAt ?? a.cell.createdAt ?? 0).getTime())
      .slice(0, 4)
      .map(({ row, cell }) => ({
        title: `${formatStatusLabel(cell.status)} entry ${cell.status === 'DRAFT' ? 'saved' : 'updated'}`,
        time: `${formatShortDate(new Date(cell.updatedAt ?? cell.createdAt ?? Date.now()))} • ${projectNameFromList(this.projects(), row.projectId)}`,
        tone: cell.status === 'REJECTED' ? 'warning' as const : cell.status === 'APPROVED' ? 'success' as const : 'info' as const,
      }));

    return activities.length > 0
      ? activities
      : [{ title: 'No activity yet', time: 'Draft entries will appear here after saving.', tone: 'info' }];
  });

  readonly hasDraftRows = computed(() =>
    this.rows().some((row) => row.cells.some((cell) => cell.entryId && cell.status === 'DRAFT')),
  );

  readonly uniqueCustomers = computed(() => {
    const seen = new Set<string>();
    return this.projects()
      .filter((project) => {
        if (seen.has(project.customerName)) return false;
        seen.add(project.customerName);
        return true;
      })
      .map((project) => ({ label: project.customerName, value: project.customerName }));
  });

  ngOnInit(): void {
    this.loadWeek();
  }

  onWeekChange(date: Date | Date[] | null): void {
    const selected = Array.isArray(date) ? date[0] : date;
    if (!selected) return;
    if (!this.confirmDiscardChanges()) {
      this.selectedDate.set(new Date(this.selectedDate()));
      return;
    }
    this.selectedDate.set(selected);
    this.loadWeek();
  }

  loadWeek(): void {
    this.isLoading.set(true);
    this.lockMessage.set(null);

    forkJoin({
      entries: this.timesheetService.getEntries(this.periodStart(), this.periodEnd()),
      projects: this.timesheetService.getProjects(),
      lock: this.timesheetService.getPeriodLock(this.periodStart(), this.periodEnd()),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ entries, projects, lock }) => {
          this.projects.set(projects);
          this.rows.set(this.entriesToGridRows(entries.data));
          this.isLocked.set(lock.isLocked);
          this.lockMessage.set(lock.isLocked ? `This week was locked on ${formatShortDate(new Date(lock.lockedAt ?? Date.now()))}.` : null);
        },
        error: (err: unknown) => {
          console.error('Error loading timesheet:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load timesheet data' });
        },
      });
  }

  toggleDay(day: Date): void {
    const key = toDateInputValue(day);
    this.collapsedDays.update((set) => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isDayCollapsed(day: Date): boolean {
    return this.collapsedDays().has(toDateInputValue(day));
  }

  openTaskPopover(row: TimesheetGridRow): void {
    this.taskPopover.set({
      rowId: row.localId,
      task: row.task,
      readonly: this.isRowReadonly(row),
    });
  }

  closeTaskPopover(save = false): void {
    const popover = this.taskPopover();
    if (!popover) return;

    if (save && !popover.readonly) {
      const row = this.rows().find((r) => r.localId === popover.rowId);
      if (row) {
        row.task = popover.task;
        this.markDirty(row);
      }
    }

    this.taskPopover.set(null);
  }

  addRow(day: Date = this.weekDays()[0]): void {
    if (this.isLocked()) return;
    const row = this.createEmptyGridRow(true, toDateInputValue(day));
    this.rows.update((rows) => [...rows, row]);
  }

  workOrdersForRow(row: TimesheetGridRow): { label: string; value: string }[] {
    if (!row.customerId) return [];
    return this.projects()
      .filter((project) => project.customerName === row.customerId)
      .map((project) => ({ label: project.workOrderNumber, value: project.id }));
  }

  onRowCustomerChange(row: TimesheetGridRow, customerName: string): void {
    row.customerId = customerName;
    row.projectId = null;
    this.markDirty(row);
  }

  onRowWorkOrderChange(row: TimesheetGridRow, projectId: string): void {
    row.projectId = projectId;
    this.markDirty(row);
  }

  previousWeek(): void { this.changeWeekBy(-7); }
  nextWeek(): void     { this.changeWeekBy(7); }

  markDirty(row: TimesheetGridRow): void {
    if (this.isRowReadonly(row)) return;
    row.dirty = true;
    row.cells.forEach((cell) => {
      if (cell.entryId || Number(cell.hours) > 0) cell.dirty = true;
    });
    this.rows.update((rows) => [...rows]);
  }

  markCellDirty(row: TimesheetGridRow, cell: TimesheetGridCell): void {
    if (this.isCellReadonly(cell) || this.isRowReadonly(row)) return;
    row.dirty = true;
    cell.dirty = true;
    this.rows.update((rows) => [...rows]);
  }

  onLocationChange(row: TimesheetGridRow): void {
    const match = this.locationOptions.find((option) => option.value === row.location);
    row.workType = match?.workType ?? 'OFFICE_DIRECT_WORK';
    this.markDirty(row);
  }

  rowsForDay(day: Date): TimesheetDayItem[] {
    const date = toDateInputValue(day);
    return this.rows()
      .map((row) => ({ row, cell: row.cells.find((item) => item.date === date) }))
      .filter((item): item is TimesheetDayItem => !!item.cell && (item.cell.entryId !== undefined || Number(item.cell.hours) > 0 || item.row.targetDate === date));
  }

  statusLabel(status: TimesheetEntryStatus): string { return formatStatusLabel(status); }

  saveButtonLabel(): string {
    return this.unsavedCount() > 0 ? `Save Draft (${this.unsavedCount()})` : 'Save Draft';
  }

  deleteDayEntry(row: TimesheetGridRow, cell: TimesheetGridCell): void {
    if (this.isRowReadonly(row) || this.isCellReadonly(cell)) return;

    if (!cell.entryId) {
      cell.hours = null;
      cell.dirty = false;
      if (!row.cells.some((item) => item.entryId || Number(item.hours) > 0)) {
        this.rows.update((rows) => rows.filter((item) => item !== row));
      } else {
        this.rows.update((rows) => [...rows]);
      }
      return;
    }

    row.saving = true;
    this.rows.update((rows) => [...rows]);
    this.timesheetService.deleteEntry(cell.entryId)
      .pipe(finalize(() => {
        row.saving = false;
        this.rows.update((rows) => [...rows]);
      }))
      .subscribe({
        next: () => {
          cell.entryId = undefined;
          cell.hours = null;
          cell.dirty = false;
          if (!row.cells.some((item) => item.entryId || Number(item.hours) > 0)) {
            this.rows.update((rows) => rows.filter((item) => item !== row));
          }
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Draft entry deleted' });
          this.loadWeek();
        },
        error: (err: unknown) => {
          console.error('Error deleting entry:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to delete entry') });
        },
      });
  }

  saveRow(row: TimesheetGridRow): void {
    const operations = this.buildSaveOperations(row);
    if (!operations) return;

    if (operations.length === 0) {
      this.messageService.add({ severity: 'info', summary: 'No hours', detail: 'Enter hours for at least one day before saving.' });
      return;
    }

    row.saving = true;
    this.rows.update((rows) => [...rows]);

    forkJoin(operations)
      .pipe(finalize(() => {
        row.saving = false;
        this.rows.update((rows) => [...rows]);
      }))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Weekly row saved as draft' });
          this.loadWeek();
        },
        error: (err: unknown) => {
          console.error('Error saving row:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to save row') });
        },
      });
  }

  saveAllDrafts(): void {
    const editableRows = this.rows().filter((row) => (row.dirty || row.cells.some((cell) => cell.dirty)) && !this.isRowReadonly(row));
    if (editableRows.length === 0) return;

    const operations: Observable<unknown>[] = [];
    for (const row of editableRows) {
      const rowOperations = this.buildSaveOperations(row, false);
      if (!rowOperations) return;
      operations.push(...rowOperations);
    }

    if (operations.length === 0) {
      this.messageService.add({ severity: 'info', summary: 'No hours', detail: 'Enter hours for at least one day before saving.' });
      return;
    }

    this.isSavingAll.set(true);
    forkJoin(operations)
      .pipe(finalize(() => this.isSavingAll.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'All draft rows saved' });
          this.loadWeek();
        },
        error: (err: unknown) => {
          console.error('Error saving drafts:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to save all drafts') });
        },
      });
  }

  submitWeek(): void {
    if (this.hasUnsavedChanges()) {
      this.messageService.add({ severity: 'warn', summary: 'Save drafts first', detail: 'Please save all draft changes before submitting.' });
      return;
    }
    if (!this.hasDraftRows()) {
      this.messageService.add({ severity: 'info', summary: 'Nothing to submit', detail: 'There are no draft rows for this week.' });
      return;
    }

    this.isSubmitting.set(true);
    this.timesheetService.submitWeek(this.periodStart(), this.periodEnd())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (result) => {
          this.messageService.add({ severity: 'success', summary: 'Submitted', detail: `${result.submittedCount} row(s) submitted for approval` });
          this.loadWeek();
        },
        error: (err: unknown) => {
          console.error('Error submitting week:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to submit week') });
        },
      });
  }

  isRowReadonly(row: TimesheetGridRow): boolean {
    return this.isLocked() || row.saving || row.cells.some((cell) => cell.entryId && cell.status !== 'DRAFT');
  }

  isCellReadonly(cell: TimesheetGridCell): boolean {
    return this.isLocked() || (!!cell.entryId && cell.status !== 'DRAFT');
  }

  statusClass(status: TimesheetEntryStatus): string {
    return `status-badge status-badge--${status.toLowerCase()}`;
  }

  rowTotal(row: TimesheetGridRow): number {
    return row.cells.reduce((total, cell) => total + (Number(cell.hours) || 0), 0);
  }

  totalForDay(day: Date): number {
    return this.dailyTotals().get(toDateInputValue(day)) ?? 0;
  }

  hasRowChanges(row: TimesheetGridRow): boolean {
    return row.dirty || row.cells.some((cell) => cell.dirty);
  }

  hasUnsavedChanges(): boolean {
    return this.rows().some((row) => this.hasRowChanges(row));
  }

  confirmDiscardChanges(): boolean {
    if (!this.hasUnsavedChanges()) return true;
    return window.confirm('You have unsaved timesheet changes. Discard them and leave this week?');
  }

  beforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  private changeWeekBy(days: number): void {
    if (!this.confirmDiscardChanges()) return;
    this.selectedDate.set(addDays(this.selectedDate(), days));
    this.loadWeek();
  }

  private sumHours(predicate: (row: TimesheetGridRow) => boolean): number {
    return this.rows().reduce((total, row) => {
      if (!predicate(row)) return total;
      return total + this.rowTotal(row);
    }, 0);
  }

  private buildSaveOperations(row: TimesheetGridRow, showValidation = true): Observable<unknown>[] | null {
    const error = this.validateRow(row);
    if (error) {
      if (showValidation) this.messageService.add({ severity: 'warn', summary: 'Check row', detail: error });
      else this.messageService.add({ severity: 'warn', summary: 'Check rows', detail: error });
      return null;
    }

    const operations: Observable<unknown>[] = [];
    for (const cell of row.cells) {
      if (this.isCellReadonly(cell)) continue;
      if (!cell.dirty && !row.dirty) continue;
      const hours = Number(cell.hours) || 0;
      if (cell.entryId && hours <= 0) operations.push(this.timesheetService.deleteEntry(cell.entryId));
      else if (cell.entryId && hours > 0) operations.push(this.timesheetService.updateEntry(cell.entryId, this.rowToPayload(row, cell)));
      else if (!cell.entryId && hours > 0) operations.push(this.timesheetService.createEntry(this.rowToPayload(row, cell)));
    }
    return operations;
  }

  private validateRow(row: TimesheetGridRow): string | null {
    const activeCells = row.cells.filter((cell) => Number(cell.hours) > 0 || cell.entryId);
    if (activeCells.length === 0) return null;
    if (!row.projectId) return 'Please select a project and work order.';
    if (!row.task.trim()) return 'Task description is required.';

    for (const cell of activeCells) {
      const hours = Number(cell.hours) || 0;
      if (hours < 0 || hours > 24) return 'Hours must be between 0 and 24 per day.';
      const otherTotal = this.rows()
        .flatMap((item) => item.cells.map((itemCell) => ({ row: item, cell: itemCell })))
        .filter(({ row: itemRow, cell: itemCell }) => itemRow !== row && itemCell.date === cell.date)
        .reduce((total, item) => total + (Number(item.cell.hours) || 0), 0);
      if (otherTotal + hours > 24) return 'Total hours for one day cannot exceed 24.';
    }
    return null;
  }

  private entriesToGridRows(entries: TimesheetEntry[]): TimesheetGridRow[] {
    const groups = new Map<string, TimesheetGridRow>();

    entries.forEach((entry) => {
      const date = entry.workDate.slice(0, 10);
      const key = [
        entry.projectId,
        entry.location,
        entry.workType,
        entry.task,
        entry.projectDescription ?? '',
        entry.isOvertime ? 'OT' : 'REG',
        entry.isNightDifferential ? 'ND' : 'DAY',
        entry.status,
      ].join('|');

      if (!groups.has(key)) {
        groups.set(key, {
          localId: entry.id,
          projectId: entry.projectId,
          customerId: entry.project?.customerName ?? null,
          location: entry.location,
          workType: entry.workType,
          task: entry.task,
          isOvertime: entry.isOvertime,
          isNightDifferential: entry.isNightDifferential,
          projectDescription: entry.projectDescription ?? '',
          cells: this.emptyCells(),
          dirty: false,
          isNew: false,
          saving: false,
        });
      }

      const row = groups.get(key)!;
      const cell = row.cells.find((item) => item.date === date);
      if (cell) {
        cell.entryId = entry.id;
        cell.hours = entry.hours;
        cell.status = entry.status;
        cell.rejectionReason = entry.rejectionReason;
        cell.createdAt = entry.createdAt;
        cell.updatedAt = entry.updatedAt;
        cell.dirty = false;
      }
    });

    return [...groups.values()];
  }

  private createEmptyGridRow(isNew: boolean, targetDate?: string): TimesheetGridRow {
    return {
      localId: crypto.randomUUID?.() ?? `row-${Date.now()}-${Math.random()}`,
      projectId: null,
      customerId: null,
      location: 'OFC - DW',
      workType: 'OFFICE_DIRECT_WORK',
      task: '',
      isOvertime: false,
      isNightDifferential: false,
      projectDescription: '',
      targetDate,
      cells: this.emptyCells(),
      dirty: isNew,
      isNew,
      saving: false,
    };
  }

  private emptyCells(): TimesheetGridCell[] {
    return this.weekDates().map((date) => ({
      date,
      hours: null,
      status: 'DRAFT' as TimesheetEntryStatus,
      dirty: false,
    }));
  }

  private rowToPayload(row: TimesheetGridRow, cell: TimesheetGridCell): TimesheetEntryPayload {
    return {
      projectId: row.projectId!,
      workDate: cell.date,
      hours: Number(cell.hours),
      location: row.location,
      workType: row.workType,
      task: row.task.trim(),
      projectDescription: row.projectDescription.trim() || null,
      isOvertime: row.isOvertime,
      isNightDifferential: row.isNightDifferential,
    };
  }
}

export const pendingTimesheetChangesGuard: CanDeactivateFn<Timesheet> = (component) => component.confirmDiscardChanges();

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

function formatStatusLabel(status: TimesheetEntryStatus): string {
  switch (status) {
    case 'SUBMITTED': return 'Pending';
    case 'APPROVED': return 'Approved';
    case 'REJECTED': return 'Rejected';
    default: return 'Draft';
  }
}

function projectNameFromList(projects: TimesheetProject[], projectId: string | null): string {
  return projects.find((project) => project.id === projectId)?.customerName ?? 'Timesheet';
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const maybe = err as { error?: { message?: string | string[] } };
  const message = maybe.error?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}
