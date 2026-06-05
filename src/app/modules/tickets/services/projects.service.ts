import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.dev';

export interface Project {
  id: string;
  apptivoId: string;
  workOrderNumber: string;
  customerName: string;
  displayName: string;
  status: string;
  total: number;
  reportedDate: string | null;
}

interface PaginatedProjects {
  data: Omit<Project, 'displayName'>[];
  meta: {
    total: number;
    limit: number;
    page: number;
    lastPage: number;
  };
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/projects`;

  getAll() {
    return this.http
      .get<PaginatedProjects>(this.baseUrl, {
        params: { page: 1, limit: 50 },
        withCredentials: true,
      })
      .pipe(
        map(res =>
          res.data.map(p => ({
            ...p,
            displayName: `${p.workOrderNumber} – ${p.customerName}`,
          })),
        ),
      );
  }
}