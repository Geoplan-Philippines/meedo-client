import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, debounceTime, map, of, startWith, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/auth/auth.service';
import { ArchivedTag } from '../../../shared/ui/archived-tag/archived-tag';
import { ProjectAdminService } from './services/project-admin.service';
import {
  ProjectListFilters,
  ProjectRecord,
  ProjectSortField,
} from './models/project-admin.model';
import { ProjectDetailDrawer } from './project-detail-drawer/project-detail-drawer';
import { WorkspaceService } from '../../clients/services/workspace.service';
import { WorkspaceBreadcrumb } from '../../clients/workspace-breadcrumb/workspace-breadcrumb';
import { UNASSIGNED_CLIENT_ID, workspaceLinks } from '../../clients/models/workspace.model';
import { NewInternalRecord } from '../shared/new-internal-record';
import { ClientTypeahead } from '../shared/client-typeahead';

/** Group of projects under one client; `clientId` null is the "Unassigned" group. */
interface ProjectGroup {
  clientId: string | null;
  name: string;
  isArchived: boolean;
  projects: ProjectRecord[];
}

type LoadState = 'loading' | 'ready' | 'error';

const SEARCH_DEBOUNCE_MS = 250;

const SORT_OPTIONS: { label: string; field: ProjectSortField; order: 'asc' | 'desc' }[] = [
  { label: 'Newest reported', field: 'reportedDate', order: 'desc' },
  { label: 'Oldest reported', field: 'reportedDate', order: 'asc' },
  { label: 'WO number', field: 'workOrderNumber', order: 'desc' },
  { label: 'Quote subject', field: 'quoteSubject', order: 'asc' },
  { label: 'Highest total', field: 'total', order: 'desc' },
];

@Component({
  selector: 'app-settings-projects',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
    TooltipModule,
    ArchivedTag,
    ProjectDetailDrawer,
    WorkspaceBreadcrumb,
    RouterLink,
    NewInternalRecord,
    ClientTypeahead,
  ],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Projects implements OnInit {
  private readonly projectAdmin = inject(ProjectAdminService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspace = inject(WorkspaceService);

  readonly isAdmin = this.authService.isAdmin;
  readonly creating = signal(false);
  readonly sortOptions = SORT_OPTIONS.map((option, index) => ({ label: option.label, value: index }));

  readonly projects = signal<ProjectRecord[]>([]);
  readonly loadState = signal<LoadState>('loading');
  readonly statusOptions = signal<string[]>([]);
  readonly selectedProjectId = signal<string | null>(null);
  /** Manage button that opened the drawer, so focus can return to it on close. */
  private manageTrigger: HTMLElement | null = null;

  readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    clientId: new FormControl<string | null>(null),
    status: new FormControl<string | null>(null),
    includeArchived: new FormControl(false, { nonNullable: true }),
    includeClosed: new FormControl(true, { nonNullable: true }),
    sort: new FormControl(0, { nonNullable: true }),
  });

  private readonly filterValue = toSignal(
    this.filters.valueChanges.pipe(map(() => this.filters.getRawValue())),
    { initialValue: this.filters.getRawValue() },
  );

  /** Client fixed by the URL; 'unassigned' = projects with no client. */
  readonly routeClientId = toSignal(this.route.paramMap.pipe(map((params) => params.get('clientId'))), {
    initialValue: this.route.snapshot.paramMap.get('clientId'),
  });
  readonly routeClientName = toSignal(
    toObservable(this.routeClientId).pipe(switchMap((id) => (id ? this.workspace.client(id) : of(null)))),
    { initialValue: null },
  );
  readonly routeProjectId = toSignal(this.route.paramMap.pipe(map((params) => params.get('projectId'))), {
    initialValue: this.route.snapshot.paramMap.get('projectId'),
  });
  readonly subtitle = computed(() => this.routeClientId() ? 'Projects for this client.' : 'Internal projects and Apptivo work orders, grouped by customer.');

  constructor() {
    // The Project breadcrumb opens the existing detail drawer at a shareable URL.
    effect(() => this.selectedProjectId.set(this.routeProjectId()));
  }

  readonly groups = computed<ProjectGroup[]>(() => groupByClient(this.projects()));
  readonly clientCount = computed(() => this.groups().filter((group) => group.clientId !== null).length);
  readonly hasActiveFilters = computed(() => {
    const value = this.filterValue();
    return !!(value.search.trim() || value.clientId || value.status);
  });

  /** Reloads whenever the URL client or a filter changes. */
  private readonly listTrigger$ = combineLatest([
    toObservable(this.routeClientId),
    // Typing in search waits for a pause; dropdowns and toggles apply at once.
    this.filters.valueChanges.pipe(debounceTime(SEARCH_DEBOUNCE_MS), startWith(null)),
  ]);

  ngOnInit(): void {
    (this.route.queryParamMap ?? of(this.route.snapshot.queryParamMap))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => { if (this.isAdmin() && params.has('create')) this.creating.set(true); });
    // Older links used /…?clientId=; the client now lives in the path.
    const queryClientId = this.route.snapshot.queryParamMap.get('clientId');
    if (queryClientId && !this.routeClientId()) this.filters.controls.clientId.setValue(queryClientId);

    this.projectAdmin
      .statuses()
      .pipe(catchError(() => of([] as string[])), takeUntilDestroyed(this.destroyRef))
      .subscribe((statuses) => this.statusOptions.set(statuses));

    this.listTrigger$
      .pipe(
        map(() => this.toListFilters()),
        tap(() => this.loadState.set('loading')),
        switchMap((filters) =>
          this.projectAdmin.listAll(filters).pipe(
            map((projects) => ({ projects, failed: false })),
            catchError(() => of({ projects: [] as ProjectRecord[], failed: true })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ projects, failed }) => {
        this.projects.set(projects);
        this.loadState.set(failed ? 'error' : 'ready');
      });
  }

  reload(): void {
    this.filters.updateValueAndValidity();
  }

  onCreated() { this.creating.set(false); this.workspace.invalidate(); this.reload(); }

  clearFilters(): void {
    this.filters.patchValue({ search: '', clientId: null, status: null });
  }

  openProject(project: ProjectRecord): void {
    const clientId = this.routeClientId();
    if (clientId) {
      void this.router.navigate(workspaceLinks.projectTickets(clientId, project.id));
      return;
    }
    this.selectedProjectId.set(project.id);
  }

  /**
   * Admin row action: open the project drawer in place. No navigation, so the
   * table keeps its filters, toggles and scroll position.
   */
  manageProject(project: ProjectRecord, event: Event): void {
    event.stopPropagation();
    if (!this.isAdmin()) return;
    this.manageTrigger = (event.target as HTMLElement | null)?.closest('button') ?? null;
    this.selectedProjectId.set(project.id);
  }

  closeDrawer(): void {
    const clientId = this.routeClientId();
    if (clientId && this.routeProjectId()) {
      void this.router.navigate(workspaceLinks.clientProjects(clientId));
    }
    this.selectedProjectId.set(null);
    this.restoreManageFocus();
  }

  /** Return keyboard focus to the Manage button that opened the drawer. */
  private restoreManageFocus(): void {
    const trigger = this.manageTrigger;
    this.manageTrigger = null;
    if (trigger) setTimeout(() => trigger.focus());
  }

  /** Keep the list row in step with an edit made in the drawer. */
  onProjectChanged(updated: ProjectRecord): void {
    this.projects.update((list) => list.map((project) => (project.id === updated.id ? updated : project)));
    this.workspace.refreshProjects();
  }

  private toListFilters(): ProjectListFilters {
    const value = this.filters.getRawValue();
    const sort = SORT_OPTIONS[value.sort] ?? SORT_OPTIONS[0];
    const routeClientId = this.routeClientId();
    return {
      search: value.search,
      clientId: routeClientId && routeClientId !== UNASSIGNED_CLIENT_ID ? routeClientId : value.clientId,
      unassigned: routeClientId === UNASSIGNED_CLIENT_ID,
      teamId: null,
      status: value.status,
      includeArchived: value.includeArchived,
      includeClosed: value.includeClosed,
      sortField: sort.field,
      sortOrder: sort.order,
    };
  }
}

/** Groups by client, keeping the server's row order within a group. Clients A–Z, "Unassigned" last. */
function groupByClient(projects: ProjectRecord[]): ProjectGroup[] {
  const groups = new Map<string | null, ProjectGroup>();
  for (const project of projects) {
    const key = project.client ? project.client.id : null;
    let group = groups.get(key);
    if (!group) {
      group = {
        clientId: key,
        name: project.client?.name ?? 'Unassigned',
        isArchived: project.client?.isArchived ?? false,
        projects: [],
      };
      groups.set(key, group);
    }
    group.projects.push(project);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.clientId === null) return 1;
    if (b.clientId === null) return -1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
