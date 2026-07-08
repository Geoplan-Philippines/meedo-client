import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, of, debounceTime, distinctUntilChanged, finalize, catchError, map, switchMap } from 'rxjs';

import { Table, TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { PopoverModule } from 'primeng/popover';
import { MessageService } from 'primeng/api';

import { TicketsService } from './services/tickets.service';
import { TicketCategoriesService } from './services/ticket-categories.service';
import { StatusesService } from './services/statuses.service';
import { ProjectsService } from './services/projects.service';
import { TeamsService } from '../settings/teams/services/teams.service';
import { MembersService } from './services/members.service';
import { AuthService } from '../../core/auth/auth.service';

import { OrgMember } from './models/members.model';
import { Project } from './models/projects.model';
import { Status } from './models/status.model';
import { TicketCategory } from './models/ticket-categories.model';
import {
  CreateTicketPayload,
  Ticket,
  TicketFacets,
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
} from './utils/ticket.utils';

@Component({
  selector: 'app-tickets',
  imports: [
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
    DatePipe,
    TitleCasePipe,
    FormsModule,
    ReactiveFormsModule,
    MarkdownEditor,
  ],
  providers: [MessageService],
  templateUrl: './tickets.html',
  styleUrl: './tickets.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tickets implements OnInit {
  private readonly ticketsService = inject(TicketsService);
  private readonly categoriesService = inject(TicketCategoriesService);
  private readonly statusesService = inject(StatusesService);
  private readonly projectsService = inject(ProjectsService);
  private readonly teamsService = inject(TeamsService);
  private readonly membersService = inject(MembersService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly table = viewChild<Table>('dt');

  // List state (server-side pagination / sort / filter)
  readonly tickets = signal<Ticket[]>([]);
  readonly totalRecords = signal(0);
  readonly rows = signal(10);
  readonly isLoading = signal(false);

  private first = 0;
  // Default ordering: newest tickets first, by creation time.
  private sortField: string | null = 'createdAt';
  private sortOrder: 'asc' | 'desc' | null = 'desc';
  private ticketsRequestId = 0;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchTerm = signal('');

  // View + filter state (replaces the old single-select status / priority dropdowns).
  readonly view = signal<TicketView>('all');
  readonly selectedStatusIds = signal<string[]>([]);
  readonly selectedPriorities = signal<string[]>([]);
  readonly selectedTeamIds = signal<string[]>([]);
  readonly facets = signal<TicketFacets | null>(null);
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
  readonly projects = signal<Project[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly members = signal<OrgMember[]>([]);

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
  /** Local filters for the longer picker lists (project / assignee). */
  readonly projectSearch = signal('');
  readonly assigneeSearch = signal('');

  // Mirror the create form value into a signal so the pill labels stay reactive
  // under OnPush as the popovers write back to the controls.
  private readonly composeValue = toSignal(this.ticketForm.valueChanges, {
    initialValue: this.ticketForm.getRawValue(),
  });

  readonly canCreate = computed(() => !!this.composeValue().title?.trim());

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

  readonly selectedProject = computed(() => {
    const id = this.composeValue().projectId;
    return id ? this.projects().find((project) => project.id === id) ?? null : null;
  });

  readonly selectedTeam = computed(() => {
    const id = this.composeValue().teamId;
    return id ? this.teams().find((team) => team.id === id) ?? null : null;
  });

  readonly selectedAssignees = computed(() => {
    const ids = new Set(this.composeValue().assigneeIds ?? []);
    return this.members().filter((member) => ids.has(member.id));
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

  readonly filteredProjects = computed(() => {
    const query = this.projectSearch().trim().toLowerCase();
    const list = this.projects();
    return query ? list.filter((project) => project.displayName.toLowerCase().includes(query)) : list;
  });

  /**
   * Auth-user IDs belonging to the currently selected compose team.
   * switchMap cancels the previous request whenever the team changes.
   * null = no team selected → show all org members.
   */
  private readonly composeTeamMemberUserIds = toSignal(
    toObservable(this.selectedTeam).pipe(
      switchMap((team) => {
        if (!team) return of(null);
        return this.teamsService.listTeamMembers(team.id).pipe(
          map((rows) => new Set(rows.map((r) => r.userId))),
          // On failure fall back to an empty set (no members), never null — a
          // selected team must never silently widen the picker to the whole org.
          catchError(() => of(new Set<string>())),
        );
      }),
    ),
    { initialValue: null as Set<string> | null },
  );

  readonly filteredMembers = computed(() => {
    const query = this.assigneeSearch().trim().toLowerCase();
    const teamUserIds = this.composeTeamMemberUserIds();
    let list = this.members();
    if (teamUserIds) list = list.filter((member) => teamUserIds.has(member.userId));
    if (query) list = list.filter((member) => member.displayName.toLowerCase().includes(query));
    return list;
  });

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
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshFacets();
        this.applyFilters();
      });

  }

  ngOnInit(): void {
    this.loadDropdowns();
    this.refreshFacets();
    this.openEditFromQueryParam();
    this.openCreateFromQueryParam();
    // The lazy p-table fires (onLazyLoad) on init, which loads the first page.
  }

  /** The dashboard's "New ticket" button routes here with ?new=1; open compose. */
  private openCreateFromQueryParam(): void {
    if (!this.route.snapshot.queryParamMap.has('new')) return;
    // Strip the param so a refresh doesn't reopen the composer.
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    this.openCreateDialog();
  }

  /** The detail page's "Edit" button routes here with ?edit=<id>; open that ticket for editing. */
  private openEditFromQueryParam(): void {
    const editId = this.route.snapshot.queryParamMap.get('edit');
    if (!editId) return;
    // Strip the param so a refresh doesn't reopen the editor.
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
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
      title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      description: new FormControl('', { nonNullable: true }),
      priority: new FormControl<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM', { nonNullable: true }),
      dueDate: new FormControl<Date | null>(null),
      ticketStatusId: new FormControl('', { nonNullable: true }),
      categoryId: new FormControl('', { nonNullable: true }),
      projectId: new FormControl('', { nonNullable: true }),
      teamId: new FormControl('', { nonNullable: true }),
      assigneeIds: new FormControl<string[]>([], { nonNullable: true }),
    });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.first = event.first ?? 0;
    this.rows.set(event.rows ?? 10);
    const sortField = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
    if (sortField) {
      this.sortField = sortField;
      this.sortOrder = event.sortOrder === 1 ? 'asc' : 'desc';
    } else {
      // No column sort active → fall back to newest-first by creation time
      // (PrimeNG reports sortOrder 1 with no field on the initial load, which
      // would otherwise sort the backend's default createdAt ascending).
      this.sortField = 'createdAt';
      this.sortOrder = 'desc';
    }
    this.fetchTickets();
  }

  private fetchTickets(): void {
    const requestId = ++this.ticketsRequestId;
    this.isLoading.set(true);
    this.ticketsService
      .getAll({
        page: Math.floor(this.first / this.rows()) + 1,
        limit: this.rows(),
        search: this.searchControl.value.trim() || undefined,
        view: this.view(),
        ticketStatusId: this.selectedStatusIds().length ? this.selectedStatusIds() : undefined,
        priority: this.selectedPriorities().length ? this.selectedPriorities() : undefined,
        teamId: this.selectedTeamIds().length ? this.selectedTeamIds() : undefined,
        sortField: this.sortField || undefined,
        sortOrder: this.sortOrder || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          // Ignore stale responses that resolved after a newer request started.
          if (requestId !== this.ticketsRequestId) return;
          this.tickets.set(res.data);
          this.totalRecords.set(res.meta.total);
        },
        error: (err: unknown) => {
          if (requestId !== this.ticketsRequestId) return;
          console.error('Error loading tickets:', err);
          this.tickets.set([]);
          this.totalRecords.set(0);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load tickets' });
        },
      });
  }

  private applyFilters(): void {
    this.searchTerm.set(this.searchControl.value.trim());
    const table = this.table();
    if (table) {
      table.reset();
    } else {
      this.first = 0;
      this.fetchTickets();
    }
  }

  private refreshFacets(): void {
    this.ticketsService
      .getFacets({ view: this.view(), search: this.searchControl.value.trim() || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (facets) => this.facets.set(facets),
        error: (err: unknown) => console.error('Error loading ticket facets:', err),
      });
  }

  // ─── View tabs ──────────────────────────────────────────
  setView(view: TicketView): void {
    if (this.view() === view) return;
    this.view.set(view);
    // View changes the scope of both the list and the facet counts.
    this.refreshFacets();
    this.applyFilters();
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
    this.selectedStatusIds.update((ids) =>
      ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id],
    );
    this.applyFilters();
  }

  togglePriority(value: string): void {
    this.selectedPriorities.update((values) =>
      values.includes(value) ? values.filter((existing) => existing !== value) : [...values, value],
    );
    this.applyFilters();
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
    this.selectedStatusIds.update((ids) => ids.filter((existing) => existing !== id));
    this.applyFilters();
  }

  removePriority(value: string): void {
    this.selectedPriorities.update((values) => values.filter((existing) => existing !== value));
    this.applyFilters();
  }

  toggleTeam(id: string): void {
    this.selectedTeamIds.update((ids) =>
      ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id],
    );
    this.applyFilters();
  }

  isTeamSelected(id: string): boolean {
    return this.selectedTeamIds().includes(id);
  }

  removeTeam(id: string): void {
    this.selectedTeamIds.update((ids) => ids.filter((existing) => existing !== id));
    this.applyFilters();
  }

  clearFilters(): void {
    this.selectedStatusIds.set([]);
    this.selectedPriorities.set([]);
    this.selectedTeamIds.set([]);
    this.applyFilters();
  }

  private refreshList(resetToFirstPage: boolean): void {
    const table = this.table();
    if (resetToFirstPage && table) {
      table.reset();
    } else {
      this.fetchTickets();
    }
  }

  loadDropdowns(): void {
    this.isLoadingDropdowns.set(true);

    const organizationId = this.authService.organizationId();

    forkJoin({
      categories: this.categoriesService.getAll(),
      statuses: this.statusesService.getAll(),
      projects: this.projectsService.getAll(),
      teams: organizationId ? this.teamsService.getTeams(organizationId) : of([] as Team[]),
      members: organizationId ? this.membersService.getMembers(organizationId) : of([] as OrgMember[]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.categories.set(res.categories);
          this.statuses.set(res.statuses);
          this.projects.set(res.projects);
          this.teams.set(res.teams as Team[]);
          this.members.set(res.members);
          this.isLoadingDropdowns.set(false);
        },
        error: (err: unknown) => {
          console.error('Error loading dropdowns:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load form data' });
          this.isLoadingDropdowns.set(false);
        },
      });
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

  private resetCreateForm(): void {
    this.ticketForm.reset({
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: null,
      ticketStatusId: '',
      categoryId: '',
      projectId: '',
      teamId: '',
      assigneeIds: [],
    });
    this.projectSearch.set('');
    this.assigneeSearch.set('');
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

  setProjectValue(id: string): void {
    const next = this.composeValue().projectId === id ? '' : id;
    this.ticketForm.controls.projectId.setValue(next);
  }

  setTeamValue(id: string): void {
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

  openEditDialog(ticket: Ticket): void {
    this.selectedTicket.set(ticket);
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
      dueDate: formValue.dueDate ? formValue.dueDate.toISOString() : null,
      ticketStatusId: formValue.ticketStatusId || null,
      categoryId: formValue.categoryId || null,
      projectId: formValue.projectId || null,
      teamId: formValue.teamId || null,
      assigneeIds: formValue.assigneeIds,
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
      dueDate: formValue.dueDate ? formValue.dueDate.toISOString() : undefined,
      ticketStatusId: formValue.ticketStatusId || undefined,
      categoryId: formValue.categoryId || undefined,
      projectId: formValue.projectId || undefined,
      teamId: formValue.teamId || undefined,
      assigneeIds: formValue.assigneeIds,
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
}
