import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { map, Observable, take } from 'rxjs';
import { createAuthClient } from 'better-auth/client';
import { environment } from '../../../environments/environment.dev';
import { AuthUser } from './auth.types';

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
  readonly isAdmin = computed(() => {
    const role = this._memberRole();
    return role === 'admin' || role === 'owner';
  });

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
      .pipe(take(1))
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

  async logout(): Promise<void> {
    await this.client.signOut();
    this._session.set(null);
    this._memberRole.set(null);
  }
}
