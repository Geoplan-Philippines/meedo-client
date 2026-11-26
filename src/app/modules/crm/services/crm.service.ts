import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment.dev';
import { cacheContext } from '../../../core/http/api-cache';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { toHttpParams } from '../../../shared/data/page-query';
import { ListQuery, ListStateConfig } from '../../../shared/data/url-list-state';
import { Lead, LeadStatus, LeadsStatsResponse, Subscriber } from '../models/crm.model';

export const LEAD_SORT_FIELDS = ['createdAt', 'receivedAt', 'firstName', 'lastName', 'email', 'company', 'phoneNumber', 'status', 'source'] as const;
export const LEADS_LIST: ListStateConfig<{ status: string | null; archived: boolean }> = {
  pageSize: 25,
  sortField: 'createdAt',
  sortOrder: 'desc',
  sortFields: LEAD_SORT_FIELDS,
  filters: { status: null, archived: false },
};
export type LeadsQuery = ListQuery<{ status: string | null; archived: boolean }>;

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
  private leadsUrl = `${this.baseUrl}/leads`;
  private subscribersUrl = `${this.baseUrl}/newsletter/subscribers`;

  listLeads(query: LeadsQuery): Observable<PaginatedApiResponse<Lead>> {
    return this.http.get<PaginatedApiResponse<Lead>>(this.leadsUrl, {
      params: toHttpParams(query),
      context: cacheContext('crm'),
      withCredentials: true,
    });
  }

  getLeadsStats(): Observable<LeadsStatsResponse> {
    return this.http.get<LeadsStatsResponse>(`${this.leadsUrl}/stats`, {
      context: cacheContext('crm'),
      withCredentials: true,
    });
  }

  getLead(id: string): Observable<Lead> {
    return this.http
      .get<ApiResponse<Lead>>(`${this.leadsUrl}/${id}`, { context: cacheContext('crm'), withCredentials: true })
      .pipe(map((response) => response.data));
  }

  createLead(values: Record<string, unknown>): Observable<Lead> {
    return this.http
      .post<ApiResponse<Lead>>(`${this.leadsUrl}/admin`, { values }, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  updateLead(id: string, values: Record<string, unknown>): Observable<Lead> {
    return this.http
      .patch<ApiResponse<Lead>>(`${this.leadsUrl}/${id}`, { values }, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  updateLeadStatus(id: string, status: LeadStatus): Observable<Lead> {
    return this.http
      .patch<ApiResponse<Lead>>(`${this.leadsUrl}/${id}/status`, { status }, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  archiveLead(id: string): Observable<Lead> {
    return this.http
      .patch<ApiResponse<Lead>>(`${this.leadsUrl}/${id}/archive`, {}, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  restoreLead(id: string): Observable<Lead> {
    return this.http
      .patch<ApiResponse<Lead>>(`${this.leadsUrl}/${id}/restore`, {}, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  exportLeads(query: LeadsQuery) {
    return this.http.get(`${this.leadsUrl}/export`, {
      params: toHttpParams(query),
      responseType: 'blob',
      observe: 'response',
      withCredentials: true,
    });
  }

  listSubscribers(query: ListQuery): Observable<PaginatedApiResponse<Subscriber>> {
    return this.http.get<PaginatedApiResponse<Subscriber>>(this.subscribersUrl, {
      params: toHttpParams(query),
      context: cacheContext('crm'),
      withCredentials: true,
    });
  }
}
