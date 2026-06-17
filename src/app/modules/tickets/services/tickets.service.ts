import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { CreateTicketPayload, Ticket, TicketListParams, UpdateTicketPayload } from '../models/ticket.model';
import { TicketStats } from '../models/ticket-stats.model';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tickets`;

  getAll(params: TicketListParams) {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('limit', params.limit);

    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.ticketStatusId) httpParams = httpParams.set('ticketStatusId', params.ticketStatusId);
    if (params.priority) httpParams = httpParams.set('priority', params.priority);
    if (params.sortField) httpParams = httpParams.set('sortField', params.sortField);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);

    return this.http.get<PaginatedApiResponse<Ticket>>(this.baseUrl, {
      params: httpParams,
      withCredentials: true,
    });
  }

  getStats() {
    return this.http
      .get<ApiResponse<TicketStats>>(`${this.baseUrl}/stats`, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  createTicket(payload: CreateTicketPayload) {
    return this.http
      .post<ApiResponse<Ticket>>(this.baseUrl, payload, { withCredentials: true })
      .pipe(map(res => res.data));
  }

  updateTicket(id: string, payload: UpdateTicketPayload) {
    return this.http
      .patch<ApiResponse<Ticket>>(`${this.baseUrl}/${id}`, payload, { withCredentials: true })
      .pipe(map(res => res.data));
  }
}
