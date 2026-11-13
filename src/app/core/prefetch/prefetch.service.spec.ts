import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { DataPrefetcher, PREFETCH_REPEAT_MS, PrefetchService } from './prefetch.service';
import { shouldSaveData } from './idle-preloading.strategy';

@Component({ template: '' })
class Screen {}

describe('PrefetchService', () => {
  const loaders = {
    newsletter: vi.fn(() => Promise.resolve(Screen)),
    campaigns: vi.fn(() => Promise.resolve(Screen)),
    client: vi.fn(() => Promise.resolve(Screen)),
    crmChildren: vi.fn(),
  };

  const crmRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'leads' },
    { path: 'newsletter', loadComponent: loaders.newsletter },
    { path: 'newsletter/campaigns', loadComponent: loaders.campaigns },
  ];
  const routes: Routes = [
    { path: 'crm', loadChildren: loaders.crmChildren },
    { path: 'clients/:clientId', pathMatch: 'full', loadComponent: loaders.client },
  ];

  let service: PrefetchService;

  beforeEach(() => {
    vi.useRealTimers();
    Object.values(loaders).forEach((loader) => loader.mockClear());
    loaders.crmChildren.mockImplementation(() => Promise.resolve(crmRoutes));
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    service = TestBed.inject(PrefetchService);
  });
  afterEach(() => vi.useRealTimers());

  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it('loads the code of the route the URL lands on, not a shorter sibling', async () => {
    service.prefetch('/crm/newsletter/campaigns');
    await settle();

    expect(loaders.crmChildren).toHaveBeenCalledTimes(1);
    expect(loaders.campaigns).toHaveBeenCalledTimes(1);
    expect(loaders.newsletter).not.toHaveBeenCalled();
  });

  it('matches route params and runs the data prefetchers registered for the URL', async () => {
    const prefetch = vi.fn();
    const other = vi.fn();
    const prefetchers: DataPrefetcher[] = [
      { match: (segments) => segments[0] === 'clients' && segments.length === 2, prefetch },
      { match: (segments) => segments[0] === 'crm', prefetch: other },
    ];
    service.register(prefetchers);

    service.prefetch('/clients/client-7?tab=projects');
    await settle();

    expect(loaders.client).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledTimes(1);
    const [, url, segments] = prefetch.mock.calls[0];
    expect(segments).toEqual(['clients', 'client-7']);
    expect(url.queryParams).toEqual({ tab: 'projects' });
    expect(other).not.toHaveBeenCalled();
  });

  it('warms the same URL again only after the repeat window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T08:00:00Z'));
    const prefetch = vi.fn();
    service.register([{ match: () => true, prefetch }]);

    service.prefetch('/clients/client-7');
    service.prefetch('/clients/client-7');
    expect(prefetch).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + PREFETCH_REPEAT_MS);
    service.prefetch('/clients/client-7');
    expect(prefetch).toHaveBeenCalledTimes(2);
  });

  it('stops running prefetchers once they are unregistered', () => {
    const prefetch = vi.fn();
    const unregister = service.register([{ match: () => true, prefetch }]);
    unregister();

    service.prefetch('/clients/client-7');

    expect(prefetch).not.toHaveBeenCalled();
  });

  it('keeps going when a prefetcher throws', () => {
    const after = vi.fn();
    service.register([
      { match: () => true, prefetch: () => { throw new Error('offline'); } },
      { match: () => true, prefetch: after },
    ]);

    expect(() => service.prefetch('/clients/client-7')).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
  });
});

describe('shouldSaveData', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'connection');
  const setConnection = (connection: object | undefined) =>
    Object.defineProperty(globalThis.navigator, 'connection', { value: connection, configurable: true });
  afterEach(() => {
    if (original) Object.defineProperty(globalThis.navigator, 'connection', original);
    else delete (globalThis.navigator as { connection?: unknown }).connection;
  });

  it('skips preloading on data saver and 2G-class connections only', () => {
    setConnection({ saveData: true, effectiveType: '4g' });
    expect(shouldSaveData()).toBe(true);
    setConnection({ effectiveType: 'slow-2g' });
    expect(shouldSaveData()).toBe(true);
    setConnection({ effectiveType: '2g' });
    expect(shouldSaveData()).toBe(true);
    setConnection({ effectiveType: '3g' });
    expect(shouldSaveData()).toBe(false);
    setConnection(undefined);
    expect(shouldSaveData()).toBe(false);
  });
});
