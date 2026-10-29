import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { Observable, Subscription, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { ProjectRecord } from '../../tickets/models/projects.model';
import { ClientOption } from '../../settings/customers/models/client.model';
import { ClientTreeNode, UNASSIGNED_CLIENT_ID } from '../models/workspace.model';

/** Shared client shortcuts and breadcrumb names; kept across layout remounts. */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly maintenanceUrl = `${environment.apiBaseUrl}/maintenance`;

  readonly clientsOpen = signal(false);
  readonly clients = signal<ClientTreeNode[]>([]);
  readonly clientsLoading = signal(false);
  readonly clientsError = signal(false);
  private clientsLoaded = false;
  private clientsRequest: Subscription | null = null;
  private readonly clientCache = new Map<string, Observable<ClientOption | null>>();
  private readonly projectCache = new Map<string, Observable<ProjectRecord | null>>();
  private identityKey: string | undefined;

  constructor() {
    effect(() => {
      const userId = this.auth.currentUser?.()?.id;
      const key = `${userId ?? ''}:${this.auth.organizationId?.() ?? ''}`;
      if (this.identityKey === undefined) { this.identityKey = key; return; }
      if (key === this.identityKey) return;
      this.identityKey = key;
      untracked(() => {
        this.clientsRequest?.unsubscribe(); this.clientsLoaded = false;
        this.clientsLoading.set(false); this.clients.set([]); this.clientCache.clear(); this.projectCache.clear();
        if (userId && this.clientsOpen()) this.reloadClients();
      });
    });
  }

  ensureClients(): void {
    if (!this.clientsLoaded && !this.clientsLoading()) this.reloadClients();
  }

  reloadClients(): void {
    this.clientsRequest?.unsubscribe();
    this.clientsLoading.set(true);
    this.clientsError.set(false);
    this.clientsRequest = this.http
      .get<PaginatedApiResponse<ClientTreeNode>>(`${this.maintenanceUrl}/clients/tree`, {
        params: { page: 1, limit: 5, hasActiveProjects: true },
        withCredentials: true,
      })
      .subscribe({
        next: (response) => {
          this.clients.set(response.data
            .filter((client) => client.projectCount > 0 && client.id !== UNASSIGNED_CLIENT_ID)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
            .slice(0, 5));
          this.clientsLoaded = true;
          this.clientsLoading.set(false);
        },
        error: () => {
          this.clientsLoading.set(false);
          this.clientsError.set(true);
        },
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

  /** Project edits can change which clients have active projects. */
  refreshProjects(): void {
    this.invalidate();
  }

  /** Refresh shortcut membership and cached names after an edit or sync. */
  invalidate(): void {
    this.clientCache.clear();
    this.projectCache.clear();
    if (this.clientsLoaded) this.reloadClients();
  }
}
