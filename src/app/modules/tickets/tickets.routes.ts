import { Routes } from '@angular/router';

export const ticketsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./tickets').then(m => m.Tickets),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard),
  },
  {
    // Keep last so 'dashboard' isn't captured by :id.
    path: ':id',
    loadComponent: () => import('./ticket-detail/ticket-detail').then(m => m.TicketDetail),
  },
];
