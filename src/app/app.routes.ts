import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { 
    path: '', 
    redirectTo:'timekeeping',
    pathMatch:'full'
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'projects',
    component: MainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/projects/projects.routes').then((m) => m.projectsRoutes),
  },
  {
    path: 'tickets',
    component: MainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/tickets/tickets.routes').then((m) => m.ticketsRoutes),
  },
  {
    path: 'timekeeping',
    component: MainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/timekeeping/timekeeping.routes').then((m) => m.timekeepingRoutes)
  },
  {
    path: 'crm',
    component: MainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/crm/crm.routes').then((m) => m.crmRoutes),
  },
  {
    path: 'settings',
    component: MainLayout,
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
