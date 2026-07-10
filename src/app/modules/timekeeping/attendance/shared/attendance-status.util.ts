import { AttendanceDayStatus, AttendanceStatus } from '../models/attendance.model';

/** Human label for each schedule-derived day status. */
export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'On time',
  late: 'Late',
  absent: 'Absent',
  upcoming: 'Not due yet',
  rest_day: 'Rest day',
  holiday: 'Holiday',
  no_schedule: 'No schedule',
};

/**
 * Chip tone (theme tokens) per status. Working-day outcomes use success/warning/
 * destructive; rest days and unscheduled days stay neutral; holidays use the
 * secondary accent.
 */
export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, string> = {
  present: 'bg-muted-success text-muted-success-foreground',
  late: 'bg-muted-warning text-muted-warning-foreground',
  absent: 'bg-muted-destructive text-muted-destructive-foreground',
  upcoming: 'bg-secondary text-secondary-foreground',
  rest_day: 'bg-muted text-body/70',
  holiday: 'bg-secondary text-secondary-foreground',
  no_schedule: 'bg-muted text-body/60',
};

/** "1 hr" / "7.5 hrs" for an hours value, or a dash when unknown. */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded} ${rounded === 1 ? 'hr' : 'hrs'}`;
}

/** "12 min late" / "1 hr 5 min late" from a lateness in minutes; empty when on time. */
export function formatLate(minutes: number): string {
  if (minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hr`);
  if (mins > 0 || hours === 0) parts.push(`${mins} min`);
  return `${parts.join(' ')} late`;
}

/** Expected work mode label (OFFICE/FIELD/WFH), or "Any" when the day sets none. */
export function expectedSourceLabel(status: AttendanceDayStatus): string {
  switch (status.expectedSource) {
    case 'OFFICE':
      return 'Office';
    case 'FIELD':
      return 'Field';
    case 'WFH':
      return 'WFH';
    default:
      return 'Any';
  }
}
