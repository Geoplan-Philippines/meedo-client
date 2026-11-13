import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
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
  CUSTOM_STATUSES_LIST,
  STANDARD_STATUSES_LIST,
  StatusesService,
} from './services/statuses.service';
import {
  CreateStatusPayload,
  Status,
  UpdateStatusPayload,
} from './models/status.model';

import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { injectListState } from '../../../shared/data/url-list-state';
import { pagedList } from '../../../shared/data/paged-list';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
type DialogMode = 'create' | 'edit';

/**
 * Curated swatch palette for custom (editable) statuses. Deliberately distinct
 * from the built-in Standard status hues (slate / blue / amber / violet / green /
 * red) so custom statuses read as their own family. No free-form picker. This
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
    MessageModule,
    PageLayout,
    ListPaginator,
    EmptyState,
    SkeletonModule,
    TagModule,
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
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
export class Statuses {
  private readonly statusesService = inject(StatusesService);

  /** Save and archive failures; load failures come from the lists. */
  readonly error = signal<string | null>(null);

  /** Built-in, locked statuses in workflow order. */
  readonly standardList = injectListState(STANDARD_STATUSES_LIST);
  readonly standard = pagedList({
    params: () => ({ ...this.standardList.query(), isSystem: true }),
    load: (query) => this.statusesService.list(query),
    refreshOn: ['lookups'],
  });

  /** Team-defined statuses that can be edited or archived. */
  readonly list = injectListState(CUSTOM_STATUSES_LIST);
  readonly custom = pagedList({
    params: () => ({ ...this.list.query(), isSystem: false }),
    load: (query) => this.statusesService.list(query),
    refreshOn: ['lookups'],
  });
  readonly showArchived = computed(() => this.list.filters().includeArchived);

  /** With archived hidden and nothing left, this tells "all archived" from "none yet". */
  private readonly archivedCustom = rxResource({
    params: () => (this.custom.loaded() && this.custom.total() === 0 && !this.showArchived() ? true : undefined),
    stream: () => this.statusesService.list({ page: 1, limit: 1, isSystem: false, includeArchived: true }),
  });
  readonly hasArchivedCustom = computed(() => (this.archivedCustom.hasValue() ? this.archivedCustom.value().meta.total > 0 : false));
  readonly loadFailed = computed(() => !!this.standard.error() || !!this.custom.error());

  readonly isDialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('create');
  readonly editingStatus = signal<Status | null>(null);
  readonly isSaving = signal(false);


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
              // Archived rows leave the list unless "Show archived" is on; a reload settles the page.
              this.custom.updateRows((rows) => rows.map((s) => (s.id === status.id ? { ...s, isArchived: nextArchived } : s)));
              this.custom.reload();
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

    this.list.clampToTotal(this.custom);
    this.standardList.clampToTotal(this.standard);
  }

  setShowArchived(value: boolean): void {
    this.list.setFilter('includeArchived', value);
  }

  load(): void {
    this.error.set(null);
    this.standard.reload();
    this.custom.reload();
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
        next: () => {
          this.custom.reload();
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
        this.custom.updateRows((rows) => rows.map((s) => (s.id === updated.id ? updated : s)));
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

}
