import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment.dev';
import { TicketFacetsParams } from '../models/ticket.model';
import { TicketsService } from './tickets.service';

describe('TicketsService query parameters', () => {
  let service: TicketsService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/tickets`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TicketsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  for (const includeArchived of [true, false]) {
    it(`serializes list scope and repeated filters with includeArchived=${includeArchived}`, () => {
      service.getAll({
        page: 2, limit: 20, view: 'active', search: 'inspection',
        teamId: ['team-1', 'team-2'], assigneeId: 'member-id', categoryId: 'category-id',
        includeArchived, ticketStatusId: ['status-1', 'status-2'], priority: ['HIGH', 'URGENT'],
        sortField: 'createdAt', sortOrder: 'desc',
      }).subscribe();
      const req = http.expectOne((request) => request.url === url);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.params.getAll('teamId')).toEqual(['team-1', 'team-2']);
      expect(req.request.params.get('assigneeId')).toBe('member-id');
      expect(req.request.params.get('categoryId')).toBe('category-id');
      expect(req.request.params.get('includeArchived')).toBe(String(includeArchived));
      expect(req.request.params.getAll('ticketStatusId')).toEqual(['status-1', 'status-2']);
      expect(req.request.params.getAll('priority')).toEqual(['HIGH', 'URGENT']);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('limit')).toBe('20');
      expect(req.request.params.get('view')).toBe('active');
      expect(req.request.params.get('search')).toBe('inspection');
      expect(req.request.params.get('sortField')).toBe('createdAt');
      expect(req.request.params.get('sortOrder')).toBe('desc');
      req.flush({ data: [], meta: { total: 0, page: 2, limit: 20, lastPage: 0 } });
    });

    it(`serializes only allowed facet context with includeArchived=${includeArchived}`, () => {
      // Extra runtime properties must never leak into the strictly validated facets endpoint.
      const params: TicketFacetsParams & { ticketStatusId: string[]; priority: string[] } = {
        view: 'active', search: 'inspection', teamId: ['team-1', 'team-2'],
        assigneeId: 'member-id', categoryId: 'category-id', includeArchived,
        ticketStatusId: ['status-id'], priority: ['HIGH'],
      };
      service.getFacets(params).subscribe();
      const req = http.expectOne((request) => request.url === `${url}/facets`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.params.getAll('teamId')).toEqual(['team-1', 'team-2']);
      expect(req.request.params.get('assigneeId')).toBe('member-id');
      expect(req.request.params.get('categoryId')).toBe('category-id');
      expect(req.request.params.get('includeArchived')).toBe(String(includeArchived));
      expect(req.request.params.get('view')).toBe('active');
      expect(req.request.params.get('search')).toBe('inspection');
      expect(req.request.params.keys().sort()).toEqual([
        'assigneeId', 'categoryId', 'includeArchived', 'search', 'teamId', 'view',
      ]);
      req.flush({ data: { views: { all: 0, active: 0, backlog: 0, closed: 0 }, statuses: [], priorities: [] } });
    });
  }

  it('omits unset scope parameters from list and facets requests', () => {
    service.getAll({ page: 1, limit: 10, teamId: [] }).subscribe();
    const list = http.expectOne((req) => req.url === url);
    expect(list.request.params.keys().sort()).toEqual(['limit', 'page']);
    list.flush({ data: [], meta: { total: 0, page: 1, limit: 10, lastPage: 0 } });
    service.getFacets({ teamId: [] }).subscribe();
    const facets = http.expectOne((req) => req.url === `${url}/facets`);
    expect(facets.request.params.keys()).toEqual([]);
    facets.flush({ data: { views: { all: 0, active: 0, backlog: 0, closed: 0 }, statuses: [], priorities: [] } });
  });
});
