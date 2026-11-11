import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment.dev';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService HTTP contract', () => {
  let service: CampaignsService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/crm/newsletter/campaigns`;
  const payload = { name: 'Example draft', subject: 'Example subject', body: '<p>Example body</p>' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CampaignsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends pagination, trimmed search and archive preference with credentials', () => {
    service.list({ page: 2, limit: 10, search: ' Example ', includeArchived: true }).subscribe(res => expect(res.meta.total).toBe(0));
    const req = http.expectOne(req => req.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.params.keys().sort()).toEqual(['includeArchived', 'limit', 'page', 'search']);
    expect(req.request.params.get('search')).toBe('Example');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('includeArchived')).toBe('true');
    req.flush({ data: [], meta: { total: 0 } });
  });
  it('omits empty optional filters and explicitly sends false', () => {
    service.list({ page: 1, limit: 5, search: '  ', includeArchived: false }).subscribe();
    const req = http.expectOne(req => req.url === url);
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.get('includeArchived')).toBe('false');
    req.flush({ data: [], meta: {} });
  });
  it.each([
    ['get', 'GET', '/example-id', null],
    ['create', 'POST', '', payload],
    ['update', 'PATCH', '/example-id', payload],
    ['archive', 'PATCH', '/example-id/archive', {}],
    ['restore', 'PATCH', '/example-id/restore', {}],
  ] as const)('%s uses the endpoint, credentials, body and global response envelope', (method, verb, path, body) => {
    const request = method === 'create' ? service.create(payload) : method === 'update' ? service.update('example-id', payload) : service[method]('example-id');
    request.subscribe(res => expect(res.id).toBe('example-id'));
    const req = http.expectOne(url + path);
    expect(req.request.method).toBe(verb);
    expect(req.request.body).toEqual(body);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ statusCode: 200, message: 'Success', data: { id: 'example-id' } });
  });
});
