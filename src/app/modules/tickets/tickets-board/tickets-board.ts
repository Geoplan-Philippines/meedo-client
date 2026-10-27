import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TitleCasePipe } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { Status } from '../models/status.model';
import { Ticket, TicketFacets, TicketListParams } from '../models/ticket.model';
import { TicketsService } from '../services/tickets.service';
import { extraAssigneeCount, safeStatusColor, visibleAssignees } from '../utils/ticket.utils';
import { SlaBadge } from '../sla-badge/sla-badge';

export interface BoardColumn {
  id: string | null;
  name: string;
  status?: Status;
  total: number;
}
interface ColumnPage { tickets: Ticket[]; page: number; more: boolean; loading: boolean; error: boolean }
const SYSTEM_ORDER = ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done', 'Canceled'];
const EMPTY_PAGE: ColumnPage = { tickets: [], page: 0, more: false, loading: false, error: false };
export const columnKey = (id: string | null) => id ?? 'no-status';

export function buildColumns(statuses: Status[], facets: TicketFacets | null, selected: string[] = []): BoardColumn[] {
  const counts = new Map(facets?.statuses.map(entry => [entry.ticketStatusId, entry.count]));
  const rank = (status: Status) => status.isSystem ? SYSTEM_ORDER.indexOf(status.name) : -1;
  const columns: BoardColumn[] = statuses.filter(status => !status.isArchived).sort((a, b) => {
    const ar = rank(a), br = rank(b);
    if (ar >= 0 || br >= 0) return (ar < 0 ? Infinity : ar) - (br < 0 ? Infinity : br);
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  }).map(status => ({ id: status.id, name: status.name, status,
    total: selected.length && !selected.includes(status.id) ? 0 : counts.get(status.id) ?? 0 }));
  if (!selected.length && (facets?.noStatusCount ?? 0) > 0) {
    columns.push({ id: null, name: 'No status', total: facets!.noStatusCount! });
  }
  return columns;
}

export function columnRequest(filters: TicketListParams, id: string | null, page: number): TicketListParams {
  return { ...filters, page, limit: 20, ticketStatusId: id ? [id] : undefined,
    noStatus: id === null, sortField: 'board', sortOrder: 'desc' };
}

@Component({
  selector: 'app-tickets-board',
  standalone: true,
  imports: [CdkDrag, CdkDropList, CdkDropListGroup, TitleCasePipe, TagModule, AvatarModule, SlaBadge],
  templateUrl: './tickets-board.html',
  styleUrl: './tickets-board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketsBoard {
  readonly statuses = input.required<Status[]>();
  readonly filters = input.required<TicketListParams>();
  readonly revision = input(0);
  readonly openTicket = output<Ticket>();
  readonly moved = output<void>();
  private readonly service = inject(TicketsService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly facets = signal<TicketFacets | null>(null);
  readonly pages = signal<Record<string, ColumnPage>>({});
  readonly pending = signal<string | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly columns = computed(() => buildColumns(this.statuses(), this.facets(), this.filters().ticketStatusId));
  readonly moveStatuses = computed(() => this.statuses().filter(status => !status.isArchived));
  private generation = 0;
  readonly avatars = visibleAssignees;
  readonly extraAvatars = extraAssigneeCount;
  readonly statusColor = safeStatusColor;

  constructor() {
    effect(() => {
      this.statuses(); this.filters(); this.revision();
      untracked(() => this.reload());
    });
  }

  reload(): void {
    const generation = ++this.generation;
    this.pages.set({}); this.facets.set(null); this.loading.set(true); this.failed.set(false);
    const { view, search, teamId, categoryId, projectId, assigneeId, includeArchived, priority } = this.filters();
    this.service.getFacets({ view, search, teamId, categoryId, projectId, assigneeId, includeArchived, priority })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: facets => {
          if (generation !== this.generation) return;
          this.facets.set(facets); this.loading.set(false);
          for (const column of this.columns()) this.loadMore(column.id, true);
        },
        error: () => {
          if (generation !== this.generation) return;
          this.loading.set(false); this.failed.set(true);
        },
      });
  }

  page(id: string | null): ColumnPage { return this.pages()[columnKey(id)] ?? EMPTY_PAGE; }

  loadMore(id: string | null, refresh = false): void {
    const current = this.page(id), generation = this.generation;
    if (current.loading || (this.pending() && !refresh)) return;
    const selected = this.filters().ticketStatusId;
    if (selected?.length && (id === null || !selected.includes(id))) return;
    this.setPage(id, { ...current, loading: true, error: false });
    this.service.getAll(columnRequest(this.filters(), id, current.page + 1))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => {
          if (generation !== this.generation) return;
          const tickets = [...new Map([...current.tickets, ...response.data].map(ticket => [ticket.id, ticket])).values()];
          this.setPage(id, { tickets: this.sort(tickets), page: response.meta.page,
            more: response.meta.page < response.meta.lastPage, loading: false, error: false });
        },
        error: () => {
          if (generation === this.generation) this.setPage(id, { ...current, loading: false, error: true });
        },
      });
  }

  drop(event: CdkDragDrop<string | null, string | null, Ticket>): void {
    if (event.isPointerOverContainer) this.move(event.item.data, event.container.data);
  }

  move(ticket: Ticket, id: string | null): void {
    const from = ticket.ticketStatusId ?? null;
    if (from === id || this.pending()) return;
    const previous = this.pages(), previousFacets = this.facets();
    this.pending.set(ticket.id);
    // Invalidate in-flight column pages so they cannot overwrite the optimistic move.
    ++this.generation;
    const moveGeneration = this.generation;
    this.place({ ...ticket, ticketStatusId: id, ticketStatus: this.statuses().find(s => s.id === id) ?? null,
      updatedAt: new Date().toISOString() }, id);
    this.facets.update(facets => facets ? { ...facets,
      statuses: [...new Set([...facets.statuses.map(entry => entry.ticketStatusId), ...(id ? [id] : [])])].map(ticketStatusId => ({
        ticketStatusId,
        count: Math.max(0, (facets.statuses.find(entry => entry.ticketStatusId === ticketStatusId)?.count ?? 0)
          + (ticketStatusId === id && this.matchesView(id) ? 1 : 0) - (ticketStatusId === from ? 1 : 0)),
      })),
      noStatusCount: Math.max(0, (facets.noStatusCount ?? 0) + (id === null && this.matchesView(null) ? 1 : 0) - (from === null ? 1 : 0)),
    } : facets);
    this.service.updateTicket(ticket.id, { ticketStatusId: id })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: updated => {
          this.pending.set(null);
          if (moveGeneration === this.generation) this.place(updated, updated.ticketStatusId ?? null);
          this.moved.emit();
          this.reload();
        },
        error: () => {
          this.pending.set(null);
          if (moveGeneration === this.generation) {
            this.facets.set(previousFacets);
            this.pages.set(Object.fromEntries(Object.entries(previous).map(([key, page]) => [key, { ...page, loading: false, error: page.error || page.loading }])));
          }
          this.messages.add({ severity: 'error', summary: 'Status change failed', detail: 'The ticket was returned to its previous status. Try again.' });
        },
      });
  }

  private place(ticket: Ticket, to: string | null): void {
    const visible = this.matchesView(to);
    const selected = this.filters().ticketStatusId;
    this.pages.update(pages => {
      const next = Object.fromEntries(Object.entries(pages).map(([key, page]) => [key,
        { ...page, loading: false, tickets: page.tickets.filter(item => item.id !== ticket.id) }]));
      if (visible && (!selected?.length || (to !== null && selected.includes(to)))) {
        const page = next[columnKey(to)] ?? EMPTY_PAGE;
        next[columnKey(to)] = { ...page, tickets: this.sort([...page.tickets, ticket]) };
      }
      return next;
    });
  }

  private matchesView(to: string | null): boolean {
    const view = this.filters().view;
    const category = this.statuses().find(status => status.id === to)?.category;
    return !view || view === 'all' || (view === 'active' && ['UNSTARTED', 'STARTED'].includes(category ?? ''))
      || (view === 'backlog' && category === 'BACKLOG') || (view === 'closed' && ['COMPLETED', 'CANCELED'].includes(category ?? ''));
  }

  private sort(tickets: Ticket[]): Ticket[] {
    const rank = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return tickets.sort((a, b) => rank[a.priority] - rank[b.priority] || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }
  private setPage(id: string | null, page: ColumnPage): void {
    this.pages.update(pages => ({ ...pages, [columnKey(id)]: page }));
  }
}
