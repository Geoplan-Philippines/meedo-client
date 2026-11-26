import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SubscriberEditor } from './subscriber-editor';
import { CrmService } from '../../services/crm.service';
import { FieldDefinitionsService } from '../../services/field-definitions.service';
import { FieldDefinition } from '../../models/field-definition.model';

const emailField: FieldDefinition = {
  id: 'f1', collection: 'subscriber', key: 'email', label: 'Email', type: 'text',
  options: [], isRequired: true, isReadOnly: false, isSystem: true, position: 0,
};

describe('SubscriberEditor', () => {
  const crm = {
    getSubscriber: vi.fn(),
    updateSubscriber: vi.fn(),
    archiveSubscriber: vi.fn(),
    restoreSubscriber: vi.fn(),
  };
  const fields = { list: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    fields.list.mockReturnValue(of([emailField]));
    crm.getSubscriber.mockReturnValue(of({
      id: 'sub-1', email: 'ada@example.test', name: 'Ada Lovelace',
      status: 'SUBSCRIBED', isArchived: false, createdAt: '2026-11-01',
    }));
    crm.updateSubscriber.mockReturnValue(of({ id: 'sub-1', email: 'ada@example.test' }));
    crm.archiveSubscriber.mockReturnValue(of({
      id: 'sub-1', email: 'ada@example.test', name: 'Ada Lovelace', isArchived: true, createdAt: '2026-11-01',
    }));
    await TestBed.configureTestingModule({
      imports: [SubscriberEditor],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'sub-1' }) } } },
        { provide: CrmService, useValue: crm },
        { provide: FieldDefinitionsService, useValue: fields },
      ],
    }).compileComponents();
  });

  const render = async () => {
    const fixture = TestBed.createComponent(SubscriberEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('loads subscriber field definitions and the record', async () => {
    const fixture = await render();
    expect(fields.list).toHaveBeenCalledWith('subscriber');
    expect(crm.getSubscriber).toHaveBeenCalledWith('sub-1');
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
  });

  it('archives the subscriber after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = await render();
    fixture.componentInstance.toggleArchive();
    expect(crm.archiveSubscriber).toHaveBeenCalledWith('sub-1');
  });

  it('shows every validation error from a failed save', async () => {
    crm.updateSubscriber.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      error: { message: ['Email is required.', 'Site must start with http:// or https://.'] },
    })));
    const fixture: ComponentFixture<SubscriberEditor> = await render();
    fixture.componentInstance.save();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Email is required.');
    expect(fixture.nativeElement.textContent).toContain('Site must start with http:// or https://.');
  });
});
