import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.dev';

export interface Ticket {
  id: string;
  title: string;
  ticketNumber: number;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  assigneeId?: string;
  ticketStatusId: string;
  categoryId?: string;
  projectId?: string;
  teamId?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  ticketStatus?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface CreateTicketPayload {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  ticketStatusId?: string;
  categoryId?: string;
  projectId?: string;
  teamId?: string;
  assigneeId?: string;
}

interface PaginatedApiResponse<T> {
  statusCode: number;
  message: string;
  data: T[];
  meta: {
    total: number;
    limit: number;
    page: number;
    lastPage: number;
  };
}

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
      .pipe(map(res => res.data));
  }

  createTicket(payload: CreateTicketPayload) {
    return this.http.post<Ticket>(this.baseUrl, payload, {
      withCredentials: true,
    });
  }
}
