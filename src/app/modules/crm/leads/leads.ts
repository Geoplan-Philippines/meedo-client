import { Component, OnInit, OnDestroy} from '@angular/core';
import { CrmService } from '../services/crm.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';

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

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './leads.html',
  styleUrl: './leads.css',
})

export class Leads implements OnInit, OnDestroy {

  leads: Lead[] = [];
  private destroy$ = new Subject<void>();
  isLoading = false;

  constructor(private crmService: CrmService) {}
    
  ngOnInit() {
    this.isLoading = true;
    
    this.crmService.getLeads()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res:LeadsResponse)  => {
        console.log('RAW res:', res);   
        console.log('res.data:', res.data);
        this.leads = res.data;

        console.log('leads', this.leads);

        this.isLoading = false;
      },
      error: (err)  => {
        console.error('Error loading leads:', err);
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
  
