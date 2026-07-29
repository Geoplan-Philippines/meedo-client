import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { Observable, share } from 'rxjs';

import { environment } from '../../../../../environments/environment.dev';
import {
  AttendanceHistoryParams,
  AttendanceHistoryResponse,
  AttendanceRealtimeUpdate,
  BoardRosterParams,
  BoardRosterResponse,
  BoardSummary,
  BoardSummaryResponse,
  DailyAttendanceSummary,
  DailySummaryResponse,
  RecognizeResponse,
  RecordAttendanceEventPayload,
  RecordEventResponse,
  RosterParams,
  RosterResponse,
  TardinessParams,
  TardinessResponse,
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

  readonly updates$ = new Observable<AttendanceRealtimeUpdate>((subscriber) => {
    if (typeof EventSource === 'undefined') {
      subscriber.complete();
      return;
    }

    const source = new EventSource(`${this.baseUrl}/updates`, { withCredentials: true });
    let connectionInterrupted = false;
    const onUpdate = (event: MessageEvent<string>): void => {
      try {
        subscriber.next(JSON.parse(event.data) as AttendanceRealtimeUpdate);
      } catch (error) {
        console.error('Invalid attendance realtime update:', error);
      }
    };
    const onOpen = (): void => {
      if (connectionInterrupted) {
        console.info('Attendance realtime connection restored.');
      }
      connectionInterrupted = false;
    };
    const onError = (): void => {
      if (connectionInterrupted) return;
      connectionInterrupted = true;
      const state = source.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting';
      console.warn(`Attendance realtime connection interrupted (${state}).`);
    };
    source.addEventListener('open', onOpen);
    source.addEventListener('error', onError);
    source.addEventListener('attendance.updated', onUpdate as EventListener);
    return () => {
      source.removeEventListener('open', onOpen);
      source.removeEventListener('error', onError);
      source.removeEventListener('attendance.updated', onUpdate as EventListener);
      source.close();
    };
  }).pipe(share());

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

  /* ─── Admin attendance board ───────────────────────────── */

  /** Headline present/late/absent counts for a day (admins only). */
  getBoardSummary(date?: string) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);

    return this.http
      .get<BoardSummaryResponse>(`${this.baseUrl}/board/summary`, { params, withCredentials: true })
      .pipe(map((res): BoardSummary => res.data));
  }

  /** Member-centric, paginated roster for a day, filterable by status (admins only). */
  getBoardRoster(params: BoardRosterParams) {
    let httpParams = new HttpParams().set('page', params.page).set('limit', params.limit);
    if (params.date) httpParams = httpParams.set('date', params.date);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http.get<BoardRosterResponse>(`${this.baseUrl}/board/roster`, {
      params: httpParams,
      withCredentials: true,
    });
  }

  /** Lateness scoreboard over a day/week/month window (admins only). */
  getTardiness(params: TardinessParams) {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('limit', params.limit)
      .set('period', params.period);
    if (params.date) httpParams = httpParams.set('date', params.date);
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<TardinessResponse>(`${this.baseUrl}/board/tardiness`, {
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
}
