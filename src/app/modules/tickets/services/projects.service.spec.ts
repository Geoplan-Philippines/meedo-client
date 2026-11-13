import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Project } from '../models/projects.model';
import { ProjectsService, toPickerProject, withCurrentProject } from './projects.service';

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
});

describe('ProjectsService.search', () => {
  let http: HttpTestingController;
  let service: ProjectsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProjectsService);
  });
  afterEach(() => http.verify());

  it('asks the server for one page that matches the search, newest reported first', () => {
    let result: Project[] = [];
    service.search({ page: 2, limit: 20, search: 'rtls' }).subscribe((page) => (result = page.data));
    const req = http.expectOne((request) => request.url.endsWith('/maintenance/projects'));
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.get('search')).toBe('rtls');
    expect(req.request.params.get('sortField')).toBe('reportedDate');
    expect(req.request.params.get('sortOrder')).toBe('desc');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: [record('7')], meta: { total: 21, page: 2, limit: 20, lastPage: 2 } });
    expect(result.map((project) => project.label)).toEqual(['Project 7 · Denso · SO-7']);
  });
});
