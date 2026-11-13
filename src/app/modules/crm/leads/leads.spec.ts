import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { Leads } from './leads';
import { CrmService } from '../services/crm.service';
import { Lead } from '../models/crm.model';

const page = (data: Lead[], total = data.length) => of({ data, meta: { total, page: 1, limit: 25, lastPage: Math.ceil(total / 25) } });

describe('Leads', () => {
  const crm = { listLeads: vi.fn(), getLeadsStats: vi.fn() };
  let component: Leads;
  let fixture: ComponentFixture<Leads>;

  beforeEach(async () => {
    vi.clearAllMocks();
    crm.listLeads.mockReturnValue(page([]));
    crm.getLeadsStats.mockReturnValue(of({ data: { total: 4, pending: 1, contacted: 1, qualified: 1, lost: 1 } }));
    await TestBed.configureTestingModule({
      imports: [Leads], providers: [provideRouter([]), { provide: CrmService, useValue: crm }],
    }).compileComponents();
  });

  const render = async () => {
    fixture = TestBed.createComponent(Leads);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('loads the four real lead status counts', async () => {
    await render();
    expect(crm.getLeadsStats).toHaveBeenCalled();
    expect(component.statItems().map((item) => item.value)).toEqual([4, 1, 1, 1, 1]);
    expect(fixture.nativeElement.textContent).toContain('Contacted');
    expect(fixture.nativeElement.textContent).toContain('Lost');
  });

  it('asks the API for one page, newest first, and shows its total', async () => {
    crm.listLeads.mockReturnValue(page([{ id: '1', firstName: 'Example', lastName: 'Lead', email: 'lead@example.test', createdAt: '2026-10-29' }], 60));
    await render();
    expect(crm.listLeads).toHaveBeenCalledWith({ page: 1, limit: 25, sortField: 'createdAt', sortOrder: 'desc', status: null });
    expect(fixture.nativeElement.textContent).toContain('Showing 1 to 25 of 60 leads');
  });

  it('takes page, size, sort and search from the URL', async () => {
    crm.listLeads.mockReturnValue(page([], 100));
    await TestBed.inject(Router).navigateByUrl('/?page=2&size=10&sort=email&dir=asc&q=jane');
    await render();
    expect(crm.listLeads).toHaveBeenLastCalledWith({ page: 2, limit: 10, search: 'jane', sortField: 'email', sortOrder: 'asc', status: null });
    expect(component.list.searchInput()).toBe('jane');
  });

  it('applies the themed badge class for uppercase API statuses', async () => {
    crm.listLeads.mockReturnValue(page(['PENDING', 'CONTACTED', 'QUALIFIED', 'LOST'].map((status, index) => ({
      id: String(index), firstName: 'Example', lastName: status, email: `example${index}@example.test`, status, createdAt: '2026-10-29',
    }))));
    await render();
    const badges = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.status-badge')];
    expect(badges.map(badge => [...badge.classList].find(name => name.startsWith('status-') && name !== 'status-badge')))
      .toEqual(['pending', 'contacted', 'qualified', 'lost'].map(status => `status-${status}`));
    expect(badges.map(badge => [...badge.classList].find(name => name.startsWith('p-tag-') && name !== 'p-tag-rounded')))
      .toEqual(['p-tag-warn', 'p-tag-info', 'p-tag-success', 'p-tag-danger']);
  });
});
