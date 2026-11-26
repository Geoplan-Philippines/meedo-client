import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment.dev';
import { CrmService } from './crm.service';

describe('CrmService HTTP contract', () => {
  let service: CrmService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/crm/leads`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CrmService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists leads with status, archive, search and credentials', () => {
    service.listLeads({ page: 2, limit: 10, search: ' Jane ', status: 'NEW', archived: true, sortField: 'email', sortOrder: 'asc' }).subscribe();
    const req = http.expectOne((request) => request.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.params.get('status')).toBe('NEW');
    expect(req.request.params.get('archived')).toBe('true');
    expect(req.request.params.get('search')).toBe('Jane');
    req.flush({ data: [], meta: { total: 0, page: 2, limit: 10, lastPage: 0 } });
  });

  it('creates a lead through the admin path with a values body', () => {
    service.createLead({ email: 'lead@example.test' }).subscribe((lead) => expect(lead.id).toBe('lead-1'));
    const req = http.expectOne(`${url}/admin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ values: { email: 'lead@example.test' } });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: { id: 'lead-1' } });
  });

  it.each([
    ['getLead', 'GET', '/lead-1', null],
    ['updateLead', 'PATCH', '/lead-1', { values: { email: 'a@b.test' } }],
    ['updateLeadStatus', 'PATCH', '/lead-1/status', { status: 'CONTACTED' }],
    ['archiveLead', 'PATCH', '/lead-1/archive', {}],
    ['restoreLead', 'PATCH', '/lead-1/restore', {}],
  ] as const)('%s uses the endpoint and credentials', (method, verb, path, body) => {
    const request =
      method === 'getLead' ? service.getLead('lead-1')
      : method === 'updateLead' ? service.updateLead('lead-1', { email: 'a@b.test' })
      : method === 'updateLeadStatus' ? service.updateLeadStatus('lead-1', 'CONTACTED')
      : method === 'archiveLead' ? service.archiveLead('lead-1')
      : service.restoreLead('lead-1');
    request.subscribe();
    const req = http.expectOne(url + path);
    expect(req.request.method).toBe(verb);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(body);
    req.flush({ data: { id: 'lead-1' } });
  });

  it('exports leads as a CSV blob with the current filters', () => {
    service.exportLeads({ page: 1, limit: 25, status: 'NEW', archived: false }).subscribe((response) => {
      expect(response.body).toBeTruthy();
    });
    const req = http.expectOne((request) => request.url === `${url}/export`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('status')).toBe('NEW');
    req.flush(new Blob(['email\n']));
  });

  it('loads subscriber stats', () => {
    const statsUrl = `${environment.apiBaseUrl}/crm/newsletter/subscribers/stats`;
    service.getSubscriberStats().subscribe((response) => expect(response.data.unsubscribed).toBe(2));
    const req = http.expectOne(statsUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: { total: 10, newThisMonth: 1, unsubscribed: 2 } });
  });

  it('lists subscribers with status, archive, search and credentials', () => {
    const subscribersUrl = `${environment.apiBaseUrl}/crm/newsletter/subscribers`;
    service.listSubscribers({ page: 1, limit: 25, search: ' ada ', status: 'SUBSCRIBED', archived: false, sortField: 'email', sortOrder: 'asc' }).subscribe();
    const req = http.expectOne((request) => request.url === subscribersUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.params.get('status')).toBe('SUBSCRIBED');
    expect(req.request.params.get('archived')).toBe('false');
    expect(req.request.params.get('search')).toBe('ada');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 25, lastPage: 0 } });
  });

  it.each([
    ['getSubscriber', 'GET', '/sub-1', null],
    ['updateSubscriber', 'PATCH', '/sub-1', { values: { email: 'a@b.test' } }],
    ['archiveSubscriber', 'PATCH', '/sub-1/archive', {}],
    ['restoreSubscriber', 'PATCH', '/sub-1/restore', {}],
  ] as const)('%s uses the subscribers endpoint and credentials', (method, verb, path, body) => {
    const subscribersUrl = `${environment.apiBaseUrl}/crm/newsletter/subscribers`;
    const request =
      method === 'getSubscriber' ? service.getSubscriber('sub-1')
      : method === 'updateSubscriber' ? service.updateSubscriber('sub-1', { email: 'a@b.test' })
      : method === 'archiveSubscriber' ? service.archiveSubscriber('sub-1')
      : service.restoreSubscriber('sub-1');
    request.subscribe();
    const req = http.expectOne(subscribersUrl + path);
    expect(req.request.method).toBe(verb);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(body);
    req.flush({ data: { id: 'sub-1' } });
  });

  it('exports subscribers as a CSV blob with the current filters', () => {
    const exportUrl = `${environment.apiBaseUrl}/crm/newsletter/subscribers/export`;
    service.exportSubscribers({ page: 1, limit: 25, status: 'UNSUBSCRIBED', archived: false }).subscribe((response) => {
      expect(response.body).toBeTruthy();
    });
    const req = http.expectOne((request) => request.url === exportUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('status')).toBe('UNSUBSCRIBED');
    req.flush(new Blob(['email\n']));
  });
});
