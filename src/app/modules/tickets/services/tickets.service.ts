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
  TicketView,
  UpdateTicketPayload,
} from '../models/ticket.model';
import { cacheContext } from '../../../core/http/api-cache';
import { ListQuery, ListStateConfig } from '../../../shared/data/url-list-state';
import { TicketStats } from '../models/ticket-stats.model';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';

/** URL filters of the ticket list: the view tab and the facet selections. */
export type TicketListFilters = {
  tab: string;
  status: readonly string[];
  priority: readonly string[];
  team: readonly string[];
};

/** Ticket list: newest first; tab, facets, search, sort and page live in the URL. */
export const TICKETS_LIST: ListStateConfig<TicketListFilters> = {
  pageSize: 25,
  sortField: 'createdAt',
  sortOrder: 'desc',
  sortFields: ['title', 'priority', 'dueDate', 'createdAt', 'ticketNumber'],
  filters: { tab: 'all', status: [], priority: [], team: [] },
};

const TICKET_VIEW_VALUES: readonly TicketView[] = ['all', 'active', 'backlog', 'closed'];

export function ticketView(tab: string): TicketView {
  return (TICKET_VIEW_VALUES as readonly string[]).includes(tab) ? (tab as TicketView) : 'all';
}

/** The API query for a ticket list state, plus the page's scope (my tickets, one project). */
export function ticketListParams(
  query: ListQuery<TicketListFilters>,
  scope: { assigneeId?: string; projectId?: string },
): TicketListParams {
  return {
    page: query.page,
    limit: query.limit,
    search: query.search,
    view: ticketView(query.tab),
    ticketStatusId: query.status.length ? [...query.status] : undefined,
    priority: query.priority.length ? [...query.priority] : undefined,
    teamId: query.team.length ? [...query.team] : undefined,
    assigneeId: scope.assigneeId,
    projectId: scope.projectId,
    sortField: query.sortField,
    sortOrder: query.sortOrder,
  };
}

/** Facet counts for the same scope (status selections are left out so their badges stay useful). */
export function ticketFacetParams(params: TicketListParams): TicketFacetsParams {
  return {
    view: params.view,
    search: params.search,
    teamId: params.teamId,
    assigneeId: params.assigneeId,
    projectId: params.projectId,
  };
}

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tickets`;

  getAll(params: TicketListParams) {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('limit', params.limit);

    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.noStatus) httpParams = httpParams.set('noStatus', true);
    if (params.view) httpParams = httpParams.set('view', params.view);
    // Multi-select facets go out as repeated params (?ticketStatusId=a&ticketStatusId=b).
    for (const id of params.ticketStatusId ?? []) httpParams = httpParams.append('ticketStatusId', id);
    for (const priority of params.priority ?? []) httpParams = httpParams.append('priority', priority);
    for (const id of params.teamId ?? []) httpParams = httpParams.append('teamId', id);
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId);
    if (params.projectId) httpParams = httpParams.set('projectId', params.projectId);
    if (params.assigneeId) httpParams = httpParams.set('assigneeId', params.assigneeId);
    if (params.includeArchived !== undefined) httpParams = httpParams.set('includeArchived', params.includeArchived);
    if (params.sortField) httpParams = httpParams.set('sortField', params.sortField);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);

    return this.http.get<PaginatedApiResponse<Ticket>>(this.baseUrl, {
      params: httpParams,
      context: cacheContext('tickets'),
      withCredentials: true,
    });
  }

  getFacets(params: TicketFacetsParams) {
    let httpParams = new HttpParams();
    for (const priority of params.priority ?? []) httpParams = httpParams.append('priority', priority);
    if (params.view) httpParams = httpParams.set('view', params.view);
    if (params.search) httpParams = httpParams.set('search', params.search);

    for (const id of params.teamId ?? []) httpParams = httpParams.append('teamId', id);
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId);
    if (params.projectId) httpParams = httpParams.set('projectId', params.projectId);
    if (params.assigneeId) httpParams = httpParams.set('assigneeId', params.assigneeId);
    if (params.includeArchived !== undefined) httpParams = httpParams.set('includeArchived', params.includeArchived);

    return this.http
      .get<ApiResponse<TicketFacets>>(`${this.baseUrl}/facets`, {
        params: httpParams,
        context: cacheContext('tickets'),
        withCredentials: true,
      })
      .pipe(map(res => res.data));
  }

  getStats() {
    return this.http
      .get<ApiResponse<TicketStats>>(`${this.baseUrl}/stats`, { context: cacheContext('tickets'), withCredentials: true })
      .pipe(map(res => res.data));
  }

  getById(id: string) {
    return this.http
      .get<ApiResponse<Ticket>>(`${this.baseUrl}/${id}`, { context: cacheContext('tickets'), withCredentials: true })
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
