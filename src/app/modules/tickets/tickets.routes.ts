import { Routes } from '@angular/router';
import { Tickets } from './tickets';
import { Dashboard } from './dashboard/dashboard';
import { TicketDetail } from './ticket-detail/ticket-detail';

export const ticketsRoutes: Routes = [
  {
    path: '',
    component: Tickets,
  },
  {
    path: 'dashboard',
    component: Dashboard,
  },
  {
    // Keep last so 'dashboard' isn't captured by :id.
    path: ':id',
    component: TicketDetail,
  },
];
