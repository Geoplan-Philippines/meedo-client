import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, finalize } from 'rxjs';

import { TicketsService } from '../services/tickets.service';
import { StatusesService } from '../services/statuses.service';
import { Status, TicketStatusCategory } from '../models/status.model';
import { Ticket, TicketFacets } from '../models/ticket.model';
import { TicketStats } from '../models/ticket-stats.model';
import { DashboardMetric, PrioritySegment, StatusSegment } from './models/dashboard.model';
import {
  AssigneeAvatar,
  visibleAssignees as visibleAssigneesUtil,
  extraAssigneeCount as extraAssigneeCountUtil,
  safeStatusColor as safeStatusColorUtil,
  startOfToday,
} from '../utils/ticket.utils';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** Lifecycle order for the status bar so the queue reads left-to-right the way work moves. */
const CATEGORY_ORDER: Record<TicketStatusCategory, number> = {
  BACKLOG: 0,
  UNSTARTED: 1,
  STARTED: 2,
  COMPLETED: 3,
  CANCELED: 4,
};

/** Severity-first order + labels for the priority breakdown. */
const PRIORITY_META: { value: Priority; label: string }[] = [
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

@Component({
  selector: 'app-tickets-dashboard',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly ticketsService = inject(TicketsService);
  private readonly statusesService = inject(StatusesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  readonly stats = signal<TicketStats | null>(null);
  readonly facets = signal<TicketFacets | null>(null);
  readonly statuses = signal<Status[]>([]);
  readonly attention = signal<Ticket[]>([]);

  /** Fixed-length placeholders driving the loading skeletons. */
  readonly skeletonMetrics = [0, 1, 2, 3, 4];
  readonly skeletonRows = [0, 1, 2, 3];

  // Start of today, computed once — used to flag overdue due dates.
  private readonly today = startOfToday();

  readonly hasTickets = computed(() => (this.stats()?.total ?? this.facets()?.views.all ?? 0) > 0);

  // ─── Metric strip ───────────────────────────────────────
  readonly metrics = computed<DashboardMetric[]>(() => {
    const stats = this.stats();
    const views = this.facets()?.views;
    return [
      { key: 'total', label: 'Total', value: stats?.total ?? views?.all ?? 0, tone: 'default' },
      { key: 'active', label: 'Active', value: views?.active ?? 0, tone: 'default' },
      { key: 'backlog', label: 'Backlog', value: views?.backlog ?? 0, tone: 'default' },
      { key: 'urgent', label: 'Urgent', value: stats?.urgent ?? 0, tone: 'attention' },
      { key: 'overdue', label: 'Overdue', value: stats?.overdue ?? 0, tone: 'attention' },
    ];
  });

  // ─── Status distribution ────────────────────────────────
  private readonly statusCountById = computed(() => {
    const map = new Map<string, number>();
    for (const entry of this.facets()?.statuses ?? []) map.set(entry.ticketStatusId, entry.count);
    return map;
  });

  readonly statusTotal = computed(() =>
    (this.facets()?.statuses ?? []).reduce((sum, entry) => sum + entry.count, 0),
  );

  readonly statusSegments = computed<StatusSegment[]>(() => {
    const counts = this.statusCountById();
    const total = this.statusTotal();
    if (!total) return [];
    return this.statuses()
      .filter((status) => (counts.get(status.id) ?? 0) > 0)
      .sort((a, b) => {
        const orderA = CATEGORY_ORDER[a.category] ?? 99;
        const orderB = CATEGORY_ORDER[b.category] ?? 99;
        return orderA - orderB || (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
      })
      .map((status) => {
        const count = counts.get(status.id) ?? 0;
        return {
          id: status.id,
          name: status.name,
          color: this.safeStatusColor(status.color),
          count,
          percent: (count / total) * 100,
        };
      });
  });

  readonly statusAriaLabel = computed(() => {
    const segments = this.statusSegments();
    if (!segments.length) return 'No tickets have a status yet';
    return `Queue by status: ${segments.map((s) => `${s.name} ${s.count}`).join(', ')}`;
  });

  // ─── Priority distribution ──────────────────────────────
  private readonly priorityCountByValue = computed(() => {
    const map = new Map<string, number>();
    for (const entry of this.facets()?.priorities ?? []) map.set(entry.priority, entry.count);
    return map;
  });

  readonly priorityTotal = computed(() =>
    (this.facets()?.priorities ?? []).reduce((sum, entry) => sum + entry.count, 0),
  );

  readonly prioritySegments = computed<PrioritySegment[]>(() => {
    const counts = this.priorityCountByValue();
    const total = this.priorityTotal();
    return PRIORITY_META.map((meta) => {
      const count = counts.get(meta.value) ?? 0;
      return {
        value: meta.value,
        label: meta.label,
        color: this.priorityColor(meta.value),
        count,
        percent: total ? (count / total) * 100 : 0,
      };
    });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      stats: this.ticketsService.getStats(),
      facets: this.ticketsService.getFacets({ view: 'all' }),
      statuses: this.statusesService.options(),
      // The triage list: open work that's urgent or high, most-due first.
      attention: this.ticketsService.getAll({
        page: 1,
        limit: 6,
        view: 'active',
        priority: ['URGENT', 'HIGH'],
        sortField: 'dueDate',
        sortOrder: 'asc',
      }),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.stats.set(res.stats);
          this.facets.set(res.facets);
          this.statuses.set(res.statuses);
          this.attention.set(res.attention.data);
        },
        error: (err: unknown) => {
          console.error('Error loading dashboard:', err);
          this.hasError.set(true);
        },
      });
  }

  /** Priority colour, mirroring the ticket list's dot mapping so a priority reads
   *  the same in both places (low → success, medium → warning, high/urgent → destructive). */
  priorityColor(value: Priority): string {
    switch (value) {
      case 'LOW':
        return 'var(--color-success)';
      case 'MEDIUM':
        return 'var(--color-warning)';
      default:
        return 'var(--color-destructive)';
    }
  }

  safeStatusColor(color?: string | null): string {
    return safeStatusColorUtil(color, 'var(--color-muted)');
  }

  statusColorOf(ticket: Ticket): string {
    return this.safeStatusColor(ticket.ticketStatus?.color);
  }

  isOverdue(ticket: Ticket): boolean {
    return !!ticket.dueDate && new Date(ticket.dueDate) < this.today;
  }

  /** Up to three assignee avatars for the row; the rest collapse into a +N chip. */
  visibleAssignees(ticket: Ticket): AssigneeAvatar[] {
    return visibleAssigneesUtil(ticket);
  }

  extraAssigneeCount(ticket: Ticket): number {
    return extraAssigneeCountUtil(ticket);
  }

  /** Open the full ticket detail page, seeding it with the row data. */
  openDetail(ticket: Ticket): void {
    this.router.navigate(['/tickets', ticket.id], { state: { ticket } });
  }

  /** Route into the list and open its compose dialog (mirrors the existing ?edit= entry). */
  newTicket(): void {
    this.router.navigate(['/tickets'], { queryParams: { new: 1 } });
  }
}
