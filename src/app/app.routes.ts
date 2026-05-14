import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'tickets',
    component: MainLayout,
    loadChildren: () =>
      import('./modules/tickets/tickets.routes').then((m) => m.ticketsRoutes),
  },
  {
    path: 'timekeeping',
    component: MainLayout,
    loadChildren: () =>
      import('./modules/timekeeping/timekeeping.routes').then((m) => m.timekeepingRoutes)
  },
  {
    path: 'crm',
    component: MainLayout,
    loadChildren: () =>
      import('./modules/crm/crm.routes').then((m) => m.crmRoutes),
  },  
  {
    path: 'maintenance',
    component: MainLayout,
    loadChildren: () =>
      import('./modules/maintenance/maintenance.routes').then((m) => m.maintenanceRoutes),
  },
];
