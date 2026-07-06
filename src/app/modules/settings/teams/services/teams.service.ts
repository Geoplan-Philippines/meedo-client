import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment.dev';
import { CreateTeamPayload, Team, TeamMember } from '../models/teams.model';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth/organization`;

  getTeams(organizationId: string) {
    return this.http.get<Team[]>(`${this.baseUrl}/list-teams`, {
      params: { organizationId },
      withCredentials: true,
    });
  }

  /** Better Auth: the user↔team links for one team (used to scope assignees to a team). */
  listTeamMembers(teamId: string) {
    return this.http.get<TeamMember[]>(`${this.baseUrl}/list-team-members`, {
      params: { teamId },
      withCredentials: true,
    });
  }

  createTeam(payload: CreateTeamPayload) {
    return this.http.post<Team>(`${this.baseUrl}/create-team`, payload, {
      withCredentials: true,
    });
  }

  updateTeam(teamId: string, data: { name?: string }) {
    return this.http.post<Team>(
      `${this.baseUrl}/update-team`,
      { teamId, data },
      { withCredentials: true }
    );
  }

  deleteTeam(teamId: string) {
    return this.http.post<void>(
      `${this.baseUrl}/remove-team`,
      { teamId },
      { withCredentials: true }
    );
  }
}
