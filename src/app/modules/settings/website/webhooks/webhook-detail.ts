import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { AuthService } from '../../../../core/auth/auth.service';
import { IntegrationService, WEBHOOK_DELIVERIES_LIST } from '../../../crm/services/integration.service';
import { WebhookEndpoint, webhookEventLabel } from '../../../crm/models/integration.model';
import { SecretReveal } from '../../../crm/shared/secret-reveal';
import { apiErrorMessage } from '../../../crm/shared/api-errors';
import { injectListState } from '../../../../shared/data/url-list-state';
import { pagedList } from '../../../../shared/data/paged-list';

const HTTP_URL = /^https?:\/\//i;

@Component({
  selector: 'app-webhook-detail',
  imports: [
    DatePipe, RouterLink, ReactiveFormsModule, ButtonModule, InputTextModule, ToggleSwitchModule, TableModule,
    TagModule, SkeletonModule, MessageModule, PageLayout, EmptyState, ListPaginator, SecretReveal,
  ],
  templateUrl: './webhook-detail.html',
  styleUrl: './webhook-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebhookDetail {
  private readonly service = inject(IntegrationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly isAdmin = inject(AuthService).isAdmin;

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly webhook = signal<WebhookEndpoint | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly busy = signal(false);
  readonly revealedSecret = signal('');

  readonly list = injectListState(WEBHOOK_DELIVERIES_LIST);
  readonly deliveries = pagedList({
    params: () => this.list.query(),
    load: (query) => this.service.listDeliveries(this.id, query),
    refreshOn: ['crm'],
  });

  readonly form = new FormGroup({
    url: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2048)] }),
    enabled: new FormControl(true, { nonNullable: true }),
    leadCreated: new FormControl(false, { nonNullable: true }),
    subscriberCreated: new FormControl(false, { nonNullable: true }),
    subscriberUnsubscribed: new FormControl(false, { nonNullable: true }),
  });

  readonly canWrite = computed(() => this.isAdmin() && !!this.webhook());
  readonly heading = computed(() => this.webhook()?.url || 'Webhook');

  constructor() {
    this.list.clampToTotal(this.deliveries);
    this.load();
  }

  eventLabel(event: string): string {
    return webhookEventLabel(event);
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.service.getWebhook(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (webhook) => {
        this.webhook.set(webhook);
        this.patch(webhook);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('The webhook could not be loaded.');
        this.loading.set(false);
      },
    });
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
    this.saving.set(true);
    this.error.set('');
    this.service.updateWebhook(this.id, { url, events, enabled: this.form.controls.enabled.value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (webhook) => {
          this.saving.set(false);
          this.webhook.set(webhook);
          this.patch(webhook);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(error, 'The webhook could not be saved. Try again.'));
        },
      });
  }

  rotateSecret(): void {
    if (!this.canWrite() || this.busy()) return;
    if (!window.confirm('Rotate this signing secret? Deliveries must verify the new secret.')) return;
    this.busy.set(true);
    this.error.set('');
    this.service.rotateWebhookSecret(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.busy.set(false);
        this.revealedSecret.set(response.secret);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(error, 'The secret could not be rotated. Try again.'));
      },
    });
  }

  remove(): void {
    if (!this.canWrite() || this.busy()) return;
    if (!window.confirm('Delete this webhook? Meedo will stop sending events to it.')) return;
    this.busy.set(true);
    this.error.set('');
    this.service.deleteWebhook(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/settings/website/webhooks']);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(error, 'The webhook could not be deleted. Try again.'));
      },
    });
  }

  private patch(webhook: WebhookEndpoint): void {
    const events = webhook.events ?? [];
    this.form.reset({
      url: webhook.url,
      enabled: webhook.enabled,
      leadCreated: events.includes('lead.created'),
      subscriberCreated: events.includes('subscriber.created'),
      subscriberUnsubscribed: events.includes('subscriber.unsubscribed'),
    });
    if (!this.isAdmin()) this.form.disable({ emitEvent: false });
    else this.form.enable({ emitEvent: false });
  }

  private selectedEvents(): string[] {
    const selected: string[] = [];
    if (this.form.controls.leadCreated.value) selected.push('lead.created');
    if (this.form.controls.subscriberCreated.value) selected.push('subscriber.created');
    if (this.form.controls.subscriberUnsubscribed.value) selected.push('subscriber.unsubscribed');
    return selected;
  }
}
