import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../../core/auth/auth.service';
import { CAMPAIGNS_LIST, CampaignsService } from '../../services/campaigns.service';
import { CAMPAIGN_LIMITS, Campaign } from './campaign.model';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { injectListState } from '../../../../shared/data/url-list-state';
import { pagedList } from '../../../../shared/data/paged-list';

import { MessageModule } from 'primeng/message';
@Component({
  selector: 'app-campaign-list',
  imports: [
    MessageModule,
    RouterLink, DatePipe, FormsModule, TableModule, ButtonModule, TagModule, SkeletonModule, ToggleSwitchModule,
    IconFieldModule, InputIconModule, InputTextModule, PageLayout, ListPaginator, EmptyState,
  ],
  templateUrl: './campaign-list.html',
  styleUrl: './campaign-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignList {
  private readonly service = inject(CampaignsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isAdmin = inject(AuthService).isAdmin;

  readonly list = injectListState(CAMPAIGNS_LIST);
  readonly campaigns = pagedList({
    params: () => this.list.query(),
    load: (query) => this.service.list(query),
    refreshOn: ['crm'],
  });

  readonly actionError = signal('');
  readonly busyId = signal<string | null>(null);
  readonly searchLimit = CAMPAIGN_LIMITS.name;

  constructor() {
    this.list.clampToTotal(this.campaigns);
  }

  onSearch(event: Event) { this.list.setSearch((event.target as HTMLInputElement).value); }
  setIncludeArchived(value: boolean) { this.list.setFilter('includeArchived', value); }

  changeStatus(campaign: Campaign) {
    if (!this.isAdmin() || this.busyId()) return;
    const action = campaign.status === 'ARCHIVED' ? 'Restore' : 'Archive';
    if (!window.confirm(`${action} campaign "${campaign.name}"?`)) return;
    this.busyId.set(campaign.id);
    this.actionError.set('');
    const request = campaign.status === 'ARCHIVED' ? this.service.restore(campaign.id) : this.service.archive(campaign.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busyId.set(null); this.campaigns.reload(); },
      error: () => { this.busyId.set(null); this.actionError.set('The campaign could not be changed. Try again.'); },
    });
  }
}
