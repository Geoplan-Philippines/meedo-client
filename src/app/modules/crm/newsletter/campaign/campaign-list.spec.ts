import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
  const response = (data: Campaign[] = [draft]) => ({ data, meta: { total: data.length, page: 1, limit: 10, lastPage: data.length ? 1 : 0 } });
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
  const text = () => fixture.nativeElement.textContent as string;

  it('shows loading and then empty state', () => {
    const pending = new Subject<PaginatedApiResponse<Campaign>>(); api.list.mockReturnValue(pending);
    render(); expect(text()).toContain('Loading campaigns');
    pending.next(response([]) as PaginatedApiResponse<Campaign>); fixture.detectChanges();
    expect(text()).toContain('No campaigns found'); expect(text()).toContain('Sending is not available yet');
  });
  it('shows errors and can retry successfully', () => {
    api.list.mockReturnValueOnce(throwError(() => new Error('Invented failure')));
    const component = render(); expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
    component.load(); fixture.detectChanges(); expect(text()).toContain('Example draft');
  });
  it('shows populated results and sends search, archive filter and pagination', () => {
    const component = render();
    component.search.set('Example'); component.includeArchived.set(true); component.filter();
    expect(api.list).toHaveBeenLastCalledWith({ page: 1, limit: 10, search: 'Example', includeArchived: true });
    api.list.mockReturnValue(of({ ...response(), meta: { total: 25, page: 2, limit: 10, lastPage: 3 } }));
    component.goTo(2); fixture.detectChanges();
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(text()).toContain('Showing 11 to 20 of 25 campaigns');
  });
  it('cancels obsolete list requests when a newer filter starts', () => {
    const stale = new Subject<PaginatedApiResponse<Campaign>>(); api.list.mockReturnValueOnce(stale);
    const component = render(); component.filter();
    stale.next(response([{ ...draft, name: 'Obsolete draft' }]) as PaginatedApiResponse<Campaign>);
    fixture.detectChanges(); expect(text()).toContain('Example draft'); expect(text()).not.toContain('Obsolete draft');
  });
  it.each([['DRAFT', 'archive', 'Archive'], ['ARCHIVED', 'restore', 'Restore']] as const)('confirms %s actions and refreshes', (status, method, label) => {
    const component = render(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.changeStatus({ ...draft, status });
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(label));
    expect(api[method]).toHaveBeenCalledWith(draft.id); expect(api.list).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });
  it('does not mutate after cancellation and surfaces failed actions', () => {
    const component = render(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.changeStatus(draft); expect(api.archive).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); api.archive.mockReturnValue(throwError(() => new Error('Invented failure')));
    component.changeStatus(draft); fixture.detectChanges();
    expect(text()).toContain('could not be changed'); expect(component.busyId()).toBe(null); confirm.mockRestore();
  });
  it('hides all mutation controls for members and rejects programmatic actions', () => {
    admin.set(false); const component = render();
    expect(text()).not.toContain('Create campaign'); expect(text()).not.toContain('Archive'); expect(text()).not.toContain('Edit');
    expect(text()).toContain('View'); component.changeStatus(draft); expect(api.archive).not.toHaveBeenCalled();
  });
});
