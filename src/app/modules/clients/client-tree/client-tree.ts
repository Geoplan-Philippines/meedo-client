import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { WorkspaceService } from '../services/workspace.service';
import { workspaceLinks } from '../models/workspace.model';

/** A single top-level user item with a short list of client links. */
@Component({
  selector: 'app-client-tree',
  imports: [RouterLink],
  templateUrl: './client-tree.html',
  styleUrl: './client-tree.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientTree implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly workspace = inject(WorkspaceService);
  readonly collapsed = input(false);
  readonly navigated = output<void>();
  readonly expandSidebar = output<void>();
  readonly links = workspaceLinks;
  readonly isAdmin = this.authService.isAdmin;
  readonly userName = computed(() => this.authService.currentUser()?.name || this.authService.currentUser()?.email || 'Signed in');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly activeClientId = computed(() => /^\/clients\/([^/?#]+)/.exec(this.url())?.[1] ?? null);
  readonly isActive = computed(() => /^\/clients(?:[/?#]|$)/.test(this.url()));
  readonly isAllClients = computed(() => /^\/clients\/?(?:[?#]|$)/.test(this.url()));

  constructor() {
    // Bookmarks and browser navigation reveal the active client, while the user can still collapse it.
    effect(() => {
      if (this.isActive()) untracked(() => this.workspace.clientsOpen.set(true));
    });
  }

  ngOnInit(): void {
    this.workspace.ensureClients();
  }

  newProject(): void {
    if (!this.isAdmin()) return;
    void this.router.navigate(['/settings/projects'], { queryParams: { create: Date.now() } });
    this.navigated.emit();
  }

  toggle(): void {
    if (this.collapsed()) {
      this.workspace.clientsOpen.set(true);
      this.expandSidebar.emit();
    } else {
      this.workspace.clientsOpen.update((open) => !open);
    }
  }
}
