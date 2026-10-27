import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { isOrganizationAdmin } from '../../core/auth/org-admin.guard';

interface SettingsCard {
  label: string;
  description: string;
  route?: string;
  icon: string;
  adminOnly?: boolean;
}

interface SettingsGroup {
  label: string;
  cards: SettingsCard[];
}

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManageUsers = signal(false);

  readonly groups = signal<SettingsGroup[]>([
    {
      label: 'General',
      cards: [
        { label: 'Organization', description: 'Company info and branding', icon: 'pi-globe' },
        {
          label: 'Users',
          description: 'Members, roles and permissions',
          icon: 'pi-users',
          route: 'users',
          adminOnly: true,
        },
        { label: 'Teams', description: 'Manage your teams', route: 'teams', icon: 'pi-sitemap' },
      ],
    },
    {
      label: 'Timekeeping',
      cards: [
        {
          label: 'Attendance',
          description: 'Shifts, schedules, holidays and policy',
          route: 'attendance',
          icon: 'pi-clock',
        },
      ],
    },
    {
      label: 'Workspace',
      cards: [
        { label: 'Projects', description: 'Active and archived projects', route: 'projects', icon: 'pi-briefcase' },
        { label: 'Customers', description: 'Customer accounts and project counts', route: 'customers', icon: 'pi-building' },
      ],
    },
    {
      label: 'Tickets',
      cards: [
        { label: 'Categories', description: 'Ticket categories and tags', route: 'categories', icon: 'pi-tags' },
        { label: 'Statuses', description: 'Lifecycle statuses for tickets', route: 'statuses', icon: 'pi-flag' },
      ],
    },
  ]);

  ngOnInit(): void {
    const organizationId = this.authService.organizationId();
    if (!organizationId) return;

    this.authService
      .getActiveMemberRole(organizationId)
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((role) => this.canManageUsers.set(isOrganizationAdmin(role)));
  }
}
