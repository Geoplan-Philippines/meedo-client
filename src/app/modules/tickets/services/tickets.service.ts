import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { CreateTicketPayload, Ticket } from '../models/ticket.model';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tickets`;

  getAll() {
    return this.http
      .get<PaginatedApiResponse<Ticket>>(this.baseUrl, {
        params: { page: 1, limit: 50 },
        withCredentials: true,
      })
      .pipe(
        map(res => {
          if (res.meta.lastPage > 1) {
            console.warn(`[TicketsService] Only page 1 of ${res.meta.lastPage} loaded (${res.meta.total} total). Increase limit or implement pagination.`);
          }
          return res.data;
        }),
      );
  }

  createTicket(payload: CreateTicketPayload) {
    return this.http
      .post<ApiResponse<Ticket>>(this.baseUrl, payload, {
        withCredentials: true,
      })
      .pipe(map(res => res.data));
  }
}
