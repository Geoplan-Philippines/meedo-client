import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/auth/auth.service';
import { ArchivedTag } from '../../../shared/ui/archived-tag/archived-tag';
import { ProjectsService } from '../../tickets/services/projects.service';
import { WorkspaceService } from '../../clients/services/workspace.service';
import { WorkspaceBreadcrumb } from '../../clients/workspace-breadcrumb/workspace-breadcrumb';
import { ClientsService } from './services/clients.service';
import { ClientListParams, ClientRecord, ClientSortField } from './models/client.model';
import { NewInternalRecord } from '../shared/new-internal-record';

/** Must match the server's DISPLAY_NAME_MAX_LENGTH. */
const DISPLAY_NAME_MAX_LENGTH = 200;
const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 250;

const SORTABLE: Record<string, ClientSortField> = {
  name: 'customerName',
  projectCount: 'projectCount',
};

@Component({
  selector: 'app-settings-customers',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    ToggleSwitchModule,
    TooltipModule,
    ArchivedTag,
    WorkspaceBreadcrumb,
    NewInternalRecord,
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
  readonly pageSize = PAGE_SIZE;
  readonly maxNameLength = DISPLAY_NAME_MAX_LENGTH;

  readonly clients = signal<ClientRecord[]>([]);
  readonly total = signal(0);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly first = signal(0);

  readonly editingId = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly archivedControl = new FormControl(false, { nonNullable: true });
  readonly editForm = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DISPLAY_NAME_MAX_LENGTH)],
    }),
  });

  private params: ClientListParams = { page: 1, limit: PAGE_SIZE, sortField: 'customerName', sortOrder: 'asc' };
  /** Every list request goes through here; switchMap drops responses a newer request replaced. */
  private readonly request$ = new Subject<ClientListParams>();

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.applyParams({ search, page: 1 }));

    this.archivedControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((includeArchived) => this.applyParams({ includeArchived, page: 1 }));

    this.request$
      .pipe(
        tap(() => {
          this.isLoading.set(true);
          this.error.set(null);
        }),
        switchMap((params) =>
          this.clientsService.list(params).pipe(
            map((response) => ({ response, failed: false as const })),
            catchError(() => of({ response: null, failed: true as const })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ response }) => {
        this.isLoading.set(false);
        if (!response) {
          this.error.set('Failed to load customers. Please try again.');
          return;
        }
        this.clients.set(response.data);
        this.total.set(response.meta.total);
        this.first.set((response.meta.page - 1) * response.meta.limit);
      });
  }

  /** PrimeNG lazy table: page and sort changes. */
  onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? PAGE_SIZE;
    const sortKey = typeof event.sortField === 'string' ? event.sortField : 'name';
    this.applyParams({
      page: Math.floor((event.first ?? 0) / rows) + 1,
      limit: rows,
      sortField: SORTABLE[sortKey] ?? 'customerName',
      sortOrder: event.sortOrder === -1 ? 'desc' : 'asc',
    });
  }

  reload(): void {
    this.request$.next(this.params);
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
          this.clients.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
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

  private applyParams(patch: Partial<ClientListParams>): void {
    this.params = { ...this.params, ...patch };
    if (patch.page === 1) this.first.set(0);
    this.request$.next(this.params);
  }
}
