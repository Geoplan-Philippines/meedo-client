import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import {
  PaginatedApiResponse,
  PaginationMeta,
} from '../../../../shared/interface/paginated-response.interface';

export interface RecognitionResult {
  matched: boolean;
  similarity: number;
  threshold: number;
}

export type RecognizeResponse = ApiResponse<RecognitionResult>;

/* ─── Attendance management ─────────────────────────────── */

export type AttendanceSource = 'OFFICE' | 'FIELD' | 'WFH';

export type AttendanceEventType =
  | 'OFFICE_ACCESS'
  | 'OFFICE_IN'
  | 'OFFICE_OUT'
  | 'FIELD_IN'
  | 'FIELD_OUT'
  | 'WFH_IN'
  | 'WFH_OUT';

/** Event types an employee may punch from the web app (OFFICE_ACCESS is biometric-only). */
export type ManualEventType =
  | 'OFFICE_IN'
  | 'OFFICE_OUT'
  | 'FIELD_IN'
  | 'FIELD_OUT'
  | 'WFH_IN'
  | 'WFH_OUT';

/** Where the work happened, as chosen in the Work Type dialog. */
export type WorkType = 'HOME' | 'OFFICE' | 'FIELD';

export type AttendanceOrigin = 'BIOMETRICS' | 'MANUAL';

export interface AttendanceEvent {
  id: string;
  employeeId: string;
  source: AttendanceSource;
  eventType: AttendanceEventType;
  origin: AttendanceOrigin;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * How a day reads against its weekly schedule (from attendance settings):
 * a rest day, a holiday, an on-time or late working day, an absence, or a day
 * with no schedule resolved for the employee.
 */
export type AttendanceStatus =
  | 'no_schedule'
  | 'holiday'
  | 'rest_day'
  | 'upcoming'
  | 'absent'
  | 'late'
  | 'present';

/** Which layer of the org-default -> team -> employee hierarchy resolved the schedule. */
export type AssignmentSource = 'employee' | 'team' | 'organization-default' | 'none';

/** Schedule-derived grade for a single attendance day, layered onto the raw record. */
export interface AttendanceDayStatus {
  status: AttendanceStatus;
  schedule: { id: string; name: string; isDefault: boolean } | null;
  source: AssignmentSource;
  isWorkingDay: boolean | null;
  isRestDay: boolean | null;
  isHoliday: boolean;
  isFlexible: boolean;
  expectedSource: AttendanceSource | null;
  expectedHours: number;
  workedHours: number | null;
  /** Minutes past shift start + grace on a fixed shift; 0 when on time or flexible. */
  lateMinutes: number;
  shift: { id: string; name: string; startTime: string; endTime: string } | null;
}

/** Materialized daily attendance (first-in / last-out / billable hours) plus its schedule grade. */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  billableHours: number | null;
  status: AttendanceDayStatus;
  createdAt: string;
  updatedAt: string;
}

/** Computed view of a single day plus its schedule grade and underlying ordered timeline. */
export interface DailyAttendanceSummary {
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  billableHours: number | null;
  status: AttendanceDayStatus;
  events: AttendanceEvent[];
}

export interface AttendanceRealtimeUpdate {
  reasons: Array<'biometric' | 'manual' | 'auto-clock-out'>;
  affected?: AttendanceUpdateTarget[];
  timestamp: string;
}

export interface AttendanceUpdateTarget {
  employeeId: string;
  date: string;
}

export interface RecordAttendanceEventPayload {
  eventType: ManualEventType;
  timestamp?: string;
  latitude?: number;
  longitude?: number;
}

export interface AttendanceHistoryParams {
  page: number;
  limit: number;
  fromDate?: string;
  toDate?: string;
}

export type RecordEventResponse = ApiResponse<AttendanceEvent>;
export type DailySummaryResponse = ApiResponse<DailyAttendanceSummary>;
export type AttendanceHistoryResponse = PaginatedApiResponse<AttendanceRecord>;

/* ─── Org-wide roster (owners/admins) ───────────────────── */

/** One employee's computed attendance for a day on the org roster. */
export interface RosterEntry {
  employeeId: string;
  name: string | null;
  email: string;
  employeeCode: string | null;
  department: string | null;
  firstIn: string | null;
  lastOut: string | null;
  clockedHours: number | null;
  status: AttendanceDayStatus;
}

export interface RosterParams {
  page: number;
  limit: number;
  date?: string;
  search?: string;
}

/** Roster meta carries `viewerIsManager` so members can hide the employee search. */
export interface RosterMeta extends PaginationMeta {
  viewerIsManager: boolean;
}

export interface RosterResponse extends ApiResponse<RosterEntry[]> {
  meta: RosterMeta;
}

/* ─── Admin attendance board ─────────────────────────────── */

/** Coarse status buckets the board summarizes and filters by. */
export type BoardStatusFilter = 'present' | 'late' | 'absent' | 'upcoming' | 'off';

/** Headline counts for one attendance day, graded against each employee's schedule. */
export interface BoardSummary {
  date: string;
  /** Instant the board was computed (ISO). */
  asOf: string;
  isToday: boolean;
  scheduled: number;
  present: number;
  late: number;
  absent: number;
  upcoming: number;
  off: number;
  total: number;
  availableNow: number;
}

export type BoardSummaryResponse = ApiResponse<BoardSummary>;

/** One employee's row on the board for the viewed day. */
export interface BoardRosterEntry {
  employeeId: string;
  name: string | null;
  email: string;
  employeeCode: string | null;
  department: string | null;
  status: AttendanceDayStatus;
  firstIn: string | null;
  /** Clocked in right now (open session today). */
  available: boolean;
}

export interface BoardRosterParams {
  page: number;
  limit: number;
  date?: string;
  search?: string;
  status?: BoardStatusFilter;
}

export type BoardRosterResponse = PaginatedApiResponse<BoardRosterEntry>;

/** Scoreboard window. */
export type TardinessPeriod = 'daily' | 'weekly' | 'monthly';

/** One employee's lateness aggregate over the scoreboard window. */
export interface TardinessEntry {
  rank: number;
  employeeId: string;
  name: string | null;
  email: string;
  employeeCode: string | null;
  department: string | null;
  lateDays: number;
  totalLateMinutes: number;
  avgLateMinutes: number;
  workedDays: number;
}

export interface TardinessParams {
  page: number;
  limit: number;
  period: TardinessPeriod;
  date?: string;
  search?: string;
}

export interface TardinessMeta extends PaginationMeta {
  period: TardinessPeriod;
  from: string;
  to: string;
}

export interface TardinessResponse extends ApiResponse<TardinessEntry[]> {
  meta: TardinessMeta;
}
