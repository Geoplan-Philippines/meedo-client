import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment.dev';
import { CreateTeamPayload, Team, TeamMember } from '../models/teams.model';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth/organization`;
  /** Our own team endpoints (org-scoped, not gated on the caller's team membership). */
  private readonly teamsUrl = `${environment.apiBaseUrl}/settings/teams`;

  getTeams(organizationId: string) {
    return this.http.get<Team[]>(`${this.baseUrl}/list-teams`, {
      params: { organizationId },
      withCredentials: true,
    });
  }

  /**
   * The members assigned to one team, used to scope ticket assignees.
   * Backed by our own endpoint rather than Better Auth's `list-team-members`,
   * which 400s unless the caller is themselves in the team — that error was
   * silently unscoping the assignee picker to the whole org.
   */
  listTeamMembers(teamId: string) {
    return this.http
      .get<ApiResponse<TeamMember[]>>(`${this.teamsUrl}/${teamId}/members`)
      .pipe(map((res) => res.data));
  }

  /** Assign an organization member to a team (idempotent server-side). */
  addTeamMember(teamId: string, userId: string) {
    return this.http
      .post<ApiResponse<TeamMember>>(`${this.teamsUrl}/${teamId}/members`, { userId })
      .pipe(map((res) => res.data));
  }

  /** Remove a member's assignment from a team (deletes the link only). */
  removeTeamMember(teamId: string, userId: string) {
    return this.http.delete<ApiResponse<{ teamId: string; userId: string }>>(
      `${this.teamsUrl}/${teamId}/members/${userId}`,
    );
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
