import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { WebhooksSettings } from './webhooks';
import { IntegrationService } from '../../../crm/services/integration.service';
import { AuthService } from '../../../../core/auth/auth.service';

describe('WebhooksSettings', () => {
  const api = { listWebhooks: vi.fn(), createWebhook: vi.fn() };
  const isAdmin = signal(true);

  beforeEach(async () => {
    vi.clearAllMocks();
    isAdmin.set(true);
    api.listWebhooks.mockReturnValue(of([
      { id: 'wh-1', url: 'https://example.test/hook', events: ['lead.created'], enabled: true, createdAt: '2026-11-01' },
    ]));
    await TestBed.configureTestingModule({
      imports: [WebhooksSettings],
      providers: [
        provideRouter([]),
        { provide: IntegrationService, useValue: api },
        { provide: AuthService, useValue: { isAdmin } },
      ],
    }).compileComponents();
  });

  it('lists endpoints and lets an admin add one', async () => {
    api.createWebhook.mockReturnValue(of({
      id: 'wh-2', url: 'https://example.test/new', events: ['lead.created'], enabled: true, createdAt: '2026-11-02', secret: 'whsec_once',
    }));
    const fixture = TestBed.createComponent(WebhooksSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('https://example.test/hook');
    expect(fixture.nativeElement.textContent).toContain('Add webhook');
    fixture.componentInstance.form.patchValue({ url: 'https://example.test/new' });
    fixture.componentInstance.save();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.createWebhook).toHaveBeenCalledWith({
      url: 'https://example.test/new',
      events: ['lead.created', 'subscriber.created', 'subscriber.unsubscribed'],
    });
    expect(fixture.nativeElement.textContent).toContain('whsec_once');
  });

  it('hides write actions for members', async () => {
    isAdmin.set(false);
    const fixture = TestBed.createComponent(WebhooksSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Add webhook');
  });
});
