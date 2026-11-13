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
  CreateWeeklySchedulePayload,
  SetScheduleDaysPayload,
  UpdateWeeklySchedulePayload,
  WeeklySchedule,
} from '../models/attendance.model';

export const SCHEDULES_LIST: ListStateConfig = {
  pageSize: 25,
  sortFields: ['name', 'createdAt'],
};

@Injectable({ providedIn: 'root' })
export class WeeklySchedulesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/attendance/weekly-schedules`;

  /** One page of schedules; the default schedule always comes first. */
  list(query: PageQuery): Observable<PaginatedApiResponse<WeeklySchedule>> {
    return this.http.get<PaginatedApiResponse<WeeklySchedule>>(this.baseUrl, {
      params: toHttpParams(query),
      context: cacheContext('attendance'),
    });
  }

  /** Schedules for assignment pickers; an organization has a handful (the API caps a page at 50). */
  options(): Observable<WeeklySchedule[]> {
    return this.list({ page: 1, limit: 50 }).pipe(map((res) => res.data));
  }

  get(id: string): Observable<WeeklySchedule> {
    return this.http
      .get<ApiResponse<WeeklySchedule>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: CreateWeeklySchedulePayload): Observable<WeeklySchedule> {
    return this.http
      .post<ApiResponse<WeeklySchedule>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateWeeklySchedulePayload): Observable<WeeklySchedule> {
    return this.http
      .patch<ApiResponse<WeeklySchedule>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  setDays(id: string, payload: SetScheduleDaysPayload): Observable<WeeklySchedule> {
    return this.http
      .put<ApiResponse<WeeklySchedule>>(`${this.baseUrl}/${id}/days`, payload)
      .pipe(map((res) => res.data));
  }

  setDefault(id: string): Observable<WeeklySchedule> {
    return this.http
      .patch<ApiResponse<WeeklySchedule>>(`${this.baseUrl}/${id}/default`, {})
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<{ id: string }> {
    return this.http
      .delete<ApiResponse<{ id: string }>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }
}
