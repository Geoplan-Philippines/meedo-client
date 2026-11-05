import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';

import { RouterLink } from '@angular/router';

import { ArchivedTag } from '../../../../shared/ui/archived-tag/archived-tag';
import { ProjectAccessPanel } from './project-access-panel';
import { ClientTypeahead } from '../../shared/client-typeahead';
import { UNASSIGNED_CLIENT_ID, workspaceLinks } from '../../../clients/models/workspace.model';
import { ClientOption } from '../../customers/models/client.model';
import { ProjectAdminService } from '../services/project-admin.service';
import { ProjectDetail, ProjectHistoryEntry, ProjectRecord, UpdateProjectPayload } from '../models/project-admin.model';

/** Must match the server's DISPLAY_NAME_MAX_LENGTH. */
const DISPLAY_NAME_MAX_LENGTH = 200;

/** Select value for "no client" (p-select treats null as "nothing selected"). */
const NO_CLIENT = '__none__';

const FIELD_LABELS: Record<string, string> = {
  displayName: 'Name',
  clientId: 'Client',
  clientLocked: 'Client lock',
};

type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; project: ProjectDetail };

@Component({
  selector: 'app-project-detail-drawer',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe, ButtonModule, DrawerModule, InputTextModule, ClientTypeahead, ArchivedTag, ProjectAccessPanel],
  templateUrl: './project-detail-drawer.html',
  styleUrl: './project-detail-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailDrawer {
  private readonly projectAdmin = inject(ProjectAdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input<string | null>(null);
  readonly isAdmin = input(false);
  readonly closed = output<void>();
  readonly changed = output<ProjectRecord>();

  readonly maxNameLength = DISPLAY_NAME_MAX_LENGTH;
  readonly noClient = NO_CLIENT;

  readonly state = signal<DetailState>({ status: 'idle' });
  readonly project = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.project : null;
  });

  readonly isEditingName = signal(false);
  readonly isEditingClient = signal(false);
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly chosenClient = signal<ClientOption | null>(null);

  readonly nameForm = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DISPLAY_NAME_MAX_LENGTH)],
    }),
  });
  readonly clientForm = new FormGroup({
    clientId: new FormControl<string>(NO_CLIENT, { nonNullable: true }),
  });

  /** The project's tickets page under its client (or under "Unassigned"). */
  readonly ticketsLink = computed(() => {
    const project = this.project();
    return project ? workspaceLinks.projectTickets(project.clientId ?? UNASSIGNED_CLIENT_ID, project.id) : null;
  });

  /** What the name falls back to without an admin name: quote subject, else WO number. */
  readonly apptivoName = computed(() => {
    const project = this.project();
    return project ? project.quoteSubject?.trim() || project.workOrderNumber : '';
  });

  constructor() {
    toObservable(this.projectId)
      .pipe(
        switchMap((id) => {
          this.resetEditing();
          if (!id) return of<DetailState>({ status: 'idle' });
          return this.projectAdmin.detail(id).pipe(
            map((project): DetailState => ({ status: 'ready', project })),
            catchError(() => of<DetailState>({ status: 'error' })),
            startWith<DetailState>({ status: 'loading' }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.state.set(state));
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) this.closed.emit();
  }

  retry(): void {
    const id = this.projectId();
    if (!id) return;
    this.state.set({ status: 'loading' });
    this.projectAdmin
      .detail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => this.state.set({ status: 'ready', project }),
        error: () => this.state.set({ status: 'error' }),
      });
  }

  onAccessChanged(updated: ProjectRecord) {
    const previous = this.project();
    if (previous) this.state.set({ status: 'ready', project: { ...previous, ...updated } });
    this.changed.emit(updated);
  }

  startEditName(): void {
    const project = this.project();
    if (!project) return;
    this.nameForm.reset({ displayName: project.displayName ?? project.name });
    this.saveError.set(null);
    this.isEditingName.set(true);
  }

  saveName(): void {
    if (this.nameForm.invalid) {
      this.nameForm.markAllAsTouched();
      return;
    }
    const value = this.nameForm.controls.displayName.value.trim();
    // Saving the Apptivo name unchanged is the same as having no admin name.
    if (!value && !this.project()?.apptivoId) { this.saveError.set('A name is required for internal projects.'); return; }
    this.save({ displayName: this.project()?.apptivoId && value === this.apptivoName() ? null : value || null });
  }

  resetName(): void {
    this.save({ displayName: null });
  }

  startEditClient(): void {
    this.clientForm.reset({ clientId: this.project()?.clientId ?? NO_CLIENT });
    this.chosenClient.set(this.project()?.client ?? null);
    this.saveError.set(null);
    this.isEditingClient.set(true);
  }

  saveClient(): void {
    const value = this.clientForm.controls.clientId.value;
    this.save({ clientId: value === NO_CLIENT ? null : value });
  }

  selectClient(client: ClientOption | null): void {
    this.chosenClient.set(client);
    this.clientForm.controls.clientId.setValue(client?.id ?? NO_CLIENT);
  }

  cancelEdit(): void {
    this.resetEditing();
  }

  describeChange(entry: ProjectHistoryEntry): string {
    return Object.entries(entry.changes)
      .map(([field, change]) => {
        const label = FIELD_LABELS[field] ?? field;
        if (field === 'displayName') return change.to ? `${label} set to "${String(change.to)}"` : `${label} reset to Apptivo`;
        if (field === 'clientId') return change.to ? `${label} reassigned (${this.clientName(change.to)})` : `${label} removed`;
        if (field === 'clientLocked') return change.to ? 'Client locked against sync' : 'Client handed back to sync';
        return `${label} changed`;
      })
      .join('; ');
  }

  actorName(entry: ProjectHistoryEntry): string {
    return entry.actor?.user.name || entry.actor?.user.email || 'Unknown user';
  }

  formatMinutes(minutes: number): string {
    if (minutes % 1440 === 0) return `${minutes / 1440}d`;
    if (minutes % 60 === 0) return `${minutes / 60}h`;
    return minutes > 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  }

  private clientName(id: unknown): string {
    const chosen = this.chosenClient();
    if (chosen && chosen.id === id) return chosen.name;
    const current = this.project()?.client;
    return current && current.id === id ? current.name : 'another client';
  }

  private save(payload: UpdateProjectPayload): void {
    const project = this.project();
    if (!project || this.isSaving()) return;
    this.isSaving.set(true);
    this.saveError.set(null);

    this.projectAdmin
      .update(project.id, payload)
      .pipe(
        switchMap((updated) => {
          this.changed.emit(updated);
          // Reload so the change history includes this edit; the save already succeeded,
          // so a failed reload just shows the saved fields over the previous detail.
          return this.projectAdmin
            .detail(project.id)
            .pipe(catchError(() => of<ProjectDetail>({ ...project, ...updated })));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          this.isSaving.set(false);
          this.resetEditing();
          this.state.set({ status: 'ready', project: detail });
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          this.saveError.set(saveErrorMessage(error));
        },
      });
  }

  private resetEditing(): void {
    this.isEditingName.set(false);
    this.isEditingClient.set(false);
    this.saveError.set(null);
  }
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) return 'Only organization owners and admins can edit projects.';
    const message: unknown = (error.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Could not save the change. Please try again.';
}
