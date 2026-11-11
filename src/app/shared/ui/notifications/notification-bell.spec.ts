import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotificationsSocketService } from '../../../core/notifications/notifications-socket.service';
import { NotificationBell } from './notification-bell';

describe('notification bell, badge and live toast', () => {
  const item = {
    id: 'example-notification',
    title: 'Added to Example project',
    body: 'Invented notification',
    link: 'https://untrusted.test',
    entityType: 'ticket',
    entityId: 'example-ticket',
    readAt: null,
  };
  const api = {
    toastOverflow: signal(0),
    dismissOverflow: vi.fn(),
    unread: signal(0),
    latest: signal<any[]>([]),
    toast: signal<any>(null),
    connected: signal(true),
    loadLatest: vi.fn(),
    read: vi.fn(),
    readAll: vi.fn(),
    dismissToast: vi.fn(() => api.toast.set(null)),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    api.toastOverflow.set(0);
    api.unread.set(0);
    api.latest.set([]);
    api.toast.set(null);
    api.connected.set(true);
    api.loadLatest.mockReturnValue(of({}));
    api.read.mockReturnValue(of({}));
    api.readAll.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      imports: [NotificationBell],
      providers: [
        provideRouter([]),
        { provide: NotificationsSocketService, useValue: api },
      ],
    });
  });
  it('shows live badge and toast updates without reloading the page', () => {
    const fixture = TestBed.createComponent(NotificationBell);
    fixture.detectChanges();
    api.unread.set(1);
    api.toast.set(item);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.badge').textContent).toContain(
      '1',
    );
    expect(fixture.nativeElement.querySelector('.toast').textContent).toContain(
      item.title,
    );
    fixture.nativeElement
      .querySelector('[aria-label="Dismiss notification"]')
      .click();
    expect(api.toast()).toBeNull();
  });
  it('loads latest on open, highlights unread items and supports mark all and click navigation', () => {
    const fixture = TestBed.createComponent(NotificationBell);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.toggle();
    api.latest.set([item]);
    fixture.detectChanges();
    expect(api.loadLatest).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.item.unread')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(
      'See all notifications',
    );
    fixture.componentInstance.markAll();
    expect(api.readAll).toHaveBeenCalled();
    fixture.nativeElement.querySelector('.item').click();
    expect(api.read).toHaveBeenCalledWith(item.id);
    expect(router.navigate).toHaveBeenCalledWith(['/tickets', item.entityId]);
  });
  it('shows loading, empty and error states', () => {
    const fixture = TestBed.createComponent(NotificationBell);
    const pending = new Subject();
    api.loadLatest.mockReturnValue(pending);
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading');
    pending.next({});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No notifications yet');
    fixture.componentInstance.toggle();
    api.loadLatest.mockReturnValue(
      throwError(() => new Error('Invented error')),
    );
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
  });

  it('renders hostile HTML as literal text in bell and toast and provides no unknown-entity navigation', () => {
    const hostile = {
      ...item,
      entityType: 'unknown',
      title: '<script>alert(1)</script>',
      body: '<img src=x onerror=alert(1)>',
    };
    const fixture = TestBed.createComponent(NotificationBell);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.toggle();
    api.latest.set([hostile]);
    api.toast.set(hostile);
    fixture.detectChanges();
    for (const selector of ['.item', '.toast']) {
      const element = fixture.nativeElement.querySelector(selector);
      expect(element.textContent).toContain(hostile.title);
      expect(element.textContent).toContain(hostile.body);
      expect(element.querySelector('script,img,a')).toBeNull();
    }
    expect(fixture.nativeElement.querySelector('.item').disabled).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.toast').textContent,
    ).not.toContain('View');
    fixture.componentInstance.visit(hostile as any);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows one overflow summary with a fixed inbox route', () => {
    const fixture = TestBed.createComponent(NotificationBell);
    api.toast.set(item);
    api.toastOverflow.set(14);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('.overflow-summary'),
    ).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelector('.overflow-summary').textContent,
    ).toContain('14 more notifications');
    expect(
      fixture.nativeElement
        .querySelector('.overflow-summary a')
        .getAttribute('href'),
    ).toBe('/notifications');
  });
});
