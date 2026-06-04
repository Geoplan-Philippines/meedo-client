import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment.dev';

export interface Team {
  id: string;
  name: string;
  isArchived: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamPayload {
  name: string;
  organizationId?: string;
}

export interface UpdateTeamPayload {
  teamId: string;
  data: {
    name?: string;
  };
}

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

  createTeam(payload: CreateTeamPayload) {
    return this.http.post<Team>(`${this.baseUrl}/create-team`, payload, {
      withCredentials: true,
    });
  }

  updateTeam(teamId: string, data: { name?: string; description?: string }) {
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