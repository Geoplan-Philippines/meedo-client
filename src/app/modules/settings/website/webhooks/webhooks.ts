import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { AuthService } from '../../../../core/auth/auth.service';
import { IntegrationService } from '../../../crm/services/integration.service';
import { WEBHOOK_EVENTS, WebhookEndpoint, webhookEventLabel } from '../../../crm/models/integration.model';
import { SecretReveal } from '../../../crm/shared/secret-reveal';
import { apiErrorMessage } from '../../../crm/shared/api-errors';

const HTTP_URL = /^https?:\/\//i;

@Component({
  selector: 'app-webhooks-settings',
  imports: [
    DatePipe, RouterLink, ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, TableModule, TagModule,
    SkeletonModule, MessageModule, PageLayout, EmptyState, SecretReveal,
  ],
  templateUrl: './webhooks.html',
  styleUrl: './webhooks.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebhooksSettings {
  private readonly service = inject(IntegrationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly isAdmin = inject(AuthService).isAdmin;

  readonly events = WEBHOOK_EVENTS;
  readonly webhooks = signal<WebhookEndpoint[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly dialogOpen = signal(false);
  readonly saving = signal(false);
  readonly revealedSecret = signal('');

  readonly form = new FormGroup({
    url: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2048)] }),
    leadCreated: new FormControl(true, { nonNullable: true }),
    subscriberCreated: new FormControl(true, { nonNullable: true }),
    subscriberUnsubscribed: new FormControl(true, { nonNullable: true }),
  });

  readonly canWrite = computed(() => this.isAdmin());

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.service.listWebhooks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (webhooks) => {
        this.webhooks.set(webhooks);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Webhooks could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  eventsLabel(webhook: WebhookEndpoint): string {
    return (webhook.events ?? []).map((event) => webhookEventLabel(event)).join(', ');
  }

  openCreate(): void {
    if (!this.canWrite()) return;
    this.form.reset({ url: '', leadCreated: true, subscriberCreated: true, subscriberUnsubscribed: true });
    this.error.set('');
    this.dialogOpen.set(true);
  }

  save(): void {
    if (!this.canWrite() || this.saving()) return;
    this.form.markAllAsTouched();
    const url = this.form.controls.url.value.trim();
    const events = this.selectedEvents();
    if (!url || !HTTP_URL.test(url)) {
      this.error.set('Enter a URL that starts with http:// or https://.');
      return;
    }
    if (events.length === 0) {
      this.error.set('Choose at least one event.');
      return;
    }
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.service.createWebhook({ url, events }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (webhook) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.revealedSecret.set(webhook.secret ?? '');
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error, 'The webhook could not be saved. Try again.'));
      },
    });
  }

  open(webhook: WebhookEndpoint): void {
    void this.router.navigate(['/settings/website/webhooks', webhook.id]);
  }

  private selectedEvents(): string[] {
    const selected: string[] = [];
    if (this.form.controls.leadCreated.value) selected.push('lead.created');
    if (this.form.controls.subscriberCreated.value) selected.push('subscriber.created');
    if (this.form.controls.subscriberUnsubscribed.value) selected.push('subscriber.unsubscribed');
    return selected;
  }
}
