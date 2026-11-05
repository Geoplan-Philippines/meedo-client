import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import { AttendanceDayStatus, AttendanceStatus } from '../models/attendance.model';
import { AttendanceStatusBadge } from './attendance-status-badge';
import { NO_SCHEDULE_ASSIGNED_HINT } from './attendance-status.util';

function dayStatus(status: AttendanceStatus): AttendanceDayStatus {
  return {
    status,
    schedule: null,
    source: 'none',
    isWorkingDay: null,
    isRestDay: null,
    isHoliday: false,
    isFlexible: false,
    expectedSource: null,
    expectedHours: 0,
    workedHours: 2,
    lateMinutes: 0,
    shift: null,
  } as AttendanceDayStatus;
}

describe('AttendanceStatusBadge', () => {
  const isAdmin = signal(false);
  let fixture: ComponentFixture<AttendanceStatusBadge>;

  function render(status: AttendanceStatus): HTMLElement {
    fixture.componentRef.setInput('status', dayStatus(status));
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('span')!;
  }

  beforeEach(() => {
    isAdmin.set(false);
    TestBed.configureTestingModule({
      imports: [AttendanceStatusBadge],
      providers: [{ provide: AuthService, useValue: { isAdmin } }],
    });
    fixture = TestBed.createComponent(AttendanceStatusBadge);
  });

  it('labels an unscheduled time-in as Present (no schedule) with the success tone', () => {
    const chip = render('present_unscheduled');
    expect(chip.textContent).toContain('Present (no schedule)');
    expect(chip.className).toContain('bg-muted-success');
    expect(chip.className).toContain('text-muted-success-foreground');
  });

  it('shows the no-schedule hint to admins only', () => {
    expect(render('present_unscheduled').querySelector('[data-hint="no-schedule"]')).toBeNull();

    isAdmin.set(true);
    const chip = render('present_unscheduled');
    expect(chip.querySelector('[data-hint="no-schedule"]')?.getAttribute('title')).toBe(NO_SCHEDULE_ASSIGNED_HINT);
    expect(chip.querySelector('.sr-only')?.textContent).toContain(NO_SCHEDULE_ASSIGNED_HINT);
  });

  it('does not show the hint on other statuses, even for admins', () => {
    isAdmin.set(true);
    expect(render('no_schedule').querySelector('[data-hint="no-schedule"]')).toBeNull();
    expect(render('present').querySelector('[data-hint="no-schedule"]')).toBeNull();
  });

  it('renders no_schedule and rest days with the neutral badge token', () => {
    for (const status of ['no_schedule', 'rest_day'] as const) {
      const chip = render(status);
      expect(chip.className).toContain('bg-badge-neutral');
      expect(chip.className).toContain('text-badge-neutral-foreground');
      expect(chip.className).not.toMatch(/\bbg-muted\b(?!-)|text-body\//);
    }
  });
});
