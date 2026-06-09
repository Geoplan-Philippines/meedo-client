import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../../environments/environment.dev';
import { CreateStatusPayload, Envelope, Status, UpdateStatusPayload, } from '../models/status.model';

@Injectable({ providedIn: 'root' })
export class StatusesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/statuses`;

  list(): Observable<Status[]> {
    return this.http
      .get<Envelope<Status[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }

  create(payload: CreateStatusPayload): Observable<Status> {
    return this.http
      .post<Envelope<Status>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateStatusPayload): Observable<Status> {
    return this.http
      .patch<Envelope<Status>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  archive(id: string): Observable<Status> {
    return this.http
      .patch<Envelope<Status>>(`${this.baseUrl}/${id}/archive`, {})
      .pipe(map((res) => res.data));
  }

  restore(id: string): Observable<Status> {
    return this.http
      .patch<Envelope<Status>>(`${this.baseUrl}/${id}/restore`, {})
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
