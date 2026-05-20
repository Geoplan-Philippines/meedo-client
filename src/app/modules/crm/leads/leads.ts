import { Component, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrmService } from '../services/crm.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './leads.html',
  styleUrl: './leads.css',
})

export class Leads implements OnInit {
  leads$!: Observable<any[]>;

  constructor(private crmService: CrmService) {}
    
  ngOnInit() {
    this.leads$ = this.crmService.getLeads().pipe(
      map((res: any) => res.data)
    );
  }
}
  
