import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment.dev';
import { cacheContext } from '../../../core/http/api-cache';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { PageQuery, toHttpParams } from '../../../shared/data/page-query';
import { ListStateConfig } from '../../../shared/data/url-list-state';
import { AuthService } from '../../../core/auth/auth.service';
import {
  IntegrationKeySecret,
  WebsiteIntegration,
  WebhookDelivery,
  WebhookEndpoint,
  readOrganizationSlug,
} from '../models/integration.model';

export const WEBHOOK_DELIVERIES_LIST: ListStateConfig<{ event: string | null }> = {
  pageSize: 25,
  sortField: 'createdAt',
  sortOrder: 'desc',
  sortFields: ['createdAt', 'event'],
  filters: { event: null },
};

const EMPTY_SITE: WebsiteIntegration = {
  slug: '',
  hasKey: false,
  prefix: null,
  createdAt: null,
  lastUsedAt: null,
};

@Injectable({ providedIn: 'root' })
export class IntegrationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly siteUrl = `${environment.apiBaseUrl}/crm/integrations/website`;
  private readonly webhooksUrl = `${environment.apiBaseUrl}/crm/webhooks`;
  readonly docsUrl = `${environment.apiBaseUrl}/docs/integration.md`;
  readonly apiBaseUrl = environment.apiBaseUrl;

  getWebsite(): Observable<WebsiteIntegration> {
    return this.http
      .get<ApiResponse<WebsiteIntegration>>(this.siteUrl, {
        context: cacheContext('crm'),
        withCredentials: true,
      })
      .pipe(map((response) => response.data ?? EMPTY_SITE));
  }

  getOrganizationSlug(): Observable<string> {
    const organizationId = this.auth.organizationId();
    return this.http
      .get<unknown>(`${environment.apiBaseUrl}/auth/organization/get-full-organization`, {
        params: organizationId ? { organizationId } : {},
        withCredentials: true,
      })
      .pipe(map(readOrganizationSlug));
  }

  createKey(): Observable<IntegrationKeySecret> {
    return this.http
      .post<ApiResponse<IntegrationKeySecret>>(`${this.siteUrl}/key`, {}, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  rotateKey(): Observable<IntegrationKeySecret> {
    return this.http
      .post<ApiResponse<IntegrationKeySecret>>(`${this.siteUrl}/key/rotate`, {}, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  revokeKey(): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.siteUrl}/key`, { withCredentials: true })
      .pipe(map(() => undefined));
  }

  getGuide(): Observable<string> {
    return this.http.get(this.docsUrl, { responseType: 'text', withCredentials: true });
  }

  listWebhooks(): Observable<WebhookEndpoint[]> {
    return this.http
      .get<ApiResponse<WebhookEndpoint[]>>(this.webhooksUrl, {
        params: toHttpParams({ page: 1, limit: 100, sortField: 'createdAt', sortOrder: 'desc' as const }),
        context: cacheContext('crm'),
        withCredentials: true,
      })
      .pipe(map((response) => response.data ?? []));
  }

  getWebhook(id: string): Observable<WebhookEndpoint> {
    return this.http
      .get<ApiResponse<WebhookEndpoint>>(`${this.webhooksUrl}/${id}`, {
        context: cacheContext('crm'),
        withCredentials: true,
      })
      .pipe(map((response) => response.data));
  }

  createWebhook(payload: { url: string; events: string[] }): Observable<WebhookEndpoint> {
    return this.http
      .post<ApiResponse<WebhookEndpoint>>(this.webhooksUrl, payload, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  updateWebhook(id: string, payload: { url?: string; events?: string[]; enabled?: boolean }): Observable<WebhookEndpoint> {
    return this.http
      .patch<ApiResponse<WebhookEndpoint>>(`${this.webhooksUrl}/${id}`, payload, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  deleteWebhook(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.webhooksUrl}/${id}`, { withCredentials: true })
      .pipe(map(() => undefined));
  }

  rotateWebhookSecret(id: string): Observable<{ secret: string }> {
    return this.http
      .post<ApiResponse<{ secret: string }>>(`${this.webhooksUrl}/${id}/rotate-secret`, {}, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  listDeliveries(id: string, query: PageQuery): Observable<PaginatedApiResponse<WebhookDelivery>> {
    return this.http.get<PaginatedApiResponse<WebhookDelivery>>(`${this.webhooksUrl}/${id}/deliveries`, {
      params: toHttpParams(query),
      context: cacheContext('crm'),
      withCredentials: true,
    });
  }
}
