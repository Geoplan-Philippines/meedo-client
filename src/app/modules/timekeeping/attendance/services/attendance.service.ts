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
} from '../models/attendance.model';

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

  /** Paginated daily attendance history, newest first. */
  getHistory(params: AttendanceHistoryParams) {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('limit', params.limit);

    if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);

    return this.http.get<AttendanceHistoryResponse>(this.baseUrl, {
      params: httpParams,
      withCredentials: true,
    });
  }
}
