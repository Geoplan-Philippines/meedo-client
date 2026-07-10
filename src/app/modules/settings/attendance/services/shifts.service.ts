import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import { CreateShiftPayload, Shift, UpdateShiftPayload } from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class ShiftsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/attendance/shifts`;

  list(): Observable<Shift[]> {
    return this.http.get<ApiResponse<Shift[]>>(this.baseUrl).pipe(map((res) => res.data));
  }

  create(payload: CreateShiftPayload): Observable<Shift> {
    return this.http.post<ApiResponse<Shift>>(this.baseUrl, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateShiftPayload): Observable<Shift> {
    return this.http
      .patch<ApiResponse<Shift>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  archive(id: string): Observable<Shift> {
    return this.http
      .patch<ApiResponse<Shift>>(`${this.baseUrl}/${id}/archive`, {})
      .pipe(map((res) => res.data));
  }

  restore(id: string): Observable<Shift> {
    return this.http
      .patch<ApiResponse<Shift>>(`${this.baseUrl}/${id}/restore`, {})
      .pipe(map((res) => res.data));
  }
}
