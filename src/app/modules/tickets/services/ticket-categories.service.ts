import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment.dev';
import {
  CreateTicketCategoryPayload,
  TicketCategory,
  UpdateTicketCategoryPayload,
} from '../models/ticket-categories.model';
import { ApiResponse } from '../../../shared/interface/api-response.interface';

@Injectable({ providedIn: 'root' })
export class TicketCategoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/ticket-categories`;

  list(): Observable<TicketCategory[]> {
    return this.http
      .get<ApiResponse<TicketCategory[]>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }

  getAll(): Observable<TicketCategory[]> {
    return this.list();
  }

  create(payload: CreateTicketCategoryPayload): Observable<TicketCategory> {
    return this.http
      .post<ApiResponse<TicketCategory>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateTicketCategoryPayload): Observable<TicketCategory> {
    return this.http
      .patch<ApiResponse<TicketCategory>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<TicketCategory> {
    return this.http
      .delete<ApiResponse<TicketCategory>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }
}
