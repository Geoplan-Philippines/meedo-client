import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { ApiCache, CACHE_FRESH_MS, CacheChange, apiCacheInterceptor, cacheContext } from './api-cache';

describe('API response cache', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let cache: ApiCache;
  const user = signal<{ id: string } | null>({ id: 'user-1' });
  const organization = signal<string | null>('org-1');

  beforeEach(() => {
    vi.useRealTimers();
    user.set({ id: 'user-1' });
    organization.set('org-1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiCacheInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser: user, organizationId: organization } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    cache = TestBed.inject(ApiCache);
    TestBed.tick();
  });
  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  const get = (url = '/api/clients?page=1') => {
    const seen: unknown[] = [];
    http.get(url, { context: cacheContext('clients') }).subscribe((body) => seen.push(body));
    return seen;
  };

  it('answers a repeat request from memory without a network call while it is fresh', () => {
    const first = get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['a'] });
    const second = get();
    backend.expectNone('/api/clients?page=1');
    expect(first).toEqual([{ data: ['a'] }]);
    expect(second).toEqual([{ data: ['a'] }]);
  });

  it('shows a stale copy at once, then the fresh one only if it changed', () => {
    vi.useFakeTimers();
    get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['a'] });
    vi.advanceTimersByTime(CACHE_FRESH_MS + 1);
    const unchanged = get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['a'] });
    expect(unchanged).toEqual([{ data: ['a'] }]);
    vi.advanceTimersByTime(CACHE_FRESH_MS + 1);
    const changed = get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['b'] });
    expect(changed).toEqual([{ data: ['a'] }, { data: ['b'] }]);
  });

  it('shares one network call between a hover prefetch and the page', () => {
    const prefetch = get();
    const page = get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['a'] });
    expect(prefetch).toEqual([{ data: ['a'] }]);
    expect(page).toEqual([{ data: ['a'] }]);
  });

  it('never caches requests that did not opt in', () => {
    http.get('/api/other').subscribe();
    backend.expectOne('/api/other').flush({});
    http.get('/api/other').subscribe();
    backend.expectOne('/api/other').flush({});
  });

  it('clears everything after a successful write so no screen shows pre-edit data', () => {
    const changes: CacheChange[] = [];
    cache.changes$.subscribe((change) => changes.push(change));
    get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['a'] });
    http.patch('/api/clients/1', {}).subscribe();
    backend.expectOne('/api/clients/1').flush({});
    expect(changes).toEqual([null]);
    get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['renamed'] });
  });

  it('drops tagged entries when told something changed (e.g. a websocket notification)', () => {
    get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['a'] });
    cache.invalidate(['tickets']);
    get();
    backend.expectNone('/api/clients?page=1');
    cache.invalidate(['clients']);
    get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['a'] });
  });

  it('keeps users and organizations apart', () => {
    get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['org-1 rows'] });
    organization.set('org-2');
    TestBed.tick();
    get();
    backend.expectOne('/api/clients?page=1').flush({ data: ['org-2 rows'] });
  });
});
