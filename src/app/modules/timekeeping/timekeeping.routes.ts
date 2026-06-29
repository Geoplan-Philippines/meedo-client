import { Routes } from '@angular/router';

export const timekeepingRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'attendance',
  },
  {
    path: 'attendance',
    loadComponent: () =>
      import('./attendance/attendance').then((m) => m.Attendance),
  },
  {
    path: 'timesheet',
    loadComponent: () =>
      import('./timesheet/timesheet').then((m) => m.Timesheet),
    canDeactivate: [
      (component) => component.confirmDiscardChanges(),
    ],
  },
];
