import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { PaginatedProjects } from '../models/projects.model';

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
