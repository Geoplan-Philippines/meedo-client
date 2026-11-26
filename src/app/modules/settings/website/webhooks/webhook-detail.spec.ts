import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { WebhookDetail } from './webhook-detail';
import { IntegrationService } from '../../../crm/services/integration.service';
import { AuthService } from '../../../../core/auth/auth.service';

describe('WebhookDetail', () => {
  const api = {
    getWebhook: vi.fn(),
    listDeliveries: vi.fn(),
    updateWebhook: vi.fn(),
    rotateWebhookSecret: vi.fn(),
    deleteWebhook: vi.fn(),
  };
  const isAdmin = signal(true);

  beforeEach(async () => {
    vi.clearAllMocks();
    isAdmin.set(true);
    api.getWebhook.mockReturnValue(of({
      id: 'wh-1', url: 'https://example.test/hook', events: ['lead.created'], enabled: true, createdAt: '2026-11-01',
    }));
    api.listDeliveries.mockReturnValue(of({
      data: [{ id: 'd1', event: 'lead.created', success: true, statusCode: 200, attempt: 1, createdAt: '2026-11-02' }],
      meta: { total: 1, page: 1, limit: 25, lastPage: 1 },
    }));
    api.rotateWebhookSecret.mockReturnValue(of({ secret: 'rotated-secret' }));
    await TestBed.configureTestingModule({
      imports: [WebhookDetail],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: convertToParamMap({ id: 'wh-1' }), queryParamMap: convertToParamMap({}) },
          queryParamMap: of(convertToParamMap({})),
        } },
        { provide: IntegrationService, useValue: api },
        { provide: AuthService, useValue: { isAdmin } },
      ],
    }).compileComponents();
  });

  it('loads the endpoint, delivery log, and shows a rotated secret once', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(WebhookDetail);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.getWebhook).toHaveBeenCalledWith('wh-1');
    expect(api.listDeliveries).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Delivery log');
    expect(fixture.nativeElement.textContent).toContain('X-Meedo-Signature');
    fixture.componentInstance.rotateSecret();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.rotateWebhookSecret).toHaveBeenCalledWith('wh-1');
    expect(fixture.nativeElement.textContent).toContain('rotated-secret');
  });
});
