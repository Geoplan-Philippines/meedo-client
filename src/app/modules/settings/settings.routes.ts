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
  {
    path: 'website/lead-fields',
    data: {
      collection: 'lead',
      heading: 'Lead fields',
      subtitle: 'Standard and custom fields collected from website lead forms.',
    },
    loadComponent: () =>
      import('./website/field-definitions/field-definitions').then((m) => m.FieldDefinitionsSettings),
  },
  {
    path: 'website/subscriber-fields',
    data: {
      collection: 'subscriber',
      heading: 'Subscriber fields',
      subtitle: 'Standard and custom fields collected from newsletter sign-up forms.',
    },
    loadComponent: () =>
      import('./website/field-definitions/field-definitions').then((m) => m.FieldDefinitionsSettings),
  },
  // Flat projects list. No longer in Settings or the sidebar, but project notifications and old links open it.
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
