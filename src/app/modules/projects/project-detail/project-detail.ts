import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, of } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ProjectsService } from '../services/projects.service';
import { MembersService } from '../../tickets/services/members.service';
import { WorkOrdersService } from '../../tickets/services/work-orders.service';
import { AuthService } from '../../../core/auth/auth.service';
import { OrgMember } from '../../tickets/models/members.model';
import { WorkOrder } from '../../tickets/models/work-order.model';
import { Project, UpdateProjectPayload } from '../models/project.model';
import { getAvatarClass } from '../../../shared/utils/avatar.utils';
import { initialsFrom, serializeDueDate } from '../../tickets/utils/ticket.utils';
import {
  PROJECT_PRIORITIES,
  PROJECT_STATES,
  isProjectOverdue,
  projectPriorityLabel,
  projectStateColor,
  projectStateIcon,
  projectStateLabel,
} from '../utils/project.utils';

@Component({
  selector: 'app-project-detail',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    DatePickerModule,
    ToastModule,
    DatePipe,
    ReactiveFormsModule,
  ],
  providers: [MessageService],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetail {
  /** Bound from the parent route param `:projectId`. */
  readonly projectId = input<string>();

  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);
  private readonly membersService = inject(MembersService);
  private readonly workOrdersService = inject(WorkOrdersService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly project = signal<Project | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<'not-found' | 'forbidden' | 'error' | null>(null);
  readonly editDialogVisible = signal(false);
  readonly isSaving = signal(false);
  readonly isLoadingDropdowns = signal(false);

  readonly members = signal<OrgMember[]>([]);
  readonly workOrders = signal<WorkOrder[]>([]);

  readonly states = PROJECT_STATES;
  readonly priorities = PROJECT_PRIORITIES;

  readonly taskCount = computed(() => this.project()?._count.tickets ?? 0);

  readonly editForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    state: new FormControl<Project['state']>('BACKLOG', { nonNullable: true }),
    leadMemberId: new FormControl('', { nonNullable: true }),
    memberIds: new FormControl<string[]>([], { nonNullable: true }),
    startDate: new FormControl<Date | null>(null),
    targetDate: new FormControl<Date | null>(null),
    priority: new FormControl<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | ''>('', { nonNullable: true }),
    workOrderId: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    // paramMap works in the constructor injection context; toObservable() in ngOnInit throws NG0203.
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadProject());
    this.loadDropdowns();
  }

  openEditDialog(): void {
    const project = this.project();
    if (!project) return;

    this.editForm.reset({
      name: project.name,
      description: project.description ?? '',
      state: project.state,
      leadMemberId: project.leadMemberId ?? '',
      memberIds: project.members.map((row) => row.memberId),
      startDate: project.startDate ? new Date(project.startDate) : null,
      targetDate: project.targetDate ? new Date(project.targetDate) : null,
      priority: project.priority ?? '',
      workOrderId: project.workOrderId ?? '',
    });
    this.editDialogVisible.set(true);
  }

  closeEditDialog(): void {
    this.editDialogVisible.set(false);
  }

  saveProject(): void {
    const project = this.project();
    if (!project || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const form = this.editForm.getRawValue();
    const payload: UpdateProjectPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      state: form.state,
      leadMemberId: form.leadMemberId || null,
      memberIds: form.memberIds,
      startDate: form.startDate ? serializeDueDate(form.startDate) : null,
      targetDate: form.targetDate ? serializeDueDate(form.targetDate) : null,
      priority: form.priority || null,
      workOrderId: form.workOrderId || null,
    };

    this.isSaving.set(true);
    this.projectsService
      .update(project.id, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: (updated) => {
          this.project.set(updated);
          this.messageService.add({
            severity: 'success',
            summary: 'Project updated',
            detail: `"${updated.name}" saved`,
          });
          this.editDialogVisible.set(false);
        },
        error: (err: unknown) => {
          console.error('Error updating project:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update project',
          });
        },
      });
  }

  leadName(): string {
    const user = this.project()?.lead?.user;
    return user?.name ?? user?.email ?? 'Unassigned';
  }

  leadInitials(): string {
    return initialsFrom(this.leadName());
  }

  leadAvatarClass(): string {
    const project = this.project();
    return getAvatarClass(project?.lead?.user?.name ?? project?.lead?.id ?? '');
  }

  memberCount(): number {
    return this.project()?.members.length ?? 0;
  }

  stateLabel = projectStateLabel;
  stateIcon = projectStateIcon;
  stateColor = projectStateColor;
  priorityLabel = projectPriorityLabel;
  isOverdue = isProjectOverdue;

  private loadProject(): void {
    const id = this.projectId() ?? this.route.snapshot.paramMap.get('projectId');
    if (!id) {
      this.isLoading.set(false);
      this.loadError.set('not-found');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);
    this.projectsService
      .getById(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (project) => {
          if (project) {
            this.project.set(project);
            return;
          }
          this.project.set(null);
          this.loadError.set('not-found');
        },
        error: (err: unknown) => {
          console.error('Error loading project:', err);
          this.project.set(null);
          const status = err instanceof HttpErrorResponse ? err.status : 0;
          this.loadError.set(status === 404 ? 'not-found' : status === 403 ? 'forbidden' : 'error');
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail:
              status === 403
                ? 'No active organization — sign in again or pick an organization'
                : 'Failed to load project',
          });
        },
      });
  }

  private loadDropdowns(): void {
    this.isLoadingDropdowns.set(true);
    const organizationId = this.authService.organizationId();

    forkJoin({
      members: organizationId ? this.membersService.getMembers(organizationId) : of([] as OrgMember[]),
      workOrders: this.workOrdersService.getAll(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.members.set(res.members);
          this.workOrders.set(res.workOrders);
          this.isLoadingDropdowns.set(false);
        },
        error: () => this.isLoadingDropdowns.set(false),
      });
  }
}
