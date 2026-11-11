import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { MessageService } from 'primeng/api';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { Status } from '../models/status.model';
import { Ticket, TicketFacets, TicketListParams } from '../models/ticket.model';
import { TicketsService } from '../services/tickets.service';
import { buildColumns, columnRequest, TicketsBoard } from './tickets-board';

const status = (id: string, name: string, category: Status['category'], extra: Partial<Status> = {}): Status =>
  ({ id, name, category, color: '', organizationId: 'org', isArchived: false, ...extra });
const todo = status('todo', 'Todo', 'UNSTARTED', { isSystem: true });
const done = status('done', 'Done', 'COMPLETED', { isSystem: true });
const ticket: Ticket = { id: 'ticket', ticketNumber: 123456, title: 'Fix pump', priority: 'HIGH',
  organizationId: 'org', ticketStatusId: 'todo', createdAt: '2026-10-01', updatedAt: '2026-10-02' };
const facets: TicketFacets = { views: { all: 1, active: 1, backlog: 0, closed: 0 },
  statuses: [{ ticketStatusId: 'todo', count: 31 }], priorities: [], noStatusCount: 0 };
const filters: TicketListParams = { page: 1, limit: 20, view: 'all' };

describe('board columns and requests', () => {
  it('places system columns in canonical order, custom by creation, and excludes archived statuses', () => {
    const statuses = [status('b', 'Custom B', 'STARTED', { createdAt: '2026-02-01' }), done,
      status('review', 'In Review', 'STARTED', { isSystem: true }), todo,
      status('archived', 'Archived', 'STARTED', { isArchived: true }),
      status('a', 'Custom A', 'STARTED', { createdAt: '2026-01-01' })];
    expect(buildColumns(statuses, facets).map(column => column.id)).toEqual(['todo', 'review', 'done', 'a', 'b']);
    expect(statuses[0].id).toBe('b');
    expect(buildColumns(statuses, facets)[0].total).toBe(31);
  });

  it('adds No status only when matching tickets exist, respecting selected status filters', () => {
    expect(buildColumns([todo], facets).map(column => column.id)).toEqual(['todo']);
    const withNull = { ...facets, noStatusCount: 2 };
    expect(buildColumns([todo], withNull).at(-1)).toEqual({ id: null, name: 'No status', total: 2 });
    expect(buildColumns([todo], withNull, ['todo']).map(column => column.id)).toEqual(['todo']);
  });

  it('maps every active filter to an independently paged status request with board ordering', () => {
    const scope: TicketListParams = { ...filters, view: 'active', search: 'pump', teamId: ['t1', 't2'],
      assigneeId: 'my-member', priority: ['HIGH'], categoryId: 'category', ticketStatusId: ['old'], includeArchived: false };
    expect(columnRequest(scope, 'todo', 2)).toEqual({ ...scope, page: 2, limit: 20,
      ticketStatusId: ['todo'], noStatus: false, sortField: 'board', sortOrder: 'desc' });
    expect(columnRequest(scope, null, 1)).toEqual(expect.objectContaining({ noStatus: true, ticketStatusId: undefined }));
  });
});

describe('TicketsBoard', () => {
  let fixture: ComponentFixture<TicketsBoard>;
  let board: TicketsBoard;
  let response: Subject<Ticket>;
  let service: { getAll: ReturnType<typeof vi.fn>; getFacets: ReturnType<typeof vi.fn>; updateTicket: ReturnType<typeof vi.fn> };
  let messages: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    response = new Subject<Ticket>();
    service = {
      getFacets: vi.fn().mockReturnValue(of(facets)),
      getAll: vi.fn().mockImplementation((params: TicketListParams) => of({ data: params.ticketStatusId?.[0] === 'todo' ? [ticket] : [],
        meta: { page: params.page, lastPage: params.page === 1 ? 2 : 2, total: 31, limit: 20 } })),
      updateTicket: vi.fn().mockReturnValue(response),
    };
    messages = { add: vi.fn() };
    await TestBed.configureTestingModule({ imports: [TicketsBoard], providers: [
      { provide: TicketsService, useValue: service }, { provide: MessageService, useValue: messages },
    ] }).compileComponents();
    fixture = TestBed.createComponent(TicketsBoard); board = fixture.componentInstance;
    fixture.componentRef.setInput('statuses', [done, todo]);
    fixture.componentRef.setInput('filters', filters);
    fixture.detectChanges(); await fixture.whenStable();
  });

  const drop = (board: TicketsBoard) => board.drop({ isPointerOverContainer: true,
    item: { data: ticket }, container: { data: 'done' } } as CdkDragDrop<string | null, string | null, Ticket>);

  it('loads one first page per column and loads subsequent pages independently', () => {
    expect(service.getAll).toHaveBeenCalledTimes(2);
    expect(board.page('todo').tickets).toEqual([ticket]);
    board.loadMore('todo');
    expect(service.getAll).toHaveBeenLastCalledWith(columnRequest(filters, 'todo', 2));
    expect(board.page('done').page).toBe(1);
    expect(board.page('todo').more).toBe(false);
  });

  it('optimistically moves on drop, patches only status, reconciles and refreshes facets', () => {
    const moved = vi.fn(); board.moved.subscribe(moved);
    drop(board);
    expect(service.updateTicket).toHaveBeenCalledWith(ticket.id, { ticketStatusId: 'done' });
    expect(board.page('todo').tickets).toEqual([]);
    expect(board.page('done').tickets[0].ticketStatusId).toBe('done');
    expect(board.columns().find(column => column.id === 'todo')?.total).toBe(30);
    expect(board.columns().find(column => column.id === 'done')?.total).toBe(1);
    const updated = { ...ticket, ticketStatusId: 'done', title: 'Server title' };
    service.getAll.mockReturnValue(of({ data: [updated], meta: { page: 1, lastPage: 1, total: 1 } }));
    response.next(updated); response.complete();
    expect(board.page('done').tickets[0].title).toBe('Server title');
    expect(service.getFacets).toHaveBeenCalledTimes(2);
    expect(moved).toHaveBeenCalledOnce();
  });

  it('rolls back failed drops and shows an error toast', () => {
    drop(board); response.error(new Error('failed'));
    expect(board.page('todo').tickets).toEqual([ticket]);
    expect(board.page('done').tickets).toEqual([]);
    expect(board.columns().find(column => column.id === 'todo')?.total).toBe(31);
    expect(board.columns().find(column => column.id === 'done')?.total).toBe(0);
    expect(board.pending()).toBeNull();
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('uses the accessible menu to perform the same status-only update', async () => {
    const card = fixture.nativeElement.querySelector('.ticket-card') as HTMLElement;
    expect(card.tabIndex).toBe(0);
    const open = vi.fn(); board.openTicket.subscribe(open);
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(open).toHaveBeenCalledWith(ticket);
    const select = card.querySelector('select')!;
    select.value = 'done'; select.dispatchEvent(new Event('change'));
    expect(service.updateTicket).toHaveBeenCalledWith(ticket.id, { ticketStatusId: 'done' });
  });

  it('renders project and client from the ticket without a project lookup or navigation link', async () => {
    board.pages.update(pages => ({ ...pages, todo: { ...pages['todo'], tickets: [{ ...ticket,
      project: { id: 'restricted', displayName: 'Restricted rollout', workOrderNumber: null, customerName: null,
        client: { displayName: 'Acme client', customerName: null } } }] } }));
    fixture.detectChanges();
    await fixture.whenStable();
    const context = fixture.nativeElement.querySelector('[data-testid="ticket-project-context"]');
    expect(context.textContent).toContain('Restricted rollout');
    expect(context.textContent).toContain('Acme client');
    expect(context.querySelector('a,button')).toBeNull();
  });

  it('does not make a request for same-column drops or drops outside the board', () => {
    board.move(ticket, 'todo');
    board.drop({ isPointerOverContainer: false } as CdkDragDrop<string | null, string | null, Ticket>);
    expect(service.updateTicket).not.toHaveBeenCalled();
  });

  it('does not let a failed old move overwrite a newly filtered board', async () => {
    drop(board);
    service.getAll.mockReturnValue(of({ data: [], meta: { page: 1, lastPage: 0, total: 0 } }));
    fixture.componentRef.setInput('filters', { ...filters, search: 'new', assigneeId: 'my-member', priority: ['HIGH'] });
    fixture.detectChanges(); await fixture.whenStable();
    response.error(new Error('failed'));
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'new', assigneeId: 'my-member', priority: ['HIGH'] }));
    expect(board.page('todo').tickets).toEqual([]);
  });

  it('removes an active ticket moved to No status without creating an invisible-ticket column', async () => {
    fixture.componentRef.setInput('filters', { ...filters, view: 'active' });
    fixture.detectChanges(); await fixture.whenStable();
    board.move(ticket, null);
    expect(service.updateTicket).toHaveBeenCalledWith(ticket.id, { ticketStatusId: null });
    expect(board.page('todo').tickets).toEqual([]);
    expect(board.page(null).tickets).toEqual([]);
    expect(board.columns().some(column => column.id === null)).toBe(false);
    response.error(new Error('failed'));
    expect(board.page('todo').tickets).toEqual([ticket]);
  });

  it('ignores an in-flight column response after an optimistic move', async () => {
    const late = new Subject<any>();
    service.getAll.mockReturnValueOnce(late);
    board.loadMore('todo');
    drop(board);
    late.next({ data: [ticket], meta: { page: 2, lastPage: 2, total: 31 } });
    late.complete();
    expect(board.page('todo').tickets).toEqual([]);
    expect(board.page('done').tickets[0].id).toBe(ticket.id);
    response.error(new Error('failed'));
    expect(board.page('todo').tickets).toEqual([ticket]);
    expect(board.page('todo').loading).toBe(false);
  });
});
