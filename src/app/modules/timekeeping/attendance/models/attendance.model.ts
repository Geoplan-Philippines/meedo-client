import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';

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
  createdAt: string;
  updatedAt: string;
}

/** Materialized daily attendance (first-in / last-out / billable hours). */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  billableHours: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Computed view of a single day plus its underlying ordered timeline. */
export interface DailyAttendanceSummary {
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  billableHours: number | null;
  events: AttendanceEvent[];
}

export interface RecordAttendanceEventPayload {
  eventType: ManualEventType;
  timestamp?: string;
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
}

export interface RosterParams {
  page: number;
  limit: number;
  date?: string;
  search?: string;
}

export type RosterResponse = PaginatedApiResponse<RosterEntry>;
