import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.dev';

export interface TicketCategory {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
}

interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class TicketCategoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/ticket-categories`;

  getAll() {
    return this.http
      .get<ApiResponse<TicketCategory[]>>(this.baseUrl, { withCredentials: true })
      .pipe(map(res => res.data));
  }
}