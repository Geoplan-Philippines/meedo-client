import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PageLayout } from '../../shared/ui/page-layout/page-layout';
import { catchError, EMPTY } from 'rxjs';

import { ApptivoSyncPanel } from './shared/apptivo-sync-panel';
import { AuthService } from '../../core/auth/auth.service';
import { isOrganizationAdmin } from '../../core/auth/org-admin.guard';

interface SettingsCard {
  label: string;
  description: string;
  route?: string;
  icon: string;
}

interface SettingsGroup {
  label: string;
  cards: SettingsCard[];
}

@Component({
  selector: 'app-settings',
  imports: [RouterLink, ApptivoSyncPanel, PageLayout],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManageUsers = signal(false);

  // Clients, Users and Teams live in the sidebar's Workspace section, not here.
  readonly groups = signal<SettingsGroup[]>([
    {
      label: 'General',
      cards: [
        { label: 'Organization', description: 'Company info and branding', icon: 'pi-globe' },
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
