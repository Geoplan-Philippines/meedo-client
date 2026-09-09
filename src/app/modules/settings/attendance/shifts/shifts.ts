import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { catchError, exhaustMap, filter, finalize, tap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import { CreateShiftPayload, Shift, UpdateShiftPayload } from '../models/attendance.model';
import {
  DEFAULT_SHIFT_COLOR,
  TIME_PATTERN,
  formatHours,
  formatTime12h,
  shiftWorkedHours,
} from '../shared/attendance-settings.util';
import { ShiftsService } from '../services/shifts.service';

type DialogMode = 'create' | 'edit';

/**
 * Curated shift colors. Shifts allow any hex server-side, but a fixed swatch set
 * keeps them uniform and on-brand — same rationale as the custom-status palette.
 */
const SHIFT_COLORS = [
  { name: 'Slate', value: DEFAULT_SHIFT_COLOR },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Rose', value: '#F43F5E' },
] as const;

const SHIFT_COLOR_VALUES: readonly string[] = SHIFT_COLORS.map((c) => c.value);

/** endTime must be after startTime unless the shift is flagged as overnight. */
function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startTime')?.value as string;
  const end = group.get('endTime')?.value as string;
  const overnight = group.get('crossesMidnight')?.value as boolean;
  if (overnight) return null;
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em > sh * 60 + sm ? null : { endBeforeStart: true };
}

@Component({
  selector: 'app-settings-shifts',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    ToggleSwitchModule,
    TooltipModule,
  ],
  templateUrl: './shifts.html',
  styleUrls: ['./shifts.css', '../shared/attendance-time.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shifts implements OnInit {
  private readonly shiftsService = inject(ShiftsService);

  readonly shifts = signal<Shift[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly showArchivedControl = new FormControl(false, { nonNullable: true });
  readonly showArchived = toSignal(this.showArchivedControl.valueChanges, { initialValue: false });

  readonly activeShifts = computed(() => this.shifts().filter((s) => !s.isArchived));
  readonly archivedCount = computed(() => this.shifts().filter((s) => s.isArchived).length);

  readonly visibleShifts = computed(() =>
    this.showArchived() ? this.shifts() : this.activeShifts(),
  );

  readonly isDialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('create');
  readonly editingShift = signal<Shift | null>(null);
  readonly isSaving = signal(false);
  readonly archivingId = signal<string | null>(null);

  private readonly toggleArchive$ = new Subject<Shift>();

  readonly colorOptions = SHIFT_COLORS;

  readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      startTime: new FormControl('09:00', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(TIME_PATTERN)],
      }),
      endTime: new FormControl('18:00', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(TIME_PATTERN)],
      }),
      crossesMidnight: new FormControl(false, { nonNullable: true }),
      breakMinutes: new FormControl<number>(60, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.max(480)],
      }),
      graceMinutes: new FormControl<number | null>(null, {
        validators: [Validators.min(0), Validators.max(240)],
      }),
      isFlexible: new FormControl(false, { nonNullable: true }),
      color: new FormControl(SHIFT_COLOR_VALUES[0], { nonNullable: true }),
    },
    { validators: endAfterStart },
  );

  readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Live worked-hours preview, computed the same way the server does. */
  readonly previewHours = computed(() => {
    const v = this.formValue();
    if (!v?.startTime || !v?.endTime) return null;
    if (!TIME_PATTERN.test(v.startTime) || !TIME_PATTERN.test(v.endTime)) return null;
    if (!v.crossesMidnight && this.form.hasError('endBeforeStart')) return null;
    return shiftWorkedHours(v.startTime, v.endTime, v.breakMinutes ?? 0, v.crossesMidnight ?? false);
  });

  readonly nameLength = computed(() => this.formValue()?.name?.length ?? 0);

  constructor() {
    this.toggleArchive$
      .pipe(
        filter(() => this.archivingId() === null),
        tap((shift) => {
          this.archivingId.set(shift.id);
          this.error.set(null);
        }),
        exhaustMap((shift) => {
          const request$ = shift.isArchived
            ? this.shiftsService.restore(shift.id)
            : this.shiftsService.archive(shift.id);
          return request$.pipe(
            tap((updated) => {
              this.shifts.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
            }),
            catchError(() => {
              const action = shift.isArchived ? 'restore' : 'archive';
              this.error.set(`Failed to ${action} "${shift.name}". Please try again.`);
              return EMPTY;
            }),
            finalize(() => this.archivingId.set(null)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.shiftsService.list().subscribe({
      next: (data) => {
        this.shifts.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load shifts. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  workedHours(shift: Shift): string {
    return formatHours(
      shiftWorkedHours(shift.startTime, shift.endTime, shift.breakMinutes, shift.crossesMidnight),
    );
  }

  time12h(hhmm: string): string {
    return formatTime12h(hhmm);
  }

  openCreate(): void {
    this.dialogMode.set('create');
    this.editingShift.set(null);
    this.form.reset({
      name: '',
      startTime: '09:00',
      endTime: '18:00',
      crossesMidnight: false,
      breakMinutes: 60,
      graceMinutes: null,
      isFlexible: false,
      color: SHIFT_COLOR_VALUES[0],
    });
    this.isDialogOpen.set(true);
  }

  openEdit(shift: Shift): void {
    this.dialogMode.set('edit');
    this.editingShift.set(shift);
    this.form.reset({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      crossesMidnight: shift.crossesMidnight,
      breakMinutes: shift.breakMinutes,
      graceMinutes: shift.graceMinutes,
      isFlexible: shift.isFlexible,
      color: this.normalizeColor(shift.color),
    });
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
    const v = this.form.getRawValue();
    const payload: CreateShiftPayload = {
      name: v.name.trim(),
      startTime: v.startTime,
      endTime: v.endTime,
      crossesMidnight: v.crossesMidnight,
      breakMinutes: v.breakMinutes,
      graceMinutes: v.graceMinutes,
      isFlexible: v.isFlexible,
      color: v.color,
    };
    this.isSaving.set(true);
    this.error.set(null);

    if (this.dialogMode() === 'create') {
      this.shiftsService.create(payload).subscribe({
        next: (created) => {
          this.shifts.update((list) => [...list, created]);
          this.isSaving.set(false);
          this.isDialogOpen.set(false);
        },
        error: (err) => this.handleSaveError(err, 'create'),
      });
      return;
    }

    const editing = this.editingShift();
    if (!editing) {
      this.isSaving.set(false);
      return;
    }
    const update: UpdateShiftPayload = payload;
    this.shiftsService.update(editing.id, update).subscribe({
      next: (updated) => {
        this.shifts.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        this.isSaving.set(false);
        this.isDialogOpen.set(false);
      },
      error: (err) => this.handleSaveError(err, 'update'),
    });
  }

  quickToggleArchive(shift: Shift): void {
    this.toggleArchive$.next(shift);
  }

  private handleSaveError(err: unknown, action: 'create' | 'update'): void {
    this.isSaving.set(false);
    const message = this.extractMessage(err);
    this.error.set(message ?? `Failed to ${action} shift. Please try again.`);
  }

  /** Surface the server's validation message (e.g. duplicate name) when present. */
  private extractMessage(err: unknown): string | null {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string | string[] } }).error;
      const message = body?.message;
      if (Array.isArray(message)) return message[0] ?? null;
      if (typeof message === 'string') return message;
    }
    return null;
  }

  private normalizeColor(color: string | null): string {
    return color && SHIFT_COLOR_VALUES.includes(color) ? color : SHIFT_COLOR_VALUES[0];
  }
}
