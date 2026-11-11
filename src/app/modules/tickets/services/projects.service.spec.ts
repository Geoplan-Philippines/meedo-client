import { Project } from '../models/projects.model';
import { PROJECT_PICKER_LIMIT, filterProjects, toPickerProject, withCurrentProject } from './projects.service';

const record = (id: string, overrides: Partial<Project> = {}): Project =>
  toPickerProject({
    id,
    apptivoId: `wo-${id}`,
    name: `Project ${id}`,
    displayName: null,
    workOrderNumber: `SO-${id}`,
    quoteSubject: `Project ${id}`,
    customerName: 'Denso PH',
    status: 'Completed',
    total: 0,
    reportedDate: null,
    clientId: 'client-1',
    clientLocked: false,
    isArchived: false,
    client: { id: 'client-1', name: 'Denso', customerName: 'Denso PH', displayName: 'Denso', isArchived: false },
    ...overrides,
  });

describe('ticket project picker helpers', () => {
  it('does not add a hidden current project for a non-admin picker', () => { const active = [record('1')]; expect(withCurrentProject(active, { id: 'hidden', customerName: 'Example client', workOrderNumber: 'Example work' }, false)).toBe(active); });
  it('labels a project with its shown name, client and WO number', () => {
    expect(record('1').label).toBe('Project 1 · Denso · SO-1');
    expect(record('1').clientName).toBe('Denso');
  });

  it('adds the ticket\'s archived project so the picker does not go blank', () => {
    const active = [record('1')];
    const options = withCurrentProject(active, {
      id: 'gone',
      customerName: 'Denso PH',
      workOrderNumber: 'SO-2024-1441',
      displayName: null,
      quoteSubject: 'Denso RTLS QR Code App',
      isArchived: true,
      client: { customerName: 'Denso PH', displayName: null },
    });

    expect(options[0]).toMatchObject({ id: 'gone', name: 'Denso RTLS QR Code App', isArchived: true, clientName: 'Denso PH' });
    expect(options).toHaveLength(2);
  });

  it('does not duplicate a current project that is still active', () => {
    const active = [record('1')];
    expect(withCurrentProject(active, { id: '1', customerName: '', workOrderNumber: 'SO-1' })).toBe(active);
    expect(withCurrentProject(active, null)).toBe(active);
  });

  it('filters on name, client and WO number and caps what it renders', () => {
    const many = Array.from({ length: PROJECT_PICKER_LIMIT + 20 }, (_, i) => record(String(i)));

    expect(filterProjects(many, 'so-12')).toEqual({ items: [many[12]], total: 1 });
    expect(filterProjects(many, 'DENSO').total).toBe(many.length);
    expect(filterProjects(many, '')).toMatchObject({ total: PROJECT_PICKER_LIMIT + 20 });
    expect(filterProjects(many, '').items).toHaveLength(PROJECT_PICKER_LIMIT);
  });
});
