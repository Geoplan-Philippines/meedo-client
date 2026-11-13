import { Directive, OnDestroy, inject, input } from '@angular/core';
import { RouterLink, UrlTree } from '@angular/router';

import { PrefetchService } from '../../../core/prefetch/prefetch.service';

/** Hover this long before prefetching, so a pointer sweeping over the sidebar doesn't load everything. */
export const PREFETCH_HOVER_DELAY_MS = 80;

/**
 * Prefetches a link's route code and first data on hover, focus or touch.
 * Put it next to `routerLink` (it reads that link's URL), or give it a URL:
 * `appPrefetch="/tickets/42"`.
 */
@Directive({
  selector: '[appPrefetch]',
  host: {
    '(mouseenter)': 'schedule()',
    '(mouseleave)': 'cancel()',
    '(focusin)': 'prefetchNow()',
    '(touchstart)': 'prefetchNow()',
  },
})
export class PrefetchLink implements OnDestroy {
  private readonly prefetch = inject(PrefetchService);
  private readonly routerLink = inject(RouterLink, { optional: true, self: true });
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Target URL; leave empty to use the element's routerLink. */
  readonly appPrefetch = input<string | UrlTree | null | undefined>();

  schedule(): void {
    this.cancel();
    this.timer = setTimeout(() => this.prefetchNow(), PREFETCH_HOVER_DELAY_MS);
  }

  cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  prefetchNow(): void {
    this.cancel();
    const target = this.appPrefetch() || this.routerLink?.urlTree;
    if (target) this.prefetch.prefetch(target);
  }

  ngOnDestroy(): void {
    this.cancel();
  }
}
