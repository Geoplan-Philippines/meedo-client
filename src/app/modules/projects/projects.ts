import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ProjectsService } from './services/projects.service';
import { MembersService } from '../tickets/services/members.service';
import { WorkOrdersService } from '../tickets/services/work-orders.service';
import { AuthService } from '../../core/auth/auth.service';
import { OrgMember } from '../tickets/models/members.model';
import { WorkOrder } from '../tickets/models/work-order.model';
import { CreateProjectPayload, Project } from './models/project.model';
import { getAvatarClass } from '../../shared/utils/avatar.utils';
import { initialsFrom } from '../tickets/utils/ticket.utils';
import { serializeDueDate } from '../tickets/utils/ticket.utils';
import {
  PROJECT_PRIORITIES,
  PROJECT_STATES,
  isProjectOverdue,
  projectPriorityLabel,
  projectStateColor,
  projectStateIcon,
  projectStateLabel,
} from './utils/project.utils';

@Component({
  selector: 'app-projects',
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
    NgClass,
    ReactiveFormsModule,
  ],
  providers: [MessageService],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Projects implements OnInit {
  private readonly projectsService = inject(ProjectsService);
  private readonly membersService = inject(MembersService);
  private readonly workOrdersService = inject(WorkOrdersService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly table = viewChild<Table>('dt');

  readonly projects = signal<Project[]>([]);
  readonly totalRecords = signal(0);
  readonly rows = signal(20);
  readonly isLoading = signal(false);
  readonly createDialogVisible = signal(false);
  readonly isSaving = signal(false);
  readonly isLoadingDropdowns = signal(false);

  readonly members = signal<OrgMember[]>([]);
  readonly workOrders = signal<WorkOrder[]>([]);

  readonly states = PROJECT_STATES;
  readonly priorities = PROJECT_PRIORITIES;

  private first = 0;
  private sortField: 'name' | 'state' | 'priority' | 'startDate' | 'targetDate' | 'createdAt' | null =
    'createdAt';
  private sortOrder: 'asc' | 'desc' = 'desc';
  private listRequestId = 0;

  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly createForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    leadMemberId: new FormControl('', { nonNullable: true }),
    memberIds: new FormControl<string[]>([], { nonNullable: true }),
    startDate: new FormControl<Date | null>(null),
    targetDate: new FormControl<Date | null>(null),
    priority: new FormControl<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | ''>('', { nonNullable: true }),
    workOrderId: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadDropdowns();
    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applySearch());
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.first = event.first ?? 0;
    this.rows.set(event.rows ?? 20);
    const sortField = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
    if (sortField && this.isSortField(sortField)) {
      this.sortField = sortField;
      this.sortOrder = event.sortOrder === 1 ? 'asc' : 'desc';
    }
    this.fetchProjects();
  }

  openProject(project: Project): void {
    this.router.navigate(['/projects', project.id, 'tasks']);
  }

  openCreateDialog(): void {
    this.createForm.reset({
      name: '',
      description: '',
      leadMemberId: '',
      memberIds: [],
      startDate: null,
      targetDate: null,
      priority: '',
      workOrderId: '',
    });
    this.createDialogVisible.set(true);
  }

  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
  }

  saveProject(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const form = this.createForm.getRawValue();
    const payload: CreateProjectPayload = {
      name: form.name.trim(),
    };

    const description = form.description.trim();
    if (description) payload.description = description;
    if (form.leadMemberId) payload.leadMemberId = form.leadMemberId;
    if (form.memberIds.length) payload.memberIds = form.memberIds;
    if (form.startDate) payload.startDate = serializeDueDate(form.startDate);
    if (form.targetDate) payload.targetDate = serializeDueDate(form.targetDate);
    if (form.priority) payload.priority = form.priority;
    if (form.workOrderId) payload.workOrderId = form.workOrderId;

    this.isSaving.set(true);
    this.projectsService
      .create(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: (project) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Project created',
            detail: `"${project.name}" is ready`,
          });
          this.createDialogVisible.set(false);
          this.router.navigate(['/projects', project.id, 'tasks']);
        },
        error: (err: unknown) => {
          console.error('Error creating project:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create project',
          });
        },
      });
  }

  leadName(project: Project): string {
    const user = project.lead?.user;
    return user?.name ?? user?.email ?? '—';
  }

  leadInitials(project: Project): string {
    return initialsFrom(this.leadName(project));
  }

  leadAvatarClass(project: Project): string {
    return getAvatarClass(project.lead?.user?.name ?? project.lead?.id ?? '');
  }

  stateLabel = projectStateLabel;
  stateIcon = projectStateIcon;
  stateColor = projectStateColor;
  priorityLabel = projectPriorityLabel;
  isOverdue = isProjectOverdue;

  private loadDropdowns(): void {
    this.isLoadingDropdowns.set(true);
    const organizationId = this.authService.organizationId();

    this.membersService
      .getMembers(organizationId ?? '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          this.members.set(members);
          this.isLoadingDropdowns.set(false);
        },
        error: () => this.isLoadingDropdowns.set(false),
      });

    this.workOrdersService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (workOrders) => this.workOrders.set(workOrders),
        error: (err: unknown) => console.error('Error loading work orders:', err),
      });
  }

  private fetchProjects(): void {
    const requestId = ++this.listRequestId;
    this.isLoading.set(true);

    this.projectsService
      .getAll({
        page: Math.floor(this.first / this.rows()) + 1,
        limit: this.rows(),
        search: this.searchControl.value.trim() || undefined,
        sortField: this.sortField ?? undefined,
        sortOrder: this.sortOrder,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res) => {
          if (requestId !== this.listRequestId) return;
          this.projects.set(res.data);
          this.totalRecords.set(res.meta.total);
        },
        error: (err: unknown) => {
          if (requestId !== this.listRequestId) return;
          console.error('Error loading projects:', err);
          this.projects.set([]);
          this.totalRecords.set(0);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load projects',
          });
        },
      });
  }

  private applySearch(): void {
    const table = this.table();
    if (table) {
      table.reset();
    } else {
      this.first = 0;
      this.fetchProjects();
    }
  }

  private isSortField(value: string): value is NonNullable<typeof this.sortField> {
    return ['name', 'state', 'priority', 'startDate', 'targetDate', 'createdAt'].includes(value);
  }
}
