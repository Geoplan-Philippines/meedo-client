import { Signal, WritableSignal, computed, signal } from '@angular/core';
import type { TableLazyLoadEvent } from 'primeng/table';

import type { ListPageChange } from '../ui/list-paginator/list-paginator';

type SortOrder = 1 | -1;

/** Reads a dotted path such as "user.name" the way PrimeNG Table does. */
export function resolveField(row: unknown, field: string): unknown {
  let value: unknown = row;
  for (const key of field.split('.')) {
    if (value === null || value === undefined) return value;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** PrimeNG Table's default comparison: empty values first, natural string order. */
export function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? -1 : 1;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, undefined, { numeric: true });
  const [x, y] = [a as number, b as number];
  return x < y ? -1 : x > y ? 1 : 0;
}

export function sortRows<T>(rows: readonly T[], field: string, order: SortOrder): T[] {
  return [...rows].sort((a, b) => order * compareValues(resolveField(a, field), resolveField(b, field)));
}

/** Clamps a 1-based page into range for `total` rows. */
export function clampPage(page: number, total: number, pageSize: number): number {
  const lastPage = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return Math.min(Math.max(1, page), lastPage);
}

/**
 * Sort + page state for a list whose rows are already in memory. Pair it with a
 * `[lazy]="true"` p-table (sorting arrives through `onLazyLoad`) and the shared
 * `app-list-paginator`. When a list moves to server paging, the page keeps the
 * same template and swaps this for an API call.
 */
export class ClientPager<T> {
  readonly page = signal(1);
  readonly pageSize: WritableSignal<number>;
  private readonly sort = signal<{ field: string | null; order: SortOrder }>({ field: null, order: 1 });

  readonly total = computed(() => this.source().length);
  /** The page actually shown; shrinks when filtering removes rows. */
  readonly currentPage = computed(() => clampPage(this.page(), this.total(), this.pageSize()));
  readonly pageRows = computed<T[]>(() => {
    const { field, order } = this.sort();
    const rows = field ? sortRows(this.source(), field, order) : [...this.source()];
    const start = (this.currentPage() - 1) * this.pageSize();
    return rows.slice(start, start + this.pageSize());
  });

  constructor(private readonly source: Signal<readonly T[]>, pageSize = 10) {
    this.pageSize = signal(pageSize);
  }

  /** Handler for p-table `(onLazyLoad)`: applies the column sort and returns to page 1. */
  onSort(event: TableLazyLoadEvent): void {
    const field = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
    if (!field) return;
    this.sort.set({ field, order: event.sortOrder === -1 ? -1 : 1 });
    this.page.set(1);
  }

  onPage(change: ListPageChange): void {
    this.pageSize.set(change.pageSize);
    this.page.set(change.page);
  }

  reset(): void {
    this.page.set(1);
  }
}
