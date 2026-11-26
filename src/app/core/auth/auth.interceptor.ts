import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { SessionExpiryService } from './session-expiry.service';

/** better-auth's own session endpoints: a 401 there answers a question about the session, it does not end one. */
const SESSION_ENDPOINT = /\/auth\/(sign-in|sign-out|get-session)(\/|\?|$)/;
/** Public integration routes send Access-Control-Allow-Origin: *; cookies would be blocked. */
const PUBLIC_API = /\/api\/v1\/public(?:\/|\?|$)/;

/**
 * Sends cookies with authenticated API calls. Public /api/v1/public/* calls
 * skip credentials. A 401 from a data request makes SessionExpiryService check
 * the session with the server before anything is cleared; the error then
 * reaches the caller either way, so a page whose session is still valid shows
 * its normal error state.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionExpiry = inject(SessionExpiryService);
  const publicApi = PUBLIC_API.test(req.url);
  const request = req.clone({ withCredentials: !publicApi });

  return next(request).pipe(
    catchError((error: unknown) => {
      const isDataRequest401 =
        !publicApi &&
        error instanceof HttpErrorResponse &&
        error.status === HttpStatusCode.Unauthorized &&
        !SESSION_ENDPOINT.test(req.url);
      if (!isDataRequest401) return throwError(() => error);

      return from(sessionExpiry.handleUnauthorized()).pipe(switchMap(() => throwError(() => error)));
    }),
  );
};
