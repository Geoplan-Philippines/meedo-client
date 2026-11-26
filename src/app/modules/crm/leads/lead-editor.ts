import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { ArchivedTag } from '../../../shared/ui/archived-tag/archived-tag';
import { CrmService } from '../services/crm.service';
import { FieldDefinitionsService } from '../services/field-definitions.service';
import { FieldDefinition } from '../models/field-definition.model';
import { Lead, LEAD_STATUSES, LeadStatus } from '../models/crm.model';
import { RecordValuesForm } from '../shared/record-values-form';
import { apiErrorMessage } from '../shared/api-errors';
import { readFieldValue, sourceHref } from '../shared/parse-field-values';

@Component({
  selector: 'app-lead-editor',
  imports: [
    DatePipe, TitleCasePipe, RouterLink, ButtonModule, MessageModule, SelectModule, SkeletonModule, TagModule,
    FormsModule, PageLayout, EmptyState, ArchivedTag, RecordValuesForm,
  ],
  templateUrl: './lead-editor.html',
  styleUrl: './lead-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadEditor {
  private readonly crm = inject(CrmService);
  private readonly fields = inject(FieldDefinitionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly valuesForm = viewChild(RecordValuesForm);

  readonly id = this.route.snapshot.paramMap.get('id');
  readonly creating = !this.id || this.id === 'new';
  readonly statusOptions = LEAD_STATUSES.map((value) => ({
    value,
    label: value === 'NEW' ? 'New' : value.charAt(0) + value.slice(1).toLowerCase(),
  }));
  readonly lead = signal<Lead | null>(null);
  readonly definitions = signal<FieldDefinition[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly submitted = signal(false);
  readonly statusBusy = signal(false);

  readonly heading = computed(() => {
    if (this.creating) return 'Add lead';
    const lead = this.lead();
    if (!lead) return 'Lead';
    const name = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim();
    return name || lead.email || 'Lead';
  });

  readonly canEdit = computed(() => !this.lead()?.isArchived);
  readonly initialValues = computed(() => valuesFromLead(this.lead(), this.definitions()));
  readonly sourceLink = computed(() => sourceHref(this.lead()?.source));
  readonly receivedAt = computed(() => this.lead()?.receivedAt || this.lead()?.createdAt);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    const lead$ = this.creating ? of(null) : this.crm.getLead(this.id!);
    forkJoin({ definitions: this.fields.list('lead'), lead: lead$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ definitions, lead }) => {
          this.definitions.set(definitions);
          this.lead.set(lead);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(this.creating ? 'Lead fields could not be loaded.' : 'The lead could not be loaded.');
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
    const request = this.creating ? this.crm.createLead(parsed.values) : this.crm.updateLead(this.id!, parsed.values);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lead) => {
        this.saving.set(false);
        if (this.creating) void this.router.navigate(['/crm/leads', lead.id]);
        else this.lead.set(lead);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error, 'The lead could not be saved. Try again.'));
      },
    });
  }

  changeStatus(status: LeadStatus): void {
    if (this.creating || !this.id || this.statusBusy() || this.lead()?.status === status) return;
    this.statusBusy.set(true);
    this.error.set('');
    this.crm.updateLeadStatus(this.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lead) => {
        this.statusBusy.set(false);
        this.lead.set(lead);
      },
      error: (error: unknown) => {
        this.statusBusy.set(false);
        this.error.set(apiErrorMessage(error, 'The status could not be changed. Try again.'));
      },
    });
  }

  toggleArchive(): void {
    if (this.creating || !this.id || this.statusBusy()) return;
    const lead = this.lead();
    if (!lead) return;
    const restoring = !!lead.isArchived;
    const label = restoring ? 'Restore' : 'Archive';
    if (!window.confirm(`${label} this lead?`)) return;
    this.statusBusy.set(true);
    this.error.set('');
    const request = restoring ? this.crm.restoreLead(this.id) : this.crm.archiveLead(this.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.statusBusy.set(false);
        this.lead.set(updated);
      },
      error: (error: unknown) => {
        this.statusBusy.set(false);
        this.error.set(apiErrorMessage(error, `The lead could not be ${restoring ? 'restored' : 'archived'}. Try again.`));
      },
    });
  }
}

function valuesFromLead(lead: Lead | null, definitions: readonly FieldDefinition[]): Record<string, unknown> {
  if (!lead) return {};
  const record = lead as unknown as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const definition of definitions) values[definition.key] = readFieldValue(record, definition.key);
  return values;
}
