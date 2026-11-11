import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { NotificationsSocketService } from '../../../core/notifications/notifications-socket.service';
import { AppNotification } from '../../../core/notifications/notification.model';
import { notificationRoute } from '../../../core/notifications/notification-route';

@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="bell"
      aria-label="Notifications"
      [attr.aria-expanded]="open()"
      aria-controls="notifications-panel"
      (click)="toggle()"
    >
      <i class="pi pi-bell" aria-hidden="true"></i>
      @if (notifications.unread()) {
        <span class="badge" aria-live="polite">{{
          notifications.unread()
        }}</span>
      }
    </button>
    @if (open()) {
      <section
        id="notifications-panel"
        class="panel"
        aria-label="Latest notifications"
        (keydown.escape)="open.set(false)"
      >
        <header>
          <strong>Notifications</strong
          ><button (click)="markAll()">Mark all read</button
          ><button aria-label="Close notifications" (click)="open.set(false)">
            ×
          </button>
        </header>
        @if (!notifications.connected()) {
          <p role="status">Live connection unavailable. Reconnecting…</p>
        }
        @if (loading()) {
          <p role="status">Loading…</p>
        }
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        @for (item of notifications.latest(); track item.id) {
          <button
            class="item"
            [class.unread]="!item.readAt"
            [disabled]="!route(item)"
            (click)="visit(item)"
          >
            <strong>{{ item.title }}</strong
            ><span>{{ item.body }}</span>
          </button>
        } @empty {
          @if (!loading()) {
            <p>No notifications yet.</p>
          }
        }
        <a routerLink="/notifications" (click)="open.set(false)"
          >See all notifications</a
        >
      </section>
    }
    @if (notifications.toast(); as item) {
      <aside class="toast" role="status" aria-live="polite">
        <button
          aria-label="Dismiss notification"
          (click)="notifications.dismissToast()"
        >
          ×</button
        ><strong>{{ item.title }}</strong>
        <p>{{ item.body }}</p>
        @if (route(item)) {
          <button (click)="visit(item); notifications.dismissToast()">
            View
          </button>
        }
        @if (notifications.toastOverflow()) {
          <p class="overflow-summary">
            <a
              routerLink="/notifications"
              (click)="notifications.dismissOverflow()"
              >{{ notifications.toastOverflow() }} more notifications</a
            >
          </p>
        }
      </aside>
    } @else if (notifications.toastOverflow()) {
      <aside class="toast" role="status">
        <a routerLink="/notifications" (click)="notifications.dismissOverflow()"
          >{{ notifications.toastOverflow() }} more notifications</a
        ><button
          aria-label="Dismiss notification summary"
          (click)="notifications.dismissOverflow()"
        >
          ×
        </button>
      </aside>
    }
  `,
  styleUrl: './notification-bell.css',
})
export class NotificationBell {
  readonly notifications = inject(NotificationsSocketService);
  readonly route = notificationRoute;
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  toggle() {
    this.open.update((value) => !value);
    if (!this.open()) return;
    this.loading.set(true);
    this.error.set('');
    this.notifications
      .loadLatest()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.loading.set(false),
        error: () => {
          this.loading.set(false);
          this.error.set(
            'Could not load notifications. Close and reopen to retry.',
          );
        },
      });
  }
  markAll() {
    this.notifications
      .readAll()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
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
          this.open.set(false);
          void this.router.navigate(commands);
        },
        error: () => this.error.set('Could not open this notification.'),
      });
  }
}
