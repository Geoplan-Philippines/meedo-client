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
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import {
  AttendanceSource,
  DayOfWeek,
  Shift,
  WeeklySchedule,
  WeeklyScheduleDayInput,
} from '../../models/attendance.model';
import {
  ATTENDANCE_SOURCE_OPTIONS,
  WEEK_ORDER,
  dayLabel,
  formatHours,
  formatTime12h,
  shiftWorkedHours,
} from '../../shared/attendance-settings.util';
import { ShiftsService } from '../../services/shifts.service';
import { WeeklySchedulesService } from '../../services/weekly-schedules.service';

type DayForm = FormGroup<{
  dayOfWeek: FormControl<DayOfWeek>;
  isWorkingDay: FormControl<boolean>;
  shiftId: FormControl<string | null>;
  expectedSource: FormControl<AttendanceSource | null>;
}>;

interface ShiftOption {
  label: string;
  value: string;
  archived: boolean;
}

/** A working day must reference a shift; a rest day must not. */
function workingNeedsShift(group: AbstractControl): ValidationErrors | null {
  const working = group.get('isWorkingDay')?.value as boolean;
  const shiftId = group.get('shiftId')?.value as string | null;
  if (working && !shiftId) return { shiftRequired: true };
  return null;
}

@Component({
  selector: 'app-schedule-editor',
  imports: [RouterLink, ReactiveFormsModule, ButtonModule, SelectModule, ToggleSwitchModule, TooltipModule],
  templateUrl: './schedule-editor.html',
  styleUrl: './schedule-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleEditor implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly schedulesService = inject(WeeklySchedulesService);
  private readonly shiftsService = inject(ShiftsService);

  private readonly scheduleId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly schedule = signal<WeeklySchedule | null>(null);
  readonly shifts = signal<Shift[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saved = signal(false);

  readonly sourceOptions = ATTENDANCE_SOURCE_OPTIONS;

  readonly days = new FormArray<DayForm>([]);

  /** Active shifts, plus any archived shift still referenced by this schedule. */
  readonly shiftOptions = computed<ShiftOption[]>(() => {
    const referenced = new Set(
      (this.schedule()?.days ?? []).map((d) => d.shiftId).filter((id): id is string => !!id),
    );
    return this.shifts()
      .filter((shift) => !shift.isArchived || referenced.has(shift.id))
      .map((shift) => ({
        value: shift.id,
        archived: shift.isArchived,
        label:
          `${shift.name} · ${formatTime12h(shift.startTime)}–${formatTime12h(shift.endTime)}` +
          ` (${formatHours(shiftWorkedHours(shift.startTime, shift.endTime, shift.breakMinutes, shift.crossesMidnight))}h)` +
          (shift.isFlexible ? ' · flexible' : '') +
          (shift.isArchived ? ' · archived' : ''),
      }));
  });

  readonly workingDayCount = computed(() =>
    this.days.controls.filter((group) => group.controls.isWorkingDay.value).length,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.scheduleId) {
      this.loadError.set('Missing schedule id.');
      return;
    }
    this.isLoading.set(true);
    this.loadError.set(null);
    forkJoin({
      schedule: this.schedulesService.get(this.scheduleId),
      shifts: this.shiftsService.list(),
    }).subscribe({
      next: ({ schedule, shifts }) => {
        this.schedule.set(schedule);
        this.shifts.set(shifts);
        this.buildForm(schedule);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.loadError.set(
          err?.status === 404
            ? 'This schedule no longer exists.'
            : 'Failed to load the schedule. Please try again.',
        );
      },
    });
  }

  private buildForm(schedule: WeeklySchedule): void {
    this.days.clear();
    for (const day of WEEK_ORDER) {
      const entry = schedule.days.find((d) => d.dayOfWeek === day);
      const group: DayForm = new FormGroup(
        {
          dayOfWeek: new FormControl(day, { nonNullable: true }),
          isWorkingDay: new FormControl(entry?.isWorkingDay ?? false, { nonNullable: true }),
          shiftId: new FormControl<string | null>(entry?.shiftId ?? null),
          expectedSource: new FormControl<AttendanceSource | null>(entry?.expectedSource ?? null),
        },
        { validators: workingNeedsShift },
      );
      this.days.push(group);
    }

    // A day flipped to rest can't keep a shift or mode; clear them so the payload is valid.
    for (const group of this.days.controls) {
      group.controls.isWorkingDay.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((working) => {
        if (!working) {
          group.controls.shiftId.setValue(null);
          group.controls.expectedSource.setValue(null);
        }
      });
    }

    this.days.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.saved.set(false));
    this.days.markAsPristine();
  }

  dayLabel(day: DayOfWeek): string {
    return dayLabel(day);
  }

  applyToWeekdays(): void {
    // Convenience: copy Monday's setup to Tue–Fri (the common 5-day pattern).
    const monday = this.days.controls.find((g) => g.controls.dayOfWeek.value === 'MONDAY');
    if (!monday) return;
    const { isWorkingDay, shiftId, expectedSource } = monday.getRawValue();
    for (const group of this.days.controls) {
      const day = group.controls.dayOfWeek.value;
      if (day === 'MONDAY' || day === 'SATURDAY' || day === 'SUNDAY') continue;
      group.patchValue({ isWorkingDay, shiftId, expectedSource });
    }
    this.days.markAsDirty();
  }

  save(): void {
    if (this.days.invalid || this.isSaving()) {
      this.days.markAllAsTouched();
      return;
    }
    const payload: WeeklyScheduleDayInput[] = this.days.controls.map((group) => {
      const value = group.getRawValue();
      return value.isWorkingDay
        ? {
            dayOfWeek: value.dayOfWeek,
            isWorkingDay: true,
            shiftId: value.shiftId,
            expectedSource: value.expectedSource,
          }
        : { dayOfWeek: value.dayOfWeek, isWorkingDay: false };
    });

    this.isSaving.set(true);
    this.saveError.set(null);
    this.schedulesService.setDays(this.scheduleId, { days: payload }).subscribe({
      next: (updated) => {
        this.schedule.set(updated);
        this.isSaving.set(false);
        this.days.markAsPristine();
        this.saved.set(true);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.saveError.set(
          this.extractMessage(err) ?? 'Failed to save the week. Please try again.',
        );
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
