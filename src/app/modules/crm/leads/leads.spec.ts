import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Leads } from './leads';
import { CrmService } from '../services/crm.service';
import { of } from 'rxjs';
import { vi } from 'vitest';

describe('Leads', () => {
  const crm = { getLeads: vi.fn(), getLeadsStats: vi.fn() };
  let component: Leads;
  let fixture: ComponentFixture<Leads>;

  beforeEach(async () => {
    crm.getLeads.mockReturnValue(of({ data: [] }));
    crm.getLeadsStats.mockReturnValue(of({ data: { total: 4, pending: 1, contacted: 1, qualified: 1, lost: 1 } }));
    await TestBed.configureTestingModule({
      imports: [Leads], providers: [{ provide: CrmService, useValue: crm }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Leads);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the four real lead status counts', () => {
    fixture.detectChanges();
    expect(crm.getLeadsStats).toHaveBeenCalled();
    expect(component.stats()).toEqual({ total: 4, pending: 1, contacted: 1, qualified: 1, lost: 1 });
    expect(fixture.nativeElement.textContent).toContain('Contacted');
    expect(fixture.nativeElement.textContent).toContain('Lost');
  });
});
