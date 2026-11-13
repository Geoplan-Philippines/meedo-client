import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../../environments/environment.dev';
import { CreateStatusPayload, Status, UpdateStatusPayload, } from '../models/status.model';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { PageQuery, toHttpParams } from '../../../../shared/data/page-query';
import { ListStateConfig } from '../../../../shared/data/url-list-state';
import { cacheContext } from '../../../../core/http/api-cache';

export interface StatusListQuery extends PageQuery {
  /** true: standard statuses only; false: custom ones only. */
  isSystem?: boolean;
  /** false leaves archived statuses out (the API includes them by default). */
  includeArchived?: boolean;
}

/** Standard statuses keep their workflow order; there are only a handful. */
export const STANDARD_STATUSES_LIST: ListStateConfig = { pageSize: 10, prefix: 'standard' };
export const CUSTOM_STATUSES_LIST: ListStateConfig<{ includeArchived: boolean }> = {
  pageSize: 10,
  sortFields: ['name', 'updatedAt', 'createdAt'],
  filters: { includeArchived: false },
};

@Injectable({ providedIn: 'root' })
export class StatusesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/statuses`;

  /** One page of statuses; standard ones come first in workflow order unless sorted otherwise. */
  list(query: StatusListQuery): Observable<PaginatedApiResponse<Status>> {
    return this.http.get<PaginatedApiResponse<Status>>(this.baseUrl, {
      params: toHttpParams(query),
      context: cacheContext('lookups'),
    });
  }

  create(payload: CreateStatusPayload): Observable<Status> {
    return this.http
      .post<ApiResponse<Status>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateStatusPayload): Observable<Status> {
    return this.http
      .patch<ApiResponse<Status>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  archive(id: string): Observable<Status> {
    return this.http
      .patch<ApiResponse<Status>>(`${this.baseUrl}/${id}/archive`, {})
      .pipe(map((res) => res.data));
  }

  restore(id: string): Observable<Status> {
    return this.http
      .patch<ApiResponse<Status>>(`${this.baseUrl}/${id}/restore`, {})
      .pipe(map((res) => res.data));
  }

}
