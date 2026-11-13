import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageModule } from 'primeng/message';
import { TEAMS_LIST, TeamsService } from './services/teams.service';
import { AuthService } from '../../../core/auth/auth.service';
import { injectListState } from '../../../shared/data/url-list-state';
import { pagedList } from '../../../shared/data/paged-list';
import { Team } from './models/teams.model';

@Component({
  selector: 'app-teams',
  imports: [
    PageLayout,
    ListPaginator,
    EmptyState,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ConfirmDialogModule,
    ToastModule,
    IconFieldModule,
    InputIconModule,
    MessageModule,
    DatePipe,
    ReactiveFormsModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './teams.html',
  styleUrl: './teams.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Teams {
  private readonly teamsService = inject(TeamsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);

  readonly list = injectListState(TEAMS_LIST);
  readonly teams = pagedList({
    params: () => this.list.query(),
    load: (query) => this.teamsService.list(query),
    refreshOn: ['teams'],
  });
  readonly dialogVisible = signal(false);
  readonly isEditing = signal(false);
  readonly isSaving = signal(false);
  readonly isDeleting = signal(false);
  readonly selectedTeam = signal<Team | null>(null);
  readonly isAdmin = this.authService.isAdmin;

  readonly teamForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor() {
    this.list.clampToTotal(this.teams);
  }

  onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  loadTeams(): void {
    this.teams.reload();
  }

  openCreateDialog(): void {
    this.isEditing.set(false);
    this.selectedTeam.set(null);
    this.isSaving.set(false);
    this.teamForm.reset({ name: '' });
    this.dialogVisible.set(true);
  }

  openEditDialog(team: Team): void {
    this.isEditing.set(true);
    this.selectedTeam.set(team);
    this.isSaving.set(false);
    this.teamForm.patchValue({ name: team.name });
    this.dialogVisible.set(true);
  }

  saveTeam(): void {
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);

    const formValue = this.teamForm.getRawValue();
    const organizationId = this.authService.organizationId();

    if (!organizationId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No organization selected',
      });
      this.isSaving.set(false);
      return;
    }

    const selectedTeam = this.selectedTeam();

    const request$ = this.isEditing() && selectedTeam
      ? this.teamsService.updateTeam(selectedTeam.id, {
          name: formValue.name.trim(),
        })
      : this.teamsService.createTeam({
          name: formValue.name.trim(),
          organizationId,
        });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: this.isEditing() ? 'Team updated' : 'Team created',
        });
        this.dialogVisible.set(false);
        this.isSaving.set(false);
        this.loadTeams();
      },
      error: (err) => {
        console.error('Error saving team:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save team',
        });
        this.isSaving.set(false);
      },
    });
  }

  confirmDelete(team: Team): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${team.name}"?`,
      header: 'Delete Team',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteTeam(team),
    });
  }

  deleteTeam(team: Team): void {
    this.isDeleting.set(true);

    this.teamsService.deleteTeam(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Team deleted',
          });
          this.isDeleting.set(false);
          this.loadTeams();
        },
        error: (err) => {
          console.error('Error deleting team:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete team',
          });
          this.isDeleting.set(false);
        },
      });
  }
}
