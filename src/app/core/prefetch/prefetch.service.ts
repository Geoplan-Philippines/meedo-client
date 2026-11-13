import { Injectable, Injector, inject } from '@angular/core';
import { Route, Router, Routes, UrlTree } from '@angular/router';

import { shouldSaveData } from './idle-preloading.strategy';

/** A hovered link warms the same URL again only after this long. */
export const PREFETCH_REPEAT_MS = 10_000;

/**
 * Warms the data a screen asks for first. `match` runs on the URL path's
 * segments; `prefetch` fires the screen's first requests (which the API cache
 * keeps), using the injector for services and the parsed URL for its params.
 */
export interface DataPrefetcher {
  match: (segments: readonly string[]) => boolean;
  prefetch: (injector: Injector, url: UrlTree, segments: readonly string[]) => void;
}

/**
 * Makes navigation feel instant: on hover or focus of a link it loads the
 * target route's code (walking the router config, so lazy feature routes are
 * found without a second list of import paths) and runs any registered data
 * prefetcher for that URL.
 */
@Injectable({ providedIn: 'root' })
export class PrefetchService {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly prefetchers: DataPrefetcher[] = [];
  private readonly lastRun = new Map<string, number>();

  /** Registers data prefetchers; returns a function that removes them. */
  register(prefetchers: readonly DataPrefetcher[]): () => void {
    this.prefetchers.push(...prefetchers);
    return () => {
      for (const prefetcher of prefetchers) {
        const index = this.prefetchers.indexOf(prefetcher);
        if (index >= 0) this.prefetchers.splice(index, 1);
      }
    };
  }

  prefetch(target: string | UrlTree): void {
    if (shouldSaveData()) return;
    const url = typeof target === 'string' ? this.router.parseUrl(target) : target;
    const key = this.router.serializeUrl(url);
    const now = Date.now();
    if (now - (this.lastRun.get(key) ?? 0) < PREFETCH_REPEAT_MS) return;
    this.lastRun.set(key, now);

    const segments = url.root.children['primary']?.segments.map((segment) => segment.path) ?? [];
    void loadRouteCode(this.router.config, segments).catch(() => undefined);
    for (const prefetcher of this.prefetchers) {
      if (!prefetcher.match(segments)) continue;
      try {
        prefetcher.prefetch(this.injector, url, segments);
      } catch {
        // A prefetch is only a head start; the screen loads its own data anyway.
      }
    }
  }
}

/** Loads the lazy component and child routes along the first route path that matches `segments`. */
async function loadRouteCode(routes: Routes, segments: readonly string[]): Promise<void> {
  for (const route of routes) {
    if (route.redirectTo !== undefined) continue;
    const consumed = matchPath(route, segments);
    if (consumed === null) continue;
    const rest = segments.slice(consumed);
    const pending: Promise<unknown>[] = [];
    if (route.loadComponent) pending.push(Promise.resolve(route.loadComponent()));
    const children = route.children ?? (route.loadChildren ? await resolveChildren(route) : undefined);
    if (children?.length) pending.push(loadRouteCode(children, rest));
    await Promise.all(pending);
    return;
  }
}

async function resolveChildren(route: Route): Promise<Routes | undefined> {
  const loaded: unknown = await route.loadChildren?.();
  return Array.isArray(loaded) ? (loaded as Routes) : undefined;
}

/** Segments a route's path consumes, or null when it does not match (`:param` matches any segment). */
function matchPath(route: Route, segments: readonly string[]): number | null {
  const parts = (route.path ?? '').split('/').filter(Boolean);
  if (route.path === '**') return segments.length;
  if (parts.length > segments.length) return null;
  if (route.pathMatch === 'full' && parts.length !== segments.length) return null;
  const matches = parts.every((part, index) => part.startsWith(':') || part === segments[index]);
  return matches ? parts.length : null;
}
