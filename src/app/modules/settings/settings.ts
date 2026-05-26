import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

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
  imports: [RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  groups = signal<SettingsGroup[]>([
    {
      label: 'General',
      cards: [
        { label: 'Organization', description: 'Company info and branding', icon: 'pi-globe' },
        { label: 'Users', description: 'Members, roles and permissions', icon: 'pi-users' },
        { label: 'Teams', description: 'Manage your teams', route: 'teams', icon: 'pi-sitemap' },
      ],
    },
    {
      label: 'Workspace',
      cards: [
        { label: 'Projects', description: 'Active and archived projects', icon: 'pi-briefcase' },
        { label: 'Customers', description: 'Customer accounts and contacts', icon: 'pi-building' },
      ],
    },
    {
      label: 'Tickets',
      cards: [
        { label: 'Categories', description: 'Ticket categories and tags', route: 'categories', icon: 'pi-tags' },
      ],
    },
  ]);
}
