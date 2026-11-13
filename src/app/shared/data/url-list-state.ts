import { DestroyRef, Signal, WritableSignal, computed, effect, inject, linkedSignal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';
import type { TableLazyLoadEvent } from 'primeng/table';
import { Subject, debounceTime } from 'rxjs';

import { DEFAULT_PAGE_SIZE_OPTIONS, ListPageChange } from '../ui/list-paginator/list-paginator';
import { PageQuery, SortOrder } from './page-query';

export type FilterValue = string | boolean | readonly string[] | null;
export type FilterDefaults = Record<string, FilterValue>;

export const SEARCH_DEBOUNCE_MS = 300;

export interface ListStateConfig<F extends FilterDefaults = FilterDefaults> {
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  sortField?: string;
  sortOrder?: SortOrder;
  /** Sort fields the URL may pick; anything else falls back to the default. */
  sortFields?: readonly string[];
  /** Filters and their defaults; the default's type decides how the URL value is read. */
  filters?: F;
  /** Prefix for the query keys, for pages with two lists. */
  prefix?: string;
}

export type ListQuery<F extends FilterDefaults = FilterDefaults> = PageQuery & F;

const DEFAULT_PAGE_SIZE = 25;

/**
 * The query a list sends when its URL carries no state. Prefetchers use it so
 * a hovered link warms exactly the request the page will make.
 */
export function defaultListQuery<F extends FilterDefaults>(config: ListStateConfig<F>): ListQuery<F> {
  return {
    page: 1,
    limit: config.pageSize ?? DEFAULT_PAGE_SIZE,
    ...(config.sortField ? { sortField: config.sortField, sortOrder: config.sortOrder ?? 'asc' } : {}),
    ...(config.filters ?? ({} as F)),
  } as ListQuery<F>;
}

/**
 * Page, page size, sort, search and filters for a list, kept in the URL so
 * they survive reloads and back navigation. Values equal to the defaults are
 * left out of the URL. Search typing is debounced and replaces the history
 * entry; page, sort and filter changes add one, so Back steps through them.
 *
 * Create it in a field initializer (it injects the router and route).
 */
export class UrlListState<F extends FilterDefaults = FilterDefaults> {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly config: Required<Omit<ListStateConfig<F>, 'sortField' | 'sortFields'>> &
    Pick<ListStateConfig<F>, 'sortField' | 'sortFields'>;
  private readonly params: Signal<ParamMap>;
  private readonly searchTyping = new Subject<string>();

  readonly page: Signal<number>;
  readonly pageSize: Signal<number>;
  readonly sortField: Signal<string | undefined>;
  readonly sortOrder: Signal<SortOrder>;
  readonly search: Signal<string>;
  readonly filters: Signal<F>;
  /** What the search box shows: the URL value, or what the user is typing before it lands there. */
  readonly searchInput: WritableSignal<string>;
  /** PrimeNG Table's `first` and `sortOrder` for the current state. */
  readonly first: Signal<number>;
  readonly tableSortOrder: Signal<1 | -1>;
  readonly query: Signal<ListQuery<F>>;
  readonly hasFilters: Signal<boolean>;

  constructor(config: ListStateConfig<F> = {}) {
    this.config = {
      pageSize: config.pageSize ?? DEFAULT_PAGE_SIZE,
      pageSizeOptions: config.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS,
      sortOrder: config.sortOrder ?? 'asc',
      filters: config.filters ?? ({} as F),
      prefix: config.prefix ?? '',
      sortField: config.sortField,
      sortFields: config.sortFields,
    };
    this.params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
    const get = (name: string) => this.params().get(this.key(name));

    this.page = computed(() => positiveInt(get('page')) ?? 1);
    this.pageSize = computed(() => {
      const size = positiveInt(get('size'));
      return size && this.config.pageSizeOptions.includes(size) ? size : this.config.pageSize;
    });
    this.sortField = computed(() => {
      const field = get('sort');
      const allowed = this.config.sortFields;
      return field && (!allowed || allowed.includes(field)) ? field : this.config.sortField;
    });
    this.sortOrder = computed(() => {
      const order = get('dir');
      return order === 'asc' || order === 'desc' ? order : this.config.sortOrder;
    });
    this.search = computed(() => (get('q') ?? '').trim());
    this.filters = computed(() => {
      const params = this.params();
      const read = Object.entries(this.config.filters).map(([name, fallback]) => [name, readFilter(params, this.key(name), fallback)]);
      return Object.fromEntries(read) as F;
    });
    this.searchInput = linkedSignal(() => this.search());
    this.first = computed(() => (this.page() - 1) * this.pageSize());
    this.tableSortOrder = computed(() => (this.sortOrder() === 'desc' ? -1 : 1));
    this.query = computed(() => ({
      page: this.page(),
      limit: this.pageSize(),
      ...(this.search() ? { search: this.search() } : {}),
      ...(this.sortField() ? { sortField: this.sortField(), sortOrder: this.sortOrder() } : {}),
      ...this.filters(),
    }) as ListQuery<F>);
    this.hasFilters = computed(() =>
      !!this.search() || Object.entries(this.filters()).some(([name, value]) => !sameValue(value, this.config.filters[name])),
    );

    this.searchTyping
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((term) => {
        if (term.trim() !== this.search()) this.navigate({ q: term.trim(), page: 1 }, true);
      });
  }

  /** Search box input: shows at once, reaches the URL (and the API) after a pause. */
  setSearch(term: string): void {
    this.searchInput.set(term);
    this.searchTyping.next(term);
  }

  setFilter<K extends keyof F & string>(name: K, value: F[K]): void {
    this.setFilters({ [name]: value } as unknown as Partial<F>);
  }

  setFilters(patch: Partial<F>): void {
    this.navigate({ ...patch, page: 1 });
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.navigate({ ...this.config.filters, q: '', page: 1 });
  }

  /** PrimeNG lazy table `(onLazyLoad)`: column sort changes (paging goes through the shared footer). */
  onLazyLoad(event: TableLazyLoadEvent): void {
    const field = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
    if (!field) return;
    const order: SortOrder = event.sortOrder === -1 ? 'desc' : 'asc';
    if (field === this.sortField() && order === this.sortOrder()) return;
    this.navigate({ sort: field, dir: order, page: 1 });
  }

  /** Sort from a control other than the table header (e.g. a "Sort by" select). */
  setSort(field: string, order: SortOrder): void {
    if (field === this.sortField() && order === this.sortOrder()) return;
    this.navigate({ sort: field, dir: order, page: 1 });
  }

  /** Shared footer `(pageChange)`. */
  onPage(change: ListPageChange): void {
    this.navigate({ page: change.page, size: change.pageSize });
  }

  setPage(page: number): void {
    this.navigate({ page });
  }

  /**
   * Steps back to the last page when the current one emptied out (rows were
   * deleted or the URL named a page past the end). Call it from the page with
   * the list's total.
   */
  clampToTotal(list: { total: Signal<number>; loaded: Signal<boolean>; loading: Signal<boolean> }): void {
    effect(() => {
      // Only a total for the current query counts; one from the previous page or filter would bounce valid URLs.
      if (!list.loaded() || list.loading()) return;
      const lastPage = Math.max(1, Math.ceil(list.total() / this.pageSize()));
      if (this.page() > lastPage) untracked(() => this.navigate({ page: lastPage }, true));
    });
  }

  private navigate(values: Record<string, unknown>, replaceUrl = false): void {
    const queryParams: Params = {};
    for (const [name, value] of Object.entries(values)) queryParams[this.key(name)] = this.toParam(name, value);
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl });
  }

  /** URL value for one key; defaults become null, which removes the key. */
  private toParam(name: string, value: unknown): unknown {
    const defaults: Record<string, unknown> = {
      ...this.config.filters,
      page: 1,
      size: this.config.pageSize,
      sort: this.config.sortField,
      dir: this.config.sortOrder,
      q: '',
    };
    if (sameValue(value, defaults[name]) || value === '' || value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.length ? value : null;
    return typeof value === 'boolean' ? String(value) : value;
  }

  private key(name: string): string {
    return this.config.prefix ? `${this.config.prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
  }
}

/** Creates a URL list state for the component being constructed. */
export function injectListState<F extends FilterDefaults = FilterDefaults>(config: ListStateConfig<F> = {}): UrlListState<F> {
  return new UrlListState<F>(config);
}

function positiveInt(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= 1 ? number : null;
}

function readFilter(params: ParamMap, key: string, fallback: FilterValue): FilterValue {
  if (Array.isArray(fallback)) return params.getAll(key).filter(Boolean);
  const raw = params.get(key);
  if (raw === null) return fallback;
  if (typeof fallback === 'boolean') return raw === 'true' ? true : raw === 'false' ? false : fallback;
  return raw;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => item === b[index]);
  return a === b;
}
