import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../../environments/environment.dev';
import { cacheContext } from '../../../../core/http/api-cache';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { PageQuery, toHttpParams } from '../../../../shared/data/page-query';
import { ListStateConfig } from '../../../../shared/data/url-list-state';
import { ClientListParams, ClientOption, ClientRecord } from '../models/client.model';

/** All Clients: A–Z by shown name; "Show archived" lives in the URL too. */
export const CLIENTS_LIST: ListStateConfig<{ includeArchived: boolean }> = {
  pageSize: 25,
  sortField: 'name',
  sortOrder: 'asc',
  sortFields: ['name', 'projectCount', 'createdAt'],
  filters: { includeArchived: false },
};

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/clients`;

  create(name: string) {
    return this.http.post<ApiResponse<ClientRecord>>(this.baseUrl, { name: name.trim() }, { withCredentials: true }).pipe(map(res => res.data));
  }

  /** One page of clients with project counts; search, sort and the archived filter are applied by the API. */
  list(params: ClientListParams): Observable<PaginatedApiResponse<ClientRecord>> {
    return this.http.get<PaginatedApiResponse<ClientRecord>>(this.baseUrl, {
      params: toHttpParams(params),
      context: cacheContext('clients'),
      withCredentials: true,
    });
  }

  get(id: string): Observable<ClientOption> {
    return this.http
      .get<ApiResponse<ClientOption>>(`${this.baseUrl}/${id}`, { context: cacheContext('clients'), withCredentials: true })
      .pipe(map(response => response.data));
  }

  /** Picker rows: one page of clients as { id, name } sorted by shown name, narrowed by search. */
  options(query: PageQuery & { includeArchived?: boolean }): Observable<PaginatedApiResponse<ClientOption>> {
    return this.http.get<PaginatedApiResponse<ClientOption>>(`${this.baseUrl}/options`, {
      params: toHttpParams(query),
      context: cacheContext('clients'),
      withCredentials: true,
    });
  }

  /** Admin only. null or '' resets the shown name to the Apptivo customer name. */
  updateDisplayName(id: string, displayName: string | null): Observable<ClientRecord> {
    return this.http
      .patch<ApiResponse<ClientRecord>>(`${this.baseUrl}/${id}`, { displayName }, { withCredentials: true })
      .pipe(map((response) => response.data));
  }
}
