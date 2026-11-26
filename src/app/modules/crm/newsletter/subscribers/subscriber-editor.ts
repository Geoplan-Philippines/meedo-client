import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ArchivedTag } from '../../../../shared/ui/archived-tag/archived-tag';
import { CrmService } from '../../services/crm.service';
import { FieldDefinitionsService } from '../../services/field-definitions.service';
import { FieldDefinition } from '../../models/field-definition.model';
import { Subscriber } from '../../models/crm.model';
import { RecordValuesForm } from '../../shared/record-values-form';
import { apiErrorMessage } from '../../shared/api-errors';
import { readFieldValue, sourceHref } from '../../shared/parse-field-values';

@Component({
  selector: 'app-subscriber-editor',
  imports: [
    DatePipe, TitleCasePipe, RouterLink, ButtonModule, MessageModule, SkeletonModule, TagModule,
    PageLayout, EmptyState, ArchivedTag, RecordValuesForm,
  ],
  templateUrl: './subscriber-editor.html',
  styleUrl: './subscriber-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriberEditor {
  private readonly crm = inject(CrmService);
  private readonly fields = inject(FieldDefinitionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly valuesForm = viewChild(RecordValuesForm);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly subscriber = signal<Subscriber | null>(null);
  readonly definitions = signal<FieldDefinition[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly submitted = signal(false);
  readonly busy = signal(false);

  readonly heading = computed(() => this.subscriber()?.name || this.subscriber()?.email || 'Subscriber');
  readonly canEdit = computed(() => !this.subscriber()?.isArchived);
  readonly initialValues = computed(() => valuesFromSubscriber(this.subscriber(), this.definitions()));
  readonly sourceLink = computed(() => sourceHref(this.subscriber()?.source));

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({ definitions: this.fields.list('subscriber'), subscriber: this.crm.getSubscriber(this.id) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ definitions, subscriber }) => {
          this.definitions.set(definitions);
          this.subscriber.set(subscriber);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('The subscriber could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  save(): void {
    const form = this.valuesForm();
    if (!form || this.saving() || !this.canEdit()) return;
    this.submitted.set(true);
    const parsed = form.parse();
    if (parsed.errors.length) {
      this.error.set(parsed.errors.join(' '));
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.crm.updateSubscriber(this.id, parsed.values).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subscriber) => {
        this.saving.set(false);
        this.subscriber.set(subscriber);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error, 'The subscriber could not be saved. Try again.'));
      },
    });
  }

  toggleArchive(): void {
    if (!this.id || this.busy()) return;
    const subscriber = this.subscriber();
    if (!subscriber) return;
    const restoring = !!subscriber.isArchived;
    if (!window.confirm(`${restoring ? 'Restore' : 'Archive'} this subscriber?`)) return;
    this.busy.set(true);
    this.error.set('');
    const request = restoring ? this.crm.restoreSubscriber(this.id) : this.crm.archiveSubscriber(this.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.subscriber.set(updated);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(error, `The subscriber could not be ${restoring ? 'restored' : 'archived'}. Try again.`));
      },
    });
  }
}

function valuesFromSubscriber(subscriber: Subscriber | null, definitions: readonly FieldDefinition[]): Record<string, unknown> {
  if (!subscriber) return {};
  const record = subscriber as unknown as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const definition of definitions) values[definition.key] = readFieldValue(record, definition.key);
  return values;
}
