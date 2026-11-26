import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { IntegrationService } from '../services/integration.service';
import { WebsiteIntegration } from '../models/integration.model';
import { CopyBlock } from '../shared/copy-block';
import { copyText } from '../shared/copy-text';

@Component({
  selector: 'app-developers',
  imports: [RouterLink, ButtonModule, SkeletonModule, PageLayout, EmptyState, CopyBlock],
  templateUrl: './developers.html',
  styleUrl: './developers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Developers {
  private readonly service = inject(IntegrationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly site = signal<WebsiteIntegration | null>(null);
  readonly guide = signal('');
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly copiedSlug = signal(false);
  readonly copiedPrefix = signal(false);
  readonly copiedBase = signal(false);

  readonly baseUrl = this.service.apiBaseUrl;
  readonly docsUrl = this.service.docsUrl;
  readonly slug = computed(() => this.site()?.slug?.trim() || '');
  readonly prefix = computed(() => this.site()?.prefix || '');
  readonly agentPrompt = computed(() => agentPrompt(this.baseUrl, this.slug(), this.docsUrl));
  readonly leadCurl = computed(() => submitCurl(this.baseUrl, this.slug(), 'leads', {
    email: 'lead@example.test',
    firstName: 'Ada',
    lastName: 'Lovelace',
  }));
  readonly subscriberCurl = computed(() => submitCurl(this.baseUrl, this.slug(), 'subscribers', {
    email: 'reader@example.test',
    name: 'Ada Lovelace',
  }));
  readonly payloadSample = computed(() => webhookPayloadSample());
  readonly signatureSnippet = computed(() => signatureSnippet());

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      site: this.service.getWebsite(),
      slug: this.service.getOrganizationSlug().pipe(catchError(() => of(''))),
      guide: this.service.getGuide().pipe(catchError(() => of(''))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ site, slug, guide }) => {
          this.site.set({ ...site, slug: site.slug || slug });
          this.guide.set(guide);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('Developer details could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  copy(kind: 'slug' | 'prefix' | 'base'): void {
    const value = kind === 'slug' ? this.slug() : kind === 'prefix' ? this.prefix() : this.baseUrl;
    void copyText(value).then((ok) => {
      if (!ok) return;
      this.copiedSlug.set(kind === 'slug');
      this.copiedPrefix.set(kind === 'prefix');
      this.copiedBase.set(kind === 'base');
    });
  }
}

export function agentPrompt(baseUrl: string, slug: string, docsUrl: string): string {
  const org = slug || '<org-slug>';
  return [
    'Integrate the Geoplan website with Meedo.',
    `Read the integration guide at ${docsUrl}`,
    `Organization slug: ${org}`,
    'Send the website key in the x-integration-key header. Store it as MEEDO_INTEGRATION_KEY. Do not commit the key.',
    `POST ${baseUrl}/public/${org}/leads and POST ${baseUrl}/public/${org}/subscribers with JSON body { "values": { ... } }. Success is 201 { "id": "..." }.`,
    'A honeypot field in values is accepted and dropped. The key can only submit leads and subscribers.',
    'Webhooks are signed with header X-Meedo-Signature: sha256=<hex HMAC-SHA256 of the raw body>.',
  ].join('\n');
}

export function submitCurl(baseUrl: string, slug: string, collection: 'leads' | 'subscribers', values: Record<string, string>): string {
  const org = slug || '<org-slug>';
  return [
    `curl -X POST '${baseUrl}/public/${org}/${collection}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H "x-integration-key: $MEEDO_INTEGRATION_KEY" \\`,
    `  -d '${JSON.stringify({ values })}'`,
  ].join('\n');
}

export function webhookPayloadSample(): string {
  return JSON.stringify(
    {
      event: 'lead.created',
      createdAt: '2026-11-26T04:00:00.000Z',
      data: { id: 'lead_123', values: { email: 'lead@example.test', firstName: 'Ada', lastName: 'Lovelace' } },
    },
    null,
    2,
  );
}

export function signatureSnippet(): string {
  return [
    "const crypto = require('node:crypto');",
    "const expected = 'sha256=' + crypto.createHmac('sha256', process.env.MEEDO_WEBHOOK_SECRET)",
    '  .update(rawBody)',
    "  .digest('hex');",
    'const provided = request.headers[\'x-meedo-signature\'];',
    'if (provided !== expected) throw new Error(\'Invalid Meedo webhook signature\');',
  ].join('\n');
}
