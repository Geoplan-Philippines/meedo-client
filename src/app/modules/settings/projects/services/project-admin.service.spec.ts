import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { ProjectAdminService } from './project-admin.service';
import { ProjectsService } from '../../../tickets/services/projects.service';
import { ClientsService } from '../../customers/services/clients.service';

describe('internal project API request contracts', () => {
  let service: ProjectAdminService; let http: HttpTestingController; const cache = { invalidate: vi.fn() };
  beforeEach(() => { vi.clearAllMocks(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ProjectsService, useValue: cache }] }); service = TestBed.inject(ProjectAdminService); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('creates internal projects and clients using trimmed names and credentials', () => {
    service.create(' Example project ', 'example-client').subscribe(); const project = http.expectOne(req => req.url.endsWith('/maintenance/projects')); expect(project.request.body).toEqual({ name: 'Example project', clientId: 'example-client' }); expect(project.request.method).toBe('POST'); expect(project.request.withCredentials).toBe(true); project.flush({ data: { id: 'example-project' } }); expect(cache.invalidate).toHaveBeenCalled();
    TestBed.inject(ClientsService).create(' Example client ').subscribe(); const client = http.expectOne(req => req.url.endsWith('/maintenance/clients')); expect(client.request.body).toEqual({ name: 'Example client' }); expect(client.request.withCredentials).toBe(true); client.flush({ data: {} });
  });
  it('adds/removes organization users and changes closed/archive state through scoped endpoints', () => {
    service.addMember('example-project', 'example-user').subscribe(); const add = http.expectOne(req => req.url.endsWith('/example-project/members')); expect(add.request.body).toEqual({ userId: 'example-user' }); expect(add.request.withCredentials).toBe(true); add.flush({ data: {} });
    service.removeMember('example-project', 'example-user').subscribe(); const remove = http.expectOne(req => req.url.endsWith('/members/example-user')); expect(remove.request.method).toBe('DELETE'); remove.flush({ data: {} });
    service.setClosed('example-project', true).subscribe(); const closed = http.expectOne(req => req.url.endsWith('/example-project/closed')); expect(closed.request.body).toEqual({ isClosed: true }); closed.flush({ data: {} });
    service.setArchived('example-project', false).subscribe(); const restore = http.expectOne(req => req.url.endsWith('/example-project/archive')); expect(restore.request.body).toEqual({ isArchived: false }); restore.flush({ data: {} });
  });
  it('hides closed only when explicitly requested', () => {
    service.list({ page: 2, limit: 25, clientId: null, unassigned: false, teamId: null, status: null, includeArchived: false, includeClosed: false, sortField: 'createdAt', sortOrder: 'desc' }).subscribe(); const list = http.expectOne(req => req.url.endsWith('/maintenance/projects')); expect(list.request.params.get('includeClosed')).toBe('false'); expect(list.request.params.get('page')).toBe('2'); expect(list.request.params.get('limit')).toBe('25'); expect(list.request.params.get('withClientTotals')).toBe('true'); expect(list.request.params.has('clientId')).toBe(false); expect(list.request.withCredentials).toBe(true); list.flush({ data: [], meta: { total: 0, page: 2, limit: 25, lastPage: 0 } });
  });
  it('leaves out the default closed toggle and sends unassigned instead of a client', () => {
    service.list({ page: 1, limit: 25, clientId: 'example-client', unassigned: true, teamId: null, status: null, includeArchived: false, includeClosed: true }).subscribe(); const list = http.expectOne(req => req.url.endsWith('/maintenance/projects')); expect(list.request.params.has('includeClosed')).toBe(false); expect(list.request.params.get('unassigned')).toBe('true'); expect(list.request.params.has('clientId')).toBe(false); list.flush({ data: [], meta: { total: 0, page: 1, limit: 25, lastPage: 0 } });
  });
});
