import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { LeadEditor } from './lead-editor';
import { CrmService } from '../services/crm.service';
import { FieldDefinitionsService } from '../services/field-definitions.service';
import { FieldDefinition } from '../models/field-definition.model';

const emailField: FieldDefinition = {
  id: 'f1', collection: 'lead', key: 'email', label: 'Email', type: 'text',
  options: [], isRequired: true, isReadOnly: false, isSystem: true, position: 0,
};

describe('LeadEditor', () => {
  const crm = {
    getLead: vi.fn(),
    createLead: vi.fn(),
    updateLead: vi.fn(),
    updateLeadStatus: vi.fn(),
    archiveLead: vi.fn(),
    restoreLead: vi.fn(),
  };
  const fields = { list: vi.fn() };
  let id: string | null;

  beforeEach(async () => {
    vi.clearAllMocks();
    id = null;
    fields.list.mockReturnValue(of([emailField]));
    crm.getLead.mockReturnValue(of({
      id: 'lead-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test',
      status: 'NEW', isArchived: false, createdAt: '2026-11-01',
    }));
    crm.createLead.mockReturnValue(of({ id: 'lead-2', email: 'new@example.test' }));
    crm.updateLead.mockReturnValue(of({ id: 'lead-1', email: 'ada@example.test' }));
    crm.archiveLead.mockReturnValue(of({ id: 'lead-1', isArchived: true, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', createdAt: '2026-11-01' }));
    await TestBed.configureTestingModule({
      imports: [LeadEditor],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useFactory: () => ({ snapshot: { paramMap: convertToParamMap(id ? { id } : { id: 'new' }) } }) },
        { provide: CrmService, useValue: crm },
        { provide: FieldDefinitionsService, useValue: fields },
      ],
    }).compileComponents();
  });

  const render = async () => {
    const fixture = TestBed.createComponent(LeadEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('loads field definitions without fetching a lead on the create page', async () => {
    const fixture = await render();
    expect(fields.list).toHaveBeenCalledWith('lead');
    expect(crm.getLead).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Add lead');
  });

  it('loads an existing lead and archives it after confirm', async () => {
    id = 'lead-1';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = await render();
    expect(crm.getLead).toHaveBeenCalledWith('lead-1');
    fixture.componentInstance.toggleArchive();
    expect(crm.archiveLead).toHaveBeenCalledWith('lead-1');
  });

  it('shows every validation error from a failed save', async () => {
    id = 'lead-1';
    crm.updateLead.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      error: { message: ['Email is required.', 'Site must start with http:// or https://.'] },
    })));
    const fixture: ComponentFixture<LeadEditor> = await render();
    fixture.componentInstance.save();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Email is required.');
    expect(fixture.nativeElement.textContent).toContain('Site must start with http:// or https://.');
  });
});
