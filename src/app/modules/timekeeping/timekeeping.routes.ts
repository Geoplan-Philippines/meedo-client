import { Routes } from "@angular/router";
import { Attendance } from "./attendance/attendance";
import { Timesheet } from "./attendance/timesheet/timesheet";

export const timekeepingRoutes: Routes = [
    {
        path: 'attendance',
        component: Timesheet,
    },
    {
        path: 'attendance/recognition',
        component: Attendance,
    },
]
