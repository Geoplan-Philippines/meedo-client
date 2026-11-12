import { DatePipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { catchError, EMPTY, forkJoin, Subject, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Team } from '../teams/models/teams.model';
import { TeamsService } from '../teams/services/teams.service';
import {
  HikvisionDirectoryUser,
  OnboardMemberPayload,
  OrganizationMember,
  OrganizationMemberRole,
  UpdateMemberPayload,
} from './models/users.model';
import { UserService } from './services/user.service';
import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { ClientPager } from '../../../shared/utils/client-pager';

import { MessageModule } from 'primeng/message';
type DialogMode = 'create' | 'edit';

@Component({
  selector: 'app-users',
  imports: [
    MessageModule,
    TagModule,
    SkeletonModule,
    TitleCasePipe,
    PageLayout,
    ListPaginator,
    EmptyState,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    ToastModule,
    DatePipe,
    ReactiveFormsModule,
  ],
  providers: [MessageService],
  templateUrl: './users.html',
  styleUrl: './users.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Users implements OnInit {
  private readonly userService = inject(UserService);
  private readonly teamsService = inject(TeamsService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new Subject<void>();
  private readonly authService = inject(AuthService);

  readonly users = signal<OrganizationMember[]>([]);
  readonly pager = new ClientPager(this.users);
  readonly teams = signal<Team[]>([]);
  readonly biometricUsers = signal<HikvisionDirectoryUser[]>([]);
  readonly isLoadingBiometricUsers = signal(false);
  readonly biometricUsersError = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly dialogVisible = signal(false);
  readonly dialogMode = signal<DialogMode>('create');
  readonly selectedUser = signal<OrganizationMember | null>(null);
  readonly editingUserId = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly roleOptions = signal<{ label: string; value: OrganizationMemberRole }[]>([
    { label: 'Member', value: 'member' },
  ]);

  readonly onboardEmployeeForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
    employeeCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
    biometricsId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
    teamId: new FormControl<string | null>(null),
    role: new FormControl<OrganizationMemberRole>('member', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit(): void {
    this.refresh$
      .pipe(
        switchMap(() => {
          const organizationId = this.authService.organizationId();
          this.isLoading.set(true);
          this.loadError.set(null);

          if (!organizationId) {
            this.isLoading.set(false);
            this.loadError.set('No organization selected.');
            return EMPTY;
          }

          return forkJoin({
            users: this.userService.getUsers(organizationId),
            teams: this.teamsService.getTeams(organizationId),
          }).pipe(
            catchError((error) => {
              console.error('Error loading users:', error);
              this.isLoading.set(false);
              this.loadError.set('Failed to load users and teams. Please try again.');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ users, teams }) => {
        this.users.set(users);
        this.teams.set([...teams].sort((a, b) => a.name.localeCompare(b.name)));
        this.isLoading.set(false);
      });

    this.loadBiometricUsers();
    this.refresh$.next();
  }

  loadUsers(): void {
    this.refresh$.next();
  }

  loadBiometricUsers(): void {
    if (this.isLoadingBiometricUsers()) return;

    this.isLoadingBiometricUsers.set(true);
    this.biometricUsersError.set(null);
    this.userService
      .getHikvisionUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.biometricUsers.set(users);
          this.isLoadingBiometricUsers.set(false);
        },
        error: (error) => {
          console.error('Error loading Hikvision users:', error);
          this.biometricUsersError.set(
            'Hikvision users are unavailable. You can enter the ID manually.',
          );
          this.isLoadingBiometricUsers.set(false);
        },
      });
  }

  openCreateDialog(): void {
    this.dialogMode.set('create');
    this.selectedUser.set(null);
    this.roleOptions.set([{ label: 'Member', value: 'member' }]);
    this.onboardEmployeeForm.controls.role.enable({ emitEvent: false });
    this.onboardEmployeeForm.controls.password.setValidators([
      Validators.required,
      Validators.minLength(8),
      Validators.maxLength(128),
    ]);
    this.onboardEmployeeForm.reset({
      name: '',
      email: '',
      password: '',
      employeeCode: '',
      biometricsId: '',
      teamId: null,
      role: 'member',
    });
    this.onboardEmployeeForm.controls.password.updateValueAndValidity({ emitEvent: false });
    this.saveError.set(null);
    this.dialogVisible.set(true);
  }

  openEditDialog(member: OrganizationMember): void {
    if (this.editingUserId()) return;

    this.editingUserId.set(member.id);
    this.saveError.set(null);

    this.userService
      .getMember(member.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          this.dialogMode.set('edit');
          this.selectedUser.set(member);
          this.roleOptions.set([
            { label: this.formatRole(details.role), value: details.role },
          ]);
          this.onboardEmployeeForm.controls.password.clearValidators();
          this.onboardEmployeeForm.reset({
            name: details.user.name ?? '',
            email: details.user.email,
            password: '',
            employeeCode: details.user.employeeCode ?? '',
            biometricsId: details.user.biometricsId ?? '',
            teamId: details.teamId,
            role: details.role,
          });
          this.onboardEmployeeForm.controls.password.updateValueAndValidity({ emitEvent: false });
          // Role is not editable here; show it as a disabled, informational field.
          this.onboardEmployeeForm.controls.role.disable({ emitEvent: false });
          this.editingUserId.set(null);
          this.dialogVisible.set(true);
        },
        error: (error: HttpErrorResponse) => {
          this.editingUserId.set(null);
          this.messageService.add({
            severity: 'error',
            summary: 'Unable to edit user',
            detail: this.getErrorMessage(error),
          });
        },
      });
  }

  closeDialog(): void {
    if (this.isSaving()) return;
    this.dialogVisible.set(false);
    this.saveError.set(null);
  }

  saveUser(): void {
    if (this.onboardEmployeeForm.invalid || this.isSaving()) {
      this.onboardEmployeeForm.markAllAsTouched();
      return;
    }

    const formValue = this.onboardEmployeeForm.getRawValue();
    const name = formValue.name.trim();

    if (!name) {
      this.onboardEmployeeForm.controls.name.setErrors({ required: true });
      this.onboardEmployeeForm.controls.name.markAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);

    if (this.dialogMode() === 'edit') {
      const selectedUser = this.selectedUser();
      if (!selectedUser) {
        this.isSaving.set(false);
        return;
      }

      const payload: UpdateMemberPayload = {
        name,
        email: formValue.email.trim(),
        employeeCode: formValue.employeeCode.trim() || null,
        biometricsId: formValue.biometricsId.trim() || null,
        teamId: formValue.teamId,
      };

      this.userService
        .updateMember(selectedUser.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.handleSaveSuccess(`${payload.name} was updated.`),
          error: (error: HttpErrorResponse) => this.handleSaveError(error),
        });
      return;
    }

    const payload: OnboardMemberPayload = {
      name,
      email: formValue.email.trim(),
      password: formValue.password,
      role: 'member',
      ...(formValue.employeeCode.trim()
        ? { employeeCode: formValue.employeeCode.trim() }
        : {}),
      ...(formValue.biometricsId.trim()
        ? { biometricsId: formValue.biometricsId.trim() }
        : {}),
      ...(formValue.teamId ? { teamId: formValue.teamId } : {}),
    };

    this.userService
      .onboardMember(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.handleSaveSuccess(`${payload.name} can now sign in.`),
        error: (error: HttpErrorResponse) => this.handleSaveError(error),
      });
  }

  private handleSaveSuccess(detail: string): void {
    const isEditing = this.dialogMode() === 'edit';
    this.isSaving.set(false);
    this.dialogVisible.set(false);
    this.messageService.add({
      severity: 'success',
      summary: isEditing ? 'User updated' : 'User onboarded',
      detail,
    });
    this.loadUsers();
  }

  private handleSaveError(error: HttpErrorResponse): void {
    this.isSaving.set(false);
    this.saveError.set(this.getErrorMessage(error));
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    const message = error.error?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string' && message.trim()) return message;
    return this.dialogMode() === 'edit'
      ? 'Failed to update the user. Please try again.'
      : 'Failed to onboard the user. Please try again.';
  }

  private formatRole(role: OrganizationMemberRole): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }
}
