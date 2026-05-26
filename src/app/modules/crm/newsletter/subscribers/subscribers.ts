import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { CrmService } from '../../services/crm.service';

interface Subscriber {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

interface SubscriberResponse {
  data: Subscriber[];
}

const AVATAR_CLASSES = ['avatar-blue', 'avatar-teal', 'avatar-indigo', 'avatar-violet', 'avatar-rose'];

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
      const parts = subscriber.name.trim().split(' ');
      return parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0][0].toUpperCase();
    }
    return subscriber.email[0].toUpperCase();
  }

  getAvatarClass(subscriber: Subscriber): string {
    const seed = subscriber.email.charCodeAt(0) + subscriber.email.charCodeAt(1);
    return AVATAR_CLASSES[seed % AVATAR_CLASSES.length];
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  ngOnInit(): void {
    this.isLoading.set(true);
    this.crmService.getSubscribers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: SubscriberResponse) => {
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
