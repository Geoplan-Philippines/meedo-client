import { Routes } from "@angular/router";
import { Attendance } from "./attendance/attendance";

export const timekeepingRoutes: Routes = [
    {
        path: 'attendance',
        component: Attendance,
    },
]
