import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';

import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { PopoverModule } from 'primeng/popover';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';

import { TicketsService } from '../services/tickets.service';
import { TicketAttachmentsService } from '../services/attachments.service';
import { TicketCategoriesService } from '../services/ticket-categories.service';
import { StatusesService } from '../services/statuses.service';
import { ProjectsService, filterProjects, withCurrentProject } from '../services/projects.service';
import { SlaBadge } from '../sla-badge/sla-badge';
import { ArchivedTag } from '../../../shared/ui/archived-tag/archived-tag';
import { projectDisplayName } from '../../../shared/utils/display-name.utils';
import { MembersService } from '../services/members.service';
import { TeamsService } from '../../settings/teams/services/teams.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TicketThread } from '../ticket-thread/ticket-thread';
import { MarkdownEditor } from '../../../shared/ui/markdown-editor/markdown-editor';
import { TicketTitleEditor } from '../ticket-title-editor/ticket-title-editor';
import { TICKET_TITLE_MAX_LENGTH, TICKET_DESCRIPTION_MAX_LENGTH } from '../tickets.constants';

import { Ticket, TicketRelation, UpdateTicketPayload } from '../models/ticket.model';
import { Status } from '../models/status.model';
import { Project } from '../models/projects.model';
import { OrgMember } from '../models/members.model';
import { TicketCategory } from '../models/ticket-categories.model';
import { Team } from '../../settings/teams/models/teams.model';
import { getAvatarClass } from '../../../shared/utils/avatar.utils';
import {
  AssigneeAvatar,
  initialsFrom,
  toAssigneeAvatar,
  safeStatusColor as safeStatusColorUtil,
  startOfToday,
  serializeDueDate,
} from '../utils/ticket.utils';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

@Component({
  selector: 'app-ticket-detail',
  imports: [
    DatePipe,
    TitleCasePipe,
    FormsModule,
    RouterLink,
    ToastModule,
    SkeletonModule,
    PopoverModule,
    DatePickerModule,
    TicketThread,
    MarkdownEditor,
    TicketTitleEditor,
    SlaBadge,
    ArchivedTag,
  ],
  providers: [MessageService],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ticketsService = inject(TicketsService);
  private readonly attachmentsService = inject(TicketAttachmentsService);
  private readonly categoriesService = inject(TicketCategoriesService);
  private readonly statusesService = inject(StatusesService);
  private readonly projectsService = inject(ProjectsService);
  private readonly membersService = inject(MembersService);
  private readonly teamsService = inject(TeamsService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ticket = signal<Ticket | null>(null);
  readonly descriptionMaxLength = TICKET_DESCRIPTION_MAX_LENGTH;
  /** loading → skeleton · ready → content · not-found → 404 · error → load failed (retryable). */
  readonly loadState = signal<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  readonly loadErrorStatus = signal<number | null>(null);
  private currentId: string | null = null;

  readonly statuses = signal<Status[]>([]);
  readonly categories = signal<TicketCategory[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly members = signal<OrgMember[]>([]);

  readonly assigneeSearch = signal('');
  readonly projectSearch = signal('');
  readonly linkSearch = signal('');
  readonly linkResults = signal<Ticket[]>([]);

  /** Tickets already linked to this one (rendered in the sidebar). */
  readonly linkedTickets = computed<TicketRelation[]>(() => this.ticket()?.relatedTickets ?? []);

  /** Search hits minus this ticket itself and anything already linked. */
  readonly linkCandidates = computed(() => {
    const currentId = this.ticket()?.id;
    const linked = new Set(this.linkedTickets().map((relation) => relation.id));
    return this.linkResults().filter(
      (candidate) => candidate.id !== currentId && !linked.has(candidate.id),
    );
  });

  readonly priorities: { value: Priority; label: string }[] = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
  ];

  readonly activeStatuses = computed(() => this.statuses().filter((status) => !status.isArchived));

  /**
   * Resolves the auth-user IDs that belong to the ticket's current team.
   * Uses switchMap so changing the team automatically cancels the previous request.
   * null = no team selected → show all org members.
   */
  private readonly teamMemberUserIds = toSignal(
    toObservable(computed(() => this.ticket()?.teamId ?? null)).pipe(
      switchMap((teamId) => {
        if (!teamId) return of(null);
        return this.teamsService.listTeamMembers(teamId).pipe(
          map((rows) => new Set(rows.map((r) => r.userId))),
          // On failure fall back to an empty set (no members), never null — a
          // team with no members must show no assignees, not the whole org.
          catchError(() => of(new Set<string>())),
        );
      }),
    ),
    { initialValue: null as Set<string> | null },
  );

  readonly filteredMembers = computed(() => {
    const query = this.assigneeSearch().trim().toLowerCase();
    const teamUserIds = this.teamMemberUserIds();
    let list = this.members();
    if (teamUserIds) list = list.filter((member) => teamUserIds.has(member.userId));
    if (query) list = list.filter((member) => member.displayName.toLowerCase().includes(query));
    return list;
  });

  /** Active projects plus the ticket's own project when the sync archived it (shown tagged). */
  readonly projectMatches = computed(() =>
    filterProjects(withCurrentProject(this.projects(), this.ticket()?.project), this.projectSearch()),
  );

  readonly categoryName = computed(() => {
    const id = this.ticket()?.categoryId;
    return id ? this.categories().find((category) => category.id === id)?.name ?? null : null;
  });

  readonly teamName = computed(() => {
    const id = this.ticket()?.teamId;
    return id ? this.teams().find((team) => team.id === id)?.name ?? null : null;
  });

  readonly priorityLabel = computed(
    () => this.priorities.find((p) => p.value === this.ticket()?.priority)?.label ?? '',
  );

  readonly dueDateValue = computed(() => {
    const due = this.ticket()?.dueDate;
    return due ? new Date(due) : null;
  });

  /** Overdue = a due date strictly before the start of today (matches the list). */
  readonly isOverdue = computed(() => {
    const due = this.ticket()?.dueDate;
    return !!due && new Date(due) < this.today;
  });

  /** True when every visible team member is already an assignee. */
  readonly allFilteredAssigneesSelected = computed(() => {
    const filtered = this.filteredMembers();
    if (!filtered.length) return false;
    const assigneeIds = new Set((this.ticket()?.assignees ?? []).map((a) => a.memberId));
    return filtered.every((member) => assigneeIds.has(member.id));
  });

  /** True when at least one, but not all, visible members are selected. */
  readonly someFilteredAssigneesSelected = computed(() => {
    const filtered = this.filteredMembers();
    if (!filtered.length) return false;
    const assigneeIds = new Set((this.ticket()?.assignees ?? []).map((a) => a.memberId));
    const count = filtered.filter((member) => assigneeIds.has(member.id)).length;
    return count > 0 && count < filtered.length;
  });

  readonly assigneeAvatars = computed<AssigneeAvatar[]>(() =>
    (this.ticket()?.assignees ?? []).map(toAssigneeAvatar),
  );

  /** Start of today, computed once — used to flag overdue due dates. */
  private readonly today = startOfToday();

  constructor() {
    // Seed from the row we navigated from so the page renders instantly.
    const seeded = this.router.getCurrentNavigation()?.extras.state?.['ticket'] as Ticket | undefined;
    if (seeded) {
      this.ticket.set(seeded);
      this.loadState.set('ready');
    }

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) this.load(id);
    });

    // Ticket search powering the "link a ticket" popover — debounced, server-side.
    toObservable(this.linkSearch)
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((term) =>
          this.ticketsService.getAll({ page: 1, limit: 20, search: term.trim() || undefined }).pipe(
            map((res) => res.data ?? []),
            catchError(() => of<Ticket[]>([])),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => this.linkResults.set(list));
  }

  retry(): void {
    if (this.currentId) this.load(this.currentId);
  }

  private load(id: string): void {
    this.currentId = id;
    const hasSeed = this.ticket()?.id === id;
    // Keep showing a seeded ticket while it refreshes; otherwise show the skeleton.
    this.loadState.set(hasSeed ? 'ready' : 'loading');

    const organizationId = this.authService.organizationId();

    // Options for the inline editors.
    forkJoin({
      statuses: this.statusesService.getAll(),
      categories: this.categoriesService.getAll(),
      projects: this.projectsService.getAll(),
      teams: organizationId ? this.teamsService.getTeams(organizationId) : of([] as Team[]),
      members: organizationId ? this.membersService.getMembers(organizationId) : of([] as OrgMember[]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.statuses.set(res.statuses);
          this.categories.set(res.categories);
          this.projects.set(res.projects);
          this.teams.set(res.teams as Team[]);
          this.members.set(res.members);
        },
        error: (err: unknown) => console.error('Error loading ticket options:', err),
      });

    // Full ticket — best effort; fall back to the seeded row data.
    this.ticketsService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ticket) => {
          if (ticket) {
            this.ticket.set(ticket);
            this.loadState.set('ready');
          } else if (!hasSeed) {
            // 200 but no ticket in the payload — treat as missing.
            this.loadState.set('not-found');
          }
        },
        error: (err: unknown) => {
          console.error('Error loading ticket:', err);
          if (hasSeed) return; // still have the seeded copy to show
          const status = err instanceof HttpErrorResponse ? err.status : 0;
          this.loadErrorStatus.set(status);
          // A real 404 is "not found"; anything else is a load failure the user can retry.
          this.loadState.set(status === 404 ? 'not-found' : 'error');
        },
      });
  }

  // ─── Inline property edits (optimistic + PATCH) ─────────
  private applyPatch(payload: UpdateTicketPayload, optimistic: Partial<Ticket>): void {
    const previous = this.ticket();
    if (!previous) return;
    this.ticket.set({ ...previous, ...optimistic });
    this.ticketsService
      .updateTicket(previous.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // Keep the optimistic value (the PATCH response may omit joined relations).
        next: () => {},
        error: (err: unknown) => {
          console.error('Error updating ticket:', err);
          this.ticket.set(previous);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save change' });
        },
      });
  }

  setStatus(status: Status): void {
    this.applyPatch(
      { ticketStatusId: status.id },
      { ticketStatusId: status.id, ticketStatus: { id: status.id, name: status.name, color: status.color } },
    );
  }

  setPriority(value: Priority): void {
    this.applyPatch({ priority: value }, { priority: value });
  }

  setCategory(category: TicketCategory): void {
    this.applyPatch({ categoryId: category.id }, { categoryId: category.id });
  }

  setTeam(team: Team): void {
    this.applyPatch({ teamId: team.id }, { teamId: team.id });
  }

  setProject(project: Project): void {
    this.applyPatch(
      { projectId: project.id },
      {
        projectId: project.id,
        project: {
          id: project.id,
          customerName: project.customerName,
          workOrderNumber: project.workOrderNumber,
          displayName: project.displayName,
          quoteSubject: project.quoteSubject,
          isArchived: project.isArchived,
          client: project.client,
        },
      },
    );
  }

  projectName(project: NonNullable<Ticket['project']>): string {
    return projectDisplayName(project);
  }

  clearProject(): void {
    this.applyPatch({ projectId: null }, { projectId: undefined, project: null });
  }

  setDueDate(date: Date | null): void {
    this.applyPatch(
      { dueDate: date ? serializeDueDate(date) : null },
      { dueDate: date ? serializeDueDate(date) : undefined },
    );
  }

  toggleAssignee(member: OrgMember): void {
    const current = this.ticket()?.assignees ?? [];
    const exists = current.some((assignee) => assignee.memberId === member.id);
    const nextAssignees = exists
      ? current.filter((assignee) => assignee.memberId !== member.id)
      : [
          ...current,
          { id: member.id, memberId: member.id, member: { id: member.id, user: member.user } },
        ];
    this.applyPatch(
      { assigneeIds: nextAssignees.map((assignee) => assignee.memberId) },
      { assignees: nextAssignees },
    );
  }

  isAssigneeSelected(memberId: string): boolean {
    return (this.ticket()?.assignees ?? []).some((assignee) => assignee.memberId === memberId);
  }

  toggleAllAssignees(): void {
    const ticket = this.ticket();
    if (!ticket) return;
    const filtered = this.filteredMembers();
    const current = ticket.assignees ?? [];
    const currentIds = new Set(current.map((a) => a.memberId));

    if (this.allFilteredAssigneesSelected()) {
      const filteredIds = new Set(filtered.map((m) => m.id));
      const next = current.filter((a) => !filteredIds.has(a.memberId));
      this.applyPatch({ assigneeIds: next.map((a) => a.memberId) }, { assignees: next });
    } else {
      const toAdd = filtered
        .filter((m) => !currentIds.has(m.id))
        .map((m) => ({ id: m.id, memberId: m.id, member: { id: m.id, user: m.user } }));
      const next = [...current, ...toAdd];
      this.applyPatch({ assigneeIds: next.map((a) => a.memberId) }, { assignees: next });
    }
  }

  // ─── Linked tickets (optimistic + PATCH via relatedTicketIds) ──
  link(target: Ticket): void {
    const current = this.ticket();
    if (!current || target.id === current.id) return;
    const existing = current.relatedTickets ?? [];
    if (existing.some((relation) => relation.id === target.id)) return; // already linked

    const next: TicketRelation[] = [
      ...existing,
      {
        id: target.id,
        ticketNumber: target.ticketNumber,
        title: target.title,
        ticketStatus: target.ticketStatus ?? null,
      },
    ];
    this.applyPatch({ relatedTicketIds: next.map((relation) => relation.id) }, { relatedTickets: next });
    this.linkSearch.set('');
  }

  unlink(target: TicketRelation): void {
    const current = this.ticket();
    if (!current) return;
    const next = (current.relatedTickets ?? []).filter((relation) => relation.id !== target.id);
    this.applyPatch({ relatedTicketIds: next.map((relation) => relation.id) }, { relatedTickets: next });
  }

  // ─── Title inline edit (optimistic + PATCH) ─────────────
  commitTitle(title: string): void {
    const previous = this.ticket();
    if (!previous) return;
    const next = title.replace(/\s+/g, ' ').trim();

    // Guard programmatic calls as well as the bounded inline editor.
    if (!next || title.length > TICKET_TITLE_MAX_LENGTH || next === previous.title) return;

    this.ticket.set({ ...previous, title: next });
    this.ticketsService
      .updateTicket(previous.id, { title: next })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {},
        error: (err: unknown) => {
          console.error('Error saving title:', err);
          this.ticket.set(previous);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save title' });
        },
      });
  }

  // ─── Description autosave (WYSIWYG markdown) ────────────
  onDescriptionSave(markdown: string): void {
    if (markdown.length > TICKET_DESCRIPTION_MAX_LENGTH) return;
    const previous = this.ticket();
    if (!previous) return;
    const current = previous.description ?? '';
    if (markdown === current) return; // nothing changed

    // Optimistic; the editor keeps its own content so no re-sync is needed on success.
    this.ticket.set({ ...previous, description: markdown });
    this.ticketsService
      .updateTicket(previous.id, { description: markdown.trim() || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {},
        error: (err: unknown) => {
          console.error('Error saving description:', err);
          this.ticket.set(previous);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save description' });
        },
      });
  }

  /** Upload handler for the description editor (paste / drop / attach). Arrow keeps `this`. */
  readonly uploadAttachment = (file: File) => this.attachmentsService.upload(file);

  // ─── Helpers ────────────────────────────────────────────
  safeStatusColor(color?: string | null): string {
    return safeStatusColorUtil(color);
  }

  priorityDotClass(priority?: string | null): string {
    return `prio-dot prio-dot-${(priority ?? 'medium').toLowerCase()}`;
  }

  memberInitials(member: OrgMember): string {
    return initialsFrom(member.displayName || member.user?.name || member.user?.email || '');
  }

  memberAvatarClass(member: OrgMember): string {
    return getAvatarClass(member.displayName || member.id);
  }
}
