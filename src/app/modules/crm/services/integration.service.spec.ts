import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment.dev';
import { AuthService } from '../../../core/auth/auth.service';
import { readOrganizationSlug } from '../models/integration.model';
import { IntegrationService } from './integration.service';

describe('readOrganizationSlug', () => {
  it('reads slug from the common response shapes', () => {
    expect(readOrganizationSlug({ slug: 'geoplan' })).toBe('geoplan');
    expect(readOrganizationSlug({ data: { slug: 'nested' } })).toBe('nested');
    expect(readOrganizationSlug({ organization: { slug: 'org' } })).toBe('org');
    expect(readOrganizationSlug(null)).toBe('');
  });
});

describe('IntegrationService HTTP contract', () => {
  let service: IntegrationService;
  let http: HttpTestingController;
  const siteUrl = `${environment.apiBaseUrl}/crm/integrations/website`;
  const webhooksUrl = `${environment.apiBaseUrl}/crm/webhooks`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { organizationId: () => 'org-1' } },
      ],
    });
    service = TestBed.inject(IntegrationService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the website integration with credentials', () => {
    service.getWebsite().subscribe((site) => expect(site.prefix).toBe('mdo_pk_abcd'));
    const req = http.expectOne(siteUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: { slug: 'geoplan', hasKey: true, prefix: 'mdo_pk_abcd', createdAt: null, lastUsedAt: null } });
  });

  it('creates, rotates and revokes the website key', () => {
    service.createKey().subscribe((secret) => expect(secret.key.startsWith('mdo_pk_')).toBe(true));
    const created = http.expectOne(`${siteUrl}/key`);
    expect(created.request.method).toBe('POST');
    expect(created.request.withCredentials).toBe(true);
    created.flush({ data: { key: 'mdo_pk_secret', prefix: 'mdo_pk_secr' } });

    service.rotateKey().subscribe();
    const rotated = http.expectOne(`${siteUrl}/key/rotate`);
    expect(rotated.request.method).toBe('POST');
    rotated.flush({ data: { key: 'mdo_pk_new', prefix: 'mdo_pk_new' } });

    service.revokeKey().subscribe();
    const revoked = http.expectOne(`${siteUrl}/key`);
    expect(revoked.request.method).toBe('DELETE');
    revoked.flush({ data: {} });
  });

  it('reads the organization slug as a fallback', () => {
    service.getOrganizationSlug().subscribe((slug) => expect(slug).toBe('geoplan'));
    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/auth/organization/get-full-organization`);
    expect(req.request.params.get('organizationId')).toBe('org-1');
    req.flush({ slug: 'geoplan' });
  });

  it('loads the public integration guide as text', () => {
    service.getGuide().subscribe((guide) => expect(guide).toContain('MEEDO_INTEGRATION_KEY'));
    const req = http.expectOne(service.docsUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('text');
    req.flush('# Meedo\nUse MEEDO_INTEGRATION_KEY');
  });

  it('lists, creates, updates, deletes and rotates webhooks', () => {
    service.listWebhooks().subscribe((rows) => expect(rows).toHaveLength(1));
    const listed = http.expectOne((request) => request.url === webhooksUrl);
    expect(listed.request.method).toBe('GET');
    expect(listed.request.withCredentials).toBe(true);
    listed.flush({ data: [{ id: 'wh-1', url: 'https://example.test/hook', events: ['lead.created'], enabled: true, createdAt: '2026-11-01' }] });

    service.createWebhook({ url: 'https://example.test/hook', events: ['lead.created'] }).subscribe((row) => expect(row.secret).toBe('whsec'));
    const created = http.expectOne(webhooksUrl);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual({ url: 'https://example.test/hook', events: ['lead.created'] });
    created.flush({ data: { id: 'wh-1', url: 'https://example.test/hook', events: ['lead.created'], enabled: true, createdAt: '2026-11-01', secret: 'whsec' } });

    service.updateWebhook('wh-1', { enabled: false }).subscribe();
    const updated = http.expectOne(`${webhooksUrl}/wh-1`);
    expect(updated.request.method).toBe('PATCH');
    expect(updated.request.body).toEqual({ enabled: false });
    updated.flush({ data: { id: 'wh-1', enabled: false } });

    service.rotateWebhookSecret('wh-1').subscribe((row) => expect(row.secret).toBe('new-secret'));
    const rotated = http.expectOne(`${webhooksUrl}/wh-1/rotate-secret`);
    expect(rotated.request.method).toBe('POST');
    rotated.flush({ data: { secret: 'new-secret' } });

    service.deleteWebhook('wh-1').subscribe();
    const removed = http.expectOne(`${webhooksUrl}/wh-1`);
    expect(removed.request.method).toBe('DELETE');
    removed.flush({ data: {} });
  });

  it('lists webhook deliveries with paging', () => {
    service.listDeliveries('wh-1', { page: 1, limit: 25, sortField: 'createdAt', sortOrder: 'desc' }).subscribe((page) => {
      expect(page.meta.total).toBe(1);
    });
    const req = http.expectOne((request) => request.url === `${webhooksUrl}/wh-1/deliveries`);
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ data: [{ id: 'd1', event: 'lead.created', success: true, createdAt: '2026-11-01' }], meta: { total: 1, page: 1, limit: 25, lastPage: 1 } });
  });
});
