import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment.dev';
import { cacheContext } from '../../../core/http/api-cache';
import { toHttpParams } from '../../../shared/data/page-query';
import { ListStateConfig } from '../../../shared/data/url-list-state';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { Campaign, CampaignListParams, CampaignPayload } from '../newsletter/campaign/campaign.model';

export const CAMPAIGNS_LIST: ListStateConfig<{ includeArchived: boolean }> = {
  pageSize: 25,
  sortField: 'createdAt',
  sortOrder: 'desc',
  sortFields: ['createdAt', 'updatedAt', 'name', 'subject', 'status'],
  filters: { includeArchived: false },
};

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/crm/newsletter/campaigns`;

  /** One page of campaigns; search, sort and the archived filter are applied by the API. */
  list(query: CampaignListParams) {
    return this.http.get<PaginatedApiResponse<Campaign>>(this.url, {
      params: toHttpParams({ ...query }),
      context: cacheContext('crm'),
      withCredentials: true,
    });
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
