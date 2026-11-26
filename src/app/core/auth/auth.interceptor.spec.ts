import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { authInterceptor } from './auth.interceptor';
import { AuthService, SessionStatus } from './auth.service';
import { LOGIN_PATH } from './session-expiry.service';

const API = 'http://localhost:8000/api/v1';
const MEMBERS_URL = `${API}/auth/organization/list-members`;
const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const authenticated = signal(true);
  const auth = {
    isAuthenticated: authenticated.asReadonly(),
    checkSession: vi.fn<() => Promise<SessionStatus>>(),
    clearLocalSession: vi.fn(() => authenticated.set(false)),
    logout: vi.fn<() => Promise<void>>(),
  };
  const router = { navigate: vi.fn<(commands: unknown[]) => Promise<boolean>>() };

  beforeEach(() => {
    authenticated.set(true);
    vi.clearAllMocks();
    auth.checkSession.mockResolvedValue('active');
    router.navigate.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  /** Sends a GET and collects the error it ends with, if any. */
  const send = (url: string) => {
    const errors: HttpErrorResponse[] = [];
    http.get(url).subscribe({ error: (error: HttpErrorResponse) => errors.push(error) });
    return errors;
  };
  /** Lets the session check and navigation promises run. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it('sends cookies with authenticated API requests', () => {
    send(MEMBERS_URL);
    const request = backend.expectOne(MEMBERS_URL);
    expect(request.request.withCredentials).toBe(true);
    request.flush([]);
  });

  it('skips cookies on public API calls so CORS * is allowed', () => {
    const url = `${API}/public/unsubscribe/tok-1`;
    http.post(url, {}).subscribe();
    const request = backend.expectOne(url);
    expect(request.request.withCredentials).toBe(false);
    request.flush({});
  });

  it('does not treat a public 401 as session expiry', async () => {
    const url = `${API}/public/unsubscribe/tok-1`;
    const errors: HttpErrorResponse[] = [];
    http.post(url, {}).subscribe({ error: (error: HttpErrorResponse) => errors.push(error) });
    backend.expectOne(url).flush(null, UNAUTHORIZED);
    await settle();
    expect(auth.checkSession).not.toHaveBeenCalled();
    expect(auth.clearLocalSession).not.toHaveBeenCalled();
    expect(errors.map((error) => error.status)).toEqual([401]);
  });

  it('clears the local session and opens login, without signing out on the server, when the session is gone', async () => {
    auth.checkSession.mockResolvedValue('gone');
    const errors = send(MEMBERS_URL);

    backend.expectOne(MEMBERS_URL).flush(null, UNAUTHORIZED);
    await settle();

    expect(auth.checkSession).toHaveBeenCalledTimes(1);
    expect(auth.clearLocalSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith([LOGIN_PATH]);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(errors.map((error) => error.status)).toEqual([401]);
  });

  it('keeps a valid session and passes the 401 to the page', async () => {
    const errors = send(MEMBERS_URL);

    backend.expectOne(MEMBERS_URL).flush({ code: 'UNAUTHORIZED' }, UNAUTHORIZED);
    await settle();

    expect(auth.checkSession).toHaveBeenCalledTimes(1);
    expect(auth.clearLocalSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(errors.map((error) => error.status)).toEqual([401]);
  });

  it('keeps the session when the check itself fails', async () => {
    auth.checkSession.mockResolvedValue('unknown');
    const errors = send(MEMBERS_URL);

    backend.expectOne(MEMBERS_URL).flush(null, UNAUTHORIZED);
    await settle();

    expect(auth.clearLocalSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(errors).toHaveLength(1);
  });

  it.each(['/auth/sign-in/email', '/auth/sign-out', '/auth/get-session'])(
    'ignores a 401 from the session endpoint %s',
    async (path) => {
      const errors = send(`${API}${path}`);

      backend.expectOne(`${API}${path}`).flush(null, UNAUTHORIZED);
      await settle();

      expect(auth.checkSession).not.toHaveBeenCalled();
      expect(auth.clearLocalSession).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(errors.map((error) => error.status)).toEqual([401]);
    },
  );

  it('runs one check and one redirect for several 401s at once, and ignores 401s that arrive after', async () => {
    auth.checkSession.mockResolvedValue('gone');
    const urls = [MEMBERS_URL, `${API}/auth/organization/list-teams`, `${API}/settings/members`];
    const errors = urls.map((url) => send(url));

    urls.forEach((url) => backend.expectOne(url).flush(null, UNAUTHORIZED));
    await settle();

    const straggler = send(`${API}/tickets`);
    backend.expectOne(`${API}/tickets`).flush(null, UNAUTHORIZED);
    await settle();

    expect(auth.checkSession).toHaveBeenCalledTimes(1);
    expect(auth.clearLocalSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect([...errors, straggler].map((list) => list.length)).toEqual([1, 1, 1, 1]);
  });

  it('leaves other errors alone', async () => {
    const errors = send(`${API}/attendance/biometrics/users`);

    backend.expectOne(`${API}/attendance/biometrics/users`).flush(null, { status: 503, statusText: 'Service Unavailable' });
    await settle();

    expect(auth.checkSession).not.toHaveBeenCalled();
    expect(errors.map((error) => error.status)).toEqual([503]);
  });
});
