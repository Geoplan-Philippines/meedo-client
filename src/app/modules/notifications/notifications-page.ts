import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, catchError, of, startWith, switchMap, tap } from 'rxjs';
import { NotificationsSocketService } from '../../core/notifications/notifications-socket.service';
import { AppNotification } from '../../core/notifications/notification.model';
import { notificationRoute } from '../../core/notifications/notification-route';

@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <h1>All notifications</h1>
      <div class="actions">
        <label
          ><input
            type="checkbox"
            [checked]="unreadOnly()"
            (change)="toggleUnread()"
          />
          Unread only</label
        ><button (click)="markAll()">Mark all read</button>
      </div>
      @if (loading()) {
        <p role="status">Loading notifications…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
        <button (click)="load()">Retry</button>
      }
      @for (item of items(); track item.id) {
        <button
          class="item"
          [class.unread]="!item.readAt"
          [disabled]="!route(item)"
          (click)="visit(item)"
        >
          <strong>{{ item.title }}</strong
          ><span>{{ item.body }}</span
          ><small>{{ item.readAt ? 'Read' : 'Unread' }}</small>
        </button>
      }
      @if (!loading() && !error() && !items().length) {
        <p>No notifications found.</p>
      }
      <footer>
        <button
          [disabled]="loading() || page() <= 1"
          (click)="page.set(page() - 1); load()"
        >
          Previous</button
        ><span>Page {{ page() }} of {{ lastPage() || 1 }}</span
        ><button
          [disabled]="loading() || page() >= lastPage()"
          (click)="page.set(page() + 1); load()"
        >
          Next
        </button>
      </footer>
    </main>
  `,
  styles: [
    `
      main {
        padding: 1.5rem;
        max-width: 60rem;
        margin: auto;
        color: var(--text-body);
      }
      h1 {
        font-size: 1.75rem;
        color: var(--text-heading);
        font-weight: 700;
      }
      .actions,
      footer {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin: 1rem 0;
      }
      button {
        padding: 0.625rem;
        border: 1px solid var(--border);
        border-radius: 4px;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
      }
      .item {
        display: flex;
        flex-direction: column;
        text-align: left;
        width: 100%;
        background: var(--surface);
        margin: 0.5rem 0;
      }
      .unread {
        background: var(--secondary);
        border-left: 3px solid var(--primary);
      }
      button:focus-visible {
        outline: 2px solid var(--ring);
      }
    `,
  ],
})
export class NotificationsPage {
  readonly notifications = inject(NotificationsSocketService);
  readonly route = notificationRoute;
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly refresh = new Subject<void>();
  readonly items = signal<AppNotification[]>([]);
  readonly page = signal(1);
  readonly lastPage = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly unreadOnly = signal(false);
  constructor() {
    this.refresh
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap(() =>
          this.notifications.list(this.page(), this.unreadOnly()).pipe(
            catchError(() => {
              this.error.set('Could not load notifications.');
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result) {
          this.items.set(result.data);
          this.lastPage.set(result.meta.lastPage);
        }
      });
    this.notifications.incoming
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((item) => {
        if (this.page() === 1)
          this.items.update((items) =>
            [item, ...items.filter((row) => row.id !== item.id)].slice(0, 20),
          );
      });
    this.notifications.reads
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((id) =>
        this.items.update((items) =>
          items
            .map((item) =>
              !id || id === item.id
                ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
                : item,
            )
            .filter((item) => !this.unreadOnly() || !item.readAt),
        ),
      );
  }
  load() {
    this.refresh.next();
  }
  toggleUnread() {
    this.unreadOnly.update((value) => !value);
    this.page.set(1);
    this.load();
  }
  markAll() {
    this.notifications
      .readAll()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('Could not mark notifications read.'),
      });
  }
  visit(item: AppNotification) {
    const commands = this.route(item);
    if (!commands) return;
    this.notifications
      .read(item.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          void this.router.navigate(commands);
        },
        error: () => this.error.set('Could not open notification.'),
      });
  }
}
