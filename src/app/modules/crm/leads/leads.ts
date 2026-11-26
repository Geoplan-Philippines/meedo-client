import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { CrmService, LEADS_LIST } from '../services/crm.service';
import { getAvatarClass } from '../../../shared/utils/avatar.utils';
import { Lead, LeadStatus } from '../models/crm.model';
import { PageLayout } from '../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { StatItem, StatStrip } from '../../../shared/ui/stat-strip/stat-strip';
import { ArchivedTag } from '../../../shared/ui/archived-tag/archived-tag';
import { injectListState } from '../../../shared/data/url-list-state';
import { pagedList } from '../../../shared/data/paged-list';
import { ColumnChooser } from '../shared/column-chooser';
import { ColumnOption, loadColumns, saveColumns } from '../shared/column-visibility';
import { downloadBlob, filenameFromDisposition } from '../shared/download-blob';
import { apiErrorMessage } from '../shared/api-errors';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';
const LEAD_SEVERITY: Record<string, TagSeverity> = { NEW: 'warn', CONTACTED: 'info', QUALIFIED: 'success', LOST: 'danger' };
const COLUMNS_KEY = 'meedo.leads.columns';
export const LEAD_COLUMNS: readonly ColumnOption[] = [
  { id: 'name', label: 'Name', locked: true },
  { id: 'email', label: 'Email' },
  { id: 'phoneNumber', label: 'Phone' },
  { id: 'company', label: 'Company' },
  { id: 'message', label: 'Message' },
  { id: 'source', label: 'Source' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Received' },
];
export const LEAD_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'LOST', label: 'Lost' },
  { value: 'ARCHIVED', label: 'Archived' },
] as const;

@Component({
  selector: 'app-leads',
  imports: [
    TableModule, SkeletonModule, ButtonModule, TagModule, TabsModule, IconFieldModule, InputIconModule, InputTextModule,
    DatePipe, TitleCasePipe, RouterLink, MessageModule, PageLayout, ListPaginator, EmptyState, StatStrip, ArchivedTag, ColumnChooser,
  ],
  templateUrl: './leads.html',
  styleUrl: './leads.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Leads {
  private readonly crmService = inject(CrmService);
  private readonly router = inject(Router);

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
  readonly columns = LEAD_COLUMNS;
  readonly visible = signal(loadColumns(COLUMNS_KEY, LEAD_COLUMNS));
  readonly exporting = signal(false);
  readonly exportError = signal('');
  readonly tabs = LEAD_TABS;

  readonly statItems = computed<StatItem[]>(() => {
    const stats = this.stats.hasValue() ? this.stats.value() : null;
    return [
      { label: 'Total leads', value: stats?.total },
      { label: 'New', value: stats?.new, tone: 'warning' },
      { label: 'Contacted', value: stats?.contacted, tone: 'info' },
      { label: 'Qualified', value: stats?.qualified, tone: 'success' },
      { label: 'Lost', value: stats?.lost, tone: 'danger' },
    ];
  });

  readonly activeTab = computed(() => {
    if (this.list.filters().archived) return 'ARCHIVED';
    return this.list.filters().status ?? 'ALL';
  });

  readonly visibleSet = computed(() => new Set(this.visible()));
  readonly columnCount = computed(() => this.visible().length);

  constructor() {
    this.list.clampToTotal(this.leads);
  }

  show(id: string): boolean {
    return this.visibleSet().has(id);
  }

  setTab(value: string): void {
    if (value === 'ARCHIVED') this.list.setFilters({ status: null, archived: true });
    else this.list.setFilters({ status: value === 'ALL' ? null : value, archived: false });
  }

  setVisible(ids: string[]): void {
    this.visible.set(ids);
    saveColumns(COLUMNS_KEY, ids);
  }

  statusSeverity(status: string | undefined): TagSeverity {
    return LEAD_SEVERITY[(status || 'NEW').toUpperCase()] ?? 'secondary';
  }

  getInitials(lead: Lead): string {
    const first = lead.firstName?.[0] ?? '';
    const last = lead.lastName?.[0] ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  getAvatarClass(lead: Lead): string {
    return getAvatarClass(`${lead.firstName ?? ''}${lead.lastName ?? ''}`);
  }

  receivedAt(lead: Lead): string {
    return lead.receivedAt || lead.createdAt;
  }

  onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  openLead(lead: Lead): void {
    void this.router.navigate(['/crm/leads', lead.id]);
  }

  exportCsv(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set('');
    this.crmService.exportLeads(this.list.query()).subscribe({
      next: (response) => {
        this.exporting.set(false);
        if (!response.body) return;
        downloadBlob(response.body, filenameFromDisposition(response.headers.get('content-disposition')) ?? 'leads.csv');
      },
      error: (error: unknown) => {
        this.exporting.set(false);
        this.exportError.set(apiErrorMessage(error, 'The export could not be created. Try again.'));
      },
    });
  }

  statusLabel(status: LeadStatus | string | undefined): string {
    return (status || 'NEW').toLowerCase();
  }
}
