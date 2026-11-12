import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';

/** Emitted when the user picks another page or page size. `page` is 1-based. */
export interface ListPageChange {
  page: number;
  pageSize: number;
  /** Zero-based index of the first row on the page (PrimeNG's `first`). */
  first: number;
}

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * The one footer every list uses: a "Showing x to y of n" summary on the left
 * and a PrimeNG Paginator on the right. It is stateless: the parent owns
 * total, page and page size, so the same component serves client-side lists
 * today and server-paged lists later.
 *
 * `mode="more"` is the same footer for lists that grow in place (board
 * columns): the summary reads "x of n" and a Show more button asks for the
 * next page, which the parent appends.
 */
@Component({
  selector: 'app-list-paginator',
  imports: [PaginatorModule, ButtonModule],
  templateUrl: './list-paginator.html',
  styleUrl: './list-paginator.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.list-paginator--more]': "mode() === 'more'" },
})
export class ListPaginator {
  readonly total = input.required<number>();
  /** Current page, 1-based. */
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly pageSizeOptions = input<number[]>(DEFAULT_PAGE_SIZE_OPTIONS);
  /** Plural noun for the summary, e.g. "tickets". */
  readonly itemLabel = input('items');
  /** `pages`: PrimeNG Paginator. `more`: a Show more button for lists that append. */
  readonly mode = input<'pages' | 'more'>('pages');
  /** Disables Show more while the parent is busy. */
  readonly disabled = input(false);

  readonly pageChange = output<ListPageChange>();

  readonly first = computed(() => Math.max(0, (this.page() - 1) * this.pageSize()));
  readonly rangeStart = computed(() => (this.total() > 0 ? this.first() + 1 : 0));
  readonly rangeEnd = computed(() => Math.min(this.first() + this.pageSize(), this.total()));
  readonly rowsPerPage = computed(() => (this.pageSizeOptions().length ? this.pageSizeOptions() : undefined));

  showMore(): void {
    const page = this.page() + 1;
    this.pageChange.emit({ page, pageSize: this.pageSize(), first: (page - 1) * this.pageSize() });
  }

  onPageChange(state: PaginatorState): void {
    const pageSize = state.rows ?? this.pageSize();
    // A new page size starts over at page 1 so the user never lands past the end.
    if (pageSize !== this.pageSize()) {
      this.pageChange.emit({ page: 1, pageSize, first: 0 });
      return;
    }
    const page = (state.page ?? 0) + 1;
    this.pageChange.emit({ page, pageSize, first: (page - 1) * pageSize });
  }
}
