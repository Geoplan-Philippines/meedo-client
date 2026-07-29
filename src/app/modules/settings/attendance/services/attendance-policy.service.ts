import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { AttendancePolicy, UpdateAttendancePolicyPayload } from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendancePolicyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/attendance/policy`;

  get(): Observable<AttendancePolicy> {
    return this.http.get<ApiResponse<AttendancePolicy>>(this.baseUrl).pipe(map((res) => res.data));
  }

  update(payload: UpdateAttendancePolicyPayload): Observable<AttendancePolicy> {
    return this.http
      .patch<ApiResponse<AttendancePolicy>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }
}
