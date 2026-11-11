import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';

import { WorkspaceService } from '../services/workspace.service';
import { workspaceLinks } from '../models/workspace.model';

/** Clients > Client > Project > Tickets. Every level links to its page. */
@Component({
  selector: 'app-workspace-breadcrumb',
  imports: [RouterLink],
  template: `
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <a routerLink="/clients" class="crumb-link" [attr.aria-current]="!clientId() ? 'page' : null">
            Clients
          </a>
        </li>
        @if (clientId(); as id) {
          <li>
            <a class="crumb-link" [routerLink]="links.clientProjects(id)" [title]="clientName()" [attr.aria-current]="!projectId() ? 'page' : null">{{ clientName() }}</a>
          </li>
        }
        @if (projectId(); as project) {
          @if (clientId(); as client) {
            <li><a class="crumb-link" [routerLink]="links.project(client, project)" [title]="projectTitle()" [attr.aria-current]="!tickets() ? 'page' : null">{{ projectName() }}</a></li>
            @if (tickets()) {
              <li><a class="crumb-link" [routerLink]="links.projectTickets(client, project)" aria-current="page">Tickets</a></li>
            }
          }
        }
      </ol>
    </nav>
  `,
  styles: `
    .crumbs ol {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .crumbs li {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
    }

    .crumbs li + li::before {
      content: '/';
      margin-right: 0.25rem;
      opacity: 0.6;
    }

    .crumb-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      color: var(--text-body);
    }

    .crumb-link:hover {
      color: var(--primary);
    }

    .crumb-link .pi {
      font-size: 0.75rem;
    }

    .crumb-text,
    .crumb-link {
      max-width: 20rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .crumb-current {
      color: var(--text-heading);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceBreadcrumb {
  readonly workspace = inject(WorkspaceService);
  readonly links = workspaceLinks;

  readonly clientId = input<string | null>(null);
  readonly projectId = input<string | null>(null);
  readonly tickets = input(false);

  private readonly client = toSignal(
    toObservable(this.clientId).pipe(switchMap((id) => (id ? this.workspace.client(id) : of(null)))),
    { initialValue: null },
  );
  private readonly project = toSignal(
    toObservable(this.projectId).pipe(switchMap((id) => (id ? this.workspace.project(id) : of(null)))),
    { initialValue: null },
  );

  readonly clientName = computed(() => this.client()?.name ?? '…');
  readonly projectName = computed(() => this.project()?.name ?? '…');
  readonly projectTitle = computed(() => {
    const project = this.project();
    return project ? `${project.name} · ${project.workOrderNumber}` : '';
  });
}
