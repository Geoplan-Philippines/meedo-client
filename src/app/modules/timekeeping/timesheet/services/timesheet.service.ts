import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { expand, map, reduce } from 'rxjs/operators';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { toHttpParams } from '../../../../shared/data/page-query';
import { PickerQuery } from '../../../../shared/data/paged-search';
import { cacheContext } from '../../../../core/http/api-cache';
import { timesheetProjectLabel } from '../shared/timesheet-project.util';
import {
  BulkApproveResult,
  BulkRejectResult,
  SubmitWeekResult,
  TimesheetAuditLog,
  TimesheetEntry,
  TimesheetTicket,
  TimesheetEntryPayload,
  TimesheetPeriodLock,
  TimesheetProject,
  TimesheetSummaryEmployee,
  TimesheetSummaryFilters,
  TimesheetSummaryMeta,
  TimesheetSummaryPageQuery,
} from '../models/timesheet.model';

@Injectable({ providedIn: 'root' })
export class TimesheetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/timekeeping/timesheet`;

  getTickets(page = 1, search = '') {
    return this.http.get<PaginatedApiResponse<TimesheetTicket>>(this.baseUrl + '/tickets', { params: { page, limit: 20, ...(search.trim() ? { search: search.trim() } : {}) }, withCredentials: true });
  }

  createTicket(title: string, projectId: string | null) {
    return this.http.post<ApiResponse<TimesheetTicket>>(environment.apiBaseUrl + '/tickets', { title: title.trim(), ...(projectId ? { projectId } : {}) }, { withCredentials: true }).pipe(map(response => response.data));
  }

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
   * One page of projects for timesheet pickers, searched on the server and
   * labelled "Client — Project · WO". Archived projects are left out unless
   * `includeArchived` (filters over existing entries need them; new entries cannot use them).
   */
  searchProjects(query: PickerQuery & { includeArchived?: boolean }): Observable<PaginatedApiResponse<TimesheetProject>> {
    return this.http
      .get<PaginatedApiResponse<TimesheetProject>>(`${this.baseUrl}/projects`, {
        params: toHttpParams(query),
        context: cacheContext('projects'),
        withCredentials: true,
      })
      .pipe(map((page) => ({ ...page, data: page.data.map(withProjectLabel) })));
  }

  /**
   * Approvals: one page of employees for the week (with their entries), plus
   * week totals and tab counts in `meta`. Search, tab and paging run on the server.
   */
  getSummaryPage(query: TimesheetSummaryPageQuery): Observable<PaginatedApiResponse<TimesheetSummaryEmployee, TimesheetSummaryMeta>> {
    return this.http.get<PaginatedApiResponse<TimesheetSummaryEmployee, TimesheetSummaryMeta>>(`${this.baseUrl}/summary`, {
      params: toHttpParams(query),
      context: cacheContext('timesheet'),
      withCredentials: true,
    });
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

/** Adds the picker label; archived projects say so. */
function withProjectLabel(project: TimesheetProject): TimesheetProject {
  const customerName = project.customerName?.trim() || project.client?.customerName?.trim() || '';
  const label = timesheetProjectLabel({ ...project, customerName });
  return { ...project, customerName, label: project.isArchived ? `${label} (Archived)` : label };
}
