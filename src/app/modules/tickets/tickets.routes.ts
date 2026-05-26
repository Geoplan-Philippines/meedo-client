import { Routes } from '@angular/router';
import { Tickets } from './tickets';
import { Dashboard } from './dashboard/dashboard';

export const ticketsRoutes: Routes = [
  {
    path: '',
    component: Tickets,
  },
  {
    path: 'dashboard',
    component: Dashboard,
  },
];
