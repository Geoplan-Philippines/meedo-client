import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { AttendanceDayStatus } from '../models/attendance.model';
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_TONE,
  NO_SCHEDULE_ASSIGNED_HINT,
  formatLate,
} from './attendance-status.util';

/**
 * A compact chip for a day's schedule-derived status (on time / late / absent /
 * rest day / holiday / no schedule / present without a schedule). For a late day
 * it appends the lateness, e.g. "Late · 12 min late". Admins also get an info
 * hint when an employee timed in without an assigned schedule. Tone follows the
 * theme status tokens.
 */
@Component({
  selector: 'app-attendance-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      [class]="tone()"
    >
      {{ label() }}
      @if (detail(); as text) {
        <span class="opacity-80">· {{ text }}</span>
      }
      @if (adminHint(); as hint) {
        <i class="pi pi-info-circle text-[10px]" data-hint="no-schedule" [attr.title]="hint" aria-hidden="true"></i>
        <span class="sr-only">{{ hint }}</span>
      }
    </span>
  `,
})
export class AttendanceStatusBadge {
  private readonly authService = inject(AuthService);

  readonly status = input.required<AttendanceDayStatus>();
  /** Show the lateness detail alongside the label (off in dense table cells by default). */
  readonly showDetail = input(false);

  protected readonly label = computed(() => ATTENDANCE_STATUS_LABEL[this.status().status]);
  protected readonly tone = computed(() => ATTENDANCE_STATUS_TONE[this.status().status]);
  protected readonly detail = computed(() => {
    if (!this.showDetail()) return '';
    return this.status().status === 'late' ? formatLate(this.status().lateMinutes) : '';
  });
  protected readonly adminHint = computed(() =>
    this.status().status === 'present_unscheduled' && this.authService.isAdmin() ? NO_SCHEDULE_ASSIGNED_HINT : '',
  );
}
