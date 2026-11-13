import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Statuses } from './statuses';
import { StatusesService } from './services/statuses.service';

describe('Statuses supported actions', () => {
  it('offers edit/archive/restore without an unsupported delete action', async () => {
    const status = { id: 'custom', name: 'Custom', color: '#F97316', isArchived: false, isSystem: false,
      organizationId: 'org', createdAt: '2026-10-16', updatedAt: '2026-10-16' };
    const page = (data: unknown[]) => of({ data, meta: { total: data.length, page: 1, limit: 10, lastPage: 1 } });
    const service = {
      list: vi.fn((query: { isSystem?: boolean }) => page(query.isSystem ? [] : [status])),
      archive: vi.fn().mockReturnValue(of(status)),
      restore: vi.fn().mockReturnValue(of(status)),
    };
    await TestBed.configureTestingModule({ imports: [Statuses], providers: [provideRouter([]), { provide: StatusesService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(Statuses);
    fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button[aria-label="Delete Custom"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label="Edit Custom"]')).toBeTruthy();
    const archive = fixture.nativeElement.querySelector('button[aria-label="Archive Custom"]') as HTMLButtonElement;
    archive.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(service.archive).toHaveBeenCalledWith(status.id);
    // Standard and custom statuses are separate paged requests.
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ isSystem: true, page: 1, limit: 10 }));
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ isSystem: false, includeArchived: false }));
    service.list.mockImplementation((query: { isSystem?: boolean }) => page(query.isSystem ? [] : [{ ...status, isArchived: true }]));
    await TestBed.inject(Router).navigateByUrl('/?includeArchived=true');
    await fixture.whenStable(); fixture.detectChanges();
    expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ isSystem: false, includeArchived: true }));
    (fixture.nativeElement.querySelector('button[aria-label="Restore Custom"]') as HTMLButtonElement).click();
    expect(service.restore).toHaveBeenCalledWith(status.id);
    expect('delete' in StatusesService.prototype).toBe(false);
  });
});
