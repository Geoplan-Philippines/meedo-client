import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import {
  CreateHolidayPayload,
  Holiday,
  HolidayType,
  UpdateHolidayPayload,
} from '../models/attendance.model';
import {
  HOLIDAY_TYPE_OPTIONS,
  dateToYmd,
  holidayTypeLabel,
  isoDateOnlyToLocal,
} from '../shared/attendance-settings.util';
import { HOLIDAYS_LIST, HolidaysService } from '../services/holidays.service';

import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { injectListState } from '../../../../shared/data/url-list-state';
import { pagedList } from '../../../../shared/data/paged-list';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
type DialogMode = 'create' | 'edit';

@Component({
  selector: 'app-settings-holidays',
  imports: [
    MessageModule,
    PageLayout,
    ListPaginator,
    EmptyState,
    SkeletonModule,
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    DatePickerModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
    TooltipModule,
  ],
  templateUrl: './holidays.html',
  styleUrl: './holidays.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Holidays {
  private readonly holidaysService = inject(HolidaysService);

  /** The year, page and sort live in the URL (`?year=2027`). */
  readonly list = injectListState({ ...HOLIDAYS_LIST, filters: { year: String(new Date().getFullYear()) } });
  readonly year = computed(() => yearOrCurrent(this.list.filters().year));
  readonly holidays = pagedList({
    params: () => ({ ...this.list.query(), year: this.year() }),
    load: (query) => this.holidaysService.list(query),
    refreshOn: ['attendance'],
  });
  readonly isLoading = computed(() => !this.holidays.loaded() || this.holidays.loading());
  /** Save and delete failures; load failures come from the list. */
  readonly error = signal<string | null>(null);

  readonly typeOptions = HOLIDAY_TYPE_OPTIONS;

  private readonly currentYear = new Date().getFullYear();

  /** A small window of years around now for the import picker. */
  readonly yearOptions = Array.from({ length: 7 }, (_, i) => {
    const year = this.currentYear - 3 + i;
    return { label: `${year}`, value: year };
  });

  /** Countries covered by the server's holiday provider (Nager.Date). */
  readonly countryOptions = [
    { label: 'Philippines', value: 'PH' },
    { label: 'United States', value: 'US' },
    { label: 'United Kingdom', value: 'GB' },
    { label: 'Singapore', value: 'SG' },
    { label: 'Malaysia', value: 'MY' },
    { label: 'Japan', value: 'JP' },
    { label: 'Australia', value: 'AU' },
    { label: 'New Zealand', value: 'NZ' },
    { label: 'India', value: 'IN' },
    { label: 'Canada', value: 'CA' },
    { label: 'Ireland', value: 'IE' },
    { label: 'Germany', value: 'DE' },
    { label: 'France', value: 'FR' },
    { label: 'Spain', value: 'ES' },
    { label: 'Italy', value: 'IT' },
    { label: 'Netherlands', value: 'NL' },
  ];

  // Create / edit dialog
  readonly isDialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('create');
  readonly editingHoliday = signal<Holiday | null>(null);
  readonly isSaving = signal(false);

  // Delete
  readonly holidayToDelete = signal<Holiday | null>(null);
  readonly isDeleting = signal(false);

  // Clear year
  readonly isClearOpen = signal(false);
  readonly isClearing = signal(false);

  // Import
  readonly isImportOpen = signal(false);
  readonly isImporting = signal(false);
  readonly importResult = signal<{ imported: number; skipped: number } | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    date: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    type: new FormControl<HolidayType>('REGULAR', { nonNullable: true }),
    isRecurring: new FormControl(false, { nonNullable: true }),
  });

  readonly importForm = new FormGroup({
    year: new FormControl<number>(new Date().getFullYear(), {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1970), Validators.max(2100)],
    }),
    countryCode: new FormControl('PH', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(2)],
    }),
  });

  readonly nameLength = computed(() => this.nameValue()?.length ?? 0);
  private readonly nameValue = toSignal(this.form.controls.name.valueChanges, { initialValue: '' });

  constructor() {
    this.list.clampToTotal(this.holidays);
  }

  load(): void {
    this.error.set(null);
    this.holidays.reload();
  }

  changeYear(delta: number): void {
    this.list.setFilter('year', String(this.year() + delta));
  }

  localDate(iso: string): Date {
    return isoDateOnlyToLocal(iso);
  }

  typeLabel(type: HolidayType): string {
    return holidayTypeLabel(type);
  }

  typeBadgeClass(type: HolidayType): string {
    switch (type) {
      case 'SPECIAL_NON_WORKING':
        return 'bg-muted-warning text-muted-warning-foreground';
      case 'SPECIAL_WORKING':
        return 'bg-muted-success text-muted-success-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  }

  openCreate(): void {
    this.dialogMode.set('create');
    this.editingHoliday.set(null);
    this.form.reset({ name: '', date: null, type: 'REGULAR', isRecurring: false });
    this.isDialogOpen.set(true);
  }

  openEdit(holiday: Holiday): void {
    this.dialogMode.set('edit');
    this.editingHoliday.set(holiday);
    this.form.reset({
      name: holiday.name,
      date: isoDateOnlyToLocal(holiday.date),
      type: holiday.type,
      isRecurring: holiday.isRecurring,
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
    if (!value.date) return;
    const payload: CreateHolidayPayload = {
      name: value.name.trim(),
      date: dateToYmd(value.date),
      type: value.type,
      isRecurring: value.isRecurring,
    };
    this.isSaving.set(true);
    this.error.set(null);

    if (this.dialogMode() === 'create') {
      this.holidaysService.create(payload).subscribe({
        next: () => {
          this.insertIfInYear();
          this.isSaving.set(false);
          this.isDialogOpen.set(false);
        },
        error: (err) => this.handleSaveError(err, 'create'),
      });
      return;
    }

    const editing = this.editingHoliday();
    if (!editing) {
      this.isSaving.set(false);
      return;
    }
    const update: UpdateHolidayPayload = payload;
    this.holidaysService.update(editing.id, update).subscribe({
      next: (updated) => {
        // The edit may move it out of the current year; reload to stay accurate.
        this.holidays.updateRows((rows) => rows.map((h) => (h.id === updated.id ? updated : h)));
        if (new Date(updated.date).getUTCFullYear() !== this.year()) {
          this.load();
        }
        this.isSaving.set(false);
        this.isDialogOpen.set(false);
      },
      error: (err) => this.handleSaveError(err, 'update'),
    });
  }

  askDelete(holiday: Holiday): void {
    this.holidayToDelete.set(holiday);
  }

  cancelDelete(): void {
    if (this.isDeleting()) return;
    this.holidayToDelete.set(null);
  }

  confirmDelete(): void {
    const target = this.holidayToDelete();
    if (!target || this.isDeleting()) return;
    this.isDeleting.set(true);
    this.error.set(null);
    this.holidaysService.delete(target.id).subscribe({
      next: () => {
        this.holidays.reload();
        this.isDeleting.set(false);
        this.holidayToDelete.set(null);
      },
      error: () => {
        this.isDeleting.set(false);
        this.error.set(`Failed to delete "${target.name}". Please try again.`);
      },
    });
  }

  // ── Clear year ──────────────────────────────────────────────────────────────

  openClearYear(): void {
    if (this.holidays.total() === 0) return;
    this.isClearOpen.set(true);
  }

  cancelClearYear(): void {
    if (this.isClearing()) return;
    this.isClearOpen.set(false);
  }

  confirmClearYear(): void {
    if (this.isClearing()) return;
    this.isClearing.set(true);
    this.error.set(null);
    this.holidaysService.clearYear(this.year()).subscribe({
      next: () => {
        this.holidays.reload();
        this.isClearing.set(false);
        this.isClearOpen.set(false);
      },
      error: () => {
        this.isClearing.set(false);
        this.error.set(`Failed to clear ${this.year()} holidays. Please try again.`);
      },
    });
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  openImport(): void {
    this.importResult.set(null);
    this.importForm.reset({ year: this.year(), countryCode: 'PH' });
    this.isImportOpen.set(true);
  }

  closeImport(): void {
    if (this.isImporting()) return;
    this.isImportOpen.set(false);
  }

  runImport(): void {
    if (this.importForm.invalid || this.isImporting()) {
      this.importForm.markAllAsTouched();
      return;
    }
    const value = this.importForm.getRawValue();
    this.isImporting.set(true);
    this.importResult.set(null);
    this.holidaysService
      .generate({ year: value.year, countryCode: value.countryCode.toUpperCase() })
      .subscribe({
        next: (result) => {
          this.importResult.set(result);
          this.isImporting.set(false);
          // Show the imported set: jump to that year and reload.
          if (value.year !== this.year()) {
            this.list.setFilter('year', String(value.year));
          } else {
            this.load();
          }
        },
        error: (err) => {
          this.isImporting.set(false);
          this.error.set(
            this.extractMessage(err) ?? 'Could not import holidays. Please try again.',
          );
          this.isImportOpen.set(false);
        },
      });
  }

  /** The server places a saved holiday on its page (or in another year); reload to show it. */
  private insertIfInYear(): void {
    this.load();
  }

  private handleSaveError(err: unknown, action: 'create' | 'update'): void {
    this.isSaving.set(false);
    this.error.set(this.extractMessage(err) ?? `Failed to ${action} holiday. Please try again.`);
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

/** A year from the URL, or this year when it is missing or not a sensible year. */
function yearOrCurrent(value: string | boolean | readonly string[] | null): number {
  const year = typeof value === 'string' && /^\d{4}$/.test(value) ? Number(value) : NaN;
  return year >= 1970 && year <= 2100 ? year : new Date().getFullYear();
}
