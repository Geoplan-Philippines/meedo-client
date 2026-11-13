import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PaginatedApiResponse } from '../interface/paginated-response.interface';
import { PICKER_SEARCH_DEBOUNCE_MS, PickerQuery, pagedSearch } from './paged-search';

type Row = { id: string };
const response = (ids: string[], total: number, page = 1): PaginatedApiResponse<Row> =>
  ({ statusCode: 200, message: 'ok', data: ids.map((id) => ({ id })), meta: { total, page, limit: 2, lastPage: Math.ceil(total / 2) } });
const pause = (ms = PICKER_SEARCH_DEBOUNCE_MS + 30) => new Promise((resolve) => setTimeout(resolve, ms));

describe('PagedSearch', () => {
  type Fetch = (query: PickerQuery) => Observable<PaginatedApiResponse<Row>>;
  const create = (fetch: Fetch) =>
    TestBed.runInInjectionContext(() => pagedSearch<Row>({ fetch, pageSize: 2 }));

  it('loads the first page once on open, then debounces searches', async () => {
    const fetch = vi.fn<Fetch>().mockReturnValue(of(response(['a', 'b'], 5)));
    const search = create(fetch);
    search.open();
    search.open();
    await pause(10);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith({ page: 1, limit: 2 });
    search.search('a');
    search.search('ac');
    search.search(' acme ');
    await pause();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith({ page: 1, limit: 2, search: 'acme' });
  });

  it('appends pages with "Show more" and stops at the total', async () => {
    const fetch = vi.fn<Fetch>()
      .mockReturnValueOnce(of(response(['a', 'b'], 3)))
      .mockReturnValueOnce(of(response(['c'], 3, 2)));
    const search = create(fetch);
    search.open();
    await pause(10);
    expect(search.hasMore()).toBe(true);
    search.loadMore();
    await pause(10);
    expect(search.items().map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(search.hasMore()).toBe(false);
    search.loadMore();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate a page when a cached answer is followed by a fresh one', async () => {
    const answers = new Subject<PaginatedApiResponse<Row>>();
    const fetch = vi.fn<Fetch>().mockReturnValueOnce(of(response(['a', 'b'], 4))).mockReturnValueOnce(answers);
    const search = create(fetch);
    search.open();
    await pause(10);
    search.loadMore();
    await pause(10);
    answers.next(response(['c', 'd'], 4, 2));
    answers.next(response(['c', 'd'], 4, 2));
    expect(search.items().map((row) => row.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('cancels an older search when a newer one starts', async () => {
    const slow = new Subject<PaginatedApiResponse<Row>>();
    const fetch = vi.fn<Fetch>().mockReturnValueOnce(slow).mockReturnValueOnce(of(response(['new'], 1)));
    const search = create(fetch);
    search.search('old');
    await pause();
    search.search('new');
    await pause();
    slow.next(response(['old'], 1));
    expect(search.items().map((row) => row.id)).toEqual(['new']);
  });

  it('reports a failed search and recovers on refresh', async () => {
    const fetch = vi.fn<Fetch>().mockReturnValueOnce(throwError(() => new Error('down'))).mockReturnValueOnce(of(response(['a'], 1)));
    const search = create(fetch);
    search.open();
    await pause(10);
    expect(search.failed()).toBe(true);
    search.refresh();
    await pause(10);
    expect(search.failed()).toBe(false);
    expect(search.items()).toEqual([{ id: 'a' }]);
  });
});
