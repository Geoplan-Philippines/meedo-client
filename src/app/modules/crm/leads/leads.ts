import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CrmService, LeadsStats } from '../services/crm.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  company?: string;
  message?: string;
  status?: string;
  createdAt: string;
}

interface LeadsResponse {
  data: Lead[];
}

const AVATAR_CLASSES = ['avatar-blue', 'avatar-teal', 'avatar-indigo', 'avatar-violet', 'avatar-rose'];

@Component({
  selector: 'app-leads',
  imports: [TableModule, SkeletonModule],
  templateUrl: './leads.html',
  styleUrl: './leads.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Leads implements OnInit, OnDestroy {
  private crmService = inject(CrmService);
  private destroy$ = new Subject<void>();

  leads = signal<Lead[]>([]);
  isLoading = signal(false);
  searchTerm = signal('');

  /** Populated once GET /crm/leads/stats is implemented on the backend */
  stats = signal<LeadsStats | null>(null);

  skeletonRows = [1, 2, 3, 4, 5];

  filteredLeads = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.leads();
    return this.leads().filter(l =>
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(term) ||
      l.email.toLowerCase().includes(term) ||
      (l.company ?? '').toLowerCase().includes(term)
    );
  });

  getInitials(lead: Lead): string {
    return `${lead.firstName[0] ?? ''}${lead.lastName[0] ?? ''}`.toUpperCase();
  }

  getAvatarClass(lead: Lead): string {
    const index = (lead.firstName.charCodeAt(0) + lead.lastName.charCodeAt(0)) % AVATAR_CLASSES.length;
    return AVATAR_CLASSES[index];
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
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: LeadsResponse) => {
          this.leads.set(res.data);
          this.isLoading.set(false);
        },
        error: (err: unknown) => {
          console.error('Error loading leads:', err);
          this.isLoading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
