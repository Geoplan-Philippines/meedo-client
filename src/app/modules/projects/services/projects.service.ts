import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import {
  CreateProjectPayload,
  Project,
  ProjectListParams,
  UpdateProjectPayload,
} from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/projects`;

  getAll(params: ProjectListParams) {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('limit', params.limit);

    if (params.search) httpParams = httpParams.set('search', params.search);
    // Multi-select facets go out as repeated params (?state=BACKLOG&state=PLANNED).
    for (const state of params.state ?? []) httpParams = httpParams.append('state', state);
    for (const priority of params.priority ?? []) httpParams = httpParams.append('priority', priority);
    if (params.leadMemberId) httpParams = httpParams.set('leadMemberId', params.leadMemberId);
    if (params.memberId) httpParams = httpParams.set('memberId', params.memberId);
    if (params.includeArchived) httpParams = httpParams.set('includeArchived', true);
    if (params.sortField) httpParams = httpParams.set('sortField', params.sortField);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);

    return this.http.get<PaginatedApiResponse<Project>>(this.baseUrl, {
      params: httpParams,
      withCredentials: true,
    });
  }

  getById(id: string) {
    return this.http
      .get<ApiResponse<Project>>(`${this.baseUrl}/${id}`, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  /** The org's catch-all project; created on first request if it doesn't exist. */
  getInternal() {
    return this.http
      .get<ApiResponse<Project>>(`${this.baseUrl}/internal`, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  create(payload: CreateProjectPayload) {
    return this.http
      .post<ApiResponse<Project>>(this.baseUrl, payload, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  update(id: string, payload: UpdateProjectPayload) {
    return this.http
      .patch<ApiResponse<Project>>(`${this.baseUrl}/${id}`, payload, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  /** Returns the delivery project for an Apptivo work order (creates on first use). */
  getForWorkOrder(workOrderId: string) {
    return this.http
      .get<ApiResponse<Project>>(`${this.baseUrl}/for-work-order/${workOrderId}`, {
        withCredentials: true,
      })
      .pipe(map((res) => res.data));
  }

  archive(id: string) {
    return this.http
      .post<ApiResponse<Project>>(`${this.baseUrl}/${id}/archive`, {}, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  restore(id: string) {
    return this.http
      .post<ApiResponse<Project>>(`${this.baseUrl}/${id}/restore`, {}, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  /** Only permitted for non-internal projects with no tickets. */
  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }
}
