import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import {
  CreateWeeklySchedulePayload,
  SetScheduleDaysPayload,
  UpdateWeeklySchedulePayload,
  WeeklySchedule,
} from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class WeeklySchedulesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/attendance/weekly-schedules`;

  list(): Observable<WeeklySchedule[]> {
    return this.http.get<ApiResponse<WeeklySchedule[]>>(this.baseUrl).pipe(map((res) => res.data));
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
