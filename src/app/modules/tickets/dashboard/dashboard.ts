import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TicketStat } from './models/dashboard.model';

@Component({
  selector: 'app-tickets-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  stats = signal<TicketStat[]>([
    { label: 'Open', value: 0, icon: 'pi-inbox', tone: 'primary' },
    { label: 'In Progress', value: 0, icon: 'pi-spinner', tone: 'warn' },
    { label: 'Resolved', value: 0, icon: 'pi-check-circle', tone: 'success' },
    { label: 'Closed', value: 0, icon: 'pi-lock', tone: 'muted' },
  ]);
}
