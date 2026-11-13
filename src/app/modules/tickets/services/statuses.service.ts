import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { cacheContext } from '../../../core/http/api-cache';
import { Status } from '../models/status.model';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { toHttpParams } from '../../../shared/data/page-query';

/**
 * Statuses are the organization's workflow (the standard set plus a few
 * custom ones), so boards, filters and pickers take the first page in
 * workflow order; the API caps a page at 50.
 */
export const STATUS_OPTIONS_QUERY = { page: 1, limit: 50 } as const;

@Injectable({ providedIn: 'root' })
export class StatusesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/settings/statuses`;

  /** Every status in workflow order, archived ones included (callers filter them out). */
  options(): Observable<Status[]> {
    return this.http
      .get<PaginatedApiResponse<Status>>(this.baseUrl, {
        params: toHttpParams(STATUS_OPTIONS_QUERY),
        context: cacheContext('lookups'),
        withCredentials: true,
      })
      .pipe(map((res) => res.data));
  }
}
