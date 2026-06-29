import { Routes } from "@angular/router";
import { Attendance } from "./attendance/attendance";
import { Timesheet } from "./attendance/timesheet/timesheet";
import { EmployeeDetail } from "./attendance/employee-detail/employee-detail";

export const timekeepingRoutes: Routes = [
    {
        path: 'attendance',
        component: Timesheet,
    },
    {
        path: 'attendance/recognition',
        component: Attendance,
    },
    {
        path: 'attendance/:employeeId',
        component: EmployeeDetail,
    },
]
