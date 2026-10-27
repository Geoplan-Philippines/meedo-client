import { TimesheetEntry } from '../models/timesheet.model';
import { timesheetProjectLabel, withEntryProjects } from './timesheet-project.util';

describe('timesheet project helpers', () => {
  it('labels a project "Client — Name · WO" and skips the WO number when it is the name', () => {
    expect(
      timesheetProjectLabel({ id: 'p', workOrderNumber: 'SO-1', status: 'Open', quoteSubject: 'RTLS Dashboard', customerName: 'Denso PH' }),
    ).toBe('Denso PH — RTLS Dashboard · SO-1');
    expect(timesheetProjectLabel({ id: 'p', workOrderNumber: 'SO-1', status: 'Open' })).toBe('SO-1');
  });

  it('keeps entries on an archived project visible, tagged as archived', () => {
    const entry = {
      projectId: 'archived',
      project: { id: 'archived', workOrderNumber: 'SO-9', status: 'Closed', isArchived: true, client: { customerName: 'Denso PH' } },
    } as TimesheetEntry;
    const active = [{ id: 'active', workOrderNumber: 'SO-1', status: 'Open' }];

    const projects = withEntryProjects(active, [entry, entry]);

    expect(projects.map((p) => [p.id, p.isArchived ?? false])).toEqual([
      ['active', false],
      ['archived', true],
    ]);
  });
});
