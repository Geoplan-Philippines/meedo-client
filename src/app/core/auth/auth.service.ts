import { computed, Injectable, signal } from '@angular/core';
import { createAuthClient } from 'better-auth/client';
import { environment } from '../../../environments/environment.dev';
import { AuthUser } from './auth.types';

const authClient = createAuthClient({
  baseURL: `${environment.apiBaseUrl}/auth`,
});

type SessionData = {
  session: { id: string; userId: string; expiresAt: Date };
  user: AuthUser;
} | null;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<SessionData>(null);

  readonly currentUser = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);

  constructor() {
    this.loadSession();
  }

  private async loadSession(): Promise<void> {
    const { data } = await authClient.getSession();
    this._session.set(data as SessionData);
  }

  async login(payload: { email: string; password: string }) {
    const { data, error } = await authClient.signIn.email({
      email: payload.email,
      password: payload.password,
    });
    if (data) {
      await this.loadSession();
    }
    return { data, error };
  }

  async signUp(email: string, password: string, name: string) {
    const { data, error } = await authClient.signUp.email({
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
    await authClient.signOut();
    this._session.set(null);
  }
}
