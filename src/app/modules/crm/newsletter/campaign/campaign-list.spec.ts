import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { CampaignsService } from '../../services/campaigns.service';
import { Campaign } from './campaign.model';
import { CampaignList } from './campaign-list';

describe('CampaignList', () => {
  const draft = { id: 'example-id', name: 'Example draft', subject: 'Example news', status: 'DRAFT', updatedAt: '2026-10-28T00:00:00Z' } as Campaign;
  const response = (data: Campaign[] = [draft], total = data.length, pageNo = 1) =>
    ({ data, meta: { total, page: pageNo, limit: 25, lastPage: Math.ceil(total / 25) } }) as PaginatedApiResponse<Campaign>;
  let fixture: ComponentFixture<CampaignList>;
  const admin = signal(true);
  const api = { list: vi.fn(), archive: vi.fn(), restore: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks(); admin.set(true);
    api.list.mockReturnValue(of(response()));
    api.archive.mockReturnValue(of(draft)); api.restore.mockReturnValue(of(draft));
    TestBed.configureTestingModule({ imports: [CampaignList], providers: [provideRouter([]),
      { provide: AuthService, useValue: { isAdmin: admin } }, { provide: CampaignsService, useValue: api },
    ] });
  });
  const render = () => { fixture = TestBed.createComponent(CampaignList); fixture.detectChanges(); return fixture.componentInstance; };
  const settle = async () => { await fixture.whenStable(); fixture.detectChanges(); };
  const text = () => fixture.nativeElement.textContent as string;

  it('shows loading and then empty state', async () => {
    const pending = new Subject<PaginatedApiResponse<Campaign>>(); api.list.mockReturnValue(pending);
    render(); expect(text()).toContain('Loading campaigns');
    pending.next(response([])); pending.complete(); await settle();
    expect(text()).toContain('No campaigns found'); expect(text()).toContain('Sending is not available yet');
  });
  it('shows errors and can retry successfully', async () => {
    api.list.mockReturnValueOnce(throwError(() => new Error('Invented failure')));
    const component = render(); await settle();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
    component.campaigns.reload(); await settle(); expect(text()).toContain('Example draft');
  });
  it('sends search, archive filter, sort and page from the URL and shows the total', async () => {
    await TestBed.inject(Router).navigateByUrl('/?q=Example&includeArchived=true');
    render(); await settle();
    expect(api.list).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'Example', includeArchived: true, sortField: 'createdAt', sortOrder: 'desc' });
    api.list.mockReturnValue(of(response([draft], 60, 2)));
    await TestBed.inject(Router).navigateByUrl('/?q=Example&includeArchived=true&page=2&sort=name&dir=asc');
    await settle();
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, sortField: 'name', sortOrder: 'asc' }));
    expect(text()).toContain('Showing 26 to 50 of 60 campaigns');
  });
  it('cancels obsolete list requests when a newer filter starts', async () => {
    const stale = new Subject<PaginatedApiResponse<Campaign>>(); api.list.mockReturnValueOnce(stale);
    render();
    await TestBed.inject(Router).navigateByUrl('/?q=Example'); await settle();
    stale.next(response([{ ...draft, name: 'Obsolete draft' }])); await settle();
    expect(text()).toContain('Example draft'); expect(text()).not.toContain('Obsolete draft');
  });
  it.each([['DRAFT', 'archive', 'Archive'], ['ARCHIVED', 'restore', 'Restore']] as const)('confirms %s actions and refreshes', async (status, method, label) => {
    const component = render(); await settle();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.changeStatus({ ...draft, status }); await settle();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(label));
    expect(api[method]).toHaveBeenCalledWith(draft.id); expect(api.list).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });
  it('does not mutate after cancellation and surfaces failed actions', async () => {
    const component = render(); await settle();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.changeStatus(draft); expect(api.archive).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); api.archive.mockReturnValue(throwError(() => new Error('Invented failure')));
    component.changeStatus(draft); fixture.detectChanges();
    expect(text()).toContain('could not be changed'); expect(component.busyId()).toBe(null); confirm.mockRestore();
  });
  it('hides all mutation controls for members and rejects programmatic actions', async () => {
    admin.set(false); const component = render(); await settle();
    expect(text()).not.toContain('Create campaign'); expect(text()).not.toContain('Archive'); expect(text()).not.toContain('Edit');
    expect(text()).toContain('View'); component.changeStatus(draft); expect(api.archive).not.toHaveBeenCalled();
  });
});
