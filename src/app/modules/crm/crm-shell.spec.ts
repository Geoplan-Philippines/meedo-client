import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { crmRoutes } from './crm.routes';
import { CrmService } from './services/crm.service';
import { CampaignsService } from './services/campaigns.service';

describe('CRM lazy shell routing', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideRouter([{ path: 'crm', children: crmRoutes }]),
    { provide: AuthService, useValue: { isAdmin: () => false } },
    { provide: CrmService, useValue: { getLeads: () => of({ data: [] }), getSubscribers: () => of({ data: [] }) } },
    { provide: CampaignsService, useValue: { list: () => of({ data: [], meta: { total: 0, lastPage: 0 } }) } },
  ] }));
  it.each([
    ['/crm/leads', 'app-leads', 'Leads'],
    ['/crm/newsletter/subscribers', 'app-subscribers', 'Subscribers'],
    ['/crm/newsletter/campaigns', 'app-campaign-list', 'Campaigns'],
  ])('renders %s with three tabs and the active member-visible section', async (url, selector, label) => {
    const harness = await RouterTestingHarness.create(url);
    const root = harness.routeNativeElement!;
    const tabs = root.querySelectorAll('nav[aria-label="CRM sections"] a');
    expect(Array.from(tabs).map(tab => tab.textContent?.trim())).toEqual(['Leads', 'Subscribers', 'Campaigns']);
    expect(root.querySelector(selector)).toBeTruthy();
    expect(root.querySelector('nav a[aria-current=page]')?.textContent).toBe(label);
  }, 15000);
});
