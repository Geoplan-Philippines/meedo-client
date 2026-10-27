import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY } from 'rxjs';
import { expand, map, reduce } from 'rxjs/operators';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { timesheetProjectLabel } from '../shared/timesheet-project.util';
import {
  BulkApproveResult,
  BulkRejectResult,
  SubmitWeekResult,
  TimesheetAuditLog,
  TimesheetEntry,
  TimesheetEntryPayload,
  TimesheetPeriodLock,
  TimesheetProject,
  TimesheetSummary,
  TimesheetSummaryFilters,
} from '../models/timesheet.model';

@Injectable({ providedIn: 'root' })
export class TimesheetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/timekeeping/timesheet`;

  getEntries(periodStart: string, periodEnd: string) {
    return this.fetchEntriesPage(periodStart, periodEnd, 1).pipe(
      expand((response) =>
        response.meta.page < response.meta.lastPage
          ? this.fetchEntriesPage(periodStart, periodEnd, response.meta.page + 1)
          : EMPTY,
      ),
      reduce((all, response) => all.concat(response.data), [] as TimesheetEntry[]),
      map((entries) => ({ data: entries }))
    );
  }

  private fetchEntriesPage(periodStart: string, periodEnd: string, page: number) {
    return this.http.get<PaginatedApiResponse<TimesheetEntry>>(`${this.baseUrl}/entries`, {
      params: { periodStart, periodEnd, page, limit: 50 },
      withCredentials: true,
    });
  }

  createEntry(payload: TimesheetEntryPayload) {
    return this.http
      .post<ApiResponse<TimesheetEntry>>(`${this.baseUrl}/entries`, payload, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  updateEntry(id: string, payload: Partial<TimesheetEntryPayload>) {
    return this.http
      .patch<ApiResponse<TimesheetEntry>>(`${this.baseUrl}/entries/${id}`, payload, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  deleteEntry(id: string) {
    return this.http.delete<ApiResponse<{ id: string }>>(`${this.baseUrl}/entries/${id}`, { withCredentials: true });
  }

  submitWeek(periodStart: string, periodEnd: string) {
    return this.http
      .post<ApiResponse<SubmitWeekResult>>(
        `${this.baseUrl}/entries/submit-week`,
        { periodStart, periodEnd },
        { withCredentials: true },
      )
      .pipe(map((response) => response.data));
  }

  /**
   * Every project for timesheet pickers. Archived projects are left out unless
   * `includeArchived` (filters over existing entries need them; new entries cannot use them).
   */
  getProjects(includeArchived = false) {
    return this.fetchProjectsPage(1, includeArchived).pipe(
      expand((response) =>
        response.meta.page < response.meta.lastPage
          ? this.fetchProjectsPage(response.meta.page + 1, includeArchived)
          : EMPTY,
      ),
      reduce((all, response) => all.concat(response.data), [] as TimesheetProject[]),
      map((projects) =>
        projects.map((project) => {
          const customerName = project.customerName?.trim() || project.client?.customerName?.trim() || '';
          const label = timesheetProjectLabel({ ...project, customerName });
          return { ...project, customerName, label: project.isArchived ? `${label} (Archived)` : label };
        }),
      ),
    );
  }

  private fetchProjectsPage(page: number, includeArchived: boolean) {
    return this.http.get<PaginatedApiResponse<TimesheetProject>>(`${this.baseUrl}/projects`, {
      params: { page, limit: 50, ...(includeArchived ? { includeArchived: true } : {}) },
      withCredentials: true,
    });
  }

  getSummary(filters: TimesheetSummaryFilters) {
    return this.http
      .get<ApiResponse<TimesheetSummary>>(`${this.baseUrl}/summary`, {
        params: this.summaryParams(filters),
        withCredentials: true,
      })
      .pipe(map((response) => response.data));
  }

  bulkApprove(entryIds: string[]) {
    return this.http
      .post<ApiResponse<BulkApproveResult>>(
        `${this.baseUrl}/entries/bulk-approve`,
        { entryIds },
        { withCredentials: true },
      )
      .pipe(map((response) => response.data));
  }

  bulkReject(entryIds: string[], reason: string) {
    return this.http
      .post<ApiResponse<BulkRejectResult>>(
        `${this.baseUrl}/entries/bulk-reject`,
        { entryIds, reason },
        { withCredentials: true },
      )
      .pipe(map((response) => response.data));
  }

  exportTimesheet(filters: TimesheetSummaryFilters) {
    return this.http.get(`${this.baseUrl}/export.xlsx`, {
      params: this.summaryParams(filters),
      responseType: 'blob',
      observe: 'response',
      withCredentials: true,
    });
  }

  getPeriodLock(periodStart: string, periodEnd: string) {
    return this.http
      .get<ApiResponse<TimesheetPeriodLock>>(`${this.baseUrl}/period-lock`, {
        params: { periodStart, periodEnd },
        withCredentials: true,
      })
      .pipe(map((response) => response.data));
  }

  lockPeriod(periodStart: string, periodEnd: string) {
    return this.http
      .post<ApiResponse<TimesheetPeriodLock>>(
        `${this.baseUrl}/period-lock/lock`,
        { periodStart, periodEnd },
        { withCredentials: true },
      )
      .pipe(map((response) => response.data));
  }

  unlockPeriod(periodStart: string, periodEnd: string, reason: string) {
    return this.http
      .post<ApiResponse<TimesheetPeriodLock>>(
        `${this.baseUrl}/period-lock/unlock`,
        { periodStart, periodEnd, reason },
        { withCredentials: true },
      )
      .pipe(map((response) => response.data));
  }

  getAuditLogs(page = 1, limit = 10, periodStart?: string, periodEnd?: string) {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (periodStart && periodEnd) {
      params = params.set('periodStart', periodStart).set('periodEnd', periodEnd);
    }

    return this.http.get<PaginatedApiResponse<TimesheetAuditLog>>(`${this.baseUrl}/audit-logs`, {
      params,
      withCredentials: true,
    });
  }

  private summaryParams(filters: TimesheetSummaryFilters) {
    let params = new HttpParams()
      .set('periodStart', filters.periodStart)
      .set('periodEnd', filters.periodEnd);

    if (filters.employee?.trim()) params = params.set('employee', filters.employee.trim());
    if (filters.projectId) params = params.set('projectId', filters.projectId);
    if (filters.tag?.trim()) params = params.set('tag', filters.tag.trim());
    if (filters.status) params = params.set('status', filters.status);

    return params;
  }
}
