import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { crmRoutes } from './crm.routes';
import { CrmService } from './services/crm.service';
import { CampaignsService } from './services/campaigns.service';

describe('Website lazy routing', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideRouter([{ path: 'crm', children: crmRoutes }]),
    { provide: AuthService, useValue: { isAdmin: () => false } },
    { provide: CrmService, useValue: { listLeads: () => of({ data: [], meta: { total: 0, page: 1, limit: 25, lastPage: 0 } }), getLeadsStats: () => of({ data: { total: 0, new: 0, contacted: 0, qualified: 0, lost: 0 } }), listSubscribers: () => of({ data: [], meta: { total: 0, page: 1, limit: 25, lastPage: 0 } }) } },
    { provide: CampaignsService, useValue: { list: () => of({ data: [], meta: { total: 0, lastPage: 0 } }) } },
  ] }));
  it.each([
    ['/crm/leads', 'app-leads'],
    ['/crm/newsletter/subscribers', 'app-subscribers'],
    ['/crm/newsletter/campaigns', 'app-campaign-list'],
  ])('renders %s without a top tab bar', async (url, selector) => {
    const harness = await RouterTestingHarness.create(url);
    expect(harness.routeNativeElement?.matches(selector)).toBe(true);
    const host = harness.fixture.nativeElement as HTMLElement;
    expect(host.querySelector('nav')).toBeNull();
    for (const section of ['/crm/leads', '/crm/newsletter/subscribers', '/crm/newsletter/campaigns']) {
      expect(host.querySelector(`a[href="${section}"]`)).toBeNull();
    }
  }, 15000);
});
