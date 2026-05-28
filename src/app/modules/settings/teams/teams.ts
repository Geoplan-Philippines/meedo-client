import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TeamsService, Team, CreateTeamPayload, UpdateTeamPayload } from './services/teams.service';
import { Subject, switchMap } from 'rxjs';

@Component({
  selector: 'app-teams',
  imports: [
    RouterLink,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    ConfirmDialogModule,
    ToastModule,
    DatePipe,
    ReactiveFormsModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './teams.html',
  styleUrl: './teams.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class Teams implements OnInit {
  private readonly teamsService = inject(TeamsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new Subject<void>();

  readonly teams = signal<Team[]>([]);
  readonly isLoading = signal(false);
  readonly dialogVisible = signal(false);
  readonly isEditing = signal(false);
  readonly isSaving = signal(false);

  readonly selectedTeam = signal<Team | null>(null);
  readonly teamForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl('', {
      nonNullable: true,
    }),
  });

  ngOnInit(): void {
  this.refresh$
    .pipe(
      switchMap(() => {
        this.isLoading.set(true);
        return this.teamsService.getTeams();
      }),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe({
      next: (res) => {
        this.teams.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading teams:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load teams',
        });
        this.isLoading.set(false);
      },
    });

    this.refresh$.next();
  }
  
  loadTeams(): void {
    this.refresh$.next();
  }

  openCreateDialog(): void {
    this.isEditing.set(false);
    this.selectedTeam.set(null);
    
    this.teamForm.reset({
      name: '',
      description: '',
    });

    this.dialogVisible.set(true);
  }

  openEditDialog(team: Team): void {
    this.isEditing.set(true);
    this.selectedTeam.set(team);

    this.teamForm.patchValue({
      name: team.name,
      description: team.description ?? '',
    });

    this.dialogVisible.set(true);
  }

  saveTeam(): void {
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);

    const formValue = this.teamForm.getRawValue();

    const payload: CreateTeamPayload | UpdateTeamPayload = {
      name: formValue.name.trim(),
      description: formValue.description.trim() || undefined,
    };

    const selectedTeam = this.selectedTeam();

    const request$ = this.isEditing() && selectedTeam
      ? this.teamsService.updateTeam(selectedTeam.id, payload)
      : this.teamsService.createTeam(payload as CreateTeamPayload);

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
    this.teamsService.deleteTeam(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Team deleted',
          });
          this.loadTeams();
        },
        error: (err) => {
          console.error('Error deleting team:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete team',
          });
        },
      });
  }
}
