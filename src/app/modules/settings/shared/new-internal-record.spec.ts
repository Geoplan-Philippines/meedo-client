import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ClientsService } from '../customers/services/clients.service';
import { ProjectAdminService } from '../projects/services/project-admin.service';
import { NewInternalRecord } from './new-internal-record';

describe('internal project and client form', () => {
  const clients = { create: vi.fn() }; const projects = { create: vi.fn() };
  beforeEach(() => { vi.clearAllMocks(); clients.create.mockReturnValue(of({})); projects.create.mockReturnValue(of({})); TestBed.configureTestingModule({ imports: [NewInternalRecord], providers: [{ provide: ClientsService, useValue: clients }, { provide: ProjectAdminService, useValue: projects }] }); });
  it('rejects whitespace names and shows an accessible error and character counter', () => {
    const fixture = TestBed.createComponent(NewInternalRecord); fixture.componentInstance.form.controls.name.setValue('   '); fixture.componentInstance.save(); fixture.detectChanges();
    expect(clients.create).not.toHaveBeenCalled(); expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy(); expect(fixture.nativeElement.textContent).toContain('0 / 200');
  });
  it('requires a client for a project and enforces the 200 character limit', () => {
    const fixture = TestBed.createComponent(NewInternalRecord); fixture.componentRef.setInput('kind', 'project'); const form = fixture.componentInstance.form;
    form.controls.name.setValue('Example'); fixture.componentInstance.save(); expect(projects.create).not.toHaveBeenCalled();
    form.controls.clientId.setValue('example-client'); form.controls.name.setValue('x'.repeat(201)); fixture.componentInstance.save(); expect(projects.create).not.toHaveBeenCalled();
    form.controls.name.setValue(' Example internal project '); fixture.componentInstance.save(); expect(projects.create).toHaveBeenCalledWith('Example internal project', 'example-client');
  });
  it('trims client names and exposes API failures', () => {
    const fixture = TestBed.createComponent(NewInternalRecord); clients.create.mockReturnValue(throwError(() => new Error('Invented failure'))); fixture.componentInstance.form.controls.name.setValue(' Example client '); fixture.componentInstance.save(); fixture.detectChanges();
    expect(clients.create).toHaveBeenCalledWith('Example client'); expect(fixture.nativeElement.textContent).toContain('Could not create'); expect(fixture.componentInstance.busy()).toBe(false);
  });
});
