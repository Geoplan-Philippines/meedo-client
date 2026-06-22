import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { forkJoin, of, debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { Table, TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { TicketsService } from './services/tickets.service';
import { TicketCategoriesService } from './services/ticket-categories.service';
import { StatusesService } from './services/statuses.service';
import { ProjectsService } from './services/projects.service';
import { TeamsService } from '../settings/teams/services/teams.service';
import { MembersService } from './services/members.service';
import { AuthService } from '../../core/auth/auth.service';
import { TicketThread } from './ticket-thread/ticket-thread';

import { OrgMember } from './models/members.model';
import { Project } from './models/projects.model';
import { Status } from './models/status.model';
import { TicketCategory } from './models/ticket-categories.model';
import { CreateTicketPayload, Ticket, UpdateTicketPayload } from './models/ticket.model';
import { TicketStats } from './models/ticket-stats.model';
import { Team } from '../settings/teams/models/teams.model';

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
    DatePipe,
    TitleCasePipe,
    ReactiveFormsModule,
    TicketThread,
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
  private readonly destroyRef = inject(DestroyRef);

  private readonly table = viewChild<Table>('dt');

  // List state (server-side pagination / sort / filter)
  readonly tickets = signal<Ticket[]>([]);
  readonly totalRecords = signal(0);
  readonly rows = signal(10);
  readonly isLoading = signal(false);

  private first = 0;
  private sortField: string | null = null;
  private sortOrder: 'asc' | 'desc' | null = null;
  private ticketsRequestId = 0;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusFilterControl = new FormControl<string | null>(null);
  readonly priorityFilterControl = new FormControl<string | null>(null);
  readonly searchTerm = signal('');

  readonly stats = signal<TicketStats>({ total: 0, urgent: 0, high: 0, overdue: 0 });

  readonly minDueDate = (() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  })();

  readonly createDialogVisible = signal(false);
  readonly detailDialogVisible = signal(false);
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

  readonly priorities = [
    { label: 'Low', value: 'LOW' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'High', value: 'HIGH' },
    { label: 'Urgent', value: 'URGENT' },
  ];

  readonly ticketForm = this.buildTicketForm();
  readonly editTicketForm = this.buildTicketForm();

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());

    this.statusFilterControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());

    this.priorityFilterControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());
  }

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadStats();
    // The lazy p-table fires (onLazyLoad) on init, which loads the first page.
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
    this.sortField = sortField ?? null;
    this.sortOrder = event.sortOrder === 1 ? 'asc' : event.sortOrder === -1 ? 'desc' : null;
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
        ticketStatusId: this.statusFilterControl.value || undefined,
        priority: this.priorityFilterControl.value || undefined,
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

  private loadStats(): void {
    this.ticketsService
      .getStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => this.stats.set(stats),
        error: (err: unknown) => console.error('Error loading ticket stats:', err),
      });
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

  /**
   * The date picker returns a Date at LOCAL midnight (e.g. 2026-06-18T00:00:00+08:00).
   * Calling .toISOString() shifts it to UTC, which can roll the calendar date back a day
   * (→ 2026-06-17T16:00:00Z), making the backend treat today's date as a past date.
   * We instead build the timestamp from the picked Y/M/D at UTC midnight so the calendar
   * date the user selected is preserved regardless of timezone.
   */
  private toDueDateIso(date: Date | null): string | null {
    if (!date) return null;
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
  }

  getMemberNames(ticket: Ticket): string {
    const assignees = ticket.assignees ?? [];
    if (!assignees.length) return '—';
    return assignees.map(a => a.member?.user?.name ?? a.member?.user?.email ?? a.memberId).join(', ');
  }

  private readonly hexColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

  /** Only let validated hex colors from the API into inline styles; otherwise fall back to a theme token. */
  safeStatusColor(color?: string | null): string {
    return color && this.hexColorPattern.test(color) ? color : 'var(--text-body)';
  }

  getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      LOW: 'priority-low',
      MEDIUM: 'priority-medium',
      HIGH: 'priority-high',
      URGENT: 'priority-urgent',
    };
    return `priority-badge ${map[priority] ?? 'priority-medium'}`;
  }

  openCreateDialog(): void {
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
    this.createDialogVisible.set(true);
  }

  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
  }

  openDetailDialog(ticket: Ticket): void {
    this.selectedTicket.set(ticket);
    this.detailDialogVisible.set(true);
  }

  closeDetailDialog(): void {
    this.detailDialogVisible.set(false);
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
      dueDate: this.toDueDateIso(formValue.dueDate),
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
          this.loadStats();
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
      dueDate: this.toDueDateIso(formValue.dueDate) ?? undefined,
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
          this.loadStats();
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
