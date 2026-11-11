import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotificationsSocketService } from '../../core/notifications/notifications-socket.service';
import { NotificationsPage } from './notifications-page';

describe('All Notifications page', () => {
  const item = {
    id: 'example-notification',
    title: 'Example notification',
    body: 'Invented message',
    readAt: null,
    link: '/notifications',
  };
  const api = {
    list: vi.fn(),
    read: vi.fn(),
    readAll: vi.fn(),
    incoming: new Subject<any>(),
    reads: new Subject<string | null>(),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of({ data: [], meta: { lastPage: 2 } }));
    api.read.mockReturnValue(of({}));
    api.readAll.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [
        provideRouter([]),
        { provide: NotificationsSocketService, useValue: api },
      ],
    });
  });
  it('renders empty state, paging and unread filtering', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No notifications found',
    );
    expect(api.list).toHaveBeenCalledWith(1, false);
    fixture.componentInstance.page.set(2);
    fixture.componentInstance.load();
    expect(api.list).toHaveBeenLastCalledWith(2, false);
    fixture.componentInstance.toggleUnread();
    expect(api.list).toHaveBeenLastCalledWith(1, true);
  });
  it('prepends socket arrivals and applies read changes from other tabs', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    api.incoming.next(item);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.unread')).toBeTruthy();
    api.reads.next(item.id);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.unread')).toBeNull();
    fixture.componentInstance.toggleUnread();
    api.incoming.next(item);
    api.reads.next(null);
    expect(fixture.componentInstance.items()).toEqual([]);
  });
  it('marks all read and exposes HTTP errors with retry', () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.componentInstance.markAll();
    expect(api.readAll).toHaveBeenCalled();
    api.list.mockReturnValue(throwError(() => new Error('Invented error')));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Retry');
  });

  it('renders hostile payloads as text and never follows links for an unknown entity', () => {
    const hostile = {
      ...item,
      title: '<script>alert(1)</script>',
      body: '<img src=x onerror=alert(1)>',
      entityType: 'unknown',
      entityId: 'id',
      link: '/tickets/forged',
    };
    api.list.mockReturnValue(of({ data: [hostile], meta: { lastPage: 1 } }));
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('.item');
    expect(row.textContent).toContain(hostile.title);
    expect(row.textContent).toContain(hostile.body);
    expect(row.querySelector('script,img,a')).toBeNull();
    expect(row.disabled).toBe(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.visit(hostile as any);
    expect(navigate).not.toHaveBeenCalled();
  });
});
