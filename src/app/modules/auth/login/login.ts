import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgOptimizedImage } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgOptimizedImage,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
    DividerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  isSubmitting = signal(false);
  errorMessage = signal('');

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  constructor() {
    // Dismiss the "Invalid email or password" banner as soon as the user edits the
    // password after a failed attempt — the previous error no longer applies, so we
    // leave only the field-level "Password is required" validation message.
    this.loginForm.controls.password.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.errorMessage()) this.errorMessage.set('');
      });
  }

  async onSubmit(): Promise<void> {
    if (this.isSubmitting()) return;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const { email, password } = this.loginForm.getRawValue();

    try {
      const { error } = await this.authService.login({ email: email!, password: password! });
      if (error) {
        this.errorMessage.set(error.message ?? 'Invalid email or password.');
        return;
      }
      await this.router.navigate(['/timekeeping/attendance']);
    } catch {
      this.errorMessage.set('An unexpected error occurred. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
