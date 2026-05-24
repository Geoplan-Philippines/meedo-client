import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => 
      import('./modules/home/home').then(m => m.Home) 
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.authRoutes),
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
    path: 'maintenance',
    component: MainLayout,
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/maintenance/maintenance.routes').then((m) => m.maintenanceRoutes),
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
