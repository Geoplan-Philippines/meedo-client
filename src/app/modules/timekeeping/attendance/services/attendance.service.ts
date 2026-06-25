import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs/operators';

import { environment } from '../../../../../environments/environment.dev';
import {
  AttendanceHistoryParams,
  AttendanceHistoryResponse,
  DailyAttendanceSummary,
  DailySummaryResponse,
  RecognizeResponse,
  RecordAttendanceEventPayload,
  RecordEventResponse,
  RosterParams,
  RosterResponse,
} from '../models/attendance.model';

/** Builds page/limit/date-range query params shared by history endpoints. */
function buildHistoryParams(params: AttendanceHistoryParams): HttpParams {
  let httpParams = new HttpParams().set('page', params.page).set('limit', params.limit);
  if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
  if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);
  return httpParams;
}

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  private readonly http = inject(HttpClient);

  private readonly faceUrl = `${environment.apiBaseUrl}/timekeeping/attendance`;
  private readonly baseUrl = `${environment.apiBaseUrl}/attendance`;

  recognize(image: Blob) {
    const formData = new FormData();
    formData.append('image', image, 'capture.jpg');

    return this.http.post<RecognizeResponse>(`${this.faceUrl}/face/recognize`, formData);
  }

  /** Punch a field/WFH event for the current employee. */
  recordEvent(payload: RecordAttendanceEventPayload) {
    return this.http
      .post<RecordEventResponse>(`${this.baseUrl}/events`, payload, { withCredentials: true })
      .pipe(map((res) => res.data));
  }

  /** Computed attendance for a single day (defaults to today) plus its timeline. */
  getDailySummary(date?: string) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);

    return this.http
      .get<DailySummaryResponse>(`${this.baseUrl}/summary`, { params, withCredentials: true })
      .pipe(map((res): DailyAttendanceSummary => res.data));
  }

  /** Paginated daily attendance history for the current user, newest first. */
  getHistory(params: AttendanceHistoryParams) {
    return this.http.get<AttendanceHistoryResponse>(this.baseUrl, {
      params: buildHistoryParams(params),
      withCredentials: true,
    });
  }

  /** Org-wide roster of every employee's attendance for a day (owners/admins). */
  getRoster(params: RosterParams) {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('limit', params.limit);

    if (params.date) httpParams = httpParams.set('date', params.date);
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<RosterResponse>(`${this.baseUrl}/roster`, {
      params: httpParams,
      withCredentials: true,
    });
  }

  /** A single employee's day timeline for the roster drill-down. */
  getEmployeeDay(employeeId: string, date?: string) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);

    return this.http
      .get<DailySummaryResponse>(`${this.baseUrl}/roster/${employeeId}`, {
        params,
        withCredentials: true,
      })
      .pipe(map((res): DailyAttendanceSummary => res.data));
  }

  /** A single employee's paginated daily history for the roster drill-down. */
  getEmployeeHistory(employeeId: string, params: AttendanceHistoryParams) {
    return this.http.get<AttendanceHistoryResponse>(`${this.baseUrl}/roster/${employeeId}/history`, {
      params: buildHistoryParams(params),
      withCredentials: true,
    });
  }
}
