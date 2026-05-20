import { Component, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrmService } from '../../../services/crm.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-subscribers',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './subscribers.html',
  styleUrl: './subscribers.css',
})

export class Subscribers implements OnInit {
  subscribers$!: Observable<any[]>;

  constructor(private crmService: CrmService) {}
    
  ngOnInit() {
    this.subscribers$ = this.crmService.getSubscribers().pipe(
      map((res: any) => res.data || [])
    );
  }
}
  
