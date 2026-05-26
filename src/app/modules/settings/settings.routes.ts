import { Routes } from '@angular/router';
import { Settings } from './settings';
import { Teams } from './teams/teams';
import { Categories } from './categories/categories';

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
];
