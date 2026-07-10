import { AttendanceSource, DayOfWeek, HolidayType } from '../models/attendance.model';

/** Wall-clock "HH:mm" in 24-hour form, 00:00–23:59. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_SHIFT_COLOR = '#6B7280';

/** Minutes since local midnight for a valid "HH:mm" string. */
export function hhmmToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Worked minutes a shift represents: end minus start minus the unpaid break,
 * rolling the end past midnight for overnight shifts (or when end < start).
 * Mirrors `shiftWorkedMinutes` on the server so the UI shows the same number.
 */
export function shiftWorkedMinutes(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  crossesMidnight: boolean,
): number {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return 0;
  let span = hhmmToMinutes(endTime) - hhmmToMinutes(startTime);
  if (crossesMidnight || span < 0) span += 24 * 60;
  return Math.max(0, span - Math.max(0, breakMinutes));
}

/** Worked hours for a shift, rounded to 2 decimals. */
export function shiftWorkedHours(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  crossesMidnight: boolean,
): number {
  const minutes = shiftWorkedMinutes(startTime, endTime, breakMinutes, crossesMidnight);
  return Math.round((minutes / 60) * 100) / 100;
}

/** "8.5" not "8.50", "8" not "8.0" — compact hours for display. */
export function formatHours(hours: number): string {
  return Number(hours.toFixed(2)).toString();
}

/** "08:00" → "8:00 AM". Leaves malformed input untouched. */
export function formatTime12h(hhmm: string): string {
  if (!TIME_PATTERN.test(hhmm)) return hhmm;
  const [hours, minutes] = hhmm.split(':').map(Number);
  const period = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/** Weekdays in calendar order, Monday-first (how a week reads on screen). */
export const WEEK_ORDER: readonly DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const DAY_LABELS: Record<DayOfWeek, { full: string; short: string }> = {
  MONDAY: { full: 'Monday', short: 'Mon' },
  TUESDAY: { full: 'Tuesday', short: 'Tue' },
  WEDNESDAY: { full: 'Wednesday', short: 'Wed' },
  THURSDAY: { full: 'Thursday', short: 'Thu' },
  FRIDAY: { full: 'Friday', short: 'Fri' },
  SATURDAY: { full: 'Saturday', short: 'Sat' },
  SUNDAY: { full: 'Sunday', short: 'Sun' },
};

export function dayLabel(day: DayOfWeek): string {
  return DAY_LABELS[day].full;
}

export function dayLabelShort(day: DayOfWeek): string {
  return DAY_LABELS[day].short;
}

export const ATTENDANCE_SOURCE_OPTIONS: { label: string; value: AttendanceSource }[] = [
  { label: 'Office', value: 'OFFICE' },
  { label: 'Field', value: 'FIELD' },
  { label: 'Work from home', value: 'WFH' },
];

export function attendanceSourceLabel(source: AttendanceSource | null): string {
  if (!source) return 'Any';
  return ATTENDANCE_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source;
}

/**
 * The server stores a holiday at UTC midnight of its calendar day. Read only the
 * date part and rebuild it in local time so the day never shifts by timezone.
 */
export function isoDateOnlyToLocal(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** Local `Date` → "YYYY-MM-DD" (no toISOString, which would apply the TZ offset). */
export function dateToYmd(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const HOLIDAY_TYPE_OPTIONS: { label: string; value: HolidayType }[] = [
  { label: 'Regular', value: 'REGULAR' },
  { label: 'Special non-working', value: 'SPECIAL_NON_WORKING' },
  { label: 'Special working', value: 'SPECIAL_WORKING' },
];

export function holidayTypeLabel(type: HolidayType): string {
  return HOLIDAY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}
