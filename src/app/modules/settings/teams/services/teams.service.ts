import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment.dev';
import { CreateTeamPayload, Team, TeamMember } from '../models/teams.model';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { PageQuery, toHttpParams } from '../../../../shared/data/page-query';
import { ListStateConfig } from '../../../../shared/data/url-list-state';
import { cacheContext } from '../../../../core/http/api-cache';

export interface TeamListQuery extends PageQuery {
  /** Only teams the signed-in user belongs to. */
  mine?: boolean;
}

export const TEAMS_LIST: ListStateConfig = {
  pageSize: 25,
  sortField: 'name',
  sortOrder: 'asc',
  sortFields: ['name', 'createdAt', 'memberCount'],
};

/**
 * Teams are a short list per organization (departments), so filters and
 * pickers show the first page by name and search the server for the rest.
 */
export const TEAM_OPTIONS_QUERY: TeamListQuery = { page: 1, limit: 50, sortField: 'name', sortOrder: 'asc' };

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth/organization`;
  /** Our own team endpoints (org-scoped, not gated on the caller's team membership). */
  private readonly teamsUrl = `${environment.apiBaseUrl}/settings/teams`;

  /** One page of the organization's teams with member counts; `mine` keeps the caller's own teams. */
  list(query: TeamListQuery): Observable<PaginatedApiResponse<Team>> {
    return this.http.get<PaginatedApiResponse<Team>>(this.teamsUrl, {
      params: toHttpParams(query),
      context: cacheContext('teams'),
      withCredentials: true,
    });
  }

  /**
   * The members assigned to one team, used to scope ticket assignees.
   * Backed by our own endpoint rather than Better Auth's `list-team-members`,
   * which 400s unless the caller is themselves in the team. That error was
   * silently unscoping the assignee picker to the whole org.
   */
  listTeamMembers(teamId: string) {
    return this.http
      .get<ApiResponse<TeamMember[]>>(`${this.teamsUrl}/${teamId}/members`, { context: cacheContext('teams') })
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
