import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-crm-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav aria-label="CRM sections">
      <a routerLink="/crm/leads" routerLinkActive="active" ariaCurrentWhenActive="page">Leads</a>
      <a routerLink="/crm/newsletter/subscribers" routerLinkActive="active" ariaCurrentWhenActive="page">Subscribers</a>
      <a routerLink="/crm/newsletter/campaigns" routerLinkActive="active" ariaCurrentWhenActive="page">Campaigns</a>
    </nav>
    <router-outlet />
  `,
  styleUrl: './crm-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmShell {}
