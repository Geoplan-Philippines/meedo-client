import { ApiResponse } from './api-response.interface';

export interface PaginationMeta {
  total: number;
  limit: number;
  page: number;
  lastPage: number;
}

/**
 * The shape every list endpoint answers with. `M` adds endpoint-specific
 * meta, e.g. per-client totals on the projects list or week totals on
 * timesheet approvals.
 */
export interface PaginatedApiResponse<T, M extends object = object> extends ApiResponse<T[]> {
  meta: PaginationMeta & M;
}
