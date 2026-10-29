import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { ClientListParams, ClientOption, ClientRecord } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/clients`;

  create(name: string) {
    return this.http.post<ApiResponse<ClientRecord>>(this.baseUrl, { name: name.trim() }, { withCredentials: true }).pipe(map(res => res.data));
  }

  list(params: ClientListParams): Observable<PaginatedApiResponse<ClientRecord>> {
    const query: Record<string, string | number | boolean> = { page: params.page, limit: params.limit };
    if (params.search?.trim()) query['search'] = params.search.trim();
    if (params.includeArchived) query['includeArchived'] = true;
    if (params.sortField) query['sortField'] = params.sortField;
    if (params.sortOrder) query['sortOrder'] = params.sortOrder;

    return this.http.get<PaginatedApiResponse<ClientRecord>>(this.baseUrl, { params: query, withCredentials: true });
  }

  get(id: string): Observable<ClientOption> {
    return this.http.get<ApiResponse<ClientOption>>(`${this.baseUrl}/${id}`, { withCredentials: true }).pipe(map(response => response.data));
  }

  /** Every client as { id, name }, sorted by shown name, for pickers and filters. */
  options(includeArchived = false): Observable<ClientOption[]> {
    return this.http
      .get<ApiResponse<ClientOption[]>>(`${this.baseUrl}/options`, {
        params: includeArchived ? { includeArchived: true } : {},
        withCredentials: true,
      })
      .pipe(map((response) => response.data));
  }

  /** Admin only. null or '' resets the shown name to the Apptivo customer name. */
  updateDisplayName(id: string, displayName: string | null): Observable<ClientRecord> {
    return this.http
      .patch<ApiResponse<ClientRecord>>(`${this.baseUrl}/${id}`, { displayName }, { withCredentials: true })
      .pipe(map((response) => response.data));
  }
}
