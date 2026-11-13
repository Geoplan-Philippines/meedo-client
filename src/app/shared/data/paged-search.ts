import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, debounce, map, of, switchMap, timer } from 'rxjs';

import { PaginatedApiResponse } from '../interface/paginated-response.interface';

export const PICKER_PAGE_SIZE = 20;
export const PICKER_SEARCH_DEBOUNCE_MS = 250;

export interface PickerQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface PagedSearchOptions<T> {
  fetch: (query: PickerQuery) => Observable<PaginatedApiResponse<T>>;
  pageSize?: number;
  debounceMs?: number;
}

interface SearchRequest {
  term: string;
  page: number;
  immediate: boolean;
}

/**
 * The one paged-fetch helper behind every picker and typeahead: it asks the
 * server for one page that matches what was typed, and "Show more" appends
 * the next page. Typing is debounced and a newer search cancels an older one.
 *
 * Create it in a field initializer (it uses DestroyRef).
 */
export class PagedSearch<T> {
  private readonly requests = new Subject<SearchRequest>();
  private readonly itemsSignal = signal<T[]>([]);
  private readonly totalSignal = signal(0);
  private readonly loadingSignal = signal(false);
  private readonly failedSignal = signal(false);
  private readonly termSignal = signal('');
  private page = 0;
  private started = false;

  readonly items: Signal<T[]> = this.itemsSignal.asReadonly();
  readonly total: Signal<number> = this.totalSignal.asReadonly();
  readonly loading: Signal<boolean> = this.loadingSignal.asReadonly();
  readonly failed: Signal<boolean> = this.failedSignal.asReadonly();
  readonly term: Signal<string> = this.termSignal.asReadonly();
  readonly hasMore = computed(() => this.itemsSignal().length < this.totalSignal());

  constructor(private readonly options: PagedSearchOptions<T>) {
    const pageSize = options.pageSize ?? PICKER_PAGE_SIZE;
    const debounceMs = options.debounceMs ?? PICKER_SEARCH_DEBOUNCE_MS;
    this.requests
      .pipe(
        debounce((request) => timer(request.immediate ? 0 : debounceMs)),
        switchMap((request) => {
          this.loadingSignal.set(true);
          this.failedSignal.set(false);
          const search = request.term.trim() || undefined;
          return options.fetch({ page: request.page, limit: pageSize, ...(search ? { search } : {}) }).pipe(
            map((response) => ({ request, response })),
            catchError(() => of({ request, response: null })),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(({ request, response }) => {
        this.loadingSignal.set(false);
        if (!response) {
          this.failedSignal.set(true);
          return;
        }
        this.page = request.page;
        this.totalSignal.set(response.meta.total);
        // Writing by position keeps a cached-then-fresh pair of answers from appending twice.
        this.itemsSignal.update((items) => [...items.slice(0, (request.page - 1) * pageSize), ...response.data]);
      });
  }

  /** Loads the first page once (e.g. when a picker opens). */
  open(): void {
    if (this.started) return;
    this.started = true;
    this.requests.next({ term: this.termSignal(), page: 1, immediate: true });
  }

  /** New search text: debounced, back to page 1. */
  search(term: string): void {
    this.started = true;
    this.termSignal.set(term);
    this.requests.next({ term, page: 1, immediate: false });
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingSignal()) return;
    this.requests.next({ term: this.termSignal(), page: this.page + 1, immediate: true });
  }

  /** Reloads the current search, e.g. after a new record was created. */
  refresh(): void {
    this.started = true;
    this.requests.next({ term: this.termSignal(), page: 1, immediate: true });
  }

  /** Clears the text and results so the next open starts fresh. */
  reset(): void {
    this.termSignal.set('');
    this.started = false;
    this.page = 0;
    this.itemsSignal.set([]);
    this.totalSignal.set(0);
  }
}

/** Creates a paged search for the component or service being constructed. */
export function pagedSearch<T>(options: PagedSearchOptions<T>): PagedSearch<T> {
  return new PagedSearch<T>(options);
}
