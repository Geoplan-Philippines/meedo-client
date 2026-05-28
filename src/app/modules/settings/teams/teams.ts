import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SettingsService, Team, CreateTeamPayload, UpdateTeamPayload } from '../services/settings.service';
import { Badge } from "primeng/badge";

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
    CommonModule,
    FormsModule,
    DatePipe,
    Badge
],
  providers: [ConfirmationService, MessageService],
  templateUrl: './teams.html',
  styleUrl: './teams.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Teams implements OnInit {
private readonly settingsService = inject(SettingsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly teams = signal<Team[]>([]);
  readonly isLoading = signal(false);
  readonly dialogVisible = signal(false);
  readonly isEditing = signal(false);
  readonly isSaving = signal(false);

  selectedTeam: Team | null = null;
  formName = '';
  formDescription = '';

  ngOnInit(): void {
    this.loadTeams();
  }
  loadTeams(): void {
    this.isLoading.set(true);

    this.settingsService.getTeams()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.teams.set(res.data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading teams:', err);
          this.isLoading.set(false);
        },
      });
  }

  openCreateDialog(): void {
    this.isEditing.set(false);
    this.selectedTeam = null;
    this.formName = '';
    this.formDescription = '';
    this.dialogVisible.set(true);
  }

  openEditDialog(team: Team): void {
    this.isEditing.set(true);
    this.selectedTeam = team;
    this.formName = team.name;
    this.formDescription = team.description ?? '';
    this.dialogVisible.set(true);
  }

  saveTeam(): void {
    if (!this.formName.trim()) return;
    this.isSaving.set(true);

    const payload: CreateTeamPayload | UpdateTeamPayload = {
      name: this.formName.trim(),
      description: this.formDescription.trim() || undefined,
    };

    const request$ = this.isEditing() && this.selectedTeam
      ? this.settingsService.updateTeam(this.selectedTeam.id, payload)
      : this.settingsService.createTeam(payload as CreateTeamPayload);

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
    this.settingsService.deleteTeam(team.id)
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
        error: (err) => console.error('Error deleting team:', err),
      });
  }
}
