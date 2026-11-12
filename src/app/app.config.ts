import { APP_INITIALIZER, ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { PrimeNG, providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const authService = inject(AuthService);
        return () => authService.initialize();
      },
      multi: true,
    },
    providePrimeNG(),
    // The theme preset (Aura plus Meedo tokens, about 110 kB) is its own chunk. It loads
    // during startup, in parallel with the session check above, and is applied before
    // the first screen renders; every PrimeNG component sits behind a lazy route.
    provideAppInitializer(() => {
      const primeng = inject(PrimeNG);
      return import('./app.preset').then(({ AppPreset }) =>
        primeng.setThemeConfig({
          theme: {
            preset: AppPreset,
            options: {
              darkModeSelector: '.app-dark',
            },
          },
        }),
      );
    }),
  ],
};
