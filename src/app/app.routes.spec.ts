import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from './core/auth/auth.service';
import { routes } from './app.routes';
import { authGuard } from './core/auth/auth.guard';

@Component({ template: '' })
class Destination {}

describe('root redirect after session initialization', () => {
  const authenticated = signal(false);
  beforeEach(() => {
    authenticated.set(false);
    const timekeeping = routes.find((route) => route.path === 'timekeeping')!;
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: authenticated } },
        provideRouter([
          routes.find((route) => route.path === '')!,
          {
            path: 'timekeeping',
            component: Destination,
            canActivate: timekeeping.canActivate,
          },
          { path: 'auth/login', component: Destination },
        ]),
      ],
    });
  });

  it('sends a signed-out session from / to login through the existing auth guard', async () => {
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/auth/login');
  });

  it('sends a signed-in session from / to /timekeeping', async () => {
    authenticated.set(true);
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/timekeeping');
  });

  it('keeps all client routes protected by the existing auth guard', () => {
    expect(
      routes.find((route) => route.path === 'clients')?.canActivate,
    ).toContain(authGuard);
  });
});
