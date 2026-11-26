import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment.dev';
import { FieldDefinitionsService } from './field-definitions.service';

describe('FieldDefinitionsService HTTP contract', () => {
  let service: FieldDefinitionsService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/crm/field-definitions`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FieldDefinitionsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists field definitions for a collection with credentials', () => {
    service.list('lead').subscribe((rows) => expect(rows).toEqual([]));
    const req = http.expectOne((request) => request.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.params.get('collection')).toBe('lead');
    req.flush({ data: [] });
  });

  it('creates, updates, deletes and reorders with credentials', () => {
    service.create({ collection: 'lead', key: 'industry', label: 'Industry', type: 'text' }).subscribe();
    const created = http.expectOne(url);
    expect(created.request.method).toBe('POST');
    expect(created.request.withCredentials).toBe(true);
    expect(created.request.body).toEqual({ collection: 'lead', key: 'industry', label: 'Industry', type: 'text' });
    created.flush({ data: { id: 'field-1' } });

    service.update('field-1', { label: 'Sector' }).subscribe();
    const updated = http.expectOne(`${url}/field-1`);
    expect(updated.request.method).toBe('PATCH');
    expect(updated.request.body).toEqual({ label: 'Sector' });
    updated.flush({ data: { id: 'field-1' } });

    service.remove('field-1').subscribe();
    const removed = http.expectOne(`${url}/field-1`);
    expect(removed.request.method).toBe('DELETE');
    removed.flush({ data: {} });

    service.reorder('lead', ['a', 'b']).subscribe();
    const reordered = http.expectOne(`${url}/reorder`);
    expect(reordered.request.method).toBe('PATCH');
    expect(reordered.request.body).toEqual({ collection: 'lead', orderedIds: ['a', 'b'] });
    reordered.flush({ data: [] });
  });
});
