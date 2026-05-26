import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment.dev';

export interface LeadsStats {
  total: number;
  pending: number;
  qualified: number;
  converted: number;
}

interface LeadsStatsResponse {
  data: LeadsStats;
}

@Injectable({
  providedIn: 'root',
})
export class CrmService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/crm`;

  getLeads() {
    return this.http.get<any>(`${this.baseUrl}/leads`);
  }

  /** GET /crm/leads/stats — ready, pending backend implementation */
  getLeadsStats() {
    return this.http.get<LeadsStatsResponse>(`${this.baseUrl}/leads/stats`);
  }

  getSubscribers() {
    return this.http.get<any>(`${this.baseUrl}/newsletter/subscribers`);
  }
}