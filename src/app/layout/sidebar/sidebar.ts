import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { LayoutService } from '../layout.service';
import { AuthService } from '../../core/auth/auth.service';
import { ClientTree } from '../../modules/clients/client-tree/client-tree';

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
  imports: [CommonModule, RouterLink, ClientTree],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sidebar-host',
    '[class.sidebar-collapsed]': 'layoutService.sidebarCollapsed()',
  },
})
export class Sidebar {
  layoutService = inject(LayoutService);
  private router = inject(Router);
  private authService = inject(AuthService);
  readonly desktop = toSignal(
    inject(BreakpointObserver).observe('(min-width: 768px)').pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  // Tracks the active URL; updated on every successful navigation.
  // Used by isActive() to drive longest-prefix-wins highlight logic.
  currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly isAdmin = this.authService.isAdmin;

  sections = computed<NavSection[]>(() => [
    {
      title: 'Tickets',
      items: [
        { label: 'Dashboard', route: '/tickets/dashboard', icon: 'pi-chart-line' },
        { label: 'Tickets', route: '/tickets', icon: 'pi-list' },
      ],
    },
    {
      title: 'Timekeeping',
      items: [
        ...(this.isAdmin()
          ? [{ label: 'Dashboard', route: '/timekeeping/dashboard', icon: 'pi-chart-line' }]
          : []),
        { label: 'Attendance', route: '/timekeeping/attendance', icon: 'pi-clock' },
        { label: 'Timesheet', route: '/timekeeping/timesheet', icon: 'pi-calendar' },
        ...(this.isAdmin()
          ? [{ label: 'Approvals', route: '/timekeeping/timesheet/approval', icon: 'pi-check-circle' }]
          : []),
      ],
    },
    {
      title: 'CRM',
      items: [
        { label: 'Leads', route: '/crm/leads', icon: 'pi-address-book' },
        { label: 'Newsletter', route: '/crm/newsletter', icon: 'pi-envelope' },
      ],
    },
  ]);

  private allRoutes = computed(() =>
    this.sections().flatMap((s) => s.items.map((i) => i.route)),
  );

  // Longest-prefix-wins active matching.
  // - On /tickets         → "Tickets" lit (only match).
  // - On /tickets/dashboard → "Dashboard" lit (longer prefix beats "/tickets").
  // - On /tickets/:id     → "Tickets" lit (parent — no more-specific nav item).
  isActive(route: string): boolean {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    const matches = (r: string) => url === r || url.startsWith(r + '/');
    if (!matches(route)) return false;
    const winner = this.allRoutes()
      .filter(matches)
      .reduce((a, b) => (a.length >= b.length ? a : b));
    return winner === route;
  }
}
