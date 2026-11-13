import { APP_INITIALIZER, ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';

import { PrimeNG, providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth/auth.interceptor';
import { apiCacheInterceptor } from './core/http/api-cache';
import { IdlePreloadingStrategy } from './core/prefetch/idle-preloading.strategy';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Screens people open next load their code once the browser is idle.
    provideRouter(routes, withPreloading(IdlePreloadingStrategy)),
    // The cache answers opted-in list and detail GETs at once and is cleared by any write.
    provideHttpClient(withInterceptors([authInterceptor, apiCacheInterceptor])),
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
