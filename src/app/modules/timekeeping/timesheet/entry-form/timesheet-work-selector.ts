import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TimesheetService } from '../services/timesheet.service';
import { TimesheetProject, TimesheetTicket } from '../models/timesheet.model';
import { TimesheetProjectPicker } from './timesheet-project-picker';

export interface EntryWorkSelection {
  mode: 'ticket' | 'description';
  ticketId: string | null;
  projectId: string | null;
  description: string;
  ticket?: Pick<TimesheetTicket, 'id' | 'ticketNumber' | 'title'> | null;
}

@Component({
  selector: 'app-timesheet-work-selector', imports: [FormsModule, TimesheetProjectPicker], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset [disabled]="readonly() || creating()">
      <legend>Work description</legend>
      @if (!readonly()) { <div class="mode-buttons" role="group" aria-label="Entry mode"><button type="button" [attr.aria-pressed]="mode() === 'ticket'" (click)="setMode('ticket')">Pick a ticket</button><button type="button" [attr.aria-pressed]="mode() === 'description'" (click)="setMode('description')">Type a description</button></div> }
      @if (mode() === 'ticket') {
        @if (selected(); as ticket) { <p class="ticket-reference">Ticket #{{ ticket.ticketNumber }}  -  {{ ticket.title }}</p> }
        @if (!readonly()) {
          <label [for]="fieldId+'-search'">Find a ticket assigned to you or created by you (admins: any ticket)</label>
          <div class="search"><input [id]="fieldId+'-search'" [(ngModel)]="search" [ngModelOptions]="{standalone:true}" maxlength="100" /><button type="button" (click)="load(1)">Search tickets</button></div>
          @if (loading()) { <p role="status">Loading tickets...</p> }
          <label [for]="fieldId+'-ticket'">Ticket (required)</label><select [id]="fieldId+'-ticket'" [ngModel]="value().ticketId" (ngModelChange)="selectTicket($event)" [ngModelOptions]="{standalone:true}"><option value="">Choose a ticket</option>@for (ticket of tickets(); track ticket.id) { <option [value]="ticket.id">#{{ ticket.ticketNumber }}  -  {{ ticket.title }}</option> }</select>
          @if (!loading() && !tickets().length) { <p>No matching tickets. You can create one below.</p> }
          <div class="pages"><button type="button" [disabled]="page() <= 1 || loading()" (click)="load(page()-1)">Previous</button><span>Page {{ page() }} of {{ lastPage() || 1 }}</span><button type="button" [disabled]="page() >= lastPage() || loading()" (click)="load(page()+1)">Next</button></div>
          <button type="button" (click)="quickCreate.set(!quickCreate())">Create ticket</button>
          @if (quickCreate()) {
            <section class="quick-create" aria-label="Quick create ticket"><label [for]="fieldId+'-title'">New ticket title (required)</label><input [id]="fieldId+'-title'" [(ngModel)]="newTitle" [ngModelOptions]="{standalone:true}" maxlength="200" />
              <label [for]="fieldId+'-new-project'">Ticket project (optional)</label><app-timesheet-project-picker [inputId]="fieldId+'-new-project'" [value]="newProjectId || null" placeholder="No project" ariaLabel="Ticket project" (changed)="newProjectId = $event?.id ?? ''" />
              <p>Members are assigned to their new ticket automatically. No approval is needed.</p><button type="button" (click)="createTicket()">{{ creating() ? 'Creating...' : 'Create and select ticket' }}</button>
            </section>
          }
        }
        <p>The ticket supplies the project and description. Its title is saved as a snapshot.</p>
        <label [for]="fieldId+'-snapshot'">Description from ticket</label><textarea [id]="fieldId+'-snapshot'" [value]="value().description" readonly></textarea>
      } @else {
        <label [for]="fieldId+'-description'">Description (required)</label><textarea [id]="fieldId+'-description'" [ngModel]="value().description" (ngModelChange)="describe($event)" [ngModelOptions]="{standalone:true}" maxlength="1000" [attr.aria-describedby]="fieldId+'-counter'" [readOnly]="readonly()"></textarea><small [id]="fieldId+'-counter'" aria-live="polite">{{ value().description.trim().length }} / 1000 characters</small>
        <label [for]="fieldId+'-project'">Project (optional)</label><app-timesheet-project-picker [inputId]="fieldId+'-project'" [value]="value().projectId" [known]="projects()" placeholder="No project" ariaLabel="Project" [disabled]="readonly()" (changed)="projectChanged($event?.id ?? '')" />
      }
      @if (error()) { <p role="alert">{{ error() }}</p> }
    </fieldset>
  `,
  styleUrl: './timesheet-entry-form.css',
})
export class TimesheetWorkSelector {
  private static nextId = 0;
  readonly fieldId = 'timesheet-work-' + TimesheetWorkSelector.nextId++;
  /** `projects`: projects already known from loaded entries, so the current one keeps its label. */
  readonly value = input.required<EntryWorkSelection>(); readonly projects = input<TimesheetProject[]>([]); readonly readonly = input(false);
  readonly changed = output<EntryWorkSelection>();
  private readonly api = inject(TimesheetService); private readonly destroy = inject(DestroyRef);
  readonly mode = signal<'ticket' | 'description'>('description'); readonly selected = signal<EntryWorkSelection['ticket']>(null);
  readonly tickets = signal<TimesheetTicket[]>([]); readonly loading = signal(false); readonly creating = signal(false); readonly error = signal('');
  readonly quickCreate = signal(false); readonly page = signal(1); readonly lastPage = signal(0);
  search = ''; newTitle = ''; newProjectId = '';
  constructor() { effect(() => { const value = this.value(); this.mode.set(value.mode); this.selected.set(value.ticket); if (value.ticket && !this.tickets().some(ticket => ticket.id === value.ticketId)) this.tickets.update(items => [{ ...value.ticket!, projectId: value.projectId }, ...items]); }); }
  setMode(mode: EntryWorkSelection['mode']) { this.mode.set(mode); this.error.set(''); this.changed.emit({ ...this.value(), mode, ticketId: null, ticket: null, description: mode === 'ticket' ? '' : this.value().description }); if (mode === 'ticket') this.load(1); }
  describe(description: string) { this.changed.emit({ ...this.value(), mode: 'description', ticketId: null, ticket: null, description }); }
  projectChanged(id: string) { this.changed.emit({ ...this.value(), projectId: id || null }); }
  load(page: number) { this.loading.set(true); this.error.set(''); this.api.getTickets(page, this.search).pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: result => { this.tickets.set(result.data); this.page.set(page); this.lastPage.set(result.meta.lastPage); this.loading.set(false); }, error: () => { this.loading.set(false); this.error.set('Could not load eligible tickets. Try again.'); } }); }
  selectTicket(id: string) { const ticket = this.tickets().find(item => item.id === id); if (!ticket) return; this.selected.set(ticket); this.changed.emit({ mode: 'ticket', ticketId: ticket.id, projectId: ticket.projectId, description: ticket.title, ticket }); }
  createTicket() {
    const title = this.newTitle.trim(); if (!title || title.length > 200) { this.error.set('Enter a ticket title of at most 200 characters.'); return; }
    this.creating.set(true); this.error.set(''); this.api.createTicket(title, this.newProjectId || null).pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: ticket => { this.tickets.update(items => [ticket, ...items]); this.selectTicket(ticket.id); this.quickCreate.set(false); this.creating.set(false); this.newTitle = ''; }, error: () => { this.creating.set(false); this.error.set('Could not create a ticket. Check project membership and try again.'); } });
  }
}
