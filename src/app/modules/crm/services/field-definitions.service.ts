import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment.dev';
import { cacheContext } from '../../../core/http/api-cache';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import {
  CreateFieldDefinitionPayload,
  FieldCollection,
  FieldDefinition,
  UpdateFieldDefinitionPayload,
} from '../models/field-definition.model';

@Injectable({ providedIn: 'root' })
export class FieldDefinitionsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/crm/field-definitions`;

  list(collection: FieldCollection): Observable<FieldDefinition[]> {
    return this.http
      .get<ApiResponse<FieldDefinition[]>>(this.url, {
        params: { collection },
        context: cacheContext('crm'),
        withCredentials: true,
      })
      .pipe(map((response) => response.data ?? []));
  }

  create(payload: CreateFieldDefinitionPayload): Observable<FieldDefinition> {
    return this.http
      .post<ApiResponse<FieldDefinition>>(this.url, payload, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  update(id: string, payload: UpdateFieldDefinitionPayload): Observable<FieldDefinition> {
    return this.http
      .patch<ApiResponse<FieldDefinition>>(`${this.url}/${id}`, payload, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<ApiResponse<unknown>>(`${this.url}/${id}`, { withCredentials: true }).pipe(map(() => undefined));
  }

  reorder(collection: FieldCollection, orderedIds: string[]): Observable<FieldDefinition[]> {
    return this.http
      .patch<ApiResponse<FieldDefinition[]>>(`${this.url}/reorder`, { collection, orderedIds }, { withCredentials: true })
      .pipe(map((response) => response.data ?? []));
  }
}
