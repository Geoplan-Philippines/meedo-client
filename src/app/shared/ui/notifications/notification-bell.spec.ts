import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotificationsSocketService } from '../../../core/notifications/notifications-socket.service';
import { NotificationBell } from './notification-bell';

describe('notification bell, badge and live toast', () => {
  const item = { id: 'example-notification', title: 'Added to Example project', body: 'Invented notification', link: '/notifications', readAt: null };
  const api = { unread: signal(0), latest: signal<any[]>([]), toast: signal<any>(null), connected: signal(true), loadLatest: vi.fn(), read: vi.fn(), readAll: vi.fn(), dismissToast: vi.fn(() => api.toast.set(null)) };
  beforeEach(() => { vi.clearAllMocks(); api.unread.set(0); api.latest.set([]); api.toast.set(null); api.connected.set(true); api.loadLatest.mockReturnValue(of({})); api.read.mockReturnValue(of({})); api.readAll.mockReturnValue(of({})); TestBed.configureTestingModule({ imports: [NotificationBell], providers: [provideRouter([]), { provide: NotificationsSocketService, useValue: api }] }); });
  it('shows live badge and toast updates without reloading the page', () => {
    const fixture = TestBed.createComponent(NotificationBell); fixture.detectChanges(); api.unread.set(1); api.toast.set(item); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.badge').textContent).toContain('1'); expect(fixture.nativeElement.querySelector('.toast').textContent).toContain(item.title);
    fixture.nativeElement.querySelector('[aria-label="Dismiss notification"]').click(); expect(api.toast()).toBeNull();
  });
  it('loads latest on open, highlights unread items and supports mark all and click navigation', () => {
    const fixture = TestBed.createComponent(NotificationBell); const router = TestBed.inject(Router); vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance.toggle(); api.latest.set([item]); fixture.detectChanges(); expect(api.loadLatest).toHaveBeenCalledTimes(1); expect(fixture.nativeElement.querySelector('.item.unread')).toBeTruthy(); expect(fixture.nativeElement.textContent).toContain('See all notifications');
    fixture.componentInstance.markAll(); expect(api.readAll).toHaveBeenCalled(); fixture.nativeElement.querySelector('.item').click(); expect(api.read).toHaveBeenCalledWith(item.id); expect(router.navigateByUrl).toHaveBeenCalledWith(item.link);
  });
  it('shows loading, empty and error states', () => {
    const fixture = TestBed.createComponent(NotificationBell); const pending = new Subject(); api.loadLatest.mockReturnValue(pending); fixture.componentInstance.toggle(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Loading'); pending.next({}); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('No notifications yet');
    fixture.componentInstance.toggle(); api.loadLatest.mockReturnValue(throwError(() => new Error('Invented error'))); fixture.componentInstance.toggle(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
  });
});
