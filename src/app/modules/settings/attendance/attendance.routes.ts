import { Routes } from '@angular/router';

import { Attendance } from './attendance';

export const attendanceRoutes: Routes = [
  { path: '', component: Attendance },
  {
    path: 'shifts',
    loadComponent: () => import('./shifts/shifts').then((m) => m.Shifts),
  },
  {
    path: 'schedules',
    loadComponent: () => import('./schedules/schedules').then((m) => m.Schedules),
  },
  {
    path: 'schedules/:id',
    loadComponent: () =>
      import('./schedules/schedule-editor/schedule-editor').then((m) => m.ScheduleEditor),
  },
  {
    path: 'holidays',
    loadComponent: () => import('./holidays/holidays').then((m) => m.Holidays),
  },
  {
    path: 'policy',
    loadComponent: () => import('./policy/policy').then((m) => m.Policy),
  },
  {
    path: 'assignments',
    loadComponent: () => import('./assignments/assignments').then((m) => m.Assignments),
  },
];
