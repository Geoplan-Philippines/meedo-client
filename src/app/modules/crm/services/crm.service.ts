import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment.dev';

export interface LeadsStats {
  total: number;
  pending: number;
  qualified: number;
  converted: number;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  company?: string;
  message?: string;
  status?: string;
  createdAt: string;
}

export interface Subscriber {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface LeadsResponse {
  data: Lead[];
}

export interface SubscribersResponse {
  data: Subscriber[];
}

export interface LeadsStatsResponse {
  data: LeadsStats;
}

@Injectable({
  providedIn: 'root',
})
export class CrmService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/crm`;

  getLeads(): Observable<LeadsResponse> {
    return this.http.get<LeadsResponse>(`${this.baseUrl}/leads`);
  }

  /** GET /crm/leads/stats — ready, pending backend implementation */
  getLeadsStats(): Observable<LeadsStatsResponse> {
    return this.http.get<LeadsStatsResponse>(`${this.baseUrl}/leads/stats`);
  }

  getSubscribers(): Observable<SubscribersResponse> {
    return this.http.get<SubscribersResponse>(`${this.baseUrl}/newsletter/subscribers`);
  }
}
