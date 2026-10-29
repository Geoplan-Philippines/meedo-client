import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment.dev';
import { LeadsResponse, LeadsStatsResponse, SubscribersResponse } from '../models/crm.model';

@Injectable({
  providedIn: 'root',
})
export class CrmService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/crm`;

  getLeads(): Observable<LeadsResponse> {
    return this.http.get<LeadsResponse>(`${this.baseUrl}/leads`);
  }

  /** Authenticated GET /crm/leads/stats. */
  getLeadsStats(): Observable<LeadsStatsResponse> {
    return this.http.get<LeadsStatsResponse>(`${this.baseUrl}/leads/stats`, { withCredentials: true });
  }

  getSubscribers(): Observable<SubscribersResponse> {
    return this.http.get<SubscribersResponse>(`${this.baseUrl}/newsletter/subscribers`);
  }
}
