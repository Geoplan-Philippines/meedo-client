import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req.clone({ withCredentials: true })).pipe(
    catchError((error) => {
      if (error.status === 401) {
        authService.logout()
          .then(() => router.navigate(['/auth/login']))
          .catch(() => router.navigate(['/auth/login']));
      }
      return throwError(() => error);
    }),
  );
};
