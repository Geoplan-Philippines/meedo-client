import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import {
  AssignmentsResponse,
  EffectiveSchedule,
  EmployeeScheduleAssignment,
  TeamScheduleAssignment,
} from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class ScheduleAssignmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/attendance/assignments`;

  list(): Observable<AssignmentsResponse> {
    return this.http
      .get<ApiResponse<AssignmentsResponse>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }

  assignTeam(teamId: string, weeklyScheduleId: string): Observable<TeamScheduleAssignment> {
    return this.http
      .put<ApiResponse<TeamScheduleAssignment>>(`${this.baseUrl}/teams/${teamId}`, {
        weeklyScheduleId,
      })
      .pipe(map((res) => res.data));
  }

  clearTeam(teamId: string): Observable<{ teamId: string }> {
    return this.http
      .delete<ApiResponse<{ teamId: string }>>(`${this.baseUrl}/teams/${teamId}`)
      .pipe(map((res) => res.data));
  }

  assignEmployee(userId: string, weeklyScheduleId: string): Observable<EmployeeScheduleAssignment> {
    return this.http
      .put<ApiResponse<EmployeeScheduleAssignment>>(`${this.baseUrl}/employees/${userId}`, {
        weeklyScheduleId,
      })
      .pipe(map((res) => res.data));
  }

  clearEmployee(userId: string): Observable<{ userId: string }> {
    return this.http
      .delete<ApiResponse<{ userId: string }>>(`${this.baseUrl}/employees/${userId}`)
      .pipe(map((res) => res.data));
  }

  /** Read-only preview of the schedule/shift that applies to an employee on a date. */
  getEffective(userId: string, date?: string): Observable<EffectiveSchedule> {
    return this.http
      .get<ApiResponse<EffectiveSchedule>>(`${this.baseUrl}/effective/${userId}`, {
        params: date ? { date } : {},
      })
      .pipe(map((res) => res.data));
  }
}
