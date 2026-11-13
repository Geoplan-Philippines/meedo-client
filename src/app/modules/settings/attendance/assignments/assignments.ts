import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { MemberDirectoryService, OrgMember } from '../../../../core/members/member-directory.service';
import { AssignmentSource, EffectiveSchedule } from '../models/attendance.model';
import {
  attendanceSourceLabel,
  dateToYmd,
  formatHours,
  formatTime12h,
} from '../shared/attendance-settings.util';
import {
  EMPLOYEE_ASSIGNMENTS_LIST,
  EmployeeAssignmentRow,
  ScheduleAssignmentsService,
  TEAM_ASSIGNMENTS_LIST,
  TeamAssignmentRow,
} from '../services/schedule-assignments.service';
import { WeeklySchedulesService } from '../services/weekly-schedules.service';

import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { injectListState } from '../../../../shared/data/url-list-state';
import { pagedList } from '../../../../shared/data/paged-list';
import { pagedSearch } from '../../../../shared/data/paged-search';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageModule } from 'primeng/message';

interface ScheduleOption {
  label: string;
  value: string;
}

const SOURCE_LABELS: Record<AssignmentSource, string> = {
  employee: 'Personal override',
  team: 'From their team',
  'organization-default': 'Org default',
  none: 'No schedule',
};

@Component({
  selector: 'app-settings-assignments',
  imports: [
    MessageModule,
    PageLayout,
    ListPaginator,
    EmptyState,
    SkeletonModule,
    IconFieldModule,
    InputIconModule,
    RouterLink,
    FormsModule,
    ButtonModule,
    DatePickerModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './assignments.html',
  styleUrl: './assignments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Assignments {
  private readonly assignmentsService = inject(ScheduleAssignmentsService);
  private readonly schedulesService = inject(WeeklySchedulesService);
  private readonly directory = inject(MemberDirectoryService);

  /** Two lists on one page; each keeps its page and search in the URL under its own prefix. */
  readonly teamList = injectListState(TEAM_ASSIGNMENTS_LIST);
  readonly teams = pagedList({
    params: () => this.teamList.query(),
    load: (query) => this.assignmentsService.listTeams(query),
    refreshOn: ['attendance', 'teams'],
  });
  readonly employeeList = injectListState(EMPLOYEE_ASSIGNMENTS_LIST);
  readonly employees = pagedList({
    params: () => this.employeeList.query(),
    load: (query) => this.assignmentsService.listEmployees(query),
    refreshOn: ['attendance', 'members'],
  });

  private readonly schedulesResource = rxResource({ stream: () => this.schedulesService.options() });
  readonly schedules = computed(() => (this.schedulesResource.hasValue() ? this.schedulesResource.value() : []));

  readonly isLoading = computed(() => !this.teams.loaded() || !this.employees.loaded() || this.schedulesResource.isLoading());
  readonly loadFailed = computed(() => !!this.teams.error() || !!this.employees.error() || !!this.schedulesResource.error());
  /** Save failures; load failures come from the lists. */
  readonly error = signal<string | null>(null);

  /** Ids (teamId / userId) with an assignment request in flight. */
  private readonly savingIds = signal<Set<string>>(new Set());

  readonly scheduleOptions = computed<ScheduleOption[]>(() =>
    this.schedules()
      .filter((s) => s.isActive && !s.isArchived)
      .map((s) => ({ value: s.id, label: s.isDefault ? `${s.name} (default)` : s.name })),
  );

  readonly defaultSchedule = computed(() => this.schedules().find((s) => s.isDefault) ?? null);
  readonly assignedEmployeeCount = computed(() => this.employees.meta()?.assignedCount ?? 0);

  // Effective-schedule preview
  /** Employee picker for the preview, searched on the server. */
  readonly previewPeople = pagedSearch<OrgMember>({
    fetch: (query) => this.directory.list({ ...query, sortField: 'name', sortOrder: 'asc' }),
  });
  /** The chosen employee stays an option after the search text changes. */
  private readonly previewChoice = signal<ScheduleOption | null>(null);
  readonly previewOptions = computed(() => {
    const found = this.previewPeople.items().map((member) => ({ label: `${member.displayName} · ${member.user.email}`, value: member.userId }));
    const choice = this.previewChoice();
    return choice && !found.some((option) => option.value === choice.value) ? [choice, ...found] : found;
  });
  readonly previewUserId = signal<string | null>(null);

  selectPreviewUser(userId: string | null): void {
    this.previewUserId.set(userId);
    this.previewChoice.set(this.previewOptions().find((option) => option.value === userId) ?? null);
  }
  readonly previewDate = signal<Date>(new Date());
  readonly previewResult = signal<EffectiveSchedule | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);

  constructor() {
    this.teamList.clampToTotal(this.teams);
    this.employeeList.clampToTotal(this.employees);
  }

  load(): void {
    this.error.set(null);
    this.teams.reload();
    this.employees.reload();
    this.schedulesResource.reload();
  }

  onTeamSearch(event: Event): void {
    this.teamList.setSearch((event.target as HTMLInputElement).value);
  }

  onEmployeeSearch(event: Event): void {
    this.employeeList.setSearch((event.target as HTMLInputElement).value);
  }

  isSaving(id: string): boolean {
    return this.savingIds().has(id);
  }

  onTeamSchedule(row: TeamAssignmentRow, scheduleId: string | null): void {
    if (scheduleId === row.weeklyScheduleId || this.isSaving(row.id)) return;
    this.setSaving(row.id, true);
    this.error.set(null);
    const request$ = scheduleId
      ? this.assignmentsService.assignTeam(row.id, scheduleId)
      : this.assignmentsService.clearTeam(row.id);
    request$.subscribe({
      next: () => {
        this.teams.updateRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, weeklyScheduleId: scheduleId } : r)));
        this.setSaving(row.id, false);
      },
      error: () => {
        this.error.set(`Failed to update the schedule for "${row.name}". Please try again.`);
        this.setSaving(row.id, false);
        // Force the select back to the persisted value.
        this.teams.updateRows((rows) => [...rows]);
      },
    });
  }

  onEmployeeSchedule(row: EmployeeAssignmentRow, scheduleId: string | null): void {
    if (scheduleId === row.weeklyScheduleId || this.isSaving(row.userId)) return;
    this.setSaving(row.userId, true);
    this.error.set(null);
    const request$ = scheduleId
      ? this.assignmentsService.assignEmployee(row.userId, scheduleId)
      : this.assignmentsService.clearEmployee(row.userId);
    request$.subscribe({
      next: () => {
        this.employees.updateRows((rows) =>
          rows.map((r) => (r.userId === row.userId ? { ...r, weeklyScheduleId: scheduleId } : r)),
        );
        this.setSaving(row.userId, false);
      },
      error: () => {
        this.error.set(`Failed to update the schedule for "${row.name}". Please try again.`);
        this.setSaving(row.userId, false);
        this.employees.updateRows((rows) => [...rows]);
      },
    });
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

  runPreview(): void {
    const userId = this.previewUserId();
    if (!userId || this.previewLoading()) return;
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.previewResult.set(null);
    this.assignmentsService.getEffective(userId, dateToYmd(this.previewDate())).subscribe({
      next: (result) => {
        this.previewResult.set(result);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewLoading.set(false);
        this.previewError.set('Could not resolve the schedule. Please try again.');
      },
    });
  }

  sourceLabel(source: AssignmentSource): string {
    return SOURCE_LABELS[source];
  }

  modeLabel(source: EffectiveSchedule['expectedSource']): string {
    return attendanceSourceLabel(source);
  }

  time12h(hhmm: string): string {
    return formatTime12h(hhmm);
  }

  hours(value: number): string {
    return formatHours(value);
  }

  private setSaving(id: string, saving: boolean): void {
    this.savingIds.update((set) => {
      const next = new Set(set);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
