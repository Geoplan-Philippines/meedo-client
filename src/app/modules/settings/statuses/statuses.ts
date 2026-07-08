import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { catchError, exhaustMap, filter, finalize, tap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import {
  StatusesService,
} from './services/statuses.service';
import {
  CreateStatusPayload,
  Status,
  UpdateStatusPayload,
} from './models/status.model';

type DialogMode = 'create' | 'edit';

/**
 * Curated swatch palette for custom (editable) statuses. Deliberately distinct
 * from the built-in Standard status hues (slate / blue / amber / violet / green /
 * red) so custom statuses read as their own family. No free-form picker — this
 * keeps every status color uniform and on-brand. Mirrors CUSTOM_STATUS_COLORS
 * on the server, which rejects anything outside this set.
 */
const STATUS_COLORS = [
  { name: 'Orange', value: '#F97316' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Fuchsia', value: '#D946EF' },
  { name: 'Pink', value: '#EC4899' },
] as const;

const STATUS_COLOR_VALUES: readonly string[] = STATUS_COLORS.map((c) => c.value);

/** Custom statuses may only use a color from the curated palette. */
function colorInPalette(control: AbstractControl): ValidationErrors | null {
  return STATUS_COLOR_VALUES.includes(control.value) ? null : { colorInvalid: true };
}

@Component({
  selector: 'app-settings-statuses',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ToggleSwitchModule,
    TooltipModule,
  ],
  templateUrl: './statuses.html',
  styleUrl: './statuses.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Statuses implements OnInit {
  private readonly statusesService = inject(StatusesService);

  readonly statuses = signal<Status[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly showArchivedControl = new FormControl(false, { nonNullable: true });
  readonly showArchived = toSignal(this.showArchivedControl.valueChanges, { initialValue: false });

  /** Built-in, locked statuses — the fixed baseline (sourced from the API now). */
  readonly systemStatuses = computed(() => this.statuses().filter((s) => s.isSystem));

  /** Team-defined statuses that can be edited, archived, or deleted. */
  readonly customStatuses = computed(() => this.statuses().filter((s) => !s.isSystem));

  readonly visibleStatuses = computed(() => {
    const custom = this.customStatuses();
    return this.showArchived() ? custom : custom.filter((s) => !s.isArchived);
  });

  readonly isDialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('create');
  readonly editingStatus = signal<Status | null>(null);
  readonly isSaving = signal(false);

  readonly statusToDelete = signal<Status | null>(null);
  readonly isDeleting = signal(false);

  readonly archivingId = signal<string | null>(null);

  private readonly toggleArchive$ = new Subject<Status>();

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    color: new FormControl(STATUS_COLOR_VALUES[0], {
      nonNullable: true,
      validators: [Validators.required, colorInPalette],
    }),
  });

  /** Fixed swatch options shown in the create/edit dialog. */
  readonly colorOptions = STATUS_COLORS;

  readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly previewName = computed(() => {
    const name = this.formValue()?.name?.trim();
    return name && name.length > 0 ? name : 'Status preview';
  });

  readonly previewColor = computed(() => this.normalizeColor(this.formValue()?.color));

  readonly nameLength = computed(() => this.formValue()?.name?.length ?? 0);

  /** Snap any stored color (including legacy free-form hex) to a valid palette value. */
  private normalizeColor(color: string | null | undefined): string {
    return color && STATUS_COLOR_VALUES.includes(color) ? color : STATUS_COLOR_VALUES[0];
  }

  constructor() {
    this.toggleArchive$
      .pipe(
        filter(() => this.archivingId() === null),
        tap((status) => {
          this.archivingId.set(status.id);
          this.error.set(null);
        }),
        exhaustMap((status) => {
          const nextArchived = !status.isArchived;
          const request$ = status.isArchived
            ? this.statusesService.restore(status.id)
            : this.statusesService.archive(status.id);
          return request$.pipe(
            tap(() => {
              this.statuses.update((list) =>
                list.map((s) => (s.id === status.id ? { ...s, isArchived: nextArchived } : s)),
              );
            }),
            catchError(() => {
              const action = status.isArchived ? 'restore' : 'archive';
              this.error.set(`Failed to ${action} "${status.name}". Please try again.`);
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
    this.statusesService.list().subscribe({
      next: (data) => {
        this.statuses.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load statuses. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  openCreate(): void {
    this.dialogMode.set('create');
    this.editingStatus.set(null);
    this.form.reset({ name: '', color: STATUS_COLOR_VALUES[0] });
    this.isDialogOpen.set(true);
  }

  openEdit(status: Status): void {
    this.dialogMode.set('edit');
    this.editingStatus.set(status);
    this.form.reset({
      name: status.name,
      color: this.normalizeColor(status.color),
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
    const value = this.form.getRawValue();
    this.isSaving.set(true);
    this.error.set(null);

    if (this.dialogMode() === 'create') {
      const payload: CreateStatusPayload = { name: value.name, color: value.color };
      this.statusesService.create(payload).subscribe({
        next: (created) => {
          this.statuses.update((list) => [...list, created]);
          this.isSaving.set(false);
          this.isDialogOpen.set(false);
        },
        error: () => {
          this.isSaving.set(false);
          this.error.set('Failed to create status. Please try again.');
        },
      });
      return;
    }

    const editing = this.editingStatus();
    if (!editing) {
      this.isSaving.set(false);
      return;
    }
    const payload: UpdateStatusPayload = {
      name: value.name,
      color: value.color,
    };
    this.statusesService.update(editing.id, payload).subscribe({
      next: (updated) => {
        this.statuses.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        this.isSaving.set(false);
        this.isDialogOpen.set(false);
      },
      error: () => {
        this.isSaving.set(false);
        this.error.set('Failed to update status. Please try again.');
      },
    });
  }

  quickToggleArchive(status: Status): void {
    this.toggleArchive$.next(status);
  }

  askDelete(status: Status): void {
    this.statusToDelete.set(status);
  }

  cancelDelete(): void {
    if (this.isDeleting()) return;
    this.statusToDelete.set(null);
  }

  archiveFromDelete(): void {
    const target = this.statusToDelete();
    if (!target || this.isDeleting()) return;
    this.statusToDelete.set(null);
    this.quickToggleArchive(target);
  }

  confirmDelete(): void {
    const target = this.statusToDelete();
    if (!target || this.isDeleting()) return;
    this.isDeleting.set(true);
    this.error.set(null);
    this.statusesService.delete(target.id).subscribe({
      next: () => {
        this.statuses.update((list) => list.filter((s) => s.id !== target.id));
        this.isDeleting.set(false);
        this.statusToDelete.set(null);
      },
      error: () => {
        this.isDeleting.set(false);
        this.error.set('Failed to delete status. Please try again.');
      },
    });
  }
}
