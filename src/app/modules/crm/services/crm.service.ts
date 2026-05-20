import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment.dev';

@Injectable({
  providedIn: 'root',
})

export class CrmService {
  private baseUrl = `${environment.apiBaseUrl}/crm`;

  constructor(private http: HttpClient) {}

  getLeads() {
    return this.http.get<any>(`${this.baseUrl}/leads`);
  }

  getSubscribers() {
    return this.http.get<any>(`${this.baseUrl}/newsletter/subscribers`);
  }
}