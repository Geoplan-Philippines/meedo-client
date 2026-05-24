import { Routes } from '@angular/router';
import { Tickets } from './tickets';
import { Dashboard } from './dashboard/dashboard';
import { Categories } from './categories/categories';

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
    path: 'categories',
    component: Categories,
  },
];
