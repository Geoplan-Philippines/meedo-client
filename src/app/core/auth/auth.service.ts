import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';

import { AuthUser, BetterAuthLoginResponse, LoginPayload } from './auth.types';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8000/api/v1/auth';

  private readonly _currentUser = signal<AuthUser | null>(this.readStoredUser());

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  login(payload: LoginPayload) {
    return this.http
      .post<BetterAuthLoginResponse>(`${this.apiUrl}/sign-in/email`, payload)
      .pipe(
        tap(({ token, user }) => {
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          this._currentUser.set(user);
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private readStoredUser(): AuthUser | null {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as AuthUser;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
