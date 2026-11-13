import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment.dev';
import { cacheContext } from '../../../core/http/api-cache';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { toHttpParams } from '../../../shared/data/page-query';
import { ListQuery, ListStateConfig } from '../../../shared/data/url-list-state';
import { Lead, LeadsStatsResponse, Subscriber } from '../models/crm.model';

export const LEAD_SORT_FIELDS = ['createdAt', 'firstName', 'lastName', 'email', 'company', 'phoneNumber', 'status'] as const;
export const LEADS_LIST: ListStateConfig<{ status: string | null }> = {
  pageSize: 25,
  sortField: 'createdAt',
  sortOrder: 'desc',
  sortFields: LEAD_SORT_FIELDS,
  filters: { status: null },
};
export type LeadsQuery = ListQuery<{ status: string | null }>;

export const SUBSCRIBERS_LIST: ListStateConfig = {
  pageSize: 25,
  sortField: 'createdAt',
  sortOrder: 'desc',
  sortFields: ['createdAt', 'email', 'name'],
};

@Injectable({
  providedIn: 'root',
})
export class CrmService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/crm`;

  /** One page of leads; search, sort and status are applied by the API. */
  listLeads(query: LeadsQuery): Observable<PaginatedApiResponse<Lead>> {
    return this.http.get<PaginatedApiResponse<Lead>>(`${this.baseUrl}/leads`, {
      params: toHttpParams(query),
      context: cacheContext('crm'),
      withCredentials: true,
    });
  }

  /** Authenticated GET /crm/leads/stats. */
  getLeadsStats(): Observable<LeadsStatsResponse> {
    return this.http.get<LeadsStatsResponse>(`${this.baseUrl}/leads/stats`, {
      context: cacheContext('crm'),
      withCredentials: true,
    });
  }

  /** One page of newsletter subscribers. */
  listSubscribers(query: ListQuery): Observable<PaginatedApiResponse<Subscriber>> {
    return this.http.get<PaginatedApiResponse<Subscriber>>(`${this.baseUrl}/newsletter/subscribers`, {
      params: toHttpParams(query),
      context: cacheContext('crm'),
      withCredentials: true,
    });
  }
}
