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
      title: 'Maintenance',
      items: [
        { label: 'Users', route: '/users', icon: 'pi-users' },
        { label: 'Departments', route: '/departments', icon: 'pi-sitemap' },
        { label: 'Projects', route: '/projects', icon: 'pi-briefcase' },
        { label: 'Customers', route: '/customers', icon: 'pi-building' },
      ],
    },
  ]);
}
