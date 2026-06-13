import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment.dev';
import { TicketActivity } from '../models/ticket-activity.model';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { THREAD_PAGE_SIZE } from '../tickets.constants';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tickets`;

  getActivity(ticketId: string, page = 1, limit = THREAD_PAGE_SIZE) {
    return this.http.get<PaginatedApiResponse<TicketActivity>>(`${this.baseUrl}/${ticketId}/activity`, {
      params: { page, limit },
      withCredentials: true,
    });
  }
}
