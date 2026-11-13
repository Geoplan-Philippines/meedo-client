import {
  HttpContext,
  HttpContextToken,
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, effect, inject } from '@angular/core';
import { EMPTY, Observable, Subject, concat, filter, finalize, of, shareReplay, tap } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../auth/auth.service';

/** Tags group cached responses so one change can refresh every list that shows it. */
export type CacheTag =
  | 'tickets'
  | 'projects'
  | 'clients'
  | 'members'
  | 'teams'
  | 'lookups'
  | 'crm'
  | 'timesheet'
  | 'attendance'
  | 'notifications';

/** Within this window a repeat request is answered from memory without a network call. */
export const CACHE_FRESH_MS = 10_000;
/** Older entries are dropped instead of shown. */
export const CACHE_MAX_AGE_MS = 5 * 60_000;
/** Most responses kept; the oldest go first. */
export const CACHE_MAX_ENTRIES = 120;

const CACHE_TAG = new HttpContextToken<CacheTag | null>(() => null);

/** Opts a GET into the response cache under `tag`. */
export function cacheContext(tag: CacheTag, context = new HttpContext()): HttpContext {
  return context.set(CACHE_TAG, tag);
}

interface CacheEntry {
  response: HttpResponse<unknown>;
  storedAt: number;
  tag: CacheTag;
}

/** `null` means everything changed (a write, a sign-in or an organization switch). */
export type CacheChange = ReadonlySet<CacheTag> | null;

/**
 * In-memory cache for list and detail GETs, so repeat visits and hovered
 * links show data at once. Entries are keyed by user, organization and the
 * full URL, are cleared after any successful write, and can be invalidated
 * by tag when a websocket notification says something changed.
 */
@Injectable({ providedIn: 'root' })
export class ApiCache {
  private readonly auth = inject(AuthService);
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Observable<HttpResponse<unknown>>>();
  private readonly changeSubject = new Subject<CacheChange>();

  /** Emits after an invalidation so views on screen can refresh in place. */
  readonly changes$ = this.changeSubject.asObservable();

  constructor() {
    // Another user or organization must never see this one's cached rows.
    let previous: string | undefined;
    effect(() => {
      const identity = this.identity();
      if (previous !== undefined && previous !== identity) this.clear();
      previous = identity;
    });
  }

  key(urlWithParams: string): string {
    return `${this.identity()}|${urlWithParams}`;
  }

  read(key: string, now = Date.now()): CacheEntry | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (now - entry.storedAt > CACHE_MAX_AGE_MS) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  /** One network call per key at a time; the response is stored when it succeeds. */
  fetch(key: string, tag: CacheTag, request: () => Observable<HttpEvent<unknown>>): Observable<HttpResponse<unknown>> {
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const shared = request().pipe(
      filter((event): event is HttpResponse<unknown> => event instanceof HttpResponse),
      tap((response) => {
        if (response.ok) this.store(key, tag, response);
      }),
      finalize(() => this.inFlight.delete(key)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inFlight.set(key, shared);
    return shared;
  }

  /** Drops entries with these tags and tells views showing them to refresh. */
  invalidate(tags: readonly CacheTag[]): void {
    const set = new Set(tags);
    for (const [key, entry] of this.entries) if (set.has(entry.tag)) this.entries.delete(key);
    this.changeSubject.next(set);
  }

  /** Drops everything, e.g. after a write whose effects reach many lists. */
  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
    this.changeSubject.next(null);
  }

  private store(key: string, tag: CacheTag, response: HttpResponse<unknown>): void {
    this.entries.delete(key);
    this.entries.set(key, { response, storedAt: Date.now(), tag });
    while (this.entries.size > CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  private identity(): string {
    return `${this.auth.currentUser?.()?.id ?? ''}:${this.auth.organizationId?.() ?? ''}`;
  }
}

/**
 * Serves opted-in GETs from ApiCache: a fresh entry answers alone; an older
 * one answers at once and the network copy follows if it differs
 * (stale-while-revalidate). Any successful non-GET clears the cache, so no
 * screen shows data from before an edit.
 */
export const apiCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const cache = inject(ApiCache);
  if (req.method !== 'GET') {
    return next(req).pipe(
      tap((event) => {
        if (event instanceof HttpResponse && event.ok) cache.clear();
      }),
    );
  }

  const tag = req.context.get(CACHE_TAG);
  if (!tag) return next(req);

  const key = cache.key(req.urlWithParams);
  const entry = cache.read(key);
  if (entry && Date.now() - entry.storedAt < CACHE_FRESH_MS) return of(entry.response.clone());

  const network$ = cache.fetch(key, tag, () => next(req));
  if (!entry) return network$;
  return concat(
    of(entry.response.clone()),
    network$.pipe(
      filter((response) => !sameBody(response, entry.response)),
      // The cached copy is already on screen; a failed refresh keeps it.
      catchError(() => EMPTY),
    ),
  );
};

function sameBody(a: HttpResponse<unknown>, b: HttpResponse<unknown>): boolean {
  try {
    return JSON.stringify(a.body) === JSON.stringify(b.body);
  } catch {
    return false;
  }
}
