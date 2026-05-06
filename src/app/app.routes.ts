import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'dashboard',
    component: MainLayout,
    loadChildren: () =>
      import('./modules/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
  },
  {
    path: 'tickets',
    component: MainLayout,
    loadChildren: () =>
      import('./modules/tickets/tickets.routes').then((m) => m.ticketsRoutes),
  },
];
