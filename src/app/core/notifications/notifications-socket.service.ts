import {
  DestroyRef,
  Injectable,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, map, tap } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment.dev';
import { ApiResponse } from '../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../shared/interface/paginated-response.interface';
import { AppNotification } from './notification.model';
import { WorkspaceService } from '../../modules/clients/services/workspace.service';
import { ProjectsService } from '../../modules/tickets/services/projects.service';
import { ApiCache } from '../http/api-cache';

export const TOAST_QUEUE_CAP = 5;
export const PROJECT_REFRESH_DEBOUNCE_MS = 500;

@Injectable({ providedIn: 'root' })
export class NotificationsSocketService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroy = inject(DestroyRef);
  private readonly workspace = inject(WorkspaceService);
  private readonly projects = inject(ProjectsService);
  private readonly cache = inject(ApiCache);
  private readonly url = `${environment.apiBaseUrl}/notifications`;
  private socket?: Socket;
  private readonly toastQueue: AppNotification[] = [];
  private projectRefreshTimer?: ReturnType<typeof setTimeout>;
  readonly toastOverflow = signal(0);
  readonly connected = signal(false);
  readonly unread = signal(0);
  readonly latest = signal<AppNotification[]>([]);
  readonly toast = signal<AppNotification | null>(null);
  readonly incoming = new Subject<AppNotification>();
  readonly reads = new Subject<string | null>();

  constructor() {
    effect(() => {
      const userId = this.auth.currentUser?.()?.id;
      this.auth.organizationId?.();
      untracked(() => {
        this.socket?.disconnect();
        this.socket = undefined;
        clearTimeout(this.projectRefreshTimer);
        this.projectRefreshTimer = undefined;
        this.toastOverflow.set(0);
        this.toastQueue.length = 0;
        this.connected.set(false);
        this.unread.set(0);
        this.latest.set([]);
        this.toast.set(null);
        if (userId) this.connect();
      });
    });
    const onFocus = () => {
      if (this.auth.currentUser?.() && !this.connected()) this.refreshCount();
    };
    window.addEventListener('focus', onFocus);
    this.destroy.onDestroy(() => {
      clearTimeout(this.projectRefreshTimer);
      this.socket?.disconnect();
      window.removeEventListener('focus', onFocus);
    });
  }

  private connect() {
    let connectedBefore = false;
    const socket = io(`${environment.notificationsSocketUrl}/notifications`, {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
    });
    this.socket = socket;
    socket.on('connect', () => {
      this.connected.set(true);
      if (connectedBefore) this.refreshCount();
      connectedBefore = true;
    });
    socket.on('disconnect', () => this.connected.set(false));
    socket.on('connect_error', () => this.connected.set(false));
    socket.on('notification:unread-count', ({ count }: { count: number }) =>
      this.unread.set(count),
    );
    socket.on('notification:new', (item: AppNotification) => {
      // Something changed on the server: cached ticket pages are stale, and lists on screen refresh.
      if (item.entityType === 'ticket') this.cache.invalidate(['tickets', 'notifications']);
      else this.cache.invalidate(['notifications']);
      if (item.entityType === 'project') {
        clearTimeout(this.projectRefreshTimer);
        this.projectRefreshTimer = setTimeout(() => {
          this.projectRefreshTimer = undefined;
          this.workspace.invalidate();
          this.projects.invalidate();
        }, PROJECT_REFRESH_DEBOUNCE_MS);
      }
      this.latest.update((items) =>
        [item, ...items.filter((row) => row.id !== item.id)].slice(0, 10),
      );
      if (this.toast()) {
        if (this.toastQueue.length >= TOAST_QUEUE_CAP) {
          this.toastQueue.shift();
          this.toastOverflow.update((count) => count + 1);
        }
        this.toastQueue.push(item);
      } else this.toast.set(item);
      this.incoming.next(item);
    });
    socket.on('notification:read', ({ id }: { id: string }) =>
      this.applyRead(id),
    );
    socket.on('notification:read-all', () => this.applyRead(null));
  }

  dismissToast() {
    this.toast.set(this.toastQueue.shift() ?? null);
  }
  dismissOverflow() {
    this.toastOverflow.set(0);
  }

  refreshCount() {
    this.http
      .get<ApiResponse<{ count: number }>>(`${this.url}/unread-count`, {
        withCredentials: true,
      })
      .subscribe({
        next: (result) => this.unread.set(result.data.count),
        error: (error) =>
          console.error('Could not refresh notification count.', error),
      });
  }
  list(page = 1, unreadOnly = false, limit = 20) {
    return this.http.get<PaginatedApiResponse<AppNotification>>(this.url, {
      params: { page, limit, unreadOnly },
      withCredentials: true,
    });
  }
  loadLatest() {
    return this.list(1, false, 10).pipe(
      tap((result) => this.latest.set(result.data)),
    );
  }
  read(id: string) {
    return this.http
      .patch<ApiResponse<{ id: string }>>(
        `${this.url}/${id}/read`,
        {},
        { withCredentials: true },
      )
      .pipe(
        map((result) => result.data),
        tap(() => this.applyRead(id)),
      );
  }
  readAll() {
    return this.http
      .patch<ApiResponse<{ count: number }>>(
        `${this.url}/read-all`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap((result) => {
          this.unread.set(result.data.count);
          this.applyRead(null);
        }),
      );
  }
  private applyRead(id: string | null) {
    this.latest.update((items) =>
      items.map((item) =>
        !id || item.id === id
          ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
          : item,
      ),
    );
    this.reads.next(id);
  }
}
