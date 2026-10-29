import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TimesheetService } from '../services/timesheet.service';
import { EntryWorkSelection, TimesheetWorkSelector } from './timesheet-work-selector';

describe('two-mode work selection and quick ticket creation', () => {
  const api = { getTickets: vi.fn(), createTicket: vi.fn() };
  const ticket = { id: 'example-ticket', ticketNumber: 123456, title: 'Example ticket', projectId: 'example-project' };
  const value: EntryWorkSelection = { mode: 'description', description: '', ticketId: null, projectId: null };
  beforeEach(() => { vi.clearAllMocks(); api.getTickets.mockReturnValue(of({ data: [ticket], meta: { lastPage: 2 } })); api.createTicket.mockReturnValue(of(ticket)); TestBed.configureTestingModule({ imports: [TimesheetWorkSelector], providers: [{ provide: TimesheetService, useValue: api }] }); });
  function setup() { const fixture = TestBed.createComponent(TimesheetWorkSelector); fixture.componentRef.setInput('value', value); fixture.componentInstance.changed.subscribe(next => fixture.componentRef.setInput('value', next)); fixture.detectChanges(); return fixture; }
  it('supports free text without a project and exposes a live counter and maxlength', () => {
    const fixture = setup(); fixture.componentInstance.describe(' Example work '); fixture.detectChanges(); expect(fixture.componentInstance.value().projectId).toBeNull(); expect(fixture.nativeElement.textContent).toContain('12 / 1000'); expect(fixture.nativeElement.querySelector('textarea').maxLength).toBe(1000);
  });
  it('loads eligible ticket pages on demand, selects the derived description and prevents typing it', () => {
    const fixture = setup(); fixture.componentInstance.setMode('ticket'); fixture.detectChanges(); expect(api.getTickets).toHaveBeenCalledWith(1, ''); fixture.componentInstance.selectTicket(ticket.id); fixture.detectChanges(); expect(fixture.componentInstance.value()).toMatchObject({ ticketId: ticket.id, projectId: ticket.projectId, description: ticket.title }); expect(fixture.nativeElement.querySelector('textarea').readOnly).toBe(true);
    fixture.componentInstance.search = 'Example'; fixture.componentInstance.load(2); expect(api.getTickets).toHaveBeenLastCalledWith(2, 'Example');
  });
  it('creates a ticket inside the form and immediately selects it', () => {
    const fixture = setup(); fixture.componentInstance.setMode('ticket'); fixture.detectChanges(); fixture.componentInstance.newTitle = ' Example quick ticket '; fixture.componentInstance.newProjectId = 'example-project'; fixture.componentInstance.createTicket(); fixture.detectChanges(); expect(api.createTicket).toHaveBeenCalledWith('Example quick ticket', 'example-project'); expect(fixture.componentInstance.value().ticketId).toBe(ticket.id); expect(fixture.nativeElement.textContent).toContain('#123456');
  });
  it('rejects blank quick titles and exposes server membership errors', () => {
    const fixture = setup(); fixture.componentInstance.newTitle = '   '; fixture.componentInstance.createTicket(); expect(api.createTicket).not.toHaveBeenCalled(); api.createTicket.mockReturnValue(throwError(() => new Error('Example denied membership'))); fixture.componentInstance.newTitle = 'Example ticket'; fixture.componentInstance.createTicket(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
  });
  it('keeps submitted/approved detail selectors read-only', () => {
    const fixture = setup(); fixture.componentRef.setInput('readonly', true); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true); expect(fixture.nativeElement.querySelector('.mode-buttons')).toBeNull();
  });
});
