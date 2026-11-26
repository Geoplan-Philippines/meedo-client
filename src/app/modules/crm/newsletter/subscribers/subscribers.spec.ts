import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CrmService } from '../../services/crm.service';
import { Subscriber } from '../../models/crm.model';
import { Subscribers } from './subscribers';

const page = (data: Subscriber[], total = data.length) => of({ data, meta: { total, page: 1, limit: 25, lastPage: Math.ceil(total / 25) } });

describe('Subscribers', () => {
  const crm = { listSubscribers: vi.fn(), getSubscriberStats: vi.fn(), exportSubscribers: vi.fn() };
  let component: Subscribers;
  let fixture: ComponentFixture<Subscribers>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    crm.listSubscribers.mockReturnValue(page([]));
    crm.getSubscriberStats.mockReturnValue(of({ data: { total: 3000, newThisMonth: 12, unsubscribed: 4 } }));
    crm.exportSubscribers.mockReturnValue(of({ body: new Blob(['email\n']), headers: { get: () => 'attachment; filename="subscribers.csv"' } }));
    await TestBed.configureTestingModule({
      imports: [Subscribers],
      providers: [provideRouter([]), { provide: CrmService, useValue: crm }],
    }).compileComponents();
  });

  const render = async () => {
    fixture = TestBed.createComponent(Subscribers);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('loads real subscriber stats, not the current page total', async () => {
    await render();
    expect(crm.getSubscriberStats).toHaveBeenCalled();
    expect(component.statItems().map((item) => item.value)).toEqual([3000, 12, 4]);
    expect(fixture.nativeElement.textContent).toContain('New this month');
    expect(fixture.nativeElement.textContent).toContain('Unsubscribed');
  });

  it('asks the API for one page, newest first, and shows its total', async () => {
    crm.listSubscribers.mockReturnValue(page([{ id: 's1', email: 'sub@example.test', name: 'Example', createdAt: '2026-10-01' }], 60));
    await render();
    expect(crm.listSubscribers).toHaveBeenCalledWith({ page: 1, limit: 25, sortField: 'createdAt', sortOrder: 'desc', status: null, archived: false });
    expect(fixture.nativeElement.textContent).toContain('Showing 1 to 25 of 60 subscribers');
  });

  it('keeps the audience size while a search narrows the list', async () => {
    crm.listSubscribers.mockReturnValue(page([], 4));
    await TestBed.inject(Router).navigateByUrl('/?q=example');
    await render();
    expect(crm.listSubscribers).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'example', page: 1 }));
    expect(component.statItems()[0].value).toBe(3000);
  });

  it('filters by status tab and archived view', async () => {
    await render();
    component.setTab('UNSUBSCRIBED');
    await fixture.whenStable();
    expect(crm.listSubscribers).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'UNSUBSCRIBED', archived: false }));
    component.setTab('ARCHIVED');
    await fixture.whenStable();
    expect(crm.listSubscribers).toHaveBeenLastCalledWith(expect.objectContaining({ status: null, archived: true }));
  });

  it('exports the current filters as CSV', async () => {
    crm.exportSubscribers.mockReturnValue(of({ body: null, headers: { get: () => null } }));
    await render();
    component.exportCsv();
    expect(crm.exportSubscribers).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });
});
