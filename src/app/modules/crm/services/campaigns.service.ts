import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment.dev';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { Campaign, CampaignListParams, CampaignPayload } from '../newsletter/campaign/campaign.model';

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/crm/newsletter/campaigns`;

  list(query: CampaignListParams) {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    if (query.search?.trim()) params = params.set('search', query.search.trim());
    if (query.includeArchived !== undefined) params = params.set('includeArchived', query.includeArchived);
    return this.http.get<PaginatedApiResponse<Campaign>>(this.url, { params, withCredentials: true });
  }

  get(id: string) {
    return this.http.get<ApiResponse<Campaign>>(`${this.url}/${id}`, { withCredentials: true }).pipe(map(res => res.data));
  }

  create(payload: CampaignPayload) {
    return this.http.post<ApiResponse<Campaign>>(this.url, payload, { withCredentials: true }).pipe(map(res => res.data));
  }

  update(id: string, payload: Partial<CampaignPayload>) {
    return this.http.patch<ApiResponse<Campaign>>(`${this.url}/${id}`, payload, { withCredentials: true }).pipe(map(res => res.data));
  }

  archive(id: string) {
    return this.http.patch<ApiResponse<Campaign>>(`${this.url}/${id}/archive`, {}, { withCredentials: true }).pipe(map(res => res.data));
  }

  restore(id: string) {
    return this.http.patch<ApiResponse<Campaign>>(`${this.url}/${id}/restore`, {}, { withCredentials: true }).pipe(map(res => res.data));
  }
}
