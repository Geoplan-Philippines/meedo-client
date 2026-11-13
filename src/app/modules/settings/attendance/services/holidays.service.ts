import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { PageQuery, toHttpParams } from '../../../../shared/data/page-query';
import { ListStateConfig } from '../../../../shared/data/url-list-state';
import { cacheContext } from '../../../../core/http/api-cache';
import {
  CreateHolidayPayload,
  GenerateHolidaysPayload,
  GenerateHolidaysResult,
  Holiday,
  UpdateHolidayPayload,
} from '../models/attendance.model';

export interface HolidayListQuery extends PageQuery {
  year?: number;
}

export const HOLIDAYS_LIST: ListStateConfig = {
  pageSize: 25,
  sortField: 'date',
  sortOrder: 'asc',
  sortFields: ['date', 'name'],
};

@Injectable({ providedIn: 'root' })
export class HolidaysService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/attendance/holidays`;

  /** One page of holidays, narrowed to a year. */
  list(query: HolidayListQuery): Observable<PaginatedApiResponse<Holiday>> {
    return this.http.get<PaginatedApiResponse<Holiday>>(this.baseUrl, {
      params: toHttpParams(query),
      context: cacheContext('attendance'),
    });
  }

  create(payload: CreateHolidayPayload): Observable<Holiday> {
    return this.http.post<ApiResponse<Holiday>>(this.baseUrl, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateHolidayPayload): Observable<Holiday> {
    return this.http
      .patch<ApiResponse<Holiday>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<{ id: string }> {
    return this.http
      .delete<ApiResponse<{ id: string }>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  /** Delete every holiday in the given year. */
  clearYear(year: number): Observable<{ deleted: number }> {
    return this.http
      .delete<ApiResponse<{ deleted: number }>>(this.baseUrl, { params: { year } })
      .pipe(map((res) => res.data));
  }

  /** Import a year's public holidays from the server's provider (default PH). */
  generate(payload: GenerateHolidaysPayload): Observable<GenerateHolidaysResult> {
    return this.http
      .post<ApiResponse<GenerateHolidaysResult>>(`${this.baseUrl}/generate`, payload)
      .pipe(map((res) => res.data));
  }
}
