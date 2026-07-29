import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { RichTextEditor } from '../../../shared/ui/rich-text-editor';
import {
  TimesheetEntry,
  TimesheetEntryPayload,
  TimesheetEntryStatus,
  TimesheetProject,
  TimesheetWorkType,
} from './models/timesheet.model';
import { TimesheetService } from './services/timesheet.service';

interface TimesheetDayEntry {
  localId: string;
  entryId?: string;
  date: string;
  projectId: string | null;
  hours: number | null;
  workType: TimesheetWorkType;
  location: string;
  task: string;
  isOvertime: boolean;
  isNightDifferential: boolean;
  status: TimesheetEntryStatus;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  dirty: boolean;
  saving: boolean;
}

interface TimesheetActivityItem {
  title: string;
  time: string;
  tone: 'success' | 'info' | 'warning';
}

interface CellRowState {
  localId: string;
  entryId?: string;
  hours: number | null;
  workType: TimesheetWorkType;
  task: string;
  isOvertime: boolean;
  isNightDifferential: boolean;
  status: TimesheetEntryStatus;
  rejectionReason?: string | null;
  readonly: boolean;
}

interface CellModalState {
  projectId: string;
  date: string;
  rows: CellRowState[];
  pendingDeleteIds: string[];
  readonly: boolean;
}

const STATUS_PRECEDENCE: Record<TimesheetEntryStatus, number> = {
  REJECTED: 3,
  SUBMITTED: 2,
  APPROVED: 1,
  DRAFT: 0,
};

function rollupStatus(statuses: TimesheetEntryStatus[]): TimesheetEntryStatus {
  return statuses.reduce((worst, status) => (STATUS_PRECEDENCE[status] > STATUS_PRECEDENCE[worst] ? status : worst), 'DRAFT' as TimesheetEntryStatus);
}

interface AddProjectModalState {
  projectId: string | null;
}

const WORK_TYPE_OPTIONS: { label: string; value: TimesheetWorkType }[] = [
  { label: 'RG - Regular', value: 'REGULAR' },
  { label: 'RD - Rest Day', value: 'REST_DAY' },
  { label: 'LVE - Leave', value: 'LEAVE' },
  { label: 'Offset', value: 'OFFSET' },
];

const LOCATION_BY_WORK_TYPE: Record<TimesheetWorkType, string> = {
  REGULAR: 'OFC - DW',
  REST_DAY: 'RD',
  LEAVE: 'LVE',
  OFFSET: 'OFC - DW',
};

function locationForWorkType(workType: TimesheetWorkType): string {
  return LOCATION_BY_WORK_TYPE[workType];
}

function stripHtml(value: string): string {
  if (!value) return '';
  const container = document.createElement('div');
  container.innerHTML = value;
  return container.textContent?.trim() ?? '';
}

@Component({
  selector: 'app-timesheet',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DatePickerModule,
    SelectModule,
    ToastModule,
    ConfirmDialogModule,
    DatePipe,
    RichTextEditor,
  ],
  providers: [MessageService, ConfirmationService],
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
  private readonly confirmationService = inject(ConfirmationService);

  readonly selectedDate = signal<Date>(new Date());
  readonly selectedWeek = computed(() => startOfWeek(this.selectedDate()));
  readonly entries = signal<TimesheetDayEntry[]>([]);
  readonly projects = signal<TimesheetProject[]>([]);
  readonly isLoading = signal(false);
  readonly isRemovingProject = signal(false);
  readonly isSavingEntry = signal(false);
  readonly isSubmittingWeek = signal(false);
  readonly isLocked = signal(false);
  readonly lockMessage = signal<string | null>(null);
  readonly showHistoryDialog = signal(false);
  readonly addedProjectIds = signal<Set<string>>(new Set());
  readonly cellModal = signal<CellModalState | null>(null);
  readonly entrySaveAttempted = signal(false);
  readonly addProjectModal = signal<AddProjectModalState | null>(null);

  readonly workTypeOptions = WORK_TYPE_OPTIONS;

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

  readonly totalHours = computed(() => this.sumAllHours(() => true));
  readonly regularHours = computed(() => this.sumAllHours((entry) => !entry.isOvertime && !entry.isNightDifferential && !['LEAVE', 'OFFSET'].includes(entry.workType)));
  readonly overtimeHours = computed(() => this.sumAllHours((entry) => entry.isOvertime));
  readonly leaveNightHours = computed(() => this.sumAllHours((entry) => entry.isNightDifferential || entry.workType === 'LEAVE'));
  readonly offsetHours = computed(() => this.sumAllHours((entry) => entry.workType === 'OFFSET'));

  readonly dailyTotals = computed(() => {
    const totals = new Map<string, number>();
    this.weekDates().forEach((date) => totals.set(date, 0));
    this.entries().forEach((entry) => totals.set(entry.date, (totals.get(entry.date) ?? 0) + (Number(entry.hours) || 0)));
    return totals;
  });

  readonly recentActivity = computed<TimesheetActivityItem[]>(() => {
    const activities = this.entries()
      .filter((entry) => entry.entryId && (entry.createdAt || entry.updatedAt))
      .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())
      .slice(0, 4)
      .map((entry) => ({
        title: `${formatStatusLabel(entry.status)} entry ${entry.status === 'DRAFT' ? 'saved' : 'updated'}`,
        time: `${formatShortDate(new Date(entry.updatedAt ?? entry.createdAt ?? Date.now()))} • ${projectNameFromList(this.projects(), entry.projectId)}`,
        tone: entry.status === 'REJECTED' ? 'warning' as const : entry.status === 'APPROVED' ? 'success' as const : 'info' as const,
      }));

    return activities.length > 0
      ? activities
      : [{ title: 'No activity yet', time: 'Draft entries will appear here after saving.', tone: 'info' }];
  });

  readonly projectOptions = computed(() =>
    this.projects().map((project) => ({ label: formatProjectLabel(project), value: project.id })),
  );

  readonly tableProjectIds = computed(() => {
    const ids = new Set<string>();
    this.entries().forEach((entry) => { if (entry.projectId) ids.add(entry.projectId); });
    this.addedProjectIds().forEach((id) => ids.add(id));
    return [...ids];
  });

  readonly hasSubmittableEntries = computed(() => this.entries().some((entry) => entry.status === 'DRAFT'));
  readonly draftCount = computed(() => this.entries().filter((entry) => entry.status === 'DRAFT').length);

  private readonly todayKey = toDateInputValue(new Date());

  ngOnInit(): void {
    this.loadWeek();
  }

  isToday(day: Date): boolean {
    return toDateInputValue(day) === this.todayKey;
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
          this.entries.set(this.entriesToDayEntries(entries.data));
          this.isLocked.set(lock.isLocked);
          this.lockMessage.set(lock.isLocked ? `This week was locked on ${formatShortDate(new Date(lock.lockedAt ?? Date.now()))}.` : null);
          this.addedProjectIds.set(new Set());
        },
        error: (err: unknown) => {
          console.error('Error loading timesheet:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load timesheet data' });
        },
      });
  }

  totalForDay(day: Date): number {
    return this.dailyTotals().get(toDateInputValue(day)) ?? 0;
  }

  projectName(projectId: string | null): string {
    return this.projects().find((project) => project.id === projectId)?.customerName ?? 'Unknown project';
  }

  projectWorkOrder(projectId: string | null): string {
    return this.projects().find((project) => project.id === projectId)?.workOrderNumber ?? '';
  }

  entriesForCell(projectId: string, day: Date): TimesheetDayEntry[] {
    const date = toDateInputValue(day);
    return this.entries().filter((entry) => entry.projectId === projectId && entry.date === date);
  }

  cellHoursTotal(entries: TimesheetDayEntry[]): number {
    return entries.reduce((total, entry) => total + (Number(entry.hours) || 0), 0);
  }

  rowsHoursTotal(rows: CellRowState[]): number {
    return rows.reduce((total, row) => total + (Number(row.hours) || 0), 0);
  }

  cellStatus(entries: TimesheetDayEntry[]): TimesheetEntryStatus {
    return rollupStatus(entries.map((entry) => entry.status));
  }

  cellStatusClass(entries: TimesheetDayEntry[]): string {
    return entries.length > 0 ? `grid-cell--status-${this.cellStatus(entries).toLowerCase()}` : '';
  }

  formatHours(hours: number | null): string {
    return trimNumber(Number(hours) || 0);
  }

  isEntryReadonly(entry: TimesheetDayEntry): boolean {
    // Draft, rejected, and submitted (pending) entries stay editable; approved or locked entries are read-only.
    return this.isLocked() || entry.status === 'APPROVED';
  }

  statusBadgeClass(status: TimesheetEntryStatus): string {
    switch (status) {
      case 'SUBMITTED': return 'status-badge status-badge--submitted';
      case 'APPROVED': return 'status-badge status-badge--approved';
      case 'REJECTED': return 'status-badge status-badge--rejected';
      default: return 'status-badge status-badge--draft';
    }
  }

  statusBadgeLabel(status: TimesheetEntryStatus): string {
    return formatStatusLabel(status);
  }

  openAddProjectModal(): void {
    this.addProjectModal.set({ projectId: null });
  }

  closeAddProjectModal(): void {
    this.addProjectModal.set(null);
  }

  onAddProjectChange(projectId: string): void {
    this.addProjectModal.set({ projectId });
  }

  confirmAddProject(): void {
    if (this.isLocked()) return;
    const modal = this.addProjectModal();
    if (!modal?.projectId) return;

    if (this.tableProjectIds().includes(modal.projectId)) {
      this.messageService.add({ severity: 'info', summary: 'Already added', detail: 'This project is already on your timesheet.' });
      return;
    }

    this.addedProjectIds.update((ids) => new Set(ids).add(modal.projectId!));
    this.addProjectModal.set(null);
  }

  confirmRemoveProject(projectId: string): void {
    if (this.isLocked() || this.isRemovingProject()) return;

    // No logged hours yet — nothing to lose, so skip the warning and remove the empty row.
    const hasLoggedEntries = this.entries().some((entry) => entry.projectId === projectId && entry.entryId);
    if (!hasLoggedEntries) {
      this.removeProjectRow(projectId);
      return;
    }

    const name = this.projectName(projectId);
    this.confirmationService.confirm({
      header: 'Remove project?',
      message: `All logged hours for "${name}" this week will be permanently deleted. This can't be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', text: true },
      accept: () => this.removeProjectRow(projectId),
    });
  }

  removeProjectRow(projectId: string): void {
    if (this.isLocked()) return;
    const entryIds = this.entries()
      .filter((entry) => entry.projectId === projectId && entry.entryId)
      .map((entry) => entry.entryId!);

    if (entryIds.length === 0) {
      this.addedProjectIds.update((ids) => {
        const next = new Set(ids);
        next.delete(projectId);
        return next;
      });
      return;
    }

    this.isRemovingProject.set(true);
    forkJoin(entryIds.map((id) => this.timesheetService.deleteEntry(id)))
      .pipe(finalize(() => this.isRemovingProject.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Removed', detail: 'Project removed from timesheet' });
          this.loadWeek();
        },
        error: (err: unknown) => {
          console.error('Error removing project:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to remove project') });
        },
      });
  }

  openEntryCellModal(projectId: string, day: Date): void {
    const date = toDateInputValue(day);
    const existing = this.entriesForCell(projectId, day);
    const locked = this.isLocked();

    if (existing.length === 0 && locked) return;

    this.entrySaveAttempted.set(false);
    const rows = existing.length > 0 ? existing.map((entry) => this.entryToRow(entry)) : [this.blankRow()];

    this.cellModal.set({ projectId, date, rows, pendingDeleteIds: [], readonly: locked });
  }

  addModalRow(): void {
    this.cellModal.update((modal) => (modal && !modal.readonly ? { ...modal, rows: [...modal.rows, this.blankRow()] } : modal));
  }

  removeModalRow(localId: string): void {
    this.cellModal.update((modal) => {
      if (!modal || modal.readonly) return modal;
      const row = modal.rows.find((item) => item.localId === localId);
      if (!row || row.readonly) return modal;

      return {
        ...modal,
        rows: modal.rows.filter((item) => item.localId !== localId),
        pendingDeleteIds: row.entryId ? [...modal.pendingDeleteIds, row.entryId] : modal.pendingDeleteIds,
      };
    });
  }

  patchModalRow(localId: string, patch: Partial<CellRowState>): void {
    this.cellModal.update((modal) => modal && {
      ...modal,
      rows: modal.rows.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    });
  }

  onRowWorkTypeChange(localId: string, value: TimesheetWorkType): void {
    this.patchModalRow(localId, { workType: value });
  }

  rowHoursError(row: CellRowState): string | null {
    const raw = row.hours;
    if (raw === null || raw === undefined || `${raw}`.trim() === '') {
      return row.workType !== 'LEAVE' && this.entrySaveAttempted() ? 'Hours is required.' : null;
    }

    const hours = Number(raw);
    if (Number.isNaN(hours)) return 'Enter a valid number of hours.';
    if (row.workType === 'LEAVE') return null;
    if (hours < 1) return 'Hours must be at least 1.';
    if (hours > 9) return 'Hours cannot exceed 9.';
    return null;
  }

  rowHoursInvalid(row: CellRowState): boolean {
    return !!this.rowHoursError(row);
  }

  rowTaskInvalid(row: CellRowState): boolean {
    return this.entrySaveAttempted() && !stripHtml(row.task);
  }

  closeCellModal(save: boolean): void {
    const modal = this.cellModal();
    if (!modal) return;

    if (!save || modal.readonly) {
      this.cellModal.set(null);
      return;
    }

    const editableRows = modal.rows.filter((row) => !row.readonly);
    const hasInvalidRow = editableRows.some((row) => this.rowHoursError(row) || !stripHtml(row.task));
    if (hasInvalidRow) {
      this.entrySaveAttempted.set(true);
      return;
    }

    const validationError = this.validateModalRows(modal, editableRows);
    if (validationError) {
      this.messageService.add({ severity: 'warn', summary: 'Check entry', detail: validationError });
      return;
    }

    const deletes = modal.pendingDeleteIds.map((id) => this.timesheetService.deleteEntry(id));
    const saves = editableRows.map((row) => {
      const payload = this.rowToPayload(row, modal.projectId, modal.date);
      return row.entryId ? this.timesheetService.updateEntry(row.entryId, payload) : this.timesheetService.createEntry(payload);
    });

    if (deletes.length === 0 && saves.length === 0) {
      this.cellModal.set(null);
      return;
    }

    this.cellModal.set(null);
    this.isSavingEntry.set(true);
    forkJoin([...deletes, ...saves])
      .pipe(finalize(() => this.isSavingEntry.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Entries saved. You can keep editing until the week is locked.' });
          this.loadWeek();
        },
        error: (err: unknown) => {
          console.error('Error saving entries:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to save entries') });
          this.loadWeek();
        },
      });
  }

  submitWeek(): void {
    if (this.isLocked() || this.isSubmittingWeek()) return;

    this.isSubmittingWeek.set(true);
    this.timesheetService.submitWeek(this.periodStart(), this.periodEnd())
      .pipe(finalize(() => this.isSubmittingWeek.set(false)))
      .subscribe({
        next: (result) => {
          const count = result.submittedCount;
          this.messageService.add({ severity: 'success', summary: 'Submitted', detail: `${count} ${count === 1 ? 'entry' : 'entries'} submitted for approval.` });
          this.loadWeek();
        },
        error: (err: unknown) => {
          console.error('Error submitting week:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to submit week for approval.') });
        },
      });
  }

  hasUnsavedChanges(): boolean {
    return this.entries().some((entry) => entry.dirty);
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

  previousWeek(): void { this.changeWeekBy(-7); }
  nextWeek(): void     { this.changeWeekBy(7); }

  private changeWeekBy(days: number): void {
    if (!this.confirmDiscardChanges()) return;
    this.selectedDate.set(addDays(this.selectedDate(), days));
    this.loadWeek();
  }

  private sumAllHours(predicate: (entry: TimesheetDayEntry) => boolean): number {
    return this.entries().reduce((total, entry) => (predicate(entry) ? total + (Number(entry.hours) || 0) : total), 0);
  }

  private validateModalRows(modal: CellModalState, rows: CellRowState[]): string | null {
    for (const row of rows) {
      const hours = Number(row.hours) || 0;
      if (row.workType !== 'LEAVE' && (hours < 1 || hours > 9)) return 'Hours must be between 1 and 9.';
    }

    const otherEntries = this.entries().filter((entry) => entry.date === modal.date && entry.projectId !== modal.projectId);
    const otherTotal = otherEntries.reduce((total, entry) => total + (Number(entry.hours) || 0), 0);
    const otherRegularTotal = otherEntries
      .filter((entry) => !entry.isOvertime)
      .reduce((total, entry) => total + (Number(entry.hours) || 0), 0);

    const cellTotal = rows.reduce((total, row) => total + (Number(row.hours) || 0), 0);
    const cellRegularTotal = rows
      .filter((row) => !row.isOvertime)
      .reduce((total, row) => total + (Number(row.hours) || 0), 0);

    if (otherTotal + cellTotal > 24) return 'Total hours for one day cannot exceed 24.';
    if (otherRegularTotal + cellRegularTotal > 9) {
      return 'Regular hours across all projects cannot exceed 9 for one day. Mark the extra hours as overtime.';
    }

    return null;
  }

  private entriesToDayEntries(entries: TimesheetEntry[]): TimesheetDayEntry[] {
    return entries.map((entry) => ({
      localId: entry.id,
      entryId: entry.id,
      date: entry.workDate.slice(0, 10),
      projectId: entry.projectId,
      hours: entry.hours,
      workType: entry.workType,
      location: entry.location,
      task: entry.task,
      isOvertime: entry.isOvertime,
      isNightDifferential: entry.isNightDifferential,
      status: entry.status,
      rejectionReason: entry.rejectionReason,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      dirty: false,
      saving: false,
    }));
  }

  private rowToPayload(row: CellRowState, projectId: string, date: string): TimesheetEntryPayload {
    return {
      projectId,
      workDate: date,
      hours: Number(row.hours) || 0,
      workType: row.workType,
      location: locationForWorkType(row.workType),
      task: row.task.trim(),
      isOvertime: row.isOvertime,
      isNightDifferential: row.isNightDifferential,
    };
  }

  private entryToRow(entry: TimesheetDayEntry): CellRowState {
    return {
      localId: entry.localId,
      entryId: entry.entryId,
      hours: entry.hours,
      workType: entry.workType,
      task: entry.task,
      isOvertime: entry.isOvertime,
      isNightDifferential: entry.isNightDifferential,
      status: entry.status,
      rejectionReason: entry.rejectionReason,
      readonly: this.isEntryReadonly(entry),
    };
  }

  private blankRow(): CellRowState {
    return {
      localId: crypto.randomUUID?.() ?? `entry-${Date.now()}-${Math.random()}`,
      hours: null,
      workType: 'REGULAR',
      task: '',
      isOvertime: false,
      isNightDifferential: false,
      status: 'DRAFT',
      readonly: false,
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

function formatProjectLabel(project: TimesheetProject): string {
  const workOrder = project.workOrderNumber?.trim() || 'No Work Order';
  return `${project.customerName} — ${workOrder}`;
}

function trimNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const maybe = err as { error?: { message?: string | string[] } };
  const message = maybe.error?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}
