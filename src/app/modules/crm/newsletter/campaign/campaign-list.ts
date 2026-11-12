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
import { catchError, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CampaignsService } from '../../services/campaigns.service';
import { CAMPAIGN_LIMITS, Campaign } from './campaign.model';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { ListPageChange, ListPaginator } from '../../../../shared/ui/list-paginator/list-paginator';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';

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
  private readonly refresh = new Subject<void>();
  readonly isAdmin = inject(AuthService).isAdmin;
  readonly campaigns = signal<Campaign[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly search = signal('');
  readonly includeArchived = signal(false);
  readonly page = signal(1);
  readonly lastPage = signal(0);
  readonly total = signal(0);
  readonly busyId = signal<string | null>(null);
  readonly limit = signal(10);
  readonly searchLimit = CAMPAIGN_LIMITS.name;

  constructor() {
    this.refresh.pipe(
      startWith(undefined),
      tap(() => { this.loading.set(true); this.error.set(''); }),
      switchMap(() => this.service.list({ page: this.page(), limit: this.limit(), search: this.search(), includeArchived: this.includeArchived() })
        .pipe(catchError(() => { this.error.set('Campaigns could not be loaded. Try again.'); return of(null); }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(res => {
      this.loading.set(false);
      if (!res) return;
      this.campaigns.set(res.data);
      this.total.set(res.meta.total);
      this.lastPage.set(res.meta.lastPage);
      if (this.page() > Math.max(1, res.meta.lastPage)) this.goTo(Math.max(1, res.meta.lastPage));
    });
  }

  load() { this.refresh.next(); }
  onSearch(event: Event) { this.search.set((event.target as HTMLInputElement).value); }
  onArchiveFilter(event: Event) { this.includeArchived.set((event.target as HTMLInputElement).checked); this.filter(); }
  filter() { this.page.set(1); this.load(); }
  goTo(page: number) { this.page.set(page); this.load(); }
  setIncludeArchived(value: boolean) { this.includeArchived.set(value); this.filter(); }
  onPageChange(change: ListPageChange) { this.limit.set(change.pageSize); this.goTo(change.page); }

  changeStatus(campaign: Campaign) {
    if (!this.isAdmin() || this.busyId()) return;
    const action = campaign.status === 'ARCHIVED' ? 'Restore' : 'Archive';
    if (!window.confirm(`${action} campaign "${campaign.name}"?`)) return;
    this.busyId.set(campaign.id);
    this.actionError.set('');
    const request = campaign.status === 'ARCHIVED' ? this.service.restore(campaign.id) : this.service.archive(campaign.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busyId.set(null); this.load(); },
      error: () => { this.busyId.set(null); this.actionError.set('The campaign could not be changed. Try again.'); },
    });
  }
}
