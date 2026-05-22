import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { Home } from './modules/home/home';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: Home
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
];
