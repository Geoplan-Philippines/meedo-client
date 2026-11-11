import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';

import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('offers administrator help without linking to a missing password reset route', () => {
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain(
      'Forgot your password? Contact your administrator for help.',
    );
    expect(page.querySelector('a[href*="forgot-password"]')).toBeNull();
    const hint = Array.from(page.querySelectorAll('p')).find((p) =>
      p.textContent?.includes('Forgot your password?'),
    );
    expect(hint).toBeTruthy();
    expect(hint?.closest('a')).toBeNull();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lands on timekeeping after successful login', async () => {
    TestBed.inject(AuthService).login = vi
      .fn()
      .mockResolvedValue({ data: {}, error: null });
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    component.loginForm.patchValue({
      email: 'member@example.test',
      password: 'example-password',
    });
    await component.onSubmit();
    expect(navigate).toHaveBeenCalledWith(['/timekeeping/attendance']);
  });
});
