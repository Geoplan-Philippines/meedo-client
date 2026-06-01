import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment.dev';

export interface Team {
  id: string;
  name: string;
  description?: string;
  isArchived: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamPayload {
  name: string;
  description?: string;
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/teams`;

  getTeams() {
    return this.http.get<{ data: Team[] }>(this.baseUrl);
  }

  createTeam(payload: CreateTeamPayload) {
    return this.http.post<{ data: Team }>(this.baseUrl, payload);
  }

  updateTeam(id: string, payload: UpdateTeamPayload) {
    return this.http.patch<{ data: Team }>(`${this.baseUrl}/${id}`, payload);
  }

  deleteTeam(id: string) {
    return this.http.delete<{ data: Team }>(`${this.baseUrl}/${id}`);
  }
}