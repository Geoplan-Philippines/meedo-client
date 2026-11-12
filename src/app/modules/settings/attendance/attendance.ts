import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageLayout } from '../../../shared/ui/page-layout/page-layout';

interface AttendanceArea {
  label: string;
  description: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-settings-attendance',
  imports: [RouterLink, PageLayout],
  styles: `
    .area-list > li { padding: 0; }
    .area-link {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      min-height: 3.5rem;
      padding: 0.5rem var(--page-gutter);
      color: var(--text-body);
      text-decoration: none;
    }
    .area-link:focus-visible { outline: var(--focus-ring-width) solid var(--ring); outline-offset: -2px; }
    .area-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 2rem;
      height: 2rem;
      border-radius: var(--radius);
      background: var(--subtle);
      color: var(--text-muted);
    }
    .area-text { display: flex; flex-direction: column; gap: 0.125rem; flex: 1; min-width: 0; }
    .area-label { font-size: 0.875rem; font-weight: 500; color: var(--text-heading); }
    .area-desc { font-size: 0.8125rem; color: var(--text-muted); }
    .area-chevron { font-size: 0.75rem; color: var(--text-faint); }
  `,
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
