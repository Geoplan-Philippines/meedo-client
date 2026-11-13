import { vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { SEARCH_DEBOUNCE_MS, defaultListQuery, injectListState } from './url-list-state';

const CONFIG = {
  pageSize: 25,
  sortField: 'createdAt',
  sortOrder: 'desc' as const,
  sortFields: ['createdAt', 'name'],
  filters: { status: null as string | null, archived: false as boolean, teams: [] as readonly string[] },
};

@Component({ template: '' })
class Host {
  readonly list = injectListState(CONFIG);
}

describe('UrlListState', () => {
  let router: Router;
  const create = () => TestBed.createComponent(Host).componentInstance.list;
  const query = () => new URL(`http://x${router.url}`).searchParams.toString();

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  it('starts from the defaults and keeps them out of the URL', () => {
    const list = create();
    expect(list.query()).toEqual({ page: 1, limit: 25, sortField: 'createdAt', sortOrder: 'desc', status: null, archived: false, teams: [] });
    expect(list.query()).toEqual(defaultListQuery(CONFIG));
  });

  it('reads page, size, sort, search and typed filters from the URL', async () => {
    await router.navigateByUrl('/?page=3&size=50&sort=name&dir=asc&q=acme&status=open&archived=true&teams=a&teams=b');
    const list = create();
    expect(list.query()).toEqual({
      page: 3, limit: 50, search: 'acme', sortField: 'name', sortOrder: 'asc', status: 'open', archived: true, teams: ['a', 'b'],
    });
    expect(list.first()).toBe(100);
    expect(list.tableSortOrder()).toBe(1);
  });

  it('ignores invalid URL values instead of sending them to the API', async () => {
    await router.navigateByUrl('/?page=-2&size=7&sort=password&dir=sideways');
    const list = create();
    expect(list.query()).toMatchObject({ page: 1, limit: 25, sortField: 'createdAt', sortOrder: 'desc' });
  });

  it('writes changes to the URL, drops defaults and goes back to page 1 on a new filter or sort', async () => {
    const list = create();
    list.onPage({ page: 4, pageSize: 50, first: 150 });
    await TestBed.inject(Router).navigated;
    await new Promise((resolve) => setTimeout(resolve));
    expect(query()).toBe('page=4&size=50');
    list.setFilter('status', 'open');
    await new Promise((resolve) => setTimeout(resolve));
    expect(query()).toBe('size=50&status=open');
    list.onLazyLoad({ sortField: 'name', sortOrder: 1 });
    await new Promise((resolve) => setTimeout(resolve));
    expect(query()).toBe('size=50&status=open&sort=name&dir=asc');
    list.clearFilters();
    await new Promise((resolve) => setTimeout(resolve));
    expect(query()).toBe('size=50&sort=name&dir=asc');
  });

  it('ignores a table sort event that matches the current sort', async () => {
    const list = create();
    const navigate = vi.spyOn(router, 'navigate');
    list.onLazyLoad({ sortField: 'createdAt', sortOrder: -1 });
    list.onLazyLoad({ sortField: undefined, sortOrder: 1 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('debounces search typing into one URL change', async () => {
    const list = create();
    const navigate = vi.spyOn(router, 'navigate');
    list.setSearch('a');
    list.setSearch('ac');
    list.setSearch('acme ');
    expect(list.searchInput()).toBe('acme ');
    expect(navigate).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(query()).toBe('q=acme');
    expect(list.search()).toBe('acme');
  });

  it('steps back to the last page once the current request shows the page is past the end', async () => {
    await router.navigateByUrl('/?page=9');
    const list = TestBed.runInInjectionContext(() => injectListState(CONFIG));
    const total = signal(30);
    const loaded = signal(true);
    const loading = signal(true);
    TestBed.runInInjectionContext(() => list.clampToTotal({ total, loaded, loading }));
    TestBed.tick();
    expect(list.page()).toBe(9);
    loading.set(false);
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    expect(list.page()).toBe(2);
  });

  it('prefixes keys so two lists can share one page', async () => {
    await router.navigateByUrl('/?teamPage=2&employeePage=3');
    const teams = TestBed.runInInjectionContext(() => injectListState({ pageSize: 10, prefix: 'team' }));
    const people = TestBed.runInInjectionContext(() => injectListState({ pageSize: 10, prefix: 'employee' }));
    expect(teams.page()).toBe(2);
    expect(people.page()).toBe(3);
  });
});
