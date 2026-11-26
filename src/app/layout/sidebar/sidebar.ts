import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Params, Router, RouterLink } from '@angular/router';
import { PrefetchLink } from '../../shared/ui/prefetch/prefetch-link';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { LayoutService } from '../layout.service';
import { AuthService } from '../../core/auth/auth.service';
import { MY_TICKETS_QUERY_PARAMS } from '../../modules/tickets/tickets.constants';

interface NavLink {
  label: string;
  route: string;
  icon: string;
  /** Set on the link; the item is lit only while the URL carries them. */
  queryParams?: Params;
  /** Extra URL prefixes that light this item. */
  activeFor?: string[];
}

/** A parent label with its links indented under it. Not a link itself. */
interface NavGroup {
  label: string;
  icon: string;
  children: NavLink[];
}

type NavItem = NavLink | NavGroup;

interface NavSection {
  /** Omitted for the "My tickets" block at the top. */
  title?: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [NgTemplateOutlet, RouterLink, PrefetchLink],
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

  // Tracks the active URL; updated on every successful navigation.
  // Used by activeLink() to drive longest-prefix-wins highlight logic.
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
      items: [
        { label: 'My tickets', route: '/tickets', queryParams: MY_TICKETS_QUERY_PARAMS, icon: 'pi-inbox' },
      ],
    },
    {
      title: 'Workspace',
      items: [
        // Clients > client > project > tickets. The API limits members to clients and projects they belong to.
        // The flat projects list (still linked from project notifications) sits under Clients too.
        { label: 'Clients', route: '/clients', icon: 'pi-building', activeFor: ['/settings/projects'] },
        ...(this.isAdmin()
          ? [{ label: 'Users', route: '/settings/users', icon: 'pi-users' }]
          : []),
        { label: 'Teams', route: '/settings/teams', icon: 'pi-sitemap' },
      ],
    },
    {
      title: 'Tickets',
      items: [
        { label: 'Ticket overview', route: '/tickets/dashboard', icon: 'pi-chart-bar' },
        { label: 'Tickets', route: '/tickets', icon: 'pi-list' },
      ],
    },
    {
      title: 'Timekeeping',
      items: [
        ...(this.isAdmin()
          ? [{ label: 'Time overview', route: '/timekeeping/dashboard', icon: 'pi-gauge' }]
          : []),
        { label: 'Attendance', route: '/timekeeping/attendance', icon: 'pi-clock' },
        { label: 'Timesheet', route: '/timekeeping/timesheet', icon: 'pi-calendar' },
        ...(this.isAdmin()
          ? [{ label: 'Approvals', route: '/timekeeping/timesheet/approval', icon: 'pi-check-circle' }]
          : []),
      ],
    },
    {
      title: 'Website',
      items: [
        { label: 'Leads', route: '/crm/leads', icon: 'pi-address-book' },
        {
          label: 'Newsletter',
          icon: 'pi-envelope',
          children: [
            { label: 'Subscribers', route: '/crm/newsletter/subscribers', icon: 'pi-at' },
            { label: 'Campaigns', route: '/crm/newsletter/campaigns', icon: 'pi-megaphone' },
          ],
        },
        { label: 'Developers', route: '/crm/developers', icon: 'pi-code' },
      ],
    },
  ]);

  private allLinks = computed(() =>
    this.sections().flatMap((s) => s.items.flatMap((i) => (isGroup(i) ? i.children : [i]))),
  );

  // Longest-prefix-wins active matching. On a tie, the link whose query params
  // the URL carries wins.
  // - On /tickets             → "Tickets" lit.
  // - On /tickets?assignee=me → "My tickets" lit (same path, its params match).
  // - On /tickets/dashboard   → "Ticket overview" lit (longer prefix beats "/tickets").
  // - On /tickets/:id         → "Tickets" lit (parent, no more-specific nav item).
  // - On /clients/...         → "Clients" lit (client list, client projects, project tickets).
  // - On /settings/projects   → "Clients" lit (flat projects list).
  readonly activeLink = computed(() => {
    const tree = this.router.parseUrl(this.currentUrl());
    const path = '/' + (tree.root.children['primary']?.segments.map((s) => s.path).join('/') ?? '');
    const prefixLength = (r: string) => (path === r || path.startsWith(r + '/') ? r.length : -1);
    let winner: NavLink | null = null;
    let best = -1;
    for (const link of this.allLinks()) {
      const params = Object.entries(link.queryParams ?? {});
      if (!params.every(([key, value]) => tree.queryParams[key] === value)) continue;
      const length = Math.max(...[link.route, ...(link.activeFor ?? [])].map(prefixLength));
      if (length < 0) continue;
      const score = length * 2 + (params.length ? 1 : 0);
      if (score > best) {
        winner = link;
        best = score;
      }
    }
    return winner;
  });

  isActive(link: NavLink): boolean {
    return this.activeLink() === link;
  }

  readonly isGroup = isGroup;
}

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item;
}
