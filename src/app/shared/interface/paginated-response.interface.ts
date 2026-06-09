import { ApiResponse } from './api-response.interface';

export interface PaginationMeta {
  total: number;
  limit: number;
  page: number;
  lastPage: number;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
    meta: PaginationMeta;
}
