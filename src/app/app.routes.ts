import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

/** The app chrome (header, sidebar, notifications) loads with the first signed-in page, not at startup. */
const loadMainLayout = () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout);

export const routes: Routes = [
  {
    path: 'notifications', loadComponent: loadMainLayout, canActivate: [authGuard],
    loadChildren: () => import('./modules/notifications/notifications.routes').then(m => m.notificationsRoutes),
  },
  { path: '', pathMatch: 'full', redirectTo: 'timekeeping' },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'tickets',
    loadComponent: loadMainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/tickets/tickets.routes').then((m) => m.ticketsRoutes),
  },
  {
    path: 'clients',
    loadComponent: loadMainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/clients/clients.routes').then((m) => m.clientsRoutes),
  },
  {
    path: 'timekeeping',
    loadComponent: loadMainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/timekeeping/timekeeping.routes').then((m) => m.timekeepingRoutes)
  },
  {
    path: 'crm',
    loadComponent: loadMainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/crm/crm.routes').then((m) => m.crmRoutes),
  },
  {
    path: 'settings',
    loadComponent: loadMainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/settings/settings.routes').then((m) => m.settingsRoutes),
  },

  {
    path: '404',
    loadComponent: () =>
      import('./modules/not-found/not-found').then((m) => m.NotFound),
  },
  {
    path: '**',
    redirectTo: '404',
  },
];
