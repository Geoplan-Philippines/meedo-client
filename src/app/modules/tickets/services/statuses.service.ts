import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment.dev';

export interface Status {
  id: string;
  name: string;
  color: string;
  isArchived: boolean;
  organizationId: string;
}

@Injectable({ providedIn: 'root' })
export class StatusesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/statuses`;

  getAll() {
    return this.http.get<Status[]>(this.baseUrl, {
      withCredentials: true,
    });
  }
}