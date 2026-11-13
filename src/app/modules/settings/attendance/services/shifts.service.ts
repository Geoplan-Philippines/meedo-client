import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { PageQuery, toHttpParams } from '../../../../shared/data/page-query';
import { ListStateConfig } from '../../../../shared/data/url-list-state';
import { cacheContext } from '../../../../core/http/api-cache';
import { CreateShiftPayload, Shift, UpdateShiftPayload } from '../models/attendance.model';

export interface ShiftListQuery extends PageQuery {
  /** false leaves archived shifts out (the API includes them by default). */
  includeArchived?: boolean;
}

export const SHIFTS_LIST: ListStateConfig<{ includeArchived: boolean }> = {
  pageSize: 25,
  filters: { includeArchived: false },
};

@Injectable({ providedIn: 'root' })
export class ShiftsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/attendance/shifts`;

  /** One page of shifts, active before archived, by start time unless sorted otherwise. */
  list(query: ShiftListQuery): Observable<PaginatedApiResponse<Shift, { archivedCount: number }>> {
    return this.http.get<PaginatedApiResponse<Shift, { archivedCount: number }>>(this.baseUrl, {
      params: toHttpParams(query),
      context: cacheContext('attendance'),
    });
  }

  /** Active shifts for schedule pickers; an organization has a handful (the API caps a page at 50). */
  options(): Observable<Shift[]> {
    return this.list({ page: 1, limit: 50, includeArchived: false }).pipe(map((res) => res.data));
  }

  create(payload: CreateShiftPayload): Observable<Shift> {
    return this.http.post<ApiResponse<Shift>>(this.baseUrl, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateShiftPayload): Observable<Shift> {
    return this.http
      .patch<ApiResponse<Shift>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  archive(id: string): Observable<Shift> {
    return this.http
      .patch<ApiResponse<Shift>>(`${this.baseUrl}/${id}/archive`, {})
      .pipe(map((res) => res.data));
  }

  restore(id: string): Observable<Shift> {
    return this.http
      .patch<ApiResponse<Shift>>(`${this.baseUrl}/${id}/restore`, {})
      .pipe(map((res) => res.data));
  }
}
