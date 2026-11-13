import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { filter, forkJoin, map } from 'rxjs';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { PopoverModule } from 'primeng/popover';
import { TabsModule } from 'primeng/tabs';
import { SelectButtonModule } from 'primeng/selectbutton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService } from 'primeng/api';

import { TICKETS_LIST, TicketsService, ticketFacetParams, ticketListParams, ticketView } from './services/tickets.service';
import { TicketDepartmentService } from './services/ticket-department.service';
import { TicketsBoard } from './tickets-board/tickets-board';
import { InputFeedback } from '../../shared/ui/input-feedback/input-feedback';
import { ArchivedTag } from '../../shared/ui/archived-tag/archived-tag';
import { WorkspaceBreadcrumb } from '../clients/workspace-breadcrumb/workspace-breadcrumb';
import { WorkspaceService } from '../clients/services/workspace.service';
import { PageLayout } from '../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { PrefetchLink } from '../../shared/ui/prefetch/prefetch-link';
import { clientDisplayName, projectDisplayName } from '../../shared/utils/display-name.utils';
import { TICKET_TITLE_MAX_LENGTH, TICKET_DESCRIPTION_MAX_LENGTH, MY_TICKETS_QUERY_PARAMS } from './tickets.constants';
import { trimmedRequired } from './utils/ticket-validation';
import { TicketAttachmentsService } from './services/attachments.service';
import { TicketCategoriesService } from './services/ticket-categories.service';
import { StatusesService } from './services/statuses.service';
import { ProjectsService, toPickerProject, withCurrentProject } from './services/projects.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApiCache } from '../../core/http/api-cache';
import { MemberDirectoryService, OrgMember, withDisplayName } from '../../core/members/member-directory.service';
import { injectListState } from '../../shared/data/url-list-state';
import { pagedList } from '../../shared/data/paged-list';
import { pagedSearch } from '../../shared/data/paged-search';

import { Project } from './models/projects.model';
import { Status } from './models/status.model';
import { TicketCategory } from './models/ticket-categories.model';
import {
  CreateTicketPayload,
  Ticket,
  TicketView,
  UpdateTicketPayload,
} from './models/ticket.model';
import { Team } from '../settings/teams/models/teams.model';
import { getAvatarClass } from '../../shared/utils/avatar.utils';
import { MarkdownEditor } from '../../shared/ui/markdown-editor/markdown-editor';
import {
  AssigneeAvatar,
  initialsFrom,
  visibleAssignees as visibleAssigneesUtil,
  extraAssigneeCount as extraAssigneeCountUtil,
  safeStatusColor as safeStatusColorUtil,
  startOfToday,
  serializeDueDate,
} from './utils/ticket.utils';

import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
@Component({
  selector: 'app-tickets',
  imports: [
    BadgeModule,
    MessageModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    DatePickerModule,
    ToastModule,
    PopoverModule,
    TabsModule,
    SelectButtonModule,
    IconFieldModule,
    InputIconModule,
    DatePipe,
    TitleCasePipe,
    FormsModule,
    ReactiveFormsModule,
    MarkdownEditor,
    TicketsBoard,
    InputFeedback,
    ArchivedTag,
    WorkspaceBreadcrumb,
    PageLayout,
    ListPaginator,
    EmptyState,
    PrefetchLink,
  ],
  providers: [MessageService],
  templateUrl: './tickets.html',
  styleUrl: './tickets.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tickets implements OnInit {
  private readonly ticketsService = inject(TicketsService);
  private readonly departmentService = inject(TicketDepartmentService);
  private readonly attachmentsService = inject(TicketAttachmentsService);
  private readonly categoriesService = inject(TicketCategoriesService);
  private readonly statusesService = inject(StatusesService);
  private readonly projectsService = inject(ProjectsService);
  private readonly directory = inject(MemberDirectoryService);
  private readonly workspace = inject(WorkspaceService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly layout = toSignal(this.route.queryParamMap.pipe(map(params => params.get('view') === 'board' ? 'board' : 'list')), {
    initialValue: this.route.snapshot.queryParamMap.get('view') === 'board' ? 'board' : 'list',
  });
  /** Set on /clients/:clientId/projects/:projectId/tickets: the list, board and counts show one project. */
  readonly scopeProjectId = toSignal(this.route.paramMap.pipe(map(params => params.get('projectId'))), {
    initialValue: this.route.snapshot.paramMap.get('projectId'),
  });
  readonly scopeClientId = toSignal(this.route.paramMap.pipe(map(params => params.get('clientId'))), {
    initialValue: this.route.snapshot.paramMap.get('clientId'),
  });

  /** Tab, facets, search, sort and page live in the URL, so reloads and Back keep them. */
  readonly list = injectListState(TICKETS_LIST);
  readonly view = computed<TicketView>(() => ticketView(this.list.filters().tab));
  readonly searchTerm = this.list.search;
  readonly selectedStatusIds = computed(() => [...this.list.filters().status]);
  readonly selectedPriorities = computed(() => [...this.list.filters().priority]);
  readonly selectedTeamIds = computed(() => [...this.list.filters().team]);

  /** "My issues" lives in the URL (?assignee=me) so the sidebar's "My tickets" can open it. */
  readonly myIssues = toSignal(this.route.queryParamMap.pipe(map(isMyTickets)), {
    initialValue: isMyTickets(this.route.snapshot.queryParamMap),
  });
  /** The signed-in user's member row; its id is what tickets store as an assignee. */
  private readonly activeMember = rxResource({ stream: () => this.directory.activeMember() });
  readonly currentMemberId = computed(() => (this.activeMember.hasValue() ? this.activeMember.value()?.id ?? null : null));
  /** True while ?assignee=me waits for the member ID; loading now would briefly show everyone's tickets. */
  readonly awaitingMember = computed(() => this.myIssues() && this.activeMember.isLoading());
  readonly assigneeFilter = computed(() => (this.myIssues() ? this.currentMemberId() ?? undefined : undefined));

  /** The list request; undefined holds it back until "My issues" knows who "me" is. */
  private readonly listParams = computed(() =>
    this.awaitingMember()
      ? undefined
      : ticketListParams(this.list.query(), { assigneeId: this.assigneeFilter(), projectId: this.scopeProjectId() ?? undefined }),
  );
  readonly ticketPage = pagedList({
    params: () => (this.layout() === 'board' ? undefined : this.listParams()),
    load: (query) => this.ticketsService.getAll(query),
    refreshOn: ['tickets'],
  });
  readonly tickets = this.ticketPage.rows;
  readonly totalRecords = this.ticketPage.total;
  readonly isLoading = this.ticketPage.loading;

  private readonly facetsResource = rxResource({
    params: () => {
      const params = this.listParams();
      return params ? ticketFacetParams(params) : undefined;
    },
    stream: ({ params }) => this.ticketsService.getFacets(params),
  });
  readonly facets = computed(() => (this.facetsResource.hasValue() ? this.facetsResource.value() : null));

  readonly boardRevision = signal(0);
  readonly boardFilters = computed(() => ({
    page: 1, limit: 20, view: this.view(), search: this.searchTerm() || undefined,
    teamId: this.selectedTeamIds(), ticketStatusId: this.selectedStatusIds(),
    priority: this.selectedPriorities(), assigneeId: this.assigneeFilter(),
    projectId: this.scopeProjectId() ?? undefined,
  }));

  setLayout(layout: 'list' | 'board'): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { view: layout === 'board' ? 'board' : null }, queryParamsHandling: 'merge' });
  }

  onBoardMove(): void { this.facetsResource.reload(); }

  readonly viewTabOptions: { label: string; value: TicketView }[] = [
    { label: 'All tickets', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Backlog', value: 'backlog' },
    { label: 'Closed', value: 'closed' },
  ];
  readonly layoutOptions = [
    { label: 'List', value: 'list', icon: 'pi pi-list' },
    { label: 'Board', value: 'board', icon: 'pi pi-th-large' },
  ];

  /** Which page of the filter popover is showing: the facet list or a value list. */
  readonly filterPanel = signal<'root' | 'status' | 'priority' | 'team'>('root');

  readonly activeFilterCount = computed(
    () => this.selectedStatusIds().length + this.selectedPriorities().length + this.selectedTeamIds().length,
  );

  // Non-archived statuses for the filter picker (archived ones stay out of it).
  readonly filterableStatuses = computed(() => this.statuses().filter((status) => !status.isArchived));

  private readonly statusCountById = computed(() => {
    const map = new Map<string, number>();
    for (const entry of this.facets()?.statuses ?? []) map.set(entry.ticketStatusId, entry.count);
    return map;
  });
  private readonly priorityCountByValue = computed(() => {
    const map = new Map<string, number>();
    for (const entry of this.facets()?.priorities ?? []) map.set(entry.priority, entry.count);
    return map;
  });

  // Selected facets resolved to display chips (name + colour / label).
  readonly selectedStatusChips = computed(() => {
    const ids = new Set(this.selectedStatusIds());
    return this.statuses().filter((status) => ids.has(status.id));
  });
  readonly selectedPriorityChips = computed(() => {
    const values = new Set(this.selectedPriorities());
    return this.priorities.filter((priority) => values.has(priority.value));
  });
  readonly selectedTeamChips = computed(() => {
    const ids = new Set(this.selectedTeamIds());
    return this.teams().filter((team) => ids.has(team.id));
  });

  readonly minDueDate = startOfToday();

  readonly createDialogVisible = signal(false);
  readonly selectedTicket = signal<Ticket | null>(null);
  readonly isSaving = signal(false);
  readonly isLoadingDropdowns = signal(false);
  readonly editDialogVisible = signal(false);
  readonly isUpdating = signal(false);

  readonly categories = signal<TicketCategory[]>([]);
  readonly statuses = signal<Status[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly departmentAdmin = signal(false);
  readonly departmentLoaded = signal(false);
  readonly noDepartments = computed(() => this.departmentLoaded() && !this.departmentAdmin() && this.teams().length === 0);

  // Start of today, computed once — used to flag overdue due dates in the list.
  private readonly today = startOfToday();

  readonly priorities: { label: string; value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' }[] = [
    { label: 'Low', value: 'LOW' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'High', value: 'HIGH' },
    { label: 'Urgent', value: 'URGENT' },
  ];

  readonly ticketForm = this.buildTicketForm();
  readonly editTicketForm = this.buildTicketForm();

  // ─── Compose modal (Linear-style create) ───────────────
  // Mirror the create form value into a signal so the pill labels stay reactive
  // under OnPush as the popovers write back to the controls.
  private readonly composeValue = toSignal(this.ticketForm.valueChanges, {
    initialValue: this.ticketForm.getRawValue(),
  });

  private readonly editValue = toSignal(this.editTicketForm.valueChanges, {
    initialValue: this.editTicketForm.getRawValue(),
  });

  readonly titleMaxLength = TICKET_TITLE_MAX_LENGTH;
  readonly descriptionMaxLength = TICKET_DESCRIPTION_MAX_LENGTH;
  readonly canCreate = computed(() => {
    this.composeValue();
    return this.departmentLoaded() && this.ticketForm.valid;
  });

  readonly selectedStatus = computed(() => {
    const id = this.composeValue().ticketStatusId;
    return id ? this.statuses().find((status) => status.id === id) ?? null : null;
  });

  readonly selectedPriorityOption = computed(
    () => this.priorities.find((p) => p.value === this.composeValue().priority) ?? this.priorities[1],
  );

  readonly selectedCategory = computed(() => {
    const id = this.composeValue().categoryId;
    return id ? this.categories().find((category) => category.id === id) ?? null : null;
  });

  readonly selectedTeam = computed(() => {
    const id = this.composeValue().teamId;
    return id ? this.teams().find((team) => team.id === id) ?? null : null;
  });

  // ─── Pickers: searched on the server, one page at a time ───
  /** Compose project picker; the API only returns projects the user may see. */
  readonly composeProjects = pagedSearch<Project>({ fetch: (query) => this.projectsService.search(query) });
  /** Edit dialog project picker. */
  readonly editProjects = pagedSearch<Project>({ fetch: (query) => this.projectsService.search(query) });
  /** The compose pick, kept so its label survives a new search. */
  private readonly chosenProject = signal<Project | null>(null);

  readonly selectedProject = computed(() => {
    const id = this.composeValue().projectId;
    if (!id) return null;
    const chosen = this.chosenProject();
    return chosen?.id === id ? chosen : this.composeProjects.items().find((project) => project.id === id) ?? null;
  });

  /** Compose assignees: the selected team's members when a team is set, else the whole organization. */
  readonly composeAssignees = pagedSearch<OrgMember>({
    fetch: (query) => this.directory.list({ ...query, sortField: 'name', sortOrder: 'asc', teamId: this.selectedTeam()?.id }),
  });
  /** Edit dialog assignees: the whole organization. */
  readonly editAssignees = pagedSearch<OrgMember>({
    fetch: (query) => this.directory.list({ ...query, sortField: 'name', sortOrder: 'asc' }),
  });
  /** Every member seen in a search or on the edited ticket, so chosen assignees keep their names. */
  private readonly knownMembers = signal(new Map<string, OrgMember>());

  readonly selectedAssignees = computed(() => {
    const known = this.knownMembers();
    return (this.composeValue().assigneeIds ?? []).flatMap((id) => known.get(id) ?? []);
  });

  /** Up to three assignee avatars for the pill; the rest collapse into a +N chip. */
  readonly composeAssigneeAvatars = computed<AssigneeAvatar[]>(() =>
    this.selectedAssignees().slice(0, 3).map((member) => {
      const name = member.displayName || member.user?.name || member.user?.email || '';
      return {
        initials: initialsFrom(name),
        className: getAvatarClass(name || member.id),
        name: name || 'Member',
      };
    }),
  );

  readonly composeDueDate = computed(() => this.composeValue().dueDate ?? null);

  /** Markdown mirrored into the compose editor (reset clears it; the editor writes back on save). */
  readonly composeDescription = computed(() => this.composeValue().description ?? '');

  /**
   * Whether a member may see the edited ticket's project. Members only get their
   * own projects from the API, so a ticket on someone else's project keeps its
   * project read-only. Admins see every project.
   */
  private readonly editProjectAccess = rxResource({
    params: () => {
      const projectId = this.selectedTicket()?.projectId;
      return !this.authService.isAdmin() && projectId ? projectId : undefined;
    },
    stream: ({ params }) => this.workspace.project(params),
  });
  private readonly editProjectVisible = computed(() =>
    this.authService.isAdmin() || (this.editProjectAccess.hasValue() && this.editProjectAccess.value() !== null),
  );

  /** Edit dialog options: the search results plus the ticket's own project (archived or not on this page). */
  readonly editProjectOptions = computed(() =>
    withCurrentProject(this.editProjects.items(), this.selectedTicket()?.project, this.editProjectVisible()),
  );
  readonly editProjectReadOnly = computed(() => !this.authService.isAdmin() && !!this.selectedTicket()?.projectId && !this.editProjectVisible());

  /** Edit dialog assignee options: the ticket's chosen members first, then the search results. */
  readonly editAssigneeOptions = computed(() => {
    const known = this.knownMembers();
    const chosen = (this.editValue().assigneeIds ?? []).flatMap((id) => known.get(id) ?? []);
    const found = this.editAssignees.items().filter((member) => !chosen.some((picked) => picked.id === member.id));
    return [...chosen, ...found];
  });

  readonly filteredMembers = this.composeAssignees.items;

  /** True when every visible member is already in the assignee list. */
  readonly allFilteredAssigneesSelected = computed(() => {
    const filtered = this.filteredMembers();
    if (!filtered.length) return false;
    const chosen = new Set(this.composeValue().assigneeIds ?? []);
    return filtered.every((member) => chosen.has(member.id));
  });

  /** True when at least one, but not all, visible members are selected. */
  readonly someFilteredAssigneesSelected = computed(() => {
    const filtered = this.filteredMembers();
    if (!filtered.length) return false;
    const chosen = new Set(this.composeValue().assigneeIds ?? []);
    const count = filtered.filter((member) => chosen.has(member.id)).length;
    return count > 0 && count < filtered.length;
  });

  constructor() {
    this.list.clampToTotal(this.ticketPage);

    effect(() => {
      const found = [...this.composeAssignees.items(), ...this.editAssignees.items()];
      untracked(() => this.rememberMembers(found));
    });

    // A changed compose team re-scopes the assignee search.
    effect(() => {
      this.selectedTeam();
      untracked(() => {
        if (this.createDialogVisible()) this.composeAssignees.refresh();
      });
    });

    // ?assignee=me without a member here (e.g. a removed membership): drop the param.
    effect(() => {
      if (this.myIssues() && this.activeMember.hasValue() && !this.activeMember.value()) {
        untracked(() => void this.router.navigate([], { relativeTo: this.route, queryParams: { assignee: null }, queryParamsHandling: 'merge', replaceUrl: true }));
      }
    });

    // Facet counts follow ticket changes (writes and websocket notifications) like the list does.
    inject(ApiCache)
      .changes$.pipe(
        filter((change) => change === null || change.has('tickets')),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.facetsResource.status() !== 'idle') this.facetsResource.reload();
      });
  }

  ngOnInit(): void {
    this.loadDropdowns();
    this.openEditFromQueryParam();
    this.openCreateFromQueryParam();
  }

  /** The dashboard's "New ticket" button routes here with ?new=1; open compose. */
  private openCreateFromQueryParam(): void {
    if (!this.route.snapshot.queryParamMap.has('new')) return;
    // Strip the param so a refresh doesn't reopen the composer.
    this.router.navigate([], { relativeTo: this.route, queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.openCreateDialog();
  }

  /** The detail page's "Edit" button routes here with ?edit=<id>; open that ticket for editing. */
  private openEditFromQueryParam(): void {
    const editId = this.route.snapshot.queryParamMap.get('edit');
    if (!editId) return;
    // Strip the param so a refresh doesn't reopen the editor.
    this.router.navigate([], { relativeTo: this.route, queryParams: { edit: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.ticketsService
      .getById(editId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ticket) => this.openEditDialog(ticket),
        error: (err: unknown) => console.error('Error loading ticket to edit:', err),
      });
  }

  private buildTicketForm() {
    return new FormGroup({
      title: new FormControl('', { nonNullable: true, validators: [trimmedRequired, Validators.maxLength(TICKET_TITLE_MAX_LENGTH)] }),
      description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(TICKET_DESCRIPTION_MAX_LENGTH)] }),
      priority: new FormControl<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM', { nonNullable: true }),
      dueDate: new FormControl<Date | null>(null),
      ticketStatusId: new FormControl('', { nonNullable: true }),
      categoryId: new FormControl('', { nonNullable: true }),
      projectId: new FormControl('', { nonNullable: true }),
      teamId: new FormControl('', { nonNullable: true }),
      assigneeIds: new FormControl<string[]>([], { nonNullable: true }),
    });
  }

  onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  // ─── View tabs ──────────────────────────────────────────
  setView(view: TicketView): void {
    if (this.view() === view) return;
    this.list.setFilter('tab', view);
  }

  viewCount(view: TicketView): number {
    return this.facets()?.views[view] ?? 0;
  }

  // ─── Filter popover ─────────────────────────────────────
  openFilterPanel(panel: 'status' | 'priority' | 'team'): void {
    this.filterPanel.set(panel);
  }

  backToFilterRoot(): void {
    this.filterPanel.set('root');
  }

  /** Reset to the facet list so the popover always reopens at the top level. */
  onFilterPopoverHide(): void {
    this.filterPanel.set('root');
  }

  toggleStatus(id: string): void {
    this.list.setFilter('status', toggle(this.selectedStatusIds(), id));
  }

  togglePriority(value: string): void {
    this.list.setFilter('priority', toggle(this.selectedPriorities(), value));
  }

  isStatusSelected(id: string): boolean {
    return this.selectedStatusIds().includes(id);
  }

  isPrioritySelected(value: string): boolean {
    return this.selectedPriorities().includes(value);
  }

  statusCount(id: string): number {
    return this.statusCountById().get(id) ?? 0;
  }

  priorityCount(value: string): number {
    return this.priorityCountByValue().get(value) ?? 0;
  }

  removeStatus(id: string): void {
    this.list.setFilter('status', this.selectedStatusIds().filter((existing) => existing !== id));
  }

  removePriority(value: string): void {
    this.list.setFilter('priority', this.selectedPriorities().filter((existing) => existing !== value));
  }

  toggleTeam(id: string): void {
    this.list.setFilter('team', toggle(this.selectedTeamIds(), id));
  }

  toggleMyIssues(): void {
    if (!this.currentMemberId()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { assignee: this.myIssues() ? null : MY_TICKETS_QUERY_PARAMS.assignee, page: null },
      queryParamsHandling: 'merge',
    });
  }

  isTeamSelected(id: string): boolean {
    return this.selectedTeamIds().includes(id);
  }

  removeTeam(id: string): void {
    this.list.setFilter('team', this.selectedTeamIds().filter((existing) => existing !== id));
  }

  clearFilters(): void {
    this.list.setFilters({ status: [], priority: [], team: [] });
  }

  /** After a create or edit: refresh the list, facets and board (a new ticket goes back to page 1). */
  private refreshList(resetToFirstPage: boolean): void {
    this.boardRevision.update(revision => revision + 1);
    if (resetToFirstPage && this.list.page() !== 1) this.list.setPage(1);
    this.ticketPage.reload();
    this.facetsResource.reload();
  }

  loadDropdowns(): void {
    this.isLoadingDropdowns.set(true);

    forkJoin({
      categories: this.categoriesService.options(),
      statuses: this.statusesService.options(),
      department: this.departmentService.load(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.categories.set(res.categories);
          this.statuses.set(res.statuses);
          this.teams.set(res.department.teams);
          this.departmentAdmin.set(res.department.isAdmin);
          this.departmentLoaded.set(true);
          for (const form of [this.ticketForm, this.editTicketForm]) {
            form.controls.teamId.clearValidators();
            form.controls.teamId.updateValueAndValidity();
          }
          this.isLoadingDropdowns.set(false);
        },
        error: (err: unknown) => {
          console.error('Error loading dropdowns:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load form data' });
          this.isLoadingDropdowns.set(false);
        },
      });
  }

  projectName(project: NonNullable<Ticket['project']>): string {
    return projectDisplayName(project);
  }

  clientName(project: NonNullable<Ticket['project']>): string {
    return clientDisplayName(project.client) || 'No client';
  }

  getMemberNames(ticket: Ticket): string {
    const assignees = ticket.assignees ?? [];
    if (!assignees.length) return '—';
    return assignees.map(a => a.member?.user?.name ?? a.member?.user?.email ?? a.memberId).join(', ');
  }

  /** Lowercase modifier class for the list priority indicator (dot colour + label weight). */
  priorityCellClass(priority: string): string {
    return `prio prio-${priority.toLowerCase()}`;
  }

  isOverdue(ticket: Ticket): boolean {
    return !!ticket.dueDate && new Date(ticket.dueDate) < this.today;
  }

  /** Up to three assignee avatars for the row; the rest collapse into a +N chip. */
  visibleAssignees(ticket: Ticket): AssigneeAvatar[] {
    return visibleAssigneesUtil(ticket);
  }

  extraAssigneeCount(ticket: Ticket): number {
    return extraAssigneeCountUtil(ticket);
  }

  safeStatusColor(color?: string | null): string {
    return safeStatusColorUtil(color);
  }

  openCreateDialog(): void {
    this.resetCreateForm();
    this.createDialogVisible.set(true);
  }

  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
  }

  /** The markdown editor autosaves its content back into the compose form control. */
  onComposeDescription(markdown: string): void {
    this.ticketForm.controls.description.setValue(markdown);
  }

  /** Upload handler for the description editor (paste / drop / attach). Arrow keeps `this`. */
  readonly uploadAttachment = (file: File) => this.attachmentsService.upload(file);

  private resetCreateForm(): void {
    const scopeProjectId = this.scopeProjectId();
    this.ticketForm.reset({
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: null,
      ticketStatusId: '',
      categoryId: '',
      // New tickets on a project's page start on that project.
      projectId: scopeProjectId ?? '',
      teamId: '',
      assigneeIds: [],
    });
    this.chosenProject.set(null);
    this.composeProjects.reset();
    this.composeAssignees.reset();
    if (scopeProjectId) {
      this.workspace
        .project(scopeProjectId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((record) => {
          if (record && this.composeValue().projectId === record.id) this.chosenProject.set(toPickerProject(record));
        });
    }
  }

  // ─── Compose pill pickers ───────────────────────────────
  setStatusValue(id: string): void {
    // Tapping the active status again clears it (status is optional).
    const next = this.composeValue().ticketStatusId === id ? '' : id;
    this.ticketForm.controls.ticketStatusId.setValue(next);
  }

  setPriorityValue(value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'): void {
    this.ticketForm.controls.priority.setValue(value);
  }

  setCategoryValue(id: string): void {
    const next = this.composeValue().categoryId === id ? '' : id;
    this.ticketForm.controls.categoryId.setValue(next);
  }

  setProjectValue(project: Project): void {
    const clearing = this.composeValue().projectId === project.id;
    this.chosenProject.set(clearing ? null : project);
    this.ticketForm.controls.projectId.setValue(clearing ? '' : project.id);
  }

  setTeamValue(id: string): void {
    if (!this.departmentAdmin() && !this.teams().some(team => team.id === id)) return;
    const next = this.composeValue().teamId === id ? '' : id;
    this.ticketForm.controls.teamId.setValue(next);
  }

  toggleAssigneeValue(id: string): void {
    const current = this.ticketForm.controls.assigneeIds.value ?? [];
    const next = current.includes(id)
      ? current.filter((existing) => existing !== id)
      : [...current, id];
    this.ticketForm.controls.assigneeIds.setValue(next);
  }

  isAssigneeChosen(id: string): boolean {
    return (this.composeValue().assigneeIds ?? []).includes(id);
  }

  /** Selects or clears the members currently listed by the search. */
  toggleAllAssignees(): void {
    const filtered = this.filteredMembers();
    const current = new Set(this.ticketForm.controls.assigneeIds.value ?? []);
    if (this.allFilteredAssigneesSelected()) {
      filtered.forEach((member) => current.delete(member.id));
    } else {
      filtered.forEach((member) => current.add(member.id));
    }
    this.ticketForm.controls.assigneeIds.setValue([...current]);
  }

  clearDueDate(): void {
    this.ticketForm.controls.dueDate.setValue(null);
  }

  memberInitials(member: OrgMember): string {
    return initialsFrom(member.displayName || member.user?.name || member.user?.email || '');
  }

  memberAvatarClass(member: OrgMember): string {
    return getAvatarClass(member.displayName || member.id);
  }

  /** Row click opens the full ticket detail page (seed the page with the row data). */
  openDetail(ticket: Ticket): void {
    this.router.navigate(['/tickets', ticket.id], { state: { ticket } });
  }

  canEditTicket(ticket: Ticket) { return this.authService.isAdmin() || ticket.createdById === this.authService.currentUser()?.id; }

  openEditDialog(ticket: Ticket): void {
    if (!this.canEditTicket(ticket)) return;
    this.selectedTicket.set(ticket);
    this.rememberMembers((ticket.assignees ?? []).flatMap((assignee) => (assignee.member ? [withDisplayName({
      id: assignee.memberId,
      userId: assignee.member.user.id,
      organizationId: ticket.organizationId,
      role: '',
      createdAt: '',
      user: assignee.member.user,
    })] : [])));
    this.editProjects.reset();
    this.editAssignees.reset();
    this.editTicketForm.controls.teamId.setValidators(!this.departmentAdmin() && ticket.teamId ? [Validators.required] : []);
    this.editTicketForm.controls.teamId.updateValueAndValidity();
    this.editTicketForm.reset({
      title: ticket.title,
      description: ticket.description ?? '',
      priority: ticket.priority,
      dueDate: ticket.dueDate ? new Date(ticket.dueDate) : null,
      ticketStatusId: ticket.ticketStatusId ?? '',
      categoryId: ticket.categoryId ?? '',
      projectId: ticket.projectId ?? '',
      teamId: ticket.teamId ?? '',
      assigneeIds: (ticket.assignees ?? []).map(a => a.memberId),
    });
    this.editDialogVisible.set(true);
  }

  closeEditDialog(): void {
    this.editDialogVisible.set(false);
  }

  updateTicket(): void {
    if (this.isUpdating()) return;
    if (!this.departmentLoaded()) return;
    if (this.editTicketForm.invalid) {
      this.editTicketForm.markAllAsTouched();
      return;
    }

    const ticket = this.selectedTicket();
    if (!ticket) return;

    this.isUpdating.set(true);
    const formValue = this.editTicketForm.getRawValue();

    // null clears a field on the server; '' from a cleared select must therefore map to null.
    const payload: UpdateTicketPayload = {
      title: formValue.title.trim(),
      description: formValue.description.trim() || null,
      priority: formValue.priority,
      dueDate: formValue.dueDate ? serializeDueDate(formValue.dueDate) : null,
      ticketStatusId: formValue.ticketStatusId || null,
      categoryId: formValue.categoryId || null,
      projectId: this.editProjectReadOnly() ? undefined : formValue.projectId || null,
      teamId: formValue.teamId || null,
      assigneeIds: this.departmentAdmin() ? formValue.assigneeIds : undefined,
    };

    this.ticketsService.updateTicket(ticket.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Ticket updated' });
          this.editDialogVisible.set(false);
          this.isUpdating.set(false);
          this.refreshList(false);
        },
        error: (err: unknown) => {
          console.error('Error updating ticket:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update ticket' });
          this.isUpdating.set(false);
        },
      });
  }

  saveTicket(): void {
    if (this.isSaving()) return;
    if (!this.departmentLoaded()) return;
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formValue = this.ticketForm.getRawValue();

    const payload: CreateTicketPayload = {
      title: formValue.title.trim(),
      description: formValue.description.trim() || undefined,
      priority: formValue.priority,
      dueDate: formValue.dueDate ? serializeDueDate(formValue.dueDate) : undefined,
      ticketStatusId: formValue.ticketStatusId || undefined,
      categoryId: formValue.categoryId || undefined,
      projectId: formValue.projectId || undefined,
      teamId: formValue.teamId || undefined,
      assigneeIds: this.departmentAdmin() ? formValue.assigneeIds : undefined,
    };

    this.ticketsService.createTicket(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Ticket created' });
          this.createDialogVisible.set(false);
          this.isSaving.set(false);
          this.refreshList(true);
        },
        error: (err: unknown) => {
          console.error('Error creating ticket:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create ticket' });
          this.isSaving.set(false);
        },
      });
  }

  private rememberMembers(members: readonly OrgMember[]): void {
    if (!members.length) return;
    this.knownMembers.update((known) => {
      const next = new Map(known);
      for (const member of members) next.set(member.id, member);
      return next;
    });
  }
}

function isMyTickets(params: ParamMap): boolean {
  return params.get('assignee') === MY_TICKETS_QUERY_PARAMS.assignee;
}

function toggle(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((existing) => existing !== value) : [...values, value];
}
