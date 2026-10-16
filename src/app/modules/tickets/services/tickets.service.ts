import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import {
  CreateTicketPayload,
  Ticket,
  TicketFacets,
  TicketFacetsParams,
  TicketListParams,
  UpdateTicketPayload,
} from '../models/ticket.model';
import { TicketStats } from '../models/ticket-stats.model';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tickets`;

  getAll(params: TicketListParams) {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('limit', params.limit);

    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.view) httpParams = httpParams.set('view', params.view);
    // Multi-select facets go out as repeated params (?ticketStatusId=a&ticketStatusId=b).
    for (const id of params.ticketStatusId ?? []) httpParams = httpParams.append('ticketStatusId', id);
    for (const priority of params.priority ?? []) httpParams = httpParams.append('priority', priority);
    for (const id of params.teamId ?? []) httpParams = httpParams.append('teamId', id);
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId);
    if (params.assigneeId) httpParams = httpParams.set('assigneeId', params.assigneeId);
    if (params.includeArchived !== undefined) httpParams = httpParams.set('includeArchived', params.includeArchived);
    if (params.sortField) httpParams = httpParams.set('sortField', params.sortField);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);

    return this.http.get<PaginatedApiResponse<Ticket>>(this.baseUrl, {
      params: httpParams,
      withCredentials: true,
    });
  }

  getFacets(params: TicketFacetsParams) {
    let httpParams = new HttpParams();
    if (params.view) httpParams = httpParams.set('view', params.view);
    if (params.search) httpParams = httpParams.set('search', params.search);

    for (const id of params.teamId ?? []) httpParams = httpParams.append('teamId', id);
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId);
    if (params.assigneeId) httpParams = httpParams.set('assigneeId', params.assigneeId);
    if (params.includeArchived !== undefined) httpParams = httpParams.set('includeArchived', params.includeArchived);

    return this.http
      .get<ApiResponse<TicketFacets>>(`${this.baseUrl}/facets`, {
        params: httpParams,
        withCredentials: true,
      })
      .pipe(map(res => res.data));
  }

  getStats() {
    return this.http
      .get<ApiResponse<TicketStats>>(`${this.baseUrl}/stats`, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  getById(id: string) {
    return this.http
      .get<ApiResponse<Ticket>>(`${this.baseUrl}/${id}`, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  createTicket(payload: CreateTicketPayload) {
    return this.http
      .post<ApiResponse<Ticket>>(this.baseUrl, payload, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  updateTicket(id: string, payload: UpdateTicketPayload) {
    return this.http
      .patch<ApiResponse<Ticket>>(`${this.baseUrl}/${id}`, payload, { withCredentials: true })
      .pipe(map(res => res.data));
  }
}
