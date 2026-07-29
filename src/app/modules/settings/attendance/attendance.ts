import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface AttendanceArea {
  label: string;
  description: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-settings-attendance',
  imports: [RouterLink],
  templateUrl: './attendance.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Attendance {
  readonly areas: AttendanceArea[] = [
    {
      label: 'Shifts',
      description: 'Working hours, breaks, and grace: the building blocks of a schedule.',
      route: 'shifts',
      icon: 'pi-clock',
    },
    {
      label: 'Weekly schedules',
      description: 'Assign a shift to each weekday and mark rest days.',
      route: 'schedules',
      icon: 'pi-calendar',
    },
    {
      label: 'Holidays',
      description: 'The company holiday calendar, per year and country.',
      route: 'holidays',
      icon: 'pi-flag',
    },
    {
      label: 'Policy',
      description: 'Overtime, night differential, lunch, and rounding rules.',
      route: 'policy',
      icon: 'pi-sliders-h',
    },
    {
      label: 'Assignments',
      description: 'Which schedule applies to each team and employee.',
      route: 'assignments',
      icon: 'pi-users',
    },
  ];
}
