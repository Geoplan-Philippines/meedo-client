import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { AuthService } from '../../../../core/auth/auth.service';
import { IntegrationService } from '../../../crm/services/integration.service';
import { WebsiteIntegration } from '../../../crm/models/integration.model';
import { SecretReveal } from '../../../crm/shared/secret-reveal';
import { copyText } from '../../../crm/shared/copy-text';
import { apiErrorMessage } from '../../../crm/shared/api-errors';

@Component({
  selector: 'app-integration-key',
  imports: [DatePipe, RouterLink, ButtonModule, MessageModule, SkeletonModule, PageLayout, EmptyState, SecretReveal],
  templateUrl: './integration-key.html',
  styleUrl: './integration-key.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationKeySettings {
  private readonly service = inject(IntegrationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isAdmin = inject(AuthService).isAdmin;

  readonly site = signal<WebsiteIntegration | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly revealedKey = signal('');
  readonly copiedPrefix = signal(false);

  readonly canWrite = computed(() => this.isAdmin());

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.service.getWebsite().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (site) => {
        this.site.set(site);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('The integration key could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  create(): void {
    if (!this.canWrite() || this.busy()) return;
    this.run('Create a website key for this workspace?', () => this.service.createKey());
  }

  rotate(): void {
    if (!this.canWrite() || this.busy()) return;
    this.run(
      'Rotate this key? The current key stops working immediately.',
      () => this.service.rotateKey(),
    );
  }

  revoke(): void {
    if (!this.canWrite() || this.busy() || !this.site()?.hasKey) return;
    if (!window.confirm('Revoke this key? Website forms that use it will stop submitting.')) return;
    this.busy.set(true);
    this.error.set('');
    this.service.revokeKey().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.revealedKey.set('');
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(error, 'The key could not be revoked. Try again.'));
      },
    });
  }

  copyPrefix(): void {
    const prefix = this.site()?.prefix;
    if (!prefix) return;
    void copyText(prefix).then((ok) => {
      if (ok) this.copiedPrefix.set(true);
    });
  }

  private run(confirm: string, request: () => ReturnType<IntegrationService['createKey']>): void {
    if (!window.confirm(confirm)) return;
    this.busy.set(true);
    this.error.set('');
    request().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (secret) => {
        this.busy.set(false);
        this.revealedKey.set(secret.key);
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(error, 'The key could not be saved. Try again.'));
      },
    });
  }
}
