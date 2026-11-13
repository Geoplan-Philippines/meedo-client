import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { CrmService, SUBSCRIBERS_LIST } from '../../services/crm.service';
import { getAvatarClass } from '../../../../shared/utils/avatar.utils';
import { Subscriber } from '../../models/crm.model';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { StatItem, StatStrip } from '../../../../shared/ui/stat-strip/stat-strip';
import { injectListState } from '../../../../shared/data/url-list-state';
import { pagedList } from '../../../../shared/data/paged-list';

@Component({
  selector: 'app-subscribers',
  templateUrl: './subscribers.html',
  imports: [
    TableModule, SkeletonModule, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, DatePipe,
    PageLayout, ListPaginator, EmptyState, StatStrip,
  ],
  styleUrl: './subscribers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Subscribers {
  private readonly crmService = inject(CrmService);

  readonly list = injectListState(SUBSCRIBERS_LIST);
  readonly subscribers = pagedList({
    params: () => this.list.query(),
    load: (query) => this.crmService.listSubscribers(query),
    refreshOn: ['crm'],
  });

  readonly skeletonRows = [1, 2, 3, 4, 5];

  /** The audience size, taken from an unfiltered page; a search keeps the last known number. */
  private readonly totalSubscribers = linkedSignal<number | null, number | null>({
    source: () => (this.subscribers.loaded() && !this.list.search() ? this.subscribers.total() : null),
    computation: (total, previous) => total ?? previous?.value ?? null,
  });

  /** New-this-month and unsubscribed counts are not tracked by the API yet. */
  readonly statItems = computed<StatItem[]>(() => [
    { label: 'Total subscribers', value: this.totalSubscribers() },
    { label: 'New this month', value: null },
    { label: 'Unsubscribed', value: null },
  ]);

  constructor() {
    this.list.clampToTotal(this.subscribers);
  }

  getInitials(subscriber: Subscriber): string {
    if (subscriber.name) {
      const parts = subscriber.name.trim().split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      if (parts.length === 1) {
        return parts[0][0].toUpperCase();
      }
    }
    return subscriber.email?.[0]?.toUpperCase() ?? '?';
  }

  getAvatarClass(subscriber: Subscriber): string {
    return getAvatarClass(subscriber.email);
  }

  onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }
}
