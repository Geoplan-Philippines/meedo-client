import { Routes } from '@angular/router';
import { Settings } from './settings';
import { Teams } from './teams/teams';
import { Categories } from './categories/categories';
import { Statuses } from './statuses/statuses';
import { Users } from './users/users';
import { orgAdminGuard } from '../../core/auth/org-admin.guard';

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
  {
    path: 'attendance',
    loadChildren: () =>
      import('./attendance/attendance.routes').then((m) => m.attendanceRoutes),
  },
  {
    path: 'users',
    component: Users,
    canActivate: [orgAdminGuard],
  },
  // Admin entry points reuse the same Projects and Customers screens.
  {
    path: 'projects',
    loadComponent: () => import('./projects/projects').then((m) => m.Projects),
  },
  // Open to all members; editing is admin-only (enforced by the API and hidden in the UI).
  {
    path: 'customers',
    redirectTo: '/clients',
  },
];
