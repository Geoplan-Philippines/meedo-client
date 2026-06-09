import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject, forkJoin, of, switchMap, finalize, catchError, tap } from 'rxjs';

import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
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

import { OrgMember } from './models/members.model';
import { Project } from './models/projects.model';
import { Status } from './models/status.model';
import { TicketCategory } from './models/ticket-categories.model';
import { CreateTicketPayload, Ticket, UpdateTicketPayload } from './models/ticket.model';
import { Team } from '../settings/teams/models/teams.model';

@Component({
  selector: 'app-tickets',
  imports: [
    TableModule,
    SkeletonModule,
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

  readonly isLoading = signal(false);
  private readonly loadTrigger$ = new Subject<void>();
  private readonly loadedAt = signal(Date.now());

  readonly tickets = toSignal(
    this.loadTrigger$.pipe(
      switchMap(() => {
        this.isLoading.set(true);
        return this.ticketsService.getAll().pipe(
          tap(() => this.loadedAt.set(Date.now())),
          catchError((err: unknown) => {
            console.error('Error loading tickets:', err);
            return of([] as Ticket[]);
          }),
          finalize(() => this.isLoading.set(false)),
        );
      }),
    ),
    { initialValue: [] as Ticket[] },
  );

  readonly searchTerm = signal('');
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

  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly priorities = [
    { label: 'Low', value: 'LOW' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'High', value: 'HIGH' },
    { label: 'Urgent', value: 'URGENT' },
  ];

  readonly stats = computed(() => {
    const all = this.tickets();
    const now = this.loadedAt();
    return {
      total: all.length,
      urgent: all.filter(t => t.priority === 'URGENT').length,
      high: all.filter(t => t.priority === 'HIGH').length,
      overdue: all.filter(t => t.dueDate && new Date(t.dueDate).getTime() < now).length,
    };
  });

  readonly filteredTickets = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.tickets();
    return this.tickets().filter(t =>
      t.title.toLowerCase().includes(term) ||
      (t.description ?? '').toLowerCase().includes(term)
    );
  });

  readonly ticketForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl('', { nonNullable: true }),
    priority: new FormControl<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM', { nonNullable: true }),
    dueDate: new FormControl<Date | null>(null),
    ticketStatusId: new FormControl('', { nonNullable: true }),
    categoryId: new FormControl('', { nonNullable: true }),
    projectId: new FormControl('', { nonNullable: true }),
    teamId: new FormControl('', { nonNullable: true }),
    assigneeIds: new FormControl<string[]>([], { nonNullable: true }),
  });

  readonly editTicketForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl('', { nonNullable: true }),
    priority: new FormControl<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM', { nonNullable: true }),
    dueDate: new FormControl<Date | null>(null),
    ticketStatusId: new FormControl('', { nonNullable: true }),
    categoryId: new FormControl('', { nonNullable: true }),
    projectId: new FormControl('', { nonNullable: true }),
    teamId: new FormControl('', { nonNullable: true }),
    assigneeIds: new FormControl<string[]>([], { nonNullable: true }),
  }); 

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  ngOnInit(): void {
    this.loadTrigger$.next();
    this.loadDropdowns();
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
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load form data',
          });
          this.isLoadingDropdowns.set(false);
        },
      });
  }

  getMemberNames(ticket: Ticket): string {
    const assignees = ticket.assignees ?? [];
    if (!assignees.length) return '—';
    return assignees.map(a => a.member?.user?.name ?? a.member?.user?.email ?? a.memberId).join(', ');
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

    const payload: UpdateTicketPayload = {
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

    this.ticketsService.updateTicket(ticket.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Ticket updated',
          });
          this.editDialogVisible.set(false);
          this.isUpdating.set(false);
          this.loadTrigger$.next();
        },
        error: (err: unknown) => {
          console.error('Error updating ticket:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update ticket',
          });
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
    const selectedIds = formValue.assigneeIds;

    const payload: CreateTicketPayload = {
      title: formValue.title.trim(),
      description: formValue.description.trim() || undefined,
      priority: formValue.priority,
      dueDate: formValue.dueDate ? formValue.dueDate.toISOString() : undefined,
      ticketStatusId: formValue.ticketStatusId || undefined,
      categoryId: formValue.categoryId || undefined,
      projectId: formValue.projectId || undefined,
      teamId: formValue.teamId || undefined,
      assigneeIds: selectedIds,
    };

    this.ticketsService.createTicket(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ticket) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Ticket created',
          });
          this.createDialogVisible.set(false);
          this.isSaving.set(false);
          this.loadTrigger$.next();
        },
        error: (err: unknown) => {
          console.error('Error creating ticket:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create ticket',
          });
          this.isSaving.set(false);
        },
      });
  }
}
