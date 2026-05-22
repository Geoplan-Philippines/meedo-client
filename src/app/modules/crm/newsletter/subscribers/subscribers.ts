import { Component, OnInit, OnDestroy} from '@angular/core';
import { CrmService } from '../../services/crm.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs';
import { TableModule } from 'primeng/table';
import { CommonModule, DatePipe } from '@angular/common';

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
  standalone: true,
  imports: [CommonModule, TableModule, DatePipe],
  styleUrl: './subscribers.css',
})

export class Subscribers implements OnInit, OnDestroy{
  
  subscribers: Subscriber[] = [];
  private destroy$ = new Subject<void>();
  isLoading = false;

  constructor(private crmService: CrmService) {}
    
  ngOnInit(){
    this.isLoading = true;

    this.crmService.getSubscribers()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: SubscriberResponse) => {
        console.log('RAW response:', res); 
        this.subscribers = res.data;

        console.log('subs', this.subscribers);
        
        this.isLoading = false;
    },
    error: (err) => {
      console.error('Error loading subscribers:', err);
          this.isLoading = false;
    }
  });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
  
