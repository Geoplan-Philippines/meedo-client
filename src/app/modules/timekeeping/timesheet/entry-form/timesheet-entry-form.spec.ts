import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TimesheetService } from '../services/timesheet.service';
import { TimesheetEntry } from '../models/timesheet.model';
import { manilaTodayKey, TimesheetEntryForm } from './timesheet-entry-form';

describe('timesheet entry form', () => {
  const api = { createEntry: vi.fn(), updateEntry: vi.fn() };
  const entry = { id: 'example-entry', userId: 'example-member', workDate: '2026-10-24', hours: 2, workType: 'REGULAR', task: 'Example work', description: 'Example work', ticketId: null, projectId: null, status: 'SUBMITTED', isOvertime: false, isNightDifferential: false } as TimesheetEntry;
  beforeEach(() => { vi.clearAllMocks(); api.createEntry.mockReturnValue(of(entry)); api.updateEntry.mockReturnValue(of(entry)); TestBed.configureTestingModule({ imports: [TimesheetEntryForm], providers: [{ provide: TimesheetService, useValue: api }] }); });
  it.each([['2026-10-27T15:59:59Z', '2026-10-27'], ['2026-10-27T16:00:00Z', '2026-10-28']])('uses the Manila date at %s', (instant, day) => expect(manilaTodayKey(new Date(instant))).toBe(day));
  it('requires trimmed free text and allows weekend work without a project', () => {
    const fixture = TestBed.createComponent(TimesheetEntryForm); const form = fixture.componentInstance; form.date = '2026-10-24'; form.work.set({ mode: 'description', ticketId: null, projectId: null, description: '   ' }); form.save(); expect(api.createEntry).not.toHaveBeenCalled(); form.work.update(work => ({ ...work, description: ' Example independent work ' })); form.save(); expect(api.createEntry).toHaveBeenCalledWith(expect.objectContaining({ description: 'Example independent work', projectId: null, ticketId: null, workDate: '2026-10-24' }));
  });
  it('requires a ticket in ticket mode and sends no employee-entered description or project', () => {
    const fixture = TestBed.createComponent(TimesheetEntryForm); const form = fixture.componentInstance; form.date = '2026-10-25'; form.work.set({ mode: 'ticket', ticketId: null, projectId: null, description: '' }); form.save(); expect(api.createEntry).not.toHaveBeenCalled(); form.work.update(work => ({ ...work, ticketId: 'example-ticket' })); form.save(); expect(api.createEntry).toHaveBeenCalledWith(expect.objectContaining({ ticketId: 'example-ticket' })); const payload = api.createEntry.mock.calls[0][0]; expect(payload).not.toHaveProperty('description'); expect(payload).not.toHaveProperty('projectId');
  });
  it('edits a submitted entry through the same API without changing its status', () => {
    const fixture = TestBed.createComponent(TimesheetEntryForm); fixture.componentRef.setInput('entry', entry); fixture.detectChanges(); fixture.componentInstance.hours = 3; fixture.componentInstance.save(); expect(api.updateEntry).toHaveBeenCalledWith(entry.id, expect.objectContaining({ hours: 3 })); expect(api.updateEntry.mock.calls[0][1]).not.toHaveProperty('status'); expect(fixture.nativeElement.textContent).toContain('stays submitted');
  });
  it('rejects future dates and over-limit descriptions and reports API errors', () => {
    const fixture = TestBed.createComponent(TimesheetEntryForm); const form = fixture.componentInstance; form.date = '2099-01-01'; form.work.update(work => ({ ...work, description: 'Example' })); form.save(); expect(api.createEntry).not.toHaveBeenCalled(); form.date = '2026-10-24'; form.work.update(work => ({ ...work, description: 'x'.repeat(1001) })); form.save(); expect(api.createEntry).not.toHaveBeenCalled(); form.work.update(work => ({ ...work, description: 'Example' })); api.createEntry.mockReturnValue(throwError(() => new Error('Example failure'))); form.save(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
  });
});
