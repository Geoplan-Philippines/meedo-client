import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { map, Observable, take, catchError, of } from 'rxjs';
import { createAuthClient } from 'better-auth/client';
import { environment } from '../../../environments/environment.dev';
import { AuthUser } from './auth.types';
import { isOrganizationAdmin } from './org-admin.guard';

/**
 * What a fresh session check found. `unknown` means the check itself failed
 * (network or server error), so it proves nothing either way.
 */
export type SessionStatus = 'active' | 'gone' | 'unknown';

const HTTP_UNAUTHORIZED = 401;

type SessionData = {
  session: {
    activeOrganizationId: string | null;
    activeTeamId: string | null;
  };
  user: AuthUser;
} | null;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly client = createAuthClient({
    baseURL: `${environment.apiBaseUrl}/auth`,
  });

  private readonly _session = signal<SessionData>(null);
  private readonly _memberRole = signal<string | null>(null);

  readonly currentUser = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);

  readonly organizationId = computed(() =>
    this._session()?.session?.activeOrganizationId ?? null
  );

  readonly memberRole = this._memberRole.asReadonly();
  readonly isAdmin = computed(() => isOrganizationAdmin(this._memberRole()));

  getActiveMemberRole(organizationId?: string): Observable<string> {
    return this.http
      .get<{ role: string }>(
        `${environment.apiBaseUrl}/auth/organization/get-active-member-role`,
        {
          params: organizationId ? { organizationId } : {},
          withCredentials: true,
        },
      )
      .pipe(map((response) => response.role));
  }

  private loadMemberRole(): void {
    const organizationId = this.organizationId();
    if (!organizationId) return;

    this.getActiveMemberRole(organizationId)
      .pipe(
        take(1),
        catchError(() => of(null)),
      )
      .subscribe((role) => this._memberRole.set(role));
  }

  async initialize(): Promise<void> {
    try {
      await this.loadSession();
    } catch (err) {
      console.error('[AuthService] Failed to load session:', err);
    }
  }

  private async loadSession(): Promise<void> {
    const { data } = await this.client.getSession();
    this._session.set(data as SessionData);
    this.loadMemberRole();
  }

  async login(payload: { email: string; password: string }) {
    const { data, error } = await this.client.signIn.email({
      email: payload.email,
      password: payload.password,
    });

    if (data) {
      await this.loadSession();
    }

    return { data, error };
  }

  async signUp(email: string, password: string, name: string) {
    const { data, error } = await this.client.signUp.email({
      email,
      password,
      name,
    });

    if (data) {
      await this.loadSession();
    }
    return { data, error };
  }

  /**
   * Asks the server whether this browser still has a session. It only reads:
   * the session is not refreshed and local state is not changed.
   */
  async checkSession(): Promise<SessionStatus> {
    try {
      const { data, error } = await this.client.getSession({
        query: { disableRefresh: true, disableCookieCache: true },
      });
      if (error) return error.status === HTTP_UNAUTHORIZED ? 'gone' : 'unknown';
      return data?.session ? 'active' : 'gone';
    } catch {
      return 'unknown';
    }
  }

  /** Forgets the session in this tab only. The server session is left alone. */
  clearLocalSession(): void {
    this._session.set(null);
    this._memberRole.set(null);
  }

  /** The user's own sign-out: ends the session on the server, then here. */
  async logout(): Promise<void> {
    try {
      await this.client.signOut();
    } finally {
      this.clearLocalSession();
    }
  }
}
