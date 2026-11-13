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
  AssignedSchedule,
  EffectiveSchedule,
  EmployeeScheduleAssignment,
  TeamScheduleAssignment,
} from '../models/attendance.model';

/** A team, or an employee, with the schedule assigned to it directly (null when it falls back). */
export interface TeamAssignmentRow {
  id: string;
  name: string;
  weeklyScheduleId: string | null;
  weeklySchedule: AssignedSchedule | null;
}

export interface EmployeeAssignmentRow {
  userId: string;
  name: string;
  email: string;
  weeklyScheduleId: string | null;
  weeklySchedule: AssignedSchedule | null;
}

/** `assignedCount`: matching rows with a schedule of their own. */
export type AssignmentPageMeta = { assignedCount: number };

export const TEAM_ASSIGNMENTS_LIST: ListStateConfig = { pageSize: 10, prefix: 'team' };
export const EMPLOYEE_ASSIGNMENTS_LIST: ListStateConfig = { pageSize: 10, prefix: 'employee' };

@Injectable({ providedIn: 'root' })
export class ScheduleAssignmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/attendance/assignments`;

  /** One page of teams with their explicit schedule; search matches the team name. */
  listTeams(query: PageQuery): Observable<PaginatedApiResponse<TeamAssignmentRow, AssignmentPageMeta>> {
    return this.http.get<PaginatedApiResponse<TeamAssignmentRow, AssignmentPageMeta>>(`${this.baseUrl}/teams`, {
      params: toHttpParams(query),
      context: cacheContext('attendance'),
    });
  }

  /** One page of employees with their personal schedule; search matches name and email. */
  listEmployees(query: PageQuery): Observable<PaginatedApiResponse<EmployeeAssignmentRow, AssignmentPageMeta>> {
    return this.http.get<PaginatedApiResponse<EmployeeAssignmentRow, AssignmentPageMeta>>(`${this.baseUrl}/employees`, {
      params: toHttpParams(query),
      context: cacheContext('attendance'),
    });
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
