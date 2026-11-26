import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { AuthService } from '../../../../core/auth/auth.service';
import { FieldDefinitionsService } from '../../../crm/services/field-definitions.service';
import {
  FIELD_KEY_MAX,
  FIELD_KEY_PATTERN,
  FIELD_TYPES,
  FieldCollection,
  FieldDefinition,
  FieldType,
} from '../../../crm/models/field-definition.model';
import { apiErrorMessage } from '../../../crm/shared/api-errors';

@Component({
  selector: 'app-field-definitions-settings',
  imports: [
    RouterLink, ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule, ToggleSwitchModule,
    TableModule, TagModule, SkeletonModule, MessageModule, TooltipModule, PageLayout, EmptyState,
  ],
  templateUrl: './field-definitions.html',
  styleUrl: './field-definitions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldDefinitionsSettings {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(FieldDefinitionsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isAdmin = inject(AuthService).isAdmin;

  readonly collection = (this.route.snapshot.data['collection'] ?? 'lead') as FieldCollection;
  readonly heading = (this.route.snapshot.data['heading'] as string) ?? 'Fields';
  readonly subtitle = (this.route.snapshot.data['subtitle'] as string) ?? '';
  readonly types = FIELD_TYPES.map((type) => ({ ...type }));
  readonly keyMax = FIELD_KEY_MAX;

  readonly fields = signal<FieldDefinition[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly dialogOpen = signal(false);
  readonly editing = signal<FieldDefinition | null>(null);
  readonly saving = signal(false);
  readonly busyId = signal<string | null>(null);

  readonly form = new FormGroup({
    key: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(FIELD_KEY_MAX), Validators.pattern(FIELD_KEY_PATTERN)] }),
    label: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    type: new FormControl<FieldType>('text', { nonNullable: true, validators: [Validators.required] }),
    isRequired: new FormControl(false, { nonNullable: true }),
    optionsText: new FormControl('', { nonNullable: true }),
  });

  readonly systemFields = computed(() => this.fields().filter((field) => field.isSystem));
  readonly customFields = computed(() => this.fields().filter((field) => !field.isSystem));
  readonly creating = computed(() => this.editing() === null);
  readonly selectType = computed(() => this.form.controls.type.value === 'select');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.service.list(this.collection).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (fields) => {
        this.fields.set(fields.slice().sort((a, b) => a.position - b.position));
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Field definitions could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (!this.isAdmin()) return;
    this.editing.set(null);
    this.form.reset({ key: '', label: '', type: 'text', isRequired: false, optionsText: '' });
    this.form.controls.key.enable();
    this.form.controls.type.enable();
    this.dialogOpen.set(true);
    this.error.set('');
  }

  openEdit(field: FieldDefinition): void {
    if (!this.isAdmin() || field.isSystem) return;
    this.editing.set(field);
    this.form.reset({
      key: field.key,
      label: field.label,
      type: field.type,
      isRequired: field.isRequired,
      optionsText: field.options.join('\n'),
    });
    this.form.controls.key.disable();
    this.form.controls.type.disable();
    this.dialogOpen.set(true);
    this.error.set('');
  }

  save(): void {
    if (!this.isAdmin() || this.saving()) return;
    this.form.markAllAsTouched();
    const type = this.form.controls.type.getRawValue();
    const options = this.form.controls.optionsText.value.split('\n').map((line) => line.trim()).filter(Boolean);
    if (type === 'select' && options.length === 0) {
      this.error.set('Select fields need at least one option.');
      return;
    }
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const editing = this.editing();
    const request = editing
      ? this.service.update(editing.id, { label: this.form.controls.label.value.trim(), isRequired: this.form.controls.isRequired.value, options })
      : this.service.create({
        collection: this.collection,
        key: this.form.controls.key.value.trim(),
        label: this.form.controls.label.value.trim(),
        type,
        isRequired: this.form.controls.isRequired.value,
        options,
      });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error, 'The field could not be saved. Try again.'));
      },
    });
  }

  remove(field: FieldDefinition): void {
    if (!this.isAdmin() || field.isSystem || this.busyId()) return;
    if (!window.confirm(`Delete "${field.label}"? Existing values for this field will be removed.`)) return;
    this.busyId.set(field.id);
    this.error.set('');
    this.service.remove(field.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.error.set(apiErrorMessage(error, 'The field could not be deleted. Try again.'));
      },
    });
  }

  move(field: FieldDefinition, direction: -1 | 1): void {
    if (!this.isAdmin() || field.isSystem || this.busyId()) return;
    const custom = this.customFields();
    const index = custom.findIndex((item) => item.id === field.id);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= custom.length) return;
    const next = custom.slice();
    [next[index], next[swap]] = [next[swap], next[index]];
    const orderedIds = [...this.systemFields().map((item) => item.id), ...next.map((item) => item.id)];
    this.busyId.set(field.id);
    this.error.set('');
    this.service.reorder(this.collection, orderedIds).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (fields) => {
        this.busyId.set(null);
        this.fields.set(fields.slice().sort((a, b) => a.position - b.position));
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.error.set(apiErrorMessage(error, 'The fields could not be reordered. Try again.'));
      },
    });
  }

  typeLabel(type: FieldType): string {
    return FIELD_TYPES.find((item) => item.value === type)?.label ?? type;
  }
}
