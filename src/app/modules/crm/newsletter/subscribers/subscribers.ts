import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
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
import { CrmService, SUBSCRIBERS_LIST } from '../../services/crm.service';
import { getAvatarClass } from '../../../../shared/utils/avatar.utils';
import { Subscriber } from '../../models/crm.model';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { StatItem, StatStrip } from '../../../../shared/ui/stat-strip/stat-strip';
import { ArchivedTag } from '../../../../shared/ui/archived-tag/archived-tag';
import { injectListState } from '../../../../shared/data/url-list-state';
import { pagedList } from '../../../../shared/data/paged-list';
import { ColumnChooser } from '../../shared/column-chooser';
import { ColumnOption, loadColumns, saveColumns } from '../../shared/column-visibility';
import { downloadBlob, filenameFromDisposition } from '../../shared/download-blob';
import { apiErrorMessage } from '../../shared/api-errors';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';
const COLUMNS_KEY = 'meedo.subscribers.columns';
export const SUBSCRIBER_COLUMNS: readonly ColumnOption[] = [
  { id: 'name', label: 'Name', locked: true },
  { id: 'email', label: 'Email' },
  { id: 'source', label: 'Source' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Subscribed on' },
];
export const SUBSCRIBER_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'SUBSCRIBED', label: 'Subscribed' },
  { value: 'UNSUBSCRIBED', label: 'Unsubscribed' },
  { value: 'ARCHIVED', label: 'Archived' },
] as const;

@Component({
  selector: 'app-subscribers',
  templateUrl: './subscribers.html',
  imports: [
    TableModule, SkeletonModule, ButtonModule, TagModule, TabsModule, IconFieldModule, InputIconModule, InputTextModule,
    DatePipe, TitleCasePipe, MessageModule, PageLayout, ListPaginator, EmptyState, StatStrip, ArchivedTag, ColumnChooser,
  ],
  styleUrl: './subscribers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Subscribers {
  private readonly crmService = inject(CrmService);
  private readonly router = inject(Router);

  readonly list = injectListState(SUBSCRIBERS_LIST);
  readonly subscribers = pagedList({
    params: () => this.list.query(),
    load: (query) => this.crmService.listSubscribers(query),
    refreshOn: ['crm'],
  });

  private readonly stats = rxResource({
    stream: () => this.crmService.getSubscriberStats().pipe(map((response) => response.data)),
  });

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly columns = SUBSCRIBER_COLUMNS;
  readonly visible = signal(loadColumns(COLUMNS_KEY, SUBSCRIBER_COLUMNS));
  readonly exporting = signal(false);
  readonly exportError = signal('');
  readonly tabs = SUBSCRIBER_TABS;

  readonly statItems = computed<StatItem[]>(() => {
    const stats = this.stats.hasValue() ? this.stats.value() : null;
    return [
      { label: 'Total subscribers', value: stats?.total },
      { label: 'New this month', value: stats?.newThisMonth, tone: 'info' },
      { label: 'Unsubscribed', value: stats?.unsubscribed, tone: 'danger' },
    ];
  });

  readonly activeTab = computed(() => {
    if (this.list.filters().archived) return 'ARCHIVED';
    return this.list.filters().status ?? 'ALL';
  });

  readonly visibleSet = computed(() => new Set(this.visible()));
  readonly columnCount = computed(() => this.visible().length);

  constructor() {
    this.list.clampToTotal(this.subscribers);
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
    return (status || 'SUBSCRIBED').toUpperCase() === 'UNSUBSCRIBED' ? 'danger' : 'success';
  }

  getInitials(subscriber: Subscriber): string {
    if (subscriber.name) {
      const parts = subscriber.name.trim().split(/\s+/).filter(Boolean);
      if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      if (parts.length === 1) return parts[0][0].toUpperCase();
    }
    return subscriber.email?.[0]?.toUpperCase() ?? '?';
  }

  getAvatarClass(subscriber: Subscriber): string {
    return getAvatarClass(subscriber.email);
  }

  onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  openSubscriber(subscriber: Subscriber): void {
    void this.router.navigate(['/crm/newsletter/subscribers', subscriber.id]);
  }

  exportCsv(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set('');
    this.crmService.exportSubscribers(this.list.query()).subscribe({
      next: (response) => {
        this.exporting.set(false);
        if (!response.body) return;
        downloadBlob(response.body, filenameFromDisposition(response.headers.get('content-disposition')) ?? 'subscribers.csv');
      },
      error: (error: unknown) => {
        this.exporting.set(false);
        this.exportError.set(apiErrorMessage(error, 'The export could not be created. Try again.'));
      },
    });
  }
}
