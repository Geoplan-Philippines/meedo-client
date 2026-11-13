import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment.dev';
import { cacheContext } from '../../../core/http/api-cache';
import {
  CreateTicketCategoryPayload,
  TicketCategory,
  UpdateTicketCategoryPayload,
} from '../models/ticket-categories.model';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { PageQuery, toHttpParams } from '../../../shared/data/page-query';
import { ListStateConfig } from '../../../shared/data/url-list-state';

export const CATEGORIES_LIST: ListStateConfig = {
  pageSize: 25,
  sortField: 'name',
  sortOrder: 'asc',
  sortFields: ['name', 'createdAt', 'updatedAt'],
};

/**
 * Categories are an organization's short, admin-managed list; pickers take
 * the first page by name (the API caps a page at 50).
 */
export const CATEGORY_OPTIONS_QUERY: PageQuery = { page: 1, limit: 50, sortField: 'name', sortOrder: 'asc' };

@Injectable({ providedIn: 'root' })
export class TicketCategoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/ticket-categories`;

  /** One page of categories; search and sort are applied by the API. */
  list(query: PageQuery): Observable<PaginatedApiResponse<TicketCategory>> {
    return this.http.get<PaginatedApiResponse<TicketCategory>>(this.baseUrl, {
      params: toHttpParams(query),
      context: cacheContext('lookups'),
    });
  }

  /** Category options for ticket pickers and filters. */
  options(): Observable<TicketCategory[]> {
    return this.list(CATEGORY_OPTIONS_QUERY).pipe(map((res) => res.data));
  }

  create(payload: CreateTicketCategoryPayload): Observable<TicketCategory> {
    return this.http
      .post<ApiResponse<TicketCategory>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateTicketCategoryPayload): Observable<TicketCategory> {
    return this.http
      .patch<ApiResponse<TicketCategory>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<TicketCategory> {
    return this.http
      .delete<ApiResponse<TicketCategory>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }
}
