import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { SessionExpiryService } from './session-expiry.service';

/** better-auth's own session endpoints: a 401 there answers a question about the session, it does not end one. */
const SESSION_ENDPOINT = /\/auth\/(sign-in|sign-out|get-session)(\/|\?|$)/;

/**
 * Sends cookies with every API call. A 401 from a data request makes
 * SessionExpiryService check the session with the server before anything is
 * cleared; the error then reaches the caller either way, so a page whose
 * session is still valid shows its normal error state.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionExpiry = inject(SessionExpiryService);

  return next(req.clone({ withCredentials: true })).pipe(
    catchError((error: unknown) => {
      const isDataRequest401 =
        error instanceof HttpErrorResponse &&
        error.status === HttpStatusCode.Unauthorized &&
        !SESSION_ENDPOINT.test(req.url);
      if (!isDataRequest401) return throwError(() => error);

      return from(sessionExpiry.handleUnauthorized()).pipe(switchMap(() => throwError(() => error)));
    }),
  );
};
