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
      import('./attendance/timesheet/timesheet').then((m) => m.Timesheet),
    canDeactivate: [
      (component: any) => component.confirmDiscardChanges(),
    ],
  },
  {
    path: 'attendance/recognition',
    loadComponent: () =>
      import('./attendance/attendance').then((m) => m.Attendance),
  },
  {
    path: 'attendance/:employeeId',
    loadComponent: () =>
      import('./attendance/employee-detail/employee-detail').then((m) => m.EmployeeDetail),
  },
];
