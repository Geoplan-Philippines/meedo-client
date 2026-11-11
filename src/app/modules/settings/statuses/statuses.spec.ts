import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Statuses } from './statuses';
import { StatusesService } from './services/statuses.service';

describe('Statuses supported actions', () => {
  it('offers edit/archive/restore without an unsupported delete action', async () => {
    const status = { id: 'custom', name: 'Custom', color: '#F97316', isArchived: false, isSystem: false,
      organizationId: 'org', createdAt: '2026-10-16', updatedAt: '2026-10-16' };
    const service = { list: () => of([status]), archive: vi.fn().mockReturnValue(of(status)), restore: vi.fn().mockReturnValue(of(status)) };
    await TestBed.configureTestingModule({ imports: [Statuses], providers: [provideRouter([]), { provide: StatusesService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(Statuses);
    fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button[aria-label="Delete Custom"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label="Edit Custom"]')).toBeTruthy();
    const archive = fixture.nativeElement.querySelector('button[aria-label="Archive Custom"]') as HTMLButtonElement;
    archive.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(service.archive).toHaveBeenCalledWith(status.id);
    fixture.componentInstance.showArchivedControl.setValue(true);
    fixture.detectChanges(); await fixture.whenStable();
    (fixture.nativeElement.querySelector('button[aria-label="Restore Custom"]') as HTMLButtonElement).click();
    expect(service.restore).toHaveBeenCalledWith(status.id);
    expect('delete' in StatusesService.prototype).toBe(false);
  });
});
