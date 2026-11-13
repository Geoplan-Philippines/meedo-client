import { DestroyRef, Signal, computed, inject, linkedSignal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, filter } from 'rxjs';

import { ApiCache, CacheTag } from '../../core/http/api-cache';
import { PaginatedApiResponse, PaginationMeta } from '../interface/paginated-response.interface';

export interface PagedListOptions<Q, T, M extends object> {
  /** The query to load; `undefined` waits (e.g. until the user's member id is known). */
  params: () => Q | undefined;
  load: (query: Q) => Observable<PaginatedApiResponse<T, M>>;
  /** Refresh in place when these cache tags change (websocket notifications, other tabs' writes). */
  refreshOn?: readonly CacheTag[];
}

export interface PagedList<T, M extends object> {
  readonly rows: Signal<T[]>;
  readonly total: Signal<number>;
  readonly meta: Signal<(PaginationMeta & M) | null>;
  /** True while a page is on its way (the previous page stays on screen). */
  readonly loading: Signal<boolean>;
  /** True once the first page arrived, so empty states don't flash before it. */
  readonly loaded: Signal<boolean>;
  readonly error: Signal<unknown>;
  reload(): void;
  /** Edits rows in place, e.g. after a save returned the updated row. */
  updateRows(change: (rows: T[]) => T[]): void;
}

/**
 * One server page for a list screen. Built on `rxResource`, so a new query
 * cancels the previous request; unlike a bare resource it keeps the last page
 * on screen while the next one loads or if it fails.
 */
export function pagedList<Q, T, M extends object = object>(options: PagedListOptions<Q, T, M>): PagedList<T, M> {
  const resource = rxResource({ params: options.params, stream: ({ params }) => options.load(params) });

  const latest = linkedSignal<PaginatedApiResponse<T, M> | undefined, PaginatedApiResponse<T, M> | undefined>({
    source: () => (resource.hasValue() ? resource.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  if (options.refreshOn?.length) {
    const tags = options.refreshOn;
    inject(ApiCache)
      .changes$.pipe(
        filter((change) => change === null || tags.some((tag) => change.has(tag))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => {
        if (resource.status() !== 'idle') resource.reload();
      });
  }

  return {
    rows: computed(() => latest()?.data ?? []),
    total: computed(() => latest()?.meta.total ?? 0),
    meta: computed(() => latest()?.meta ?? null),
    loading: resource.isLoading,
    loaded: computed(() => latest() !== undefined),
    error: computed(() => (resource.status() === 'error' ? resource.error() : null)),
    reload: () => resource.reload(),
    updateRows: (change) => latest.update((page) => (page ? { ...page, data: change(page.data) } : page)),
  };
}
