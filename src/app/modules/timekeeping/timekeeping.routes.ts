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
  {
    path: 'timesheet/approval/review',
    loadComponent: () =>
      import('./timesheet/review/timesheet-review').then((m) => m.TimesheetReview),
  },
  {
    path: 'timesheet/approval',
    loadComponent: () =>
      import('./timesheet/approval/timesheet-approval').then((m) => m.TimesheetApproval),
  },
];
