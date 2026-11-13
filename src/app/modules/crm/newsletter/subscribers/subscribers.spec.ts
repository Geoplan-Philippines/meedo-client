import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CrmService } from '../../services/crm.service';
import { Subscribers } from './subscribers';

describe('Subscribers', () => {
  let component: Subscribers;
  let fixture: ComponentFixture<Subscribers>;
  const crm = { listSubscribers: vi.fn() };

  beforeEach(async () => {
    crm.listSubscribers.mockReset().mockReturnValue(of({
      data: [{ id: 's1', email: 'sub@example.test', name: 'Example', createdAt: '2026-10-01' }],
      meta: { total: 3000, page: 1, limit: 25, lastPage: 120 },
    }));
    await TestBed.configureTestingModule({
      imports: [Subscribers],
      providers: [provideRouter([]), { provide: CrmService, useValue: crm }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Subscribers);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('asks for one page, newest first, and reports the audience size from the total', () => {
    expect(crm.listSubscribers).toHaveBeenCalledWith({ page: 1, limit: 25, sortField: 'createdAt', sortOrder: 'desc' });
    expect(component.statItems()[0].value).toBe(3000);
    expect(fixture.nativeElement.textContent).toContain('Showing 1 to 25 of 3000 subscribers');
  });

  it('keeps the audience size while a search narrows the list', async () => {
    crm.listSubscribers.mockReturnValue(of({ data: [], meta: { total: 4, page: 1, limit: 25, lastPage: 1 } }));
    await TestBed.inject(Router).navigateByUrl('/?q=example');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(crm.listSubscribers).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'example', page: 1 }));
    expect(component.statItems()[0].value).toBe(3000);
  });
});
