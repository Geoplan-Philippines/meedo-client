import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TitleCasePipe } from '@angular/common';
import { map } from 'rxjs';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { CrmService, LEADS_LIST } from '../services/crm.service';
import { getAvatarClass } from '../../../shared/utils/avatar.utils';
import { Lead } from '../models/crm.model';
import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { StatItem, StatStrip } from '../../../shared/ui/stat-strip/stat-strip';
import { injectListState } from '../../../shared/data/url-list-state';
import { pagedList } from '../../../shared/data/paged-list';

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
export class Leads {
  private readonly crmService = inject(CrmService);

  /** Page, sort and search live in the URL; the API applies them. */
  readonly list = injectListState(LEADS_LIST);
  readonly leads = pagedList({
    params: () => this.list.query(),
    load: (query) => this.crmService.listLeads(query),
    refreshOn: ['crm'],
  });

  private readonly stats = rxResource({
    stream: () => this.crmService.getLeadsStats().pipe(map((response) => response.data)),
  });

  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly statItems = computed<StatItem[]>(() => {
    const stats = this.stats.hasValue() ? this.stats.value() : null;
    return [
      { label: 'Total leads', value: stats?.total },
      { label: 'Pending', value: stats?.pending, tone: 'warning' },
      { label: 'Contacted', value: stats?.contacted, tone: 'info' },
      { label: 'Qualified', value: stats?.qualified, tone: 'success' },
      { label: 'Lost', value: stats?.lost, tone: 'danger' },
    ];
  });

  constructor() {
    this.list.clampToTotal(this.leads);
  }

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
    this.list.setSearch((event.target as HTMLInputElement).value);
  }
}
