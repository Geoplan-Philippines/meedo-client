import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { CrmService } from '../services/crm.service';
import { getAvatarClass } from '../../../shared/utils/avatar.utils';
import { Lead, LeadsStats } from '../models/crm.model';

@Component({
  selector: 'app-leads',
  imports: [TableModule, SkeletonModule],
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

  /** Populated once GET /crm/leads/stats is implemented on the backend */
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
  }

  ngOnInit(): void {
    this.loadLeads();
    // TODO: call this.crmService.getLeadsStats() here once GET /crm/leads/stats is live
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
