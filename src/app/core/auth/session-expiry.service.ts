import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

export const LOGIN_PATH = '/auth/login';

/**
 * Decides what a 401 from a data request means. A 401 alone is not proof the
 * session ended (the server can fail its session lookup for other reasons), so
 * the session is checked once with the server, however many 401s arrive
 * together. Only a session the server confirms is gone clears this tab's
 * sign-in and opens the login page. The server session is never signed out here.
 */
@Injectable({ providedIn: 'root' })
export class SessionExpiryService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private pendingCheck: Promise<void> | null = null;

  /** Resolves once the check (shared with any other 401 in flight) is done. Never rejects. */
  handleUnauthorized(): Promise<void> {
    // Already signed out in this tab, e.g. a slow request answering after the redirect.
    if (!this.auth.isAuthenticated()) return Promise.resolve();

    this.pendingCheck ??= this.endSessionIfGone().finally(() => {
      this.pendingCheck = null;
    });
    return this.pendingCheck;
  }

  private async endSessionIfGone(): Promise<void> {
    try {
      if ((await this.auth.checkSession()) !== 'gone') return;
      this.auth.clearLocalSession();
      await this.router.navigate([LOGIN_PATH]);
    } catch (error) {
      console.error('[SessionExpiry] Could not finish handling an expired session:', error);
    }
  }
}
