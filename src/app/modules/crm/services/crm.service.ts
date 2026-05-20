import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class CrmService {
  private baseUrl = 'http://localhost:8000/api/v1/crm';

  constructor(private http: HttpClient) {}

  getLeads() {
    return this.http.get<any>(`${this.baseUrl}/leads`);
  }

  getSubscribers() {
    return this.http.get<any>(`${this.baseUrl}/newsletter/subscribers`);
  }
}