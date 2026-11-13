import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

import { AuthService } from '../../../core/auth/auth.service';
import { ArchivedTag } from '../../../shared/ui/archived-tag/archived-tag';
import { PROJECTS_LIST, ProjectAdminService, ProjectListFilterState, ProjectPageQuery } from './services/project-admin.service';
import { ProjectRecord, ProjectSortField } from './models/project-admin.model';
import { ProjectDetailDrawer } from './project-detail-drawer/project-detail-drawer';
import { WorkspaceService } from '../../clients/services/workspace.service';
import { WorkspaceBreadcrumb } from '../../clients/workspace-breadcrumb/workspace-breadcrumb';
import { UNASSIGNED_CLIENT_ID, workspaceLinks } from '../../clients/models/workspace.model';
import { NewInternalRecord } from '../shared/new-internal-record';
import { ClientTypeahead } from '../shared/client-typeahead';
import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PrefetchLink } from '../../../shared/ui/prefetch/prefetch-link';
import { ListQuery, injectListState } from '../../../shared/data/url-list-state';
import { pagedList } from '../../../shared/data/paged-list';

import { MessageModule } from 'primeng/message';
/** Group of projects under one client; `clientId` null is the "Unassigned" group. */
interface ProjectGroup {
  clientId: string | null;
  name: string;
  isArchived: boolean;
  projects: ProjectRecord[];
}

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
    MessageModule,
    FormsModule,
    DatePipe,
    DecimalPipe,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
    TooltipModule,
    TableModule,
    TagModule,
    SkeletonModule,
    IconFieldModule,
    InputIconModule,
    PageLayout,
    ListPaginator,
    EmptyState,
    ArchivedTag,
    ProjectDetailDrawer,
    WorkspaceBreadcrumb,
    RouterLink,
    NewInternalRecord,
    ClientTypeahead,
    PrefetchLink,
  ],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Projects {
  private readonly projectAdmin = inject(ProjectAdminService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspace = inject(WorkspaceService);

  readonly isAdmin = this.authService.isAdmin;
  readonly creating = signal(false);
  readonly sortOptions = SORT_OPTIONS.map((option, index) => ({ label: option.label, value: index }));

  readonly selectedProjectId = signal<string | null>(null);
  /** Manage button that opened the drawer, so focus can return to it on close. */
  private manageTrigger: HTMLElement | null = null;

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

  /** Search, filters, sort and page live in the URL; the API pages and counts. */
  readonly list = injectListState(PROJECTS_LIST);
  readonly projects = pagedList({
    params: () => projectPageQuery(this.list.query(), this.routeClientId()),
    load: (query) => this.projectAdmin.list(query),
    refreshOn: ['projects', 'clients'],
  });

  private readonly statusesResource = rxResource({
    stream: () => this.projectAdmin.statuses().pipe(catchError(() => of([] as string[]))),
  });
  readonly statusOptions = computed(() => (this.statusesResource.hasValue() ? this.statusesResource.value() : []));

  readonly sortIndex = computed(() => {
    const index = SORT_OPTIONS.findIndex((option) => option.field === this.list.sortField() && option.order === this.list.sortOrder());
    return index < 0 ? 0 : index;
  });

  /** The page's rows grouped by client, A–Z, "Unassigned" last. */
  readonly groups = computed<ProjectGroup[]>(() => groupByClient(this.projects.rows()));
  /** Page rows in group order, for the p-table subheader grouping. */
  readonly groupedRows = computed(() => this.groups().flatMap((group) => group.projects));
  private readonly groupIndex = computed(() => new Map(this.groups().map((group) => [group.clientId, group])));
  /** Project count per client across every page (from the API), for the group headers. */
  private readonly groupTotals = computed(
    () => new Map((this.projects.meta()?.clientTotals ?? []).map((entry) => [entry.clientId, entry.count])),
  );
  readonly clientCount = computed(() => this.projects.meta()?.clientCount ?? 0);
  readonly hasActiveFilters = computed(() => {
    const filters = this.list.filters();
    return !!(this.list.search() || filters.clientId || filters.status);
  });

  constructor() {
    // The Project breadcrumb opens the existing detail drawer at a shareable URL.
    effect(() => this.selectedProjectId.set(this.routeProjectId()));
    this.list.clampToTotal(this.projects);
  }

  groupOf(project: ProjectRecord): ProjectGroup {
    const key = project.client ? project.client.id : null;
    return this.groupIndex().get(key) ?? { clientId: key, name: 'Unassigned', isArchived: false, projects: [] };
  }

  groupTotal(clientId: string | null): number {
    return this.groupTotals().get(clientId) ?? this.groupIndex().get(clientId)?.projects.length ?? 0;
  }

  onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  setClientFilter(clientId: string | null): void {
    this.list.setFilter('clientId', clientId);
  }

  setStatus(status: string | null): void {
    this.list.setFilter('status', status);
  }

  setSort(index: number): void {
    const option = SORT_OPTIONS[index] ?? SORT_OPTIONS[0];
    this.list.setSort(option.field, option.order);
  }

  setIncludeClosed(value: boolean): void {
    this.list.setFilter('includeClosed', value);
  }

  setIncludeArchived(value: boolean): void {
    this.list.setFilter('includeArchived', value);
  }

  reload(): void {
    this.projects.reload();
  }

  onCreated() { this.creating.set(false); this.workspace.invalidate(); this.reload(); }

  clearFilters(): void {
    this.list.clearFilters();
  }

  /** Where a project row leads: its tickets on a client page, else nowhere (the drawer opens). */
  projectTicketsLink(project: ProjectRecord): string | null {
    const clientId = this.routeClientId();
    return clientId ? this.router.serializeUrl(this.router.createUrlTree(workspaceLinks.projectTickets(clientId, project.id))) : null;
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
    this.projects.updateRows((rows) => rows.map((project) => (project.id === updated.id ? updated : project)));
    this.workspace.refreshProjects();
  }
}

/**
 * The API query for the screen. On /clients/:clientId the client comes from
 * the path ('unassigned' = projects with no client) and replaces the filter.
 */
export function projectPageQuery(query: ListQuery<ProjectListFilterState>, routeClientId: string | null): ProjectPageQuery {
  const { clientId, ...rest } = query;
  return {
    ...rest,
    teamId: null,
    unassigned: routeClientId === UNASSIGNED_CLIENT_ID,
    clientId: routeClientId && routeClientId !== UNASSIGNED_CLIENT_ID ? routeClientId : clientId,
  };
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
