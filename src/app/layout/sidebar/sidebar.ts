import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../layout.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  layoutService = inject(LayoutService);

  navSections = signal<NavSection[]>([
    {
      title: 'Tickets',
      items: [
        { label: 'Dashboard', route: '/dashboard', icon: 'pi-chart-line' },
        { label: 'Tickets', route: '/tickets', icon: 'pi-list' },
      ],
    },
    {
      title: 'Timekeeping',
      items: [
        { label: 'Dashboard', route: '/timekeeping/dashboard', icon: 'pi-chart-line' },
        { label: 'Attendance', route: '/timekeeping/attendance', icon: 'pi-clock' },
        { label: 'Timesheet', route: '/timekeeping/timesheet', icon: 'pi-calendar' },
      ],
    },
    {
      title: 'CRM',
      items: [
        { label: 'Leads', route: '/crm/leads', icon: 'pi-address-book' },
        { label: 'Newsletter', route: '/crm/newsletter', icon: 'pi-envelope' },
      ],
    }, 
    {
      title: 'Maintenance',
      items: [
        { label: 'Categories', route: '/maintenance/categories', icon: 'pi-tags' },
        { label: 'Users', route: '/users', icon: 'pi-users' },
        { label: 'Departments', route: '/departments', icon: 'pi-sitemap' },
        { label: 'Projects', route: '/projects', icon: 'pi-briefcase' },
        { label: 'Customers', route: '/customers', icon: 'pi-building' },
      ],
    },
  ]);
}
