import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { TicketCategoriesService } from '../../tickets/services/ticket-categories.service';
import {
  CreateTicketCategoryPayload,
  TicketCategory,
  UpdateTicketCategoryPayload,
} from '../../tickets/models/ticket-categories.model';

type DialogMode = 'create' | 'edit';

@Component({
  selector: 'app-settings-categories',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    TooltipModule,
  ],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Categories implements OnInit {
  private readonly ticketCategoriesService = inject(TicketCategoriesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = signal<TicketCategory[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isDialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('create');
  readonly editingCategory = signal<TicketCategory | null>(null);
  readonly isSaving = signal(false);

  readonly categoryToDelete = signal<TicketCategory | null>(null);
  readonly isDeleting = signal(false);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(255)],
    }),
  });

  readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly nameLength = computed(() => this.formValue()?.name?.length ?? 0);
  readonly descriptionLength = computed(() => this.formValue()?.description?.length ?? 0);
  readonly isFormInvalid = computed(() => {
    this.formValue();
    return this.form.invalid;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.ticketCategoriesService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.categories.set(data);
          this.isLoading.set(false);
        },
        error: () => {
          this.error.set('Failed to load ticket categories. Please try again.');
          this.isLoading.set(false);
        },
      });
  }

  openCreate(): void {
    this.dialogMode.set('create');
    this.editingCategory.set(null);
    this.error.set(null);
    this.form.reset({ name: '', description: '' });
    this.isDialogOpen.set(true);
  }

  openEdit(category: TicketCategory): void {
    this.dialogMode.set('edit');
    this.editingCategory.set(category);
    this.error.set(null);
    this.form.reset({
      name: category.name,
      description: category.description ?? '',
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
      const payload: CreateTicketCategoryPayload = {
        name: value.name,
        description: value.description.trim(),
      };
      this.ticketCategoriesService
        .create(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.categories.update((list) => [...list, created]);
            this.isSaving.set(false);
            this.isDialogOpen.set(false);
          },
          error: () => {
            this.isSaving.set(false);
            this.error.set('Failed to create ticket category. Please try again.');
          },
        });
      return;
    }

    const editing = this.editingCategory();
    if (!editing) {
      this.isSaving.set(false);
      return;
    }
    const payload: UpdateTicketCategoryPayload = {
      name: value.name,
      description: value.description.trim(),
    };
    this.ticketCategoriesService
      .update(editing.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.categories.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
          this.isSaving.set(false);
          this.isDialogOpen.set(false);
        },
        error: () => {
          this.isSaving.set(false);
          this.error.set('Failed to update ticket category. Please try again.');
        },
      });
  }

  askDelete(category: TicketCategory): void {
    this.categoryToDelete.set(category);
  }

  cancelDelete(): void {
    if (this.isDeleting()) return;
    this.categoryToDelete.set(null);
  }

  confirmDelete(): void {
    const target = this.categoryToDelete();
    if (!target || this.isDeleting()) return;
    this.isDeleting.set(true);
    this.error.set(null);
    this.ticketCategoriesService
      .delete(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.categories.update((list) => list.filter((c) => c.id !== target.id));
          this.isDeleting.set(false);
          this.categoryToDelete.set(null);
        },
        error: () => {
          this.isDeleting.set(false);
          this.error.set('Failed to delete ticket category. Please try again.');
        },
      });
  }
}
