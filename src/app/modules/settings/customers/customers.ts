import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AuthService } from '../../../core/auth/auth.service';
import { ArchivedTag } from '../../../shared/ui/archived-tag/archived-tag';
import { ProjectsService } from '../../tickets/services/projects.service';
import { WorkspaceService } from '../../clients/services/workspace.service';
import { WorkspaceBreadcrumb } from '../../clients/workspace-breadcrumb/workspace-breadcrumb';
import { CLIENTS_LIST, ClientsService } from './services/clients.service';
import { ClientRecord } from './models/client.model';
import { injectListState } from '../../../shared/data/url-list-state';
import { pagedList } from '../../../shared/data/paged-list';
import { PrefetchLink } from '../../../shared/ui/prefetch/prefetch-link';
import { NewInternalRecord } from '../shared/new-internal-record';

import { MessageModule } from 'primeng/message';
/** Must match the server's DISPLAY_NAME_MAX_LENGTH. */
const DISPLAY_NAME_MAX_LENGTH = 200;

@Component({
  selector: 'app-settings-customers',
  imports: [
    MessageModule,
    PageLayout,
    ListPaginator,
    EmptyState,
    IconFieldModule,
    InputIconModule,
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    ToggleSwitchModule,
    TooltipModule,
    ArchivedTag,
    WorkspaceBreadcrumb,
    NewInternalRecord,
    PrefetchLink,
  ],
  templateUrl: './customers.html',
  styleUrl: './customers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Customers {
  private readonly clientsService = inject(ClientsService);
  private readonly ticketProjects = inject(ProjectsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isAdmin = this.authService.isAdmin;
  readonly creating = signal(false);
  onCreated() { this.creating.set(false); this.workspace.invalidate(); this.reload(); }
  readonly maxNameLength = DISPLAY_NAME_MAX_LENGTH;

  /** Page, sort, search and "Show archived" live in the URL; the API applies them. */
  readonly list = injectListState(CLIENTS_LIST);
  readonly clients = pagedList({
    params: () => this.list.query(),
    load: (query) => this.clientsService.list(query),
    refreshOn: ['clients', 'projects'],
  });

  readonly editingId = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly editForm = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DISPLAY_NAME_MAX_LENGTH)],
    }),
  });

  constructor() {
    this.list.clampToTotal(this.clients);
  }

  onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  setIncludeArchived(value: boolean): void {
    this.list.setFilter('includeArchived', value);
  }

  reload(): void {
    this.clients.reload();
  }

  startEdit(client: ClientRecord): void {
    this.editForm.reset({ displayName: client.displayName ?? client.customerName ?? client.name });
    this.saveError.set(null);
    this.editingId.set(client.id);
  }

  cancelEdit(): void {
    if (this.isSaving()) return;
    this.editingId.set(null);
    this.saveError.set(null);
  }

  saveEdit(client: ClientRecord): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const value = this.editForm.controls.displayName.value.trim();
    if (!value && !client.apptivoId) { this.saveError.set('A name is required for internal clients.'); return; }
    // Saving the Apptivo name unchanged is the same as having no admin name.
    this.save(client, value && value !== client.customerName ? value : null);
  }

  resetName(client: ClientRecord): void {
    this.save(client, null);
  }

  private save(client: ClientRecord, displayName: string | null): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.saveError.set(null);

    this.clientsService
      .updateDisplayName(client.id, displayName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.clients.updateRows((rows) => rows.map((c) => (c.id === updated.id ? updated : c)));
          this.isSaving.set(false);
          this.editingId.set(null);
          // Ticket pickers show client names, so refresh them on next open.
          this.ticketProjects.invalidate();
          this.workspace.invalidate();
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.saveError.set(
            err instanceof HttpErrorResponse && err.status === 403
              ? 'Only organization owners and admins can rename customers.'
              : 'Could not save the name. Please try again.',
          );
        },
      });
  }
}
