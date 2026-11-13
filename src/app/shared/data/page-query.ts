import { HttpParams } from '@angular/common/http';

export type SortOrder = 'asc' | 'desc';

/** The request every list endpoint shares. Endpoints add their own filters. */
export interface PageQuery {
  page: number;
  limit: number;
  search?: string;
  sortField?: string;
  sortOrder?: SortOrder;
}

export type QueryParamValue = string | number | boolean | readonly string[] | null | undefined;

/**
 * Query params for an API call. Empty values (undefined, null, blank strings,
 * empty arrays) are left out, because the API rejects unknown or invalid
 * params; arrays become repeated keys (`?id=a&id=b`); strings are trimmed.
 * Takes any query object whose values are QueryParamValue.
 */
export function toHttpParams<Q extends { [K in keyof Q]: QueryParamValue }>(query: Q): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query) as [string, QueryParamValue][]) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value as readonly string[]) if (item) params = params.append(key, item);
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : String(value);
    if (text) params = params.set(key, text);
  }
  return params;
}
