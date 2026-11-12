import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TitleCasePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { CrmService } from '../services/crm.service';
import { getAvatarClass } from '../../../shared/utils/avatar.utils';
import { Lead, LeadsStats } from '../models/crm.model';
import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { StatItem, StatStrip } from '../../../shared/ui/stat-strip/stat-strip';
import { ClientPager } from '../../../shared/utils/client-pager';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';
const LEAD_SEVERITY: Record<string, TagSeverity> = { PENDING: 'warn', CONTACTED: 'info', QUALIFIED: 'success', LOST: 'danger' };

@Component({
  selector: 'app-leads',
  imports: [
    TableModule, SkeletonModule, ButtonModule, TagModule, IconFieldModule, InputIconModule, InputTextModule, TitleCasePipe,
    PageLayout, ListPaginator, EmptyState, StatStrip,
  ],
  templateUrl: './leads.html',
  styleUrl: './leads.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Leads implements OnInit {
  private readonly crmService = inject(CrmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly leads = signal<Lead[]>([]);
  readonly isLoading = signal(false);
  readonly searchTerm = signal('');

  readonly stats = signal<LeadsStats | null>(null);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly filteredLeads = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.leads();
    return this.leads().filter(l =>
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(term) ||
      l.email.toLowerCase().includes(term) ||
      (l.company ?? '').toLowerCase().includes(term)
    );
  });

  readonly pager = new ClientPager(this.filteredLeads);

  readonly statItems = computed<StatItem[]>(() => {
    const stats = this.stats();
    return [
      { label: 'Total leads', value: stats?.total },
      { label: 'Pending', value: stats?.pending, tone: 'warning' },
      { label: 'Contacted', value: stats?.contacted, tone: 'info' },
      { label: 'Qualified', value: stats?.qualified, tone: 'success' },
      { label: 'Lost', value: stats?.lost, tone: 'danger' },
    ];
  });

  statusSeverity(status: string | undefined): TagSeverity {
    return LEAD_SEVERITY[(status || 'PENDING').toUpperCase()] ?? 'secondary';
  }

  getInitials(lead: Lead): string {
    const first = lead.firstName?.[0] ?? '';
    const last = lead.lastName?.[0] ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  getAvatarClass(lead: Lead): string {
    return getAvatarClass(`${lead.firstName ?? ''}${lead.lastName ?? ''}`);
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.pager.reset();
  }

  ngOnInit(): void {
    this.loadLeads();
    this.crmService.getLeadsStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => this.stats.set(response.data),
      error: () => this.stats.set(null),
    });
  }

  private loadLeads(): void {
    this.isLoading.set(true);
    this.crmService.getLeads()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.leads.set(res.data);
          this.isLoading.set(false);
        },
        error: (err: unknown) => {
          console.error('Error loading leads:', err);
          this.isLoading.set(false);
        },
      });
  }
}
