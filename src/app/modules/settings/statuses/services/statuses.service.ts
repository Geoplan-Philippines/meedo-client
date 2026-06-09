import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../../environments/environment.dev';
import { CreateStatusPayload, Status, UpdateStatusPayload, } from '../models/status.model';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';

@Injectable({ providedIn: 'root' })
export class StatusesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/statuses`;

  list(): Observable<Status[]> {
    return this.http
      .get<ApiResponse<Status[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }

  create(payload: CreateStatusPayload): Observable<Status> {
    return this.http
      .post<ApiResponse<Status>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateStatusPayload): Observable<Status> {
    return this.http
      .patch<ApiResponse<Status>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  archive(id: string): Observable<Status> {
    return this.http
      .patch<ApiResponse<Status>>(`${this.baseUrl}/${id}/archive`, {})
      .pipe(map((res) => res.data));
  }

  restore(id: string): Observable<Status> {
    return this.http
      .patch<ApiResponse<Status>>(`${this.baseUrl}/${id}/restore`, {})
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
