import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { CrmService } from '../../services/crm.service';
import { getAvatarClass } from '../../../../shared/utils/avatar.utils';
import { Subscriber } from '../../models/crm.model';

@Component({
  selector: 'app-subscribers',
  templateUrl: './subscribers.html',
  imports: [TableModule, SkeletonModule, DatePipe],
  styleUrl: './subscribers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Subscribers implements OnInit {
  private readonly crmService = inject(CrmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly subscribers = signal<Subscriber[]>([]);
  readonly isLoading = signal(false);
  readonly searchTerm = signal('');

  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly totalSubscribers = computed(() => this.subscribers().length);

  readonly filteredSubscribers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.subscribers();
    return this.subscribers().filter(s =>
      (s.name ?? '').toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term)
    );
  });

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
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  ngOnInit(): void {
    this.isLoading.set(true);
    this.crmService.getSubscribers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.subscribers.set(res.data);
          this.isLoading.set(false);
        },
        error: (err: unknown) => {
          console.error('Error loading subscribers:', err);
          this.isLoading.set(false);
        },
      });
  }
}
