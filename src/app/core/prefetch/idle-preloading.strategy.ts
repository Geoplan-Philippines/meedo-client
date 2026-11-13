import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';

/** Wait at most this long for an idle moment before preloading anyway. */
const IDLE_TIMEOUT_MS = 3000;

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/** Skips preloading when the user asked to save data or is on a 2G-class connection. */
export function shouldSaveData(): boolean {
  const connection = (globalThis.navigator as Navigator & { connection?: NetworkInformationLike } | undefined)?.connection;
  return !!connection && (connection.saveData === true || /(^|-)2g$/.test(connection.effectiveType ?? ''));
}

/** Resolves when the browser is idle (or after a timeout), so preloading never competes with the first screen. */
export function whenIdle(): Observable<void> {
  return new Observable<void>((subscriber) => {
    const done = () => {
      subscriber.next();
      subscriber.complete();
    };
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(done, { timeout: IDLE_TIMEOUT_MS });
      return () => cancelIdleCallback(handle);
    }
    const handle = setTimeout(done, IDLE_TIMEOUT_MS);
    return () => clearTimeout(handle);
  });
}

/**
 * Route preloading for the screens people open next: routes marked
 * `data: { preload: true }` load their code once the browser is idle. Anything
 * else (the face-recognition camera page, auth pages) loads on demand or when
 * a link to it is hovered.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preload'] !== true || shouldSaveData()) return of(null);
    return whenIdle().pipe(switchMap(() => load()));
  }
}
