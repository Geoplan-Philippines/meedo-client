import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { ProjectsService } from '../../../tickets/services/projects.service';
import {
  ProjectDetail,
  ProjectListFilters,
  ProjectRecord,
  ProjectSyncResult,
  UpdateProjectPayload,
} from '../models/project-admin.model';

/** Server maximum for maintenance lists. */
const PAGE_SIZE = 200;

@Injectable({ providedIn: 'root' })
export class ProjectAdminService {
  private readonly http = inject(HttpClient);
  private readonly ticketProjects = inject(ProjectsService);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/projects`;

  create(name: string, clientId: string) {
    return this.http.post<ApiResponse<ProjectRecord>>(this.baseUrl, { name: name.trim(), clientId }, { withCredentials: true }).pipe(map(res => res.data), tap(() => this.ticketProjects.invalidate()));
  }
  members(id: string) {
    return this.http.get<ApiResponse<{ userId: string; user: { id: string; name: string | null; email: string } }[]>>(`${this.baseUrl}/${id}/members`, { withCredentials: true }).pipe(map(res => res.data));
  }
  memberOptions() {
    return this.http.get<ApiResponse<{ user: { id: string; name: string | null; email: string } }[]>>(`${this.baseUrl}/member-options`, { withCredentials: true }).pipe(map(res => res.data.map(row => row.user)));
  }
  addMember(id: string, userId: string) { return this.http.post(`${this.baseUrl}/${id}/members`, { userId }, { withCredentials: true }); }
  removeMember(id: string, userId: string) { return this.http.delete(`${this.baseUrl}/${id}/members/${userId}`, { withCredentials: true }); }
  setClosed(id: string, isClosed: boolean) { return this.http.patch<ApiResponse<ProjectRecord>>(`${this.baseUrl}/${id}/closed`, { isClosed }, { withCredentials: true }).pipe(map(res => res.data)); }
  setArchived(id: string, isArchived: boolean) { return this.http.patch<ApiResponse<ProjectRecord>>(`${this.baseUrl}/${id}/archive`, { isArchived }, { withCredentials: true }).pipe(map(res => res.data), tap(() => this.ticketProjects.invalidate())); }

  /** Every project matching the filters (all pages; the screen groups them by client). */
  listAll(filters: ProjectListFilters): Observable<ProjectRecord[]> {
    return this.fetchPage(filters, 1).pipe(
      switchMap((first) => {
        const rest = Array.from({ length: Math.max(0, first.meta.lastPage - 1) }, (_, i) => this.fetchPage(filters, i + 2));
        return rest.length
          ? forkJoin(rest).pipe(map((pages) => [first, ...pages].flatMap((page) => page.data)))
          : of(first.data);
      }),
    );
  }

  statuses(): Observable<string[]> {
    return this.http
      .get<ApiResponse<string[]>>(`${this.baseUrl}/statuses`, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  detail(id: string): Observable<ProjectDetail> {
    return this.http
      .get<ApiResponse<ProjectDetail>>(`${this.baseUrl}/${id}`, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  /** Admin only. Ticket pickers are refreshed so they show the new name or client. */
  update(id: string, payload: UpdateProjectPayload): Observable<ProjectRecord> {
    return this.http
      .patch<ApiResponse<ProjectRecord>>(`${this.baseUrl}/${id}`, payload, { withCredentials: true })
      .pipe(
        map((response) => response.data),
        tap(() => this.ticketProjects.invalidate()),
      );
  }

  /** Runs the Apptivo sync (GET-only on the Apptivo side); can take a while on a big import. */
  sync(): Observable<ProjectSyncResult> {
    return this.http
      .post<ApiResponse<ProjectSyncResult>>(`${this.baseUrl}/sync`, {}, { withCredentials: true })
      .pipe(
        map((response) => response.data),
        tap(() => this.ticketProjects.invalidate()),
      );
  }

  private fetchPage(filters: ProjectListFilters, page: number): Observable<PaginatedApiResponse<ProjectRecord>> {
    const params: Record<string, string | number | boolean> = {
      page,
      limit: PAGE_SIZE,
      sortField: filters.sortField,
      sortOrder: filters.sortOrder,
    };
    if (filters.search.trim()) params['search'] = filters.search.trim();
    if (filters.unassigned) params['unassigned'] = true;
    else if (filters.clientId) params['clientId'] = filters.clientId;
    if (filters.teamId) params['teamId'] = filters.teamId;
    if (filters.status) params['status'] = filters.status;
    if (filters.includeArchived) params['includeArchived'] = true;
    if (filters.includeClosed === false) params['includeClosed'] = false;

    return this.http.get<PaginatedApiResponse<ProjectRecord>>(this.baseUrl, { params, withCredentials: true });
  }
}
