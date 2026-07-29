import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../../core/auth/auth.service';
import { TeamsService } from '../../teams/services/teams.service';
import { UserService } from '../../users/services/user.service';
import {
  AssignmentSource,
  EffectiveSchedule,
  WeeklySchedule,
} from '../models/attendance.model';
import {
  attendanceSourceLabel,
  dateToYmd,
  formatHours,
  formatTime12h,
} from '../shared/attendance-settings.util';
import { ScheduleAssignmentsService } from '../services/schedule-assignments.service';
import { WeeklySchedulesService } from '../services/weekly-schedules.service';

interface TeamRow {
  id: string;
  name: string;
  scheduleId: string | null;
}

interface EmployeeRow {
  userId: string;
  name: string;
  email: string;
  scheduleId: string | null;
}

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
export class Assignments implements OnInit {
  private readonly assignmentsService = inject(ScheduleAssignmentsService);
  private readonly schedulesService = inject(WeeklySchedulesService);
  private readonly teamsService = inject(TeamsService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);

  readonly teamRows = signal<TeamRow[]>([]);
  readonly employeeRows = signal<EmployeeRow[]>([]);
  readonly schedules = signal<WeeklySchedule[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  /** Ids (teamId / userId) with an assignment request in flight. */
  private readonly savingIds = signal<Set<string>>(new Set());

  readonly scheduleOptions = computed<ScheduleOption[]>(() =>
    this.schedules()
      .filter((s) => s.isActive && !s.isArchived)
      .map((s) => ({ value: s.id, label: s.isDefault ? `${s.name} (default)` : s.name })),
  );

  readonly defaultSchedule = computed(() => this.schedules().find((s) => s.isDefault) ?? null);

  readonly assignedEmployeeCount = computed(
    () => this.employeeRows().filter((row) => row.scheduleId).length,
  );

  // Effective-schedule preview
  readonly previewUserId = signal<string | null>(null);
  readonly previewDate = signal<Date>(new Date());
  readonly previewResult = signal<EffectiveSchedule | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);

  readonly employeeSelectOptions = computed(() =>
    this.employeeRows().map((row) => ({ label: `${row.name} · ${row.email}`, value: row.userId })),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const organizationId = this.authService.organizationId();
    if (!organizationId) {
      this.error.set('No active organization. Please sign in again.');
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    forkJoin({
      assignments: this.assignmentsService.list(),
      schedules: this.schedulesService.list(),
      teams: this.teamsService.getTeams(organizationId),
      members: this.userService.getUsers(organizationId),
    }).subscribe({
      next: ({ assignments, schedules, teams, members }) => {
        this.schedules.set(schedules);

        const teamScheduleByTeam = new Map(
          assignments.teams.map((a) => [a.teamId, a.weeklyScheduleId]),
        );
        this.teamRows.set(
          teams
            .filter((team) => !team.isArchived)
            .map((team) => ({
              id: team.id,
              name: team.name,
              scheduleId: teamScheduleByTeam.get(team.id) ?? null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );

        const employeeScheduleByUser = new Map(
          assignments.employees.map((a) => [a.userId, a.weeklyScheduleId]),
        );
        this.employeeRows.set(
          members
            .map((member) => ({
              userId: member.userId,
              name: member.user.name ?? member.user.email,
              email: member.user.email,
              scheduleId: employeeScheduleByUser.get(member.userId) ?? null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );

        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('Failed to load assignments. Please try again.');
      },
    });
  }

  isSaving(id: string): boolean {
    return this.savingIds().has(id);
  }

  scheduleName(id: string | null): string | null {
    if (!id) return null;
    const schedule = this.schedules().find((s) => s.id === id);
    return schedule ? (schedule.isDefault ? `${schedule.name} (default)` : schedule.name) : null;
  }

  onTeamSchedule(row: TeamRow, scheduleId: string | null): void {
    if (scheduleId === row.scheduleId || this.isSaving(row.id)) return;
    this.setSaving(row.id, true);
    this.error.set(null);
    const request$ = scheduleId
      ? this.assignmentsService.assignTeam(row.id, scheduleId)
      : this.assignmentsService.clearTeam(row.id);
    request$.subscribe({
      next: () => {
        this.teamRows.update((rows) =>
          rows.map((r) => (r.id === row.id ? { ...r, scheduleId } : r)),
        );
        this.setSaving(row.id, false);
      },
      error: () => {
        this.error.set(`Failed to update the schedule for "${row.name}". Please try again.`);
        this.setSaving(row.id, false);
        // Force the select back to the persisted value.
        this.teamRows.update((rows) => [...rows]);
      },
    });
  }

  onEmployeeSchedule(row: EmployeeRow, scheduleId: string | null): void {
    if (scheduleId === row.scheduleId || this.isSaving(row.userId)) return;
    this.setSaving(row.userId, true);
    this.error.set(null);
    const request$ = scheduleId
      ? this.assignmentsService.assignEmployee(row.userId, scheduleId)
      : this.assignmentsService.clearEmployee(row.userId);
    request$.subscribe({
      next: () => {
        this.employeeRows.update((rows) =>
          rows.map((r) => (r.userId === row.userId ? { ...r, scheduleId } : r)),
        );
        this.setSaving(row.userId, false);
      },
      error: () => {
        this.error.set(`Failed to update the schedule for "${row.name}". Please try again.`);
        this.setSaving(row.userId, false);
        this.employeeRows.update((rows) => [...rows]);
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
