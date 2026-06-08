import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.dev';

export interface TicketAssignee {
  id: string;
  memberId: string;
  member: {
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  };
}

export interface Ticket {
  id: string;
  title: string;
  ticketNumber: number;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  assignees?: TicketAssignee[];
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
  assigneeIds?: string[];
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
      .post<{ statusCode: number; message: string; data: Ticket }>(this.baseUrl, payload, {
        withCredentials: true,
      })
      .pipe(map(res => res.data));
  }
}