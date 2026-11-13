import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { PageQuery, toHttpParams } from '../../../../shared/data/page-query';
import { ListStateConfig } from '../../../../shared/data/url-list-state';
import { cacheContext } from '../../../../core/http/api-cache';
import { ProjectsService } from '../../../tickets/services/projects.service';
import {
  ProjectDetail,
  ProjectListFilters,
  ProjectRecord,
  ProjectSyncResult,
  UpdateProjectPayload,
} from '../models/project-admin.model';

export type ProjectListFilterState = {
  status: string | null;
  clientId: string | null;
  includeArchived: boolean;
  includeClosed: boolean;
};

/** Projects screen: newest reported first; filters, sort and page live in the URL. */
export const PROJECTS_LIST: ListStateConfig<ProjectListFilterState> = {
  pageSize: 25,
  sortField: 'reportedDate',
  sortOrder: 'desc',
  sortFields: ['workOrderNumber', 'quoteSubject', 'reportedDate', 'total', 'status', 'createdAt'],
  filters: { status: null, clientId: null, includeArchived: false, includeClosed: true },
};

/** Per-client totals the grouped screen shows in its group headers. */
export type ProjectPageMeta = {
  clientCount?: number;
  clientTotals?: { clientId: string | null; count: number }[];
};

export type ProjectPageQuery = PageQuery & Omit<ProjectListFilters, 'search' | 'sortField' | 'sortOrder'>;

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
  /** Admin picker: one page of organization members not yet on `projectId`, searched by name or email. */
  memberOptions(query: PageQuery & { projectId?: string }): Observable<PaginatedApiResponse<{ user: { id: string; name: string | null; email: string } }>> {
    return this.http.get<PaginatedApiResponse<{ user: { id: string; name: string | null; email: string } }>>(`${this.baseUrl}/member-options`, {
      params: toHttpParams(query),
      context: cacheContext('members'),
      withCredentials: true,
    });
  }
  addMember(id: string, userId: string) { return this.http.post(`${this.baseUrl}/${id}/members`, { userId }, { withCredentials: true }); }
  removeMember(id: string, userId: string) { return this.http.delete(`${this.baseUrl}/${id}/members/${userId}`, { withCredentials: true }); }
  setClosed(id: string, isClosed: boolean) { return this.http.patch<ApiResponse<ProjectRecord>>(`${this.baseUrl}/${id}/closed`, { isClosed }, { withCredentials: true }).pipe(map(res => res.data)); }
  setArchived(id: string, isArchived: boolean) { return this.http.patch<ApiResponse<ProjectRecord>>(`${this.baseUrl}/${id}/archive`, { isArchived }, { withCredentials: true }).pipe(map(res => res.data), tap(() => this.ticketProjects.invalidate())); }

  /**
   * One page of projects matching the filters, with per-client totals for the
   * group headers. The screen groups the page's rows by client.
   */
  list(query: ProjectPageQuery): Observable<PaginatedApiResponse<ProjectRecord, ProjectPageMeta>> {
    const { unassigned, clientId, includeClosed, teamId, ...rest } = query;
    return this.http.get<PaginatedApiResponse<ProjectRecord, ProjectPageMeta>>(this.baseUrl, {
      params: toHttpParams({
        ...rest,
        ...(unassigned ? { unassigned: true } : { clientId }),
        ...(teamId ? { teamId } : {}),
        // Closed projects show by default; only hiding them is sent.
        ...(includeClosed === false ? { includeClosed: false } : {}),
        withClientTotals: true,
      }),
      context: cacheContext('projects'),
      withCredentials: true,
    });
  }

  statuses(): Observable<string[]> {
    return this.http
      .get<ApiResponse<string[]>>(`${this.baseUrl}/statuses`, { context: cacheContext('lookups'), withCredentials: true })
      .pipe(map((response) => response.data));
  }

  detail(id: string): Observable<ProjectDetail> {
    return this.http
      .get<ApiResponse<ProjectDetail>>(`${this.baseUrl}/${id}`, { context: cacheContext('projects'), withCredentials: true })
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
}
