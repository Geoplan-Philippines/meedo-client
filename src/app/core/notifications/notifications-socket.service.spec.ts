import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { WorkspaceService } from '../../modules/clients/services/workspace.service';
import { ProjectsService } from '../../modules/tickets/services/projects.service';
import {
  NotificationsSocketService,
  PROJECT_REFRESH_DEBOUNCE_MS,
  TOAST_QUEUE_CAP,
} from './notifications-socket.service';

const socket = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => void>(),
  on: vi.fn(),
  disconnect: vi.fn(),
}));
const ioMock = vi.hoisted(() => vi.fn());
vi.mock('socket.io-client', () => ({ io: ioMock }));

describe('notification socket and HTTP service', () => {
  const user = signal<{ id: string } | null>({ id: 'example-user' });
  const workspace = { invalidate: vi.fn() };
  const projects = { invalidate: vi.fn() };
  let service: NotificationsSocketService;
  let http: HttpTestingController;
  const item = {
    id: 'example-notification',
    organizationId: 'example-org',
    title: 'Example project',
    body: 'Invented message',
    type: 'project_member_added',
    entityType: 'project',
    entityId: 'example-project',
    link: '/clients',
    readAt: null,
    createdAt: '2026-10-28T00:00:00Z',
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    socket.handlers.clear();
    user.set({ id: 'example-user' });
    socket.on.mockImplementation((event, handler) => {
      socket.handlers.set(event, handler);
      return socket;
    });
    ioMock.mockReturnValue(socket);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser: user } },
        { provide: WorkspaceService, useValue: workspace },
        { provide: ProjectsService, useValue: projects },
      ],
    });
    service = TestBed.inject(NotificationsSocketService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('uses credentials, websocket-only reconnect backoff and disconnects on logout', () => {
    expect(ioMock).toHaveBeenCalledWith(
      expect.stringContaining('/notifications'),
      expect.objectContaining({
        withCredentials: true,
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      }),
    );
    user.set(null);
    TestBed.tick();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(service.latest()).toEqual([]);
    expect(service.unread()).toBe(0);
  });
  it('updates the count, live list and toast from private server events', () => {
    socket.handlers.get('connect')!();
    socket.handlers.get('notification:unread-count')!({ count: 1 });
    socket.handlers.get('notification:new')!(item);
    expect(service.unread()).toBe(1);
    expect(service.latest()).toEqual([item]);
    expect(service.toast()).toEqual(item);
    vi.advanceTimersByTime(PROJECT_REFRESH_DEBOUNCE_MS);
    expect(workspace.invalidate).toHaveBeenCalledTimes(1);
    expect(projects.invalidate).toHaveBeenCalledTimes(1);
    socket.handlers.get('notification:read')!({ id: item.id });
    expect(service.latest()[0].readAt).toBeTruthy();
    socket.handlers.get('notification:read-all')!();
    expect(service.latest().every((row) => !!row.readAt)).toBe(true);
  });
  it('fetches count once on reconnect or disconnected focus, never on initial connect or connected focus', () => {
    socket.handlers.get('connect')!();
    window.dispatchEvent(new Event('focus'));
    http.expectNone((req) => req.url.endsWith('/unread-count'));
    socket.handlers.get('disconnect')!();
    window.dispatchEvent(new Event('focus'));
    http
      .expectOne((req) => req.url.endsWith('/unread-count'))
      .flush({ data: { count: 2 } });
    expect(service.unread()).toBe(2);
    socket.handlers.get('connect')!();
    http
      .expectOne((req) => req.url.endsWith('/unread-count'))
      .flush({ data: { count: 3 } });
    expect(service.unread()).toBe(3);
  });
  it('queues each live toast until dismissed without a timer', () => {
    socket.handlers.get('notification:new')!(item);
    socket.handlers.get('notification:new')!({ ...item, id: 'example-second' });
    expect(service.toast()?.id).toBe(item.id);
    service.dismissToast();
    expect(service.toast()?.id).toBe('example-second');
    service.dismissToast();
    expect(service.toast()).toBeNull();
  });
  it('uses recipient-only HTTP shapes with paging, unread filter and credentials', () => {
    service.list(2, true, 20).subscribe();
    const list = http.expectOne((req) => req.url.endsWith('/notifications'));
    expect(list.request.withCredentials).toBe(true);
    expect(list.request.params.get('page')).toBe('2');
    expect(list.request.params.get('unreadOnly')).toBe('true');
    list.flush({ data: [], meta: { lastPage: 0 } });
    service.read(item.id).subscribe();
    const read = http.expectOne((req) =>
      req.url.endsWith('/example-notification/read'),
    );
    expect(read.request.method).toBe('PATCH');
    expect(read.request.withCredentials).toBe(true);
    expect(read.request.body).toEqual({});
    read.flush({ data: { id: item.id } });
    service.readAll().subscribe();
    const all = http.expectOne((req) => req.url.endsWith('/read-all'));
    expect(all.request.method).toBe('PATCH');
    all.flush({ data: { count: 0 } });
    expect(service.unread()).toBe(0);
  });

  it('bounds a 20-event burst, drops oldest queued items, summarizes overflow and refreshes projects once', () => {
    for (let index = 0; index < 20; index++)
      socket.handlers.get('notification:new')!({
        ...item,
        id: `event-${index}`,
      });
    expect(service.toast()?.id).toBe('event-0');
    expect(service.toastOverflow()).toBe(14);
    expect(workspace.invalidate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PROJECT_REFRESH_DEBOUNCE_MS - 1);
    expect(workspace.invalidate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(workspace.invalidate).toHaveBeenCalledTimes(1);
    expect(projects.invalidate).toHaveBeenCalledTimes(1);
    const queued: string[] = [];
    service.dismissToast();
    while (service.toast()) {
      queued.push(service.toast()!.id);
      service.dismissToast();
    }
    expect(queued).toHaveLength(TOAST_QUEUE_CAP);
    expect(queued).toEqual([
      'event-15',
      'event-16',
      'event-17',
      'event-18',
      'event-19',
    ]);
    service.dismissOverflow();
    expect(service.toastOverflow()).toBe(0);
  });

  it('cancels pending project refresh and overflow on logout', () => {
    for (let i = 0; i < 20; i++)
      socket.handlers.get('notification:new')!({ ...item, id: String(i) });
    user.set(null);
    TestBed.tick();
    vi.advanceTimersByTime(PROJECT_REFRESH_DEBOUNCE_MS);
    expect(workspace.invalidate).not.toHaveBeenCalled();
    expect(service.toastOverflow()).toBe(0);
  });

  it('logs unread-count errors while keeping the previous count', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    service.unread.set(3);
    service.refreshCount();
    http
      .expectOne((req) => req.url.endsWith('/unread-count'))
      .flush({}, { status: 500, statusText: 'Failure' });
    expect(log).toHaveBeenCalledWith(
      'Could not refresh notification count.',
      expect.anything(),
    );
    expect(service.unread()).toBe(3);
    log.mockRestore();
  });
});
