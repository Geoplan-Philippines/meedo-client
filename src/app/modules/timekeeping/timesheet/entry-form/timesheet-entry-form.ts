import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TimesheetEntry, TimesheetProject, TimesheetWorkType } from '../models/timesheet.model';
import { TimesheetService } from '../services/timesheet.service';
import { EntryWorkSelection, TimesheetWorkSelector } from './timesheet-work-selector';

export function manilaTodayKey(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
@Component({
  selector: 'app-timesheet-entry-form', imports: [FormsModule, TimesheetWorkSelector], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop"><form class="entry-form" (ngSubmit)="save()" role="dialog" aria-modal="true" aria-labelledby="entry-form-title">
      <h2 id="entry-form-title">{{ entry() ? 'Edit timesheet entry' : 'New timesheet entry' }}</h2>
      @if (entry()?.status === 'SUBMITTED') { <p>Admin correction. This entry stays submitted; the before and after values are audited.</p> }
      <p>Weekends are allowed. Dates use Asia/Manila.</p>
      <div class="fields"><div><label for="entry-date">Work date</label><input id="entry-date" type="date" name="workDate" [(ngModel)]="date" [max]="today()" required /></div><div><label for="entry-hours">Hours</label><input id="entry-hours" type="number" name="hours" [(ngModel)]="hours" min="0" max="9" step=".25" required /></div></div>
      <label for="entry-work-type">Work type</label><select id="entry-work-type" name="workType" [(ngModel)]="workType"><option value="REGULAR">Regular</option><option value="REST_DAY">Rest day</option><option value="LEAVE">Leave</option><option value="OFFSET">Offset</option></select>
      <app-timesheet-work-selector [value]="work()" [projects]="projects()" (changed)="work.set($event)" />
      <div class="flags"><label><input type="checkbox" name="overtime" [(ngModel)]="overtime" /> Overtime</label><label><input type="checkbox" name="night" [(ngModel)]="night" /> Night differential</label></div>
      @if (error()) { <p id="entry-form-error" role="alert">{{ error() }}</p> }
      <div class="actions"><button type="button" [disabled]="busy()" (click)="cancelled.emit()">Cancel</button><button type="submit" [disabled]="busy()" aria-describedby="entry-form-error">{{ busy() ? 'Saving...' : 'Save entry' }}</button></div>
    </form></div>
  `,
  styleUrl: './timesheet-entry-form.css',
})
export class TimesheetEntryForm {
  readonly entry = input<TimesheetEntry | null>(null); readonly projects = input<TimesheetProject[]>([]);
  readonly saved = output<TimesheetEntry>(); readonly cancelled = output<void>();
  private readonly api = inject(TimesheetService); private readonly destroy = inject(DestroyRef);
  readonly work = signal<EntryWorkSelection>({ mode: 'description', ticketId: null, projectId: null, description: '' });
  readonly busy = signal(false); readonly error = signal('');
  readonly today = manilaTodayKey; date = manilaTodayKey(); hours: number | null = 1; workType: TimesheetWorkType = 'REGULAR'; overtime = false; night = false;
  constructor() { effect(() => { const entry = this.entry(); if (!entry) return; this.date = entry.workDate.slice(0,10); this.hours = entry.hours; this.workType = entry.workType; this.overtime = entry.isOvertime; this.night = entry.isNightDifferential; this.work.set({ mode: entry.ticketId ? 'ticket' : 'description', ticketId: entry.ticketId ?? null, projectId: entry.projectId, description: entry.description ?? entry.task.replace(/<[^>]*>/g, ''), ticket: entry.ticket }); }); }
  save() {
    if (this.busy()) return;
    const work = this.work(); const description = work.description.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.date) || this.date > this.today()) { this.error.set('Choose a work date on or before today in Asia/Manila.'); return; }
    if (this.hours === null || !Number.isFinite(this.hours) || (this.workType !== 'LEAVE' && (this.hours < 1 || this.hours > 9)) || this.hours < 0) { this.error.set('Enter 1 to 9 hours (leave may be zero).'); return; }
    if (work.mode === 'ticket' ? !work.ticketId : !description || description.length > 1000) { this.error.set(work.mode === 'ticket' ? 'Choose a ticket.' : 'Enter a description of at most 1000 characters.'); return; }
    const payload = { workDate: this.date, hours: this.hours, workType: this.workType, isOvertime: this.overtime, isNightDifferential: this.night, ticketId: work.mode === 'ticket' ? work.ticketId : null, ...(work.mode === 'description' ? { description, projectId: work.projectId } : {}) };
    this.busy.set(true); this.error.set(''); const request = this.entry() ? this.api.updateEntry(this.entry()!.id, payload) : this.api.createEntry(payload);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: entry => { this.busy.set(false); this.saved.emit(entry); }, error: error => { this.busy.set(false); const message = error?.error?.message; this.error.set(Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : 'Could not save this entry. Check dates, access and period locks.'); } });
  }
}
