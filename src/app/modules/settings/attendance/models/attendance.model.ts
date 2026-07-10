/**
 * Types for the attendance-settings module. These mirror the server contract in
 * `meedo-server/src/modules/settings/attendance` (Prisma models + DTOs). Times
 * are 24-hour "HH:mm" strings; calendar dates are "YYYY-MM-DD"; timestamps are ISO.
 */

export type DayOfWeek =
  | 'SUNDAY'
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY';

/** Expected work mode for a scheduled day. */
export type AttendanceSource = 'OFFICE' | 'FIELD' | 'WFH';

export type HolidayType = 'REGULAR' | 'SPECIAL_NON_WORKING' | 'SPECIAL_WORKING';

/** Which layer of the org-default → team → employee hierarchy resolved a schedule. */
export type AssignmentSource = 'employee' | 'team' | 'organization-default' | 'none';

// ── Shifts ──────────────────────────────────────────────────────────────────

export interface Shift {
  id: string;
  name: string;
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" */
  endTime: string;
  breakMinutes: number;
  /** Per-shift late grace; falls back to the org policy when null. */
  graceMinutes: number | null;
  crossesMidnight: boolean;
  /** Flexible shift: start time is nominal and lateness is not tracked. */
  isFlexible: boolean;
  color: string | null;
  isActive: boolean;
  isArchived: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftPayload {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  graceMinutes?: number | null;
  crossesMidnight?: boolean;
  isFlexible?: boolean;
  color?: string;
}

export type UpdateShiftPayload = Partial<CreateShiftPayload>;

// ── Weekly schedules ─────────────────────────────────────────────────────────

export interface WeeklyScheduleDay {
  id: string;
  weeklyScheduleId: string;
  dayOfWeek: DayOfWeek;
  isWorkingDay: boolean;
  expectedSource: AttendanceSource | null;
  /** When false, lateness is not recorded for this day (e.g. a flexible WFH day). */
  trackLateness: boolean;
  shiftId: string | null;
  /** Included by the API (`days.include.shift`). */
  shift: Shift | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklySchedule {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  isArchived: boolean;
  organizationId: string;
  days: WeeklyScheduleDay[];
  /** How many teams/employees reference this schedule (blocks deletion when > 0). */
  _count?: { teamAssignments: number; employeeAssignments: number };
  createdAt: string;
  updatedAt: string;
}

/** One day as sent to POST/PUT (no ids; server owns identity). */
export interface WeeklyScheduleDayInput {
  dayOfWeek: DayOfWeek;
  isWorkingDay: boolean;
  expectedSource?: AttendanceSource | null;
  shiftId?: string | null;
  /** When false, lateness is not recorded for this day. Defaults to true server-side. */
  trackLateness?: boolean;
}

export interface CreateWeeklySchedulePayload {
  name: string;
  isDefault?: boolean;
  days?: WeeklyScheduleDayInput[];
}

export interface UpdateWeeklySchedulePayload {
  name?: string;
  isActive?: boolean;
}

export interface SetScheduleDaysPayload {
  days: WeeklyScheduleDayInput[];
}

// ── Holidays ─────────────────────────────────────────────────────────────────

export interface Holiday {
  id: string;
  name: string;
  /** ISO datetime at UTC midnight of the calendar day. */
  date: string;
  type: HolidayType;
  isRecurring: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHolidayPayload {
  name: string;
  /** "YYYY-MM-DD" */
  date: string;
  type?: HolidayType;
  isRecurring?: boolean;
}

export type UpdateHolidayPayload = Partial<CreateHolidayPayload>;

export interface GenerateHolidaysPayload {
  year: number;
  /** ISO 3166-1 alpha-2, defaults to PH server-side. */
  countryCode?: string;
}

export interface GenerateHolidaysResult {
  imported: number;
  skipped: number;
}

// ── Policy ───────────────────────────────────────────────────────────────────

export interface AttendancePolicy {
  id: string;
  organizationId: string;
  timezone: string;
  autoClockOutEnabled: boolean;
  autoClockOutTime: string;
  standardHoursPerDay: number;
  standardHoursPerWeek: number;
  maxHoursPerDay: number;
  graceMinutes: number;
  lunchMinutes: number;
  lunchIsPaid: boolean;
  overtimeAfterHoursPerDay: number;
  minimumOvertimeMinutes: number;
  overtimeMultiplier: number;
  restDayMultiplier: number;
  nightDifferentialMultiplier: number;
  nightDifferentialStart: string;
  nightDifferentialEnd: string;
  createdAt: string;
  updatedAt: string;
}

export type UpdateAttendancePolicyPayload = Partial<
  Omit<AttendancePolicy, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
>;

// ── Assignments ──────────────────────────────────────────────────────────────

/** Trimmed schedule shape the assignments endpoints embed. */
export interface AssignedSchedule {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface TeamScheduleAssignment {
  id: string;
  organizationId: string;
  teamId: string;
  weeklyScheduleId: string;
  team: { id: string; name: string };
  weeklySchedule: AssignedSchedule;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeScheduleAssignment {
  id: string;
  organizationId: string;
  userId: string;
  weeklyScheduleId: string;
  user: { id: string; name: string | null; email: string };
  weeklySchedule: AssignedSchedule;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentsResponse {
  teams: TeamScheduleAssignment[];
  employees: EmployeeScheduleAssignment[];
}

/** The read-only resolver preview (`GET assignments/effective/:userId`). */
export interface EffectiveSchedule {
  userId: string;
  date: string;
  dayOfWeek: DayOfWeek;
  source: AssignmentSource;
  schedule: AssignedSchedule | null;
  isWorkingDay: boolean | null;
  isRestDay: boolean | null;
  expectedSource: AttendanceSource | null;
  expectedHours: number;
  isFlexible: boolean;
  trackLateness: boolean;
  shift: Shift | null;
  isHoliday: boolean;
  policy: AttendancePolicy;
}
