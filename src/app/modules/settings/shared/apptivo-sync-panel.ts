import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment.dev';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { SyncCounts } from '../projects/models/project-admin.model';
import { WorkspaceService } from '../../clients/services/workspace.service';
import { ProjectsService } from '../../tickets/services/projects.service';

@Component({
  selector: 'app-apptivo-sync-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="apptivo-sync-heading">
      <h2 id="apptivo-sync-heading">Apptivo import</h2>
      <p>Add new records and refresh Apptivo reference fields. Meedo names, client links, members and project states stay unchanged. Missing records are marked for information.</p>
      <div class="actions">
        <button type="button" (click)="sync('projects')" [disabled]="busy()">Sync projects from Apptivo</button>
        <button type="button" (click)="sync('clients')" [disabled]="busy()">Sync clients from Apptivo</button>
      </div>
      @if (busy()) { <p role="status">Importing from Apptivo…</p> }
      @if (message()) { <p role="status">{{ message() }}</p> }
      @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
    </section>
  `,
  styles: `
    :host { display: block; margin-top: 2rem; }
    section { border: 1px solid var(--border); border-radius: 4px; padding: 1.5rem; background: var(--surface); color: var(--text-body); }
    h2 { color: var(--text-heading); font-weight: 600; font-size: 1.125rem; }
    p { margin-top: .75rem; max-width: 65rem; }
    .actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1rem; }
    button { padding: .625rem 1rem; border: 1px solid var(--border-strong); border-radius: 4px; background: var(--secondary); color: var(--secondary-foreground); cursor: pointer; }
    button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
    button:disabled { opacity: .6; cursor: wait; }
    .error { color: var(--muted-destructive-foreground); }
  `,
})
export class ApptivoSyncPanel {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspace = inject(WorkspaceService);
  private readonly projects = inject(ProjectsService);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  sync(kind: 'projects' | 'clients'): void {
    if (this.busy() || !window.confirm(`Import ${kind} from Apptivo? This adds new records and refreshes reference fields only.`)) return;
    this.busy.set(true);
    this.message.set('');
    this.error.set('');
    this.http.post<ApiResponse<SyncCounts & { clients?: SyncCounts; unmatched?: number }>>(`${environment.apiBaseUrl}/maintenance/${kind}/sync`, {}, { withCredentials: true })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ data }) => {
          this.busy.set(false);
          const summary = (counts: SyncCounts) => `${counts.created} added, ${counts.updated} references refreshed, ${counts.missing ?? 0} marked missing`;
          this.message.set(`Import complete: ${summary(data)}.${data.clients ? ` Clients: ${summary(data.clients)}.` : ''}${data.unmatched ? ` ${data.unmatched} work orders have no matching customer.` : ''}`);
          this.workspace.invalidate();
          this.projects.invalidate();
        },
        error: () => { this.busy.set(false); this.error.set('The Apptivo import failed. No changes were saved. Please try again.'); },
      });
  }
}
