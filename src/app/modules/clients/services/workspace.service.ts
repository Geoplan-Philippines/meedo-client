import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiCache } from '../../../core/http/api-cache';
import { AuthService } from '../../../core/auth/auth.service';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { ProjectRecord } from '../../tickets/models/projects.model';
import { ClientOption } from '../../settings/customers/models/client.model';
import { UNASSIGNED_CLIENT_ID } from '../models/workspace.model';

/** Client and project names for breadcrumbs; kept across layout remounts. */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly maintenanceUrl = `${environment.apiBaseUrl}/maintenance`;

  private readonly clientCache = new Map<string, Observable<ClientOption | null>>();
  private readonly projectCache = new Map<string, Observable<ProjectRecord | null>>();
  private identityKey: string | undefined;

  constructor() {
    // Writes and project notifications clear the API cache; breadcrumb names follow.
    inject(ApiCache)
      .changes$.pipe(takeUntilDestroyed())
      .subscribe((change) => {
        if (change === null || change.has('clients') || change.has('projects')) this.invalidate();
      });
    effect(() => {
      const userId = this.auth.currentUser?.()?.id;
      const key = `${userId ?? ''}:${this.auth.organizationId?.() ?? ''}`;
      if (this.identityKey === undefined) { this.identityKey = key; return; }
      if (key === this.identityKey) return;
      this.identityKey = key;
      this.invalidate();
    });
  }

  /** Client name for breadcrumbs; cached per id. `unassigned` resolves without a request. */
  client(clientId: string): Observable<ClientOption | null> {
    if (clientId === UNASSIGNED_CLIENT_ID) {
      return of({ id: UNASSIGNED_CLIENT_ID, name: 'Unassigned', customerName: '', isArchived: false });
    }
    let cached = this.clientCache.get(clientId);
    if (!cached) {
      cached = this.http
        .get<ApiResponse<ClientOption>>(`${this.maintenanceUrl}/clients/${clientId}`, { withCredentials: true })
        .pipe(
          map((response) => response.data),
          catchError(() => of(null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
      this.clientCache.set(clientId, cached);
    }
    return cached;
  }

  /** Project for breadcrumbs; cached per id. */
  project(projectId: string): Observable<ProjectRecord | null> {
    let cached = this.projectCache.get(projectId);
    if (!cached) {
      cached = this.http
        .get<ApiResponse<ProjectRecord>>(`${this.maintenanceUrl}/projects/${projectId}`, { withCredentials: true })
        .pipe(
          map((response) => response.data),
          catchError(() => of(null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
      this.projectCache.set(projectId, cached);
    }
    return cached;
  }

  /** Project edits can rename projects or move them between clients. */
  refreshProjects(): void {
    this.invalidate();
  }

  /** Drop cached names after an edit, sync or identity change. */
  invalidate(): void {
    this.clientCache.clear();
    this.projectCache.clear();
  }
}
