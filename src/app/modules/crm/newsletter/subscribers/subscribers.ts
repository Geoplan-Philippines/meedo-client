import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

import { TableModule } from 'primeng/table';

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

@Component({
  selector: 'app-subscribers',
  templateUrl: './subscribers.html',
  imports: [TableModule, DatePipe],
  styleUrl: './subscribers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Subscribers implements OnInit {
  private readonly crmService = inject(CrmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly subscribers = signal<Subscriber[]>([]);
  readonly isLoading = signal(false);

  ngOnInit(): void {
    this.isLoading.set(true);

    this.crmService.getSubscribers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: SubscriberResponse) => {
          this.subscribers.set(res.data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading subscribers:', err);
          this.isLoading.set(false);
        },
      });
  }
}
