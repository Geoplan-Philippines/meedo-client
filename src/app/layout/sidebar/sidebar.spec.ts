import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Sidebar } from './sidebar';

@Component({ template: '' })
class Destination {}

describe('Sidebar', () => {
  let fixture: ComponentFixture<Sidebar>;
  let router: Router;
  const isAdmin = signal(true);

  const element = () => fixture.nativeElement as HTMLElement;
  const links = () => [...element().querySelectorAll<HTMLAnchorElement>('a.sidebar-link')];
  const labels = () => links().map((link) => link.textContent?.trim());
  const link = (label: string) => links().find((a) => a.textContent?.trim() === label)!;
  const activeLabels = () => links().filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent?.trim());

  beforeEach(async () => {
    isAdmin.set(true);
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [
        provideRouter([{ path: '**', component: Destination }]),
        { provide: AuthService, useValue: { currentUser: () => ({ name: 'Maria Santos' }), isAdmin } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Sidebar);
    fixture.detectChanges();
  });

  it('lists My tickets, then the Workspace, Tickets, Timekeeping and Website sections in order', () => {
    expect([...element().querySelectorAll('.sidebar-section-title')].map((h) => h.textContent?.trim()))
      .toEqual(['Workspace', 'Tickets', 'Timekeeping', 'Website']);
    expect(labels()).toEqual([
      'My tickets',
      'Clients', 'Users', 'Teams',
      'Ticket overview', 'Tickets',
      'Time overview', 'Attendance', 'Timesheet', 'Approvals',
      'Leads', 'Subscribers', 'Campaigns',
    ]);
    const text = element().textContent ?? '';
    expect(text).not.toMatch(/Dashboard|CRM|See all|Projects|New project/);
  });

  it('has no user row', () => {
    expect(element().textContent).not.toContain('Maria Santos');
    expect(element().querySelector('button')).toBeNull();
  });

  it('nests Subscribers and Campaigns under a Newsletter label', () => {
    const group = element().querySelector('.sidebar-group-label')!;
    expect(group.textContent?.trim()).toBe('Newsletter');
    expect(group.closest('a')).toBeNull();
    const sublist = element().querySelector('.sidebar-sublist')!;
    expect(sublist.getAttribute('aria-labelledby')).toBe(group.id);
    expect([...sublist.querySelectorAll('a')].map((a) => a.textContent?.trim())).toEqual(['Subscribers', 'Campaigns']);
    expect(link('Leads').closest('.sidebar-sublist')).toBeNull();
  });

  it('links each item to its existing page', () => {
    expect(link('My tickets').getAttribute('href')).toBe('/tickets?assignee=me');
    expect(link('Tickets').getAttribute('href')).toBe('/tickets');
    expect(link('Ticket overview').getAttribute('href')).toBe('/tickets/dashboard');
    expect(link('Time overview').getAttribute('href')).toBe('/timekeeping/dashboard');
    expect(link('Clients').getAttribute('href')).toBe('/clients');
    expect(link('Users').getAttribute('href')).toBe('/settings/users');
    expect(link('Teams').getAttribute('href')).toBe('/settings/teams');
    expect(link('Leads').getAttribute('href')).toBe('/crm/leads');
    expect(link('Subscribers').getAttribute('href')).toBe('/crm/newsletter/subscribers');
    expect(link('Campaigns').getAttribute('href')).toBe('/crm/newsletter/campaigns');
  });

  it('gives every item its own icon', () => {
    const icons = links().map((a) => [...a.querySelector('i')!.classList].find((c) => c.startsWith('pi-')));
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('keeps the admin-only Users, Time overview and Approvals hidden from members, as before', () => {
    isAdmin.set(false);
    fixture.detectChanges();
    expect(labels()).toEqual([
      'My tickets',
      'Clients', 'Teams',
      'Ticket overview', 'Tickets',
      'Attendance', 'Timesheet',
      'Leads', 'Subscribers', 'Campaigns',
    ]);
  });

  it.each([
    ['/tickets', 'Tickets'],
    ['/tickets?view=board', 'Tickets'],
    ['/tickets?assignee=me', 'My tickets'],
    ['/tickets?view=board&assignee=me', 'My tickets'],
    ['/tickets/abc-123', 'Tickets'],
    ['/tickets/dashboard', 'Ticket overview'],
    ['/clients', 'Clients'],
    ['/clients/acme', 'Clients'],
    ['/clients/acme/projects/p1', 'Clients'],
    ['/clients/acme/projects/p1/tickets', 'Clients'],
    ['/clients/acme/projects/p1/tickets?view=board&assignee=me', 'Clients'],
    ['/settings/projects', 'Clients'],
    ['/settings/users', 'Users'],
    ['/settings/teams', 'Teams'],
    ['/timekeeping/dashboard', 'Time overview'],
    ['/timekeeping/timesheet', 'Timesheet'],
    ['/timekeeping/timesheet/approval', 'Approvals'],
    ['/crm/leads', 'Leads'],
    ['/crm/newsletter/subscribers', 'Subscribers'],
    ['/crm/newsletter/campaigns/new', 'Campaigns'],
  ])('lights only the matching item on %s', async (url, label) => {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    expect(activeLabels()).toEqual([label]);
    expect(link(label).classList.contains('bg-selected')).toBe(true);
  });

  it('lights nothing on pages outside the sidebar', async () => {
    await router.navigateByUrl('/settings/statuses');
    fixture.detectChanges();
    expect(activeLabels()).toEqual([]);
  });
});
