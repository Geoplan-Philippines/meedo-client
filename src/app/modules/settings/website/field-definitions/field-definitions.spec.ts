import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { FieldDefinitionsSettings } from './field-definitions';
import { FieldDefinitionsService } from '../../../crm/services/field-definitions.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { FieldDefinition } from '../../../crm/models/field-definition.model';

const system: FieldDefinition = {
  id: 'sys', collection: 'lead', key: 'email', label: 'Email', type: 'text',
  options: [], isRequired: true, isReadOnly: true, isSystem: true, position: 0,
};
const custom: FieldDefinition = {
  id: 'cus', collection: 'lead', key: 'industry', label: 'Industry', type: 'text',
  options: [], isRequired: false, isReadOnly: false, isSystem: false, position: 1,
};

describe('FieldDefinitionsSettings', () => {
  const api = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), reorder: vi.fn() };
  const isAdmin = signal(true);

  beforeEach(async () => {
    vi.clearAllMocks();
    isAdmin.set(true);
    api.list.mockReturnValue(of([system, custom]));
    await TestBed.configureTestingModule({
      imports: [FieldDefinitionsSettings],
      providers: [
        provideRouter([]),
        { provide: FieldDefinitionsService, useValue: api },
        { provide: AuthService, useValue: { isAdmin } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { collection: 'lead', heading: 'Lead fields', subtitle: 'Custom fields' } } } },
      ],
    }).compileComponents();
  });

  async function render(): Promise<ComponentFixture<FieldDefinitionsSettings>> {
    const fixture = TestBed.createComponent(FieldDefinitionsSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists system fields as locked and custom fields as editable for admins', async () => {
    const fixture = await render();
    expect(api.list).toHaveBeenCalledWith('lead');
    expect(fixture.nativeElement.textContent).toContain('Email');
    expect(fixture.nativeElement.textContent).toContain('Industry');
    expect(fixture.nativeElement.textContent).toContain('Add field');
    expect(fixture.nativeElement.textContent).toContain('Edit');
  });

  it('hides write actions for members', async () => {
    isAdmin.set(false);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).not.toContain('Add field');
    expect(fixture.nativeElement.textContent).not.toContain('Delete');
  });

  it('loads the subscriber collection when the route asks for it', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [FieldDefinitionsSettings],
      providers: [
        provideRouter([]),
        { provide: FieldDefinitionsService, useValue: api },
        { provide: AuthService, useValue: { isAdmin } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { collection: 'subscriber', heading: 'Subscriber fields', subtitle: 'Newsletter fields' } } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(FieldDefinitionsSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.list).toHaveBeenCalledWith('subscriber');
    expect(fixture.nativeElement.textContent).toContain('Subscriber fields');
  });

  it('deletes a custom field after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.remove.mockReturnValue(of(undefined));
    const fixture = await render();
    fixture.componentInstance.remove(custom);
    expect(api.remove).toHaveBeenCalledWith('cus');
  });
});
