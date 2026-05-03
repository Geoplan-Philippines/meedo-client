import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./modules/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'tickets',
    loadChildren: () =>
      import('./modules/tickets/tickets.routes').then((m) => m.ticketsRoutes),
  },
];
