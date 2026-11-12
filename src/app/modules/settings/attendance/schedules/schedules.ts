import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import {
  CreateWeeklySchedulePayload,
  DayOfWeek,
  WeeklySchedule,
} from '../models/attendance.model';

type DialogMode = 'create' | 'edit';
import { WEEK_ORDER, dayLabelShort } from '../shared/attendance-settings.util';
import { WeeklySchedulesService } from '../services/weekly-schedules.service';

import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ClientPager } from '../../../../shared/utils/client-pager';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
interface DayDot {
  day: DayOfWeek;
  short: string;
  working: boolean;
  color: string | null;
}

@Component({
  selector: 'app-settings-schedules',
  imports: [
    MessageModule,
    PageLayout,
    ListPaginator,
    EmptyState,
    SkeletonModule,
    TagModule,
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ToggleSwitchModule,
    TooltipModule,
  ],
  templateUrl: './schedules.html',
  styleUrl: './schedules.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Schedules implements OnInit {
  private readonly schedulesService = inject(WeeklySchedulesService);

  readonly schedules = signal<WeeklySchedule[]>([]);
  readonly pager = new ClientPager(this.schedules);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isDialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('create');
  readonly editingSchedule = signal<WeeklySchedule | null>(null);
  readonly isSaving = signal(false);
  readonly settingDefaultId = signal<string | null>(null);

  readonly scheduleToDelete = signal<WeeklySchedule | null>(null);
  readonly isDeleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    isDefault: new FormControl(false, { nonNullable: true }),
  });

  readonly nameLength = computed(() => this.nameValue()?.length ?? 0);
  private readonly nameValue = toSignal(this.form.controls.name.valueChanges, { initialValue: '' });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.schedulesService.list().subscribe({
      next: (data) => {
        this.schedules.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load schedules. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  /** One dot per weekday: filled with the shift color when it's a working day. */
  dayDots(schedule: WeeklySchedule): DayDot[] {
    return WEEK_ORDER.map((day) => {
      const entry = schedule.days.find((d) => d.dayOfWeek === day);
      return {
        day,
        short: dayLabelShort(day),
        working: !!entry?.isWorkingDay,
        color: entry?.shift?.color ?? null,
      };
    });
  }

  workingCount(schedule: WeeklySchedule): number {
    return schedule.days.filter((d) => d.isWorkingDay).length;
  }

  isConfigured(schedule: WeeklySchedule): boolean {
    return schedule.days.length > 0;
  }

  /** Teams/employees pointing at a schedule block its deletion. */
  inUseCount(schedule: WeeklySchedule): number {
    const counts = schedule._count;
    return counts ? counts.teamAssignments + counts.employeeAssignments : 0;
  }

  openCreate(): void {
    this.dialogMode.set('create');
    this.editingSchedule.set(null);
    this.form.reset({ name: '', isDefault: false });
    this.isDialogOpen.set(true);
  }

  openEdit(schedule: WeeklySchedule): void {
    this.dialogMode.set('edit');
    this.editingSchedule.set(schedule);
    this.form.reset({ name: schedule.name, isDefault: schedule.isDefault });
    this.isDialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.isSaving()) return;
    this.isDialogOpen.set(false);
  }

  save(): void {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const name = value.name.trim();
    this.isSaving.set(true);
    this.error.set(null);

    if (this.dialogMode() === 'edit') {
      const editing = this.editingSchedule();
      if (!editing) {
        this.isSaving.set(false);
        return;
      }
      this.schedulesService.update(editing.id, { name }).subscribe({
        next: (updated) => {
          // `update` doesn't return days/_count; keep the existing ones, swap the name.
          this.schedules.update((list) =>
            list.map((s) => (s.id === updated.id ? { ...s, name: updated.name } : s)),
          );
          this.isSaving.set(false);
          this.isDialogOpen.set(false);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.error.set(this.extractMessage(err) ?? 'Failed to rename schedule. Please try again.');
        },
      });
      return;
    }

    const payload: CreateWeeklySchedulePayload = { name, isDefault: value.isDefault };
    this.schedulesService.create(payload).subscribe({
      next: (created) => {
        // A new default demotes the previous one server-side; refresh to stay truthful.
        if (created.isDefault) {
          this.load();
        } else {
          this.schedules.update((list) => [...list, created]);
        }
        this.isSaving.set(false);
        this.isDialogOpen.set(false);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.error.set(this.extractMessage(err) ?? 'Failed to create schedule. Please try again.');
      },
    });
  }

  askDelete(schedule: WeeklySchedule): void {
    this.deleteError.set(null);
    this.scheduleToDelete.set(schedule);
  }

  cancelDelete(): void {
    if (this.isDeleting()) return;
    this.scheduleToDelete.set(null);
  }

  confirmDelete(): void {
    const target = this.scheduleToDelete();
    if (!target || this.isDeleting()) return;
    this.isDeleting.set(true);
    this.deleteError.set(null);
    this.schedulesService.delete(target.id).subscribe({
      next: () => {
        this.schedules.update((list) => list.filter((s) => s.id !== target.id));
        this.isDeleting.set(false);
        this.scheduleToDelete.set(null);
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.deleteError.set(
          this.extractMessage(err) ?? 'Failed to delete schedule. Please try again.',
        );
      },
    });
  }

  setDefault(schedule: WeeklySchedule): void {
    if (schedule.isDefault || this.settingDefaultId() !== null) return;
    this.settingDefaultId.set(schedule.id);
    this.error.set(null);
    this.schedulesService.setDefault(schedule.id).subscribe({
      next: () => {
        this.schedules.update((list) =>
          list.map((s) => ({ ...s, isDefault: s.id === schedule.id })),
        );
        this.settingDefaultId.set(null);
      },
      error: () => {
        this.error.set(`Failed to set "${schedule.name}" as default. Please try again.`);
        this.settingDefaultId.set(null);
      },
    });
  }

  private extractMessage(err: unknown): string | null {
    if (err && typeof err === 'object' && 'error' in err) {
      const message = (err as { error?: { message?: string | string[] } }).error?.message;
      if (Array.isArray(message)) return message[0] ?? null;
      if (typeof message === 'string') return message;
    }
    return null;
  }
}
