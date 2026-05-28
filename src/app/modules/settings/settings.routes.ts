import { Routes } from '@angular/router';
import { Settings } from './settings';
import { Teams } from './teams/teams';
import { Categories } from './categories/categories';
import { Statuses } from './statuses/statuses';

export const settingsRoutes: Routes = [
  {
    path: '',
    component: Settings,
  },
  {
    path: 'teams',
    component: Teams,
  },
  {
    path: 'categories',
    component: Categories,
  },
  {
    path: 'statuses',
    component: Statuses,
  },
];
