import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

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

interface EntryModalState {
  localId: string;
  entryId?: string;
  date: string;
  projectId: string;
  hours: number | null;
  workType: TimesheetWorkType;
  task: string;
  isOvertime: boolean;
  isNightDifferential: boolean;
  status: TimesheetEntryStatus;
  rejectionReason?: string | null;
  isNew: boolean;
  readonly: boolean;
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
    DatePipe,
    RichTextEditor,
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
  readonly entryModal = signal<EntryModalState | null>(null);
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

  entryForCell(projectId: string, day: Date): TimesheetDayEntry | undefined {
    const date = toDateInputValue(day);
    return this.entries().find((entry) => entry.projectId === projectId && entry.date === date);
  }

  cellLabel(entry: TimesheetDayEntry | undefined): string {
    const hours = Number(entry?.hours) || 0;
    return hours > 0 ? `${trimNumber(hours)} hr` : '------';
  }

  cellStatusClass(entry: TimesheetDayEntry | undefined): string {
    return entry?.status ? `grid-cell--status-${entry.status.toLowerCase()}` : '';
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
    const existing = this.entryForCell(projectId, day);
    if (existing) {
      this.openEditEntryModal(existing);
      return;
    }

    if (this.isLocked()) return;
    this.entrySaveAttempted.set(false);
    this.entryModal.set({
      localId: crypto.randomUUID?.() ?? `entry-${Date.now()}-${Math.random()}`,
      date: toDateInputValue(day),
      projectId,
      hours: null,
      workType: 'REGULAR',
      task: '',
      isOvertime: false,
      isNightDifferential: false,
      status: 'DRAFT',
      isNew: true,
      readonly: false,
    });
  }

  openEditEntryModal(entry: TimesheetDayEntry): void {
    if (!entry.projectId) return;
    this.entrySaveAttempted.set(false);
    this.entryModal.set({
      localId: entry.localId,
      entryId: entry.entryId,
      date: entry.date,
      projectId: entry.projectId,
      hours: entry.hours,
      workType: entry.workType,
      task: entry.task,
      isOvertime: entry.isOvertime,
      isNightDifferential: entry.isNightDifferential,
      status: entry.status,
      rejectionReason: entry.rejectionReason,
      isNew: false,
      readonly: this.isEntryReadonly(entry),
    });
  }

  onEntryWorkTypeChange(value: TimesheetWorkType): void {
    this.patchEntryModal({ workType: value });
  }

  patchEntryModal(patch: Partial<EntryModalState>): void {
    this.entryModal.update((modal) => modal && { ...modal, ...patch });
  }

  entryHoursError(): string | null {
    const modal = this.entryModal();
    if (!modal) return null;

    const raw = modal.hours;
    if (raw === null || raw === undefined || `${raw}`.trim() === '') {
      return this.entrySaveAttempted() ? 'Hours is required.' : null;
    }

    const hours = Number(raw);
    if (Number.isNaN(hours)) return 'Enter a valid number of hours.';
    if (hours < 1) return 'Hours must be at least 1.';
    if (hours > 9) return 'Hours cannot exceed 9.';
    return null;
  }

  entryHoursInvalid(): boolean {
    return !!this.entryHoursError();
  }

  entryTaskInvalid(): boolean {
    const modal = this.entryModal();
    return !!modal && this.entrySaveAttempted() && !stripHtml(modal.task);
  }

  closeEntryModal(save: boolean): void {
    const modal = this.entryModal();
    if (!modal) return;

    if (!save || modal.readonly) {
      this.entryModal.set(null);
      return;
    }

    if (this.entryHoursError() || !stripHtml(modal.task)) {
      this.entrySaveAttempted.set(true);
      return;
    }

    const validationError = this.validateModalEntry(modal);
    if (validationError) {
      this.messageService.add({ severity: 'warn', summary: 'Check entry', detail: validationError });
      return;
    }

    const payload = this.modalToPayload(modal);
    const operation = modal.entryId
      ? this.timesheetService.updateEntry(modal.entryId, payload)
      : this.timesheetService.createEntry(payload);

    this.entryModal.set(null);
    this.isSavingEntry.set(true);
    operation.pipe(finalize(() => this.isSavingEntry.set(false))).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Entry saved. You can keep editing until the week is locked.' });
        this.loadWeek();
      },
      error: (err: unknown) => {
        console.error('Error saving entry:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: apiErrorMessage(err, 'Failed to save entry') });
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

  private validateModalEntry(modal: EntryModalState): string | null {
    const hours = Number(modal.hours) || 0;
    if (hours < 1 || hours > 9) return 'Hours must be between 1 and 9.';

    const otherTotal = this.entries()
      .filter((item) => item.localId !== modal.localId && item.date === modal.date)
      .reduce((total, item) => total + (Number(item.hours) || 0), 0);
    if (otherTotal + hours > 24) return 'Total hours for one day cannot exceed 24.';
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

  private modalToPayload(modal: EntryModalState): TimesheetEntryPayload {
    return {
      projectId: modal.projectId,
      workDate: modal.date,
      hours: Number(modal.hours),
      workType: modal.workType,
      location: locationForWorkType(modal.workType),
      task: modal.task.trim(),
      isOvertime: modal.isOvertime,
      isNightDifferential: modal.isNightDifferential,
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
