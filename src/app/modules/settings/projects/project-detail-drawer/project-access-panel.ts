import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { ProjectAdminService } from '../services/project-admin.service';
import { ProjectRecord } from '../models/project-admin.model';

@Component({
  selector: 'app-project-access-panel', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-label="Project state and members">
      @if (project().isClosed) { <span class="tag">Closed</span> }
      @if (isAdmin()) {
        <label class="closed"><input type="checkbox" [checked]="!!project().isClosed" [disabled]="busy()" (change)="setClosed($event)" /> Closed</label>
        <p>Closed is a label only. Maintenance, tickets, SLA and timesheet support remain available.</p>
        <button (click)="archive()" [disabled]="busy()">{{ project().isArchived ? 'Restore project' : 'Archive project' }}</button>
        @if (project().archivedManually) { <p>Archived by an admin. Sync will keep it archived.</p> }
      }
      <h3>Project members</h3>
      @if (loading()) { <p role="status">Loading members…</p> }
      @if (error()) { <p role="alert">{{ error() }}</p><button (click)="load()">Retry</button> }
      <ul>@for (member of members(); track member.userId) { <li><span>{{ member.user.name || member.user.email }}</span>@if (isAdmin()) { <button [disabled]="busy()" (click)="remove(member.userId)" [attr.aria-label]="'Remove '+(member.user.name || member.user.email)">Remove</button> }</li> } @empty { @if (!loading()) { <li>No members. Only admins can see this project.</li> } }</ul>
      @if (isAdmin()) {
        <label for="project-member-user">Add organization member</label><select id="project-member-user" #selected><option value="">Choose a member</option>@for (user of options(); track user.id) { <option [value]="user.id">{{ user.name || user.email }}</option> }</select>
        <button [disabled]="busy() || loading()" (click)="add(selected.value)">Add member</button>
      }
    </section>
  `,
  styles: [`section{border-block:1px solid var(--border);padding:1rem 0;color:var(--text-body)}h3{font-weight:600;color:var(--text-heading);margin:1rem 0 .5rem}.tag{background:var(--secondary);color:var(--secondary-foreground);border-radius:100px;padding:.25rem .625rem}.closed{display:flex;gap:.5rem;align-items:center;font-weight:600}p{font-size:.8rem;margin:.5rem 0}li{display:flex;align-items:center;justify-content:space-between;padding:.5rem 0}button,select{border:1px solid var(--border-strong);border-radius:4px;padding:.5rem;background:var(--surface);color:var(--text-body);margin:.25rem;cursor:pointer}select{max-width:100%}button:disabled{opacity:.5}[role=alert]{color:var(--muted-destructive-foreground)}:is(button,select,input):focus-visible{outline:2px solid var(--ring)}`],
})
export class ProjectAccessPanel {
  readonly project = input.required<ProjectRecord>(); readonly isAdmin = input(false); readonly changed = output<ProjectRecord>();
  private readonly api = inject(ProjectAdminService); private readonly destroy = inject(DestroyRef);
  readonly members = signal<{ userId: string; user: { id: string; name: string | null; email: string } }[]>([]);
  readonly options = signal<{ id: string; name: string | null; email: string }[]>([]);
  readonly loading = signal(false); readonly busy = signal(false); readonly error = signal('');
  constructor() { effect(() => { this.project(); this.isAdmin(); this.load(); }); }
  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ members: this.api.members(this.project().id), options: this.isAdmin() ? this.api.memberOptions() : of([]) }).pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: result => { this.members.set(result.members); this.options.set(result.options.filter(user => !result.members.some(member => member.userId === user.id))); this.loading.set(false); }, error: () => { this.loading.set(false); this.error.set('Could not load project members.'); } });
  }
  add(userId: string) { if (!this.isAdmin() || !userId || this.busy()) return; this.memberRequest(userId, true); }
  remove(userId: string) { if (!this.isAdmin() || this.busy() || !window.confirm('Remove this project member?')) return; this.memberRequest(userId, false); }
  private memberRequest(userId: string, add: boolean) {
    this.busy.set(true); const request = add ? this.api.addMember(this.project().id, userId) : this.api.removeMember(this.project().id, userId);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: () => { this.busy.set(false); this.load(); }, error: () => { this.busy.set(false); this.error.set('Could not change project membership.'); } });
  }
  setClosed(event: Event) { if (!this.isAdmin() || this.busy()) return; this.stateRequest(this.api.setClosed(this.project().id, (event.target as HTMLInputElement).checked)); }
  archive() { if (!this.isAdmin() || this.busy() || !window.confirm(`${this.project().isArchived ? 'Restore' : 'Archive'} this project?`)) return; this.stateRequest(this.api.setArchived(this.project().id, !this.project().isArchived)); }
  private stateRequest(request: ReturnType<ProjectAdminService['setClosed']>) { this.busy.set(true); request.pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: project => { this.busy.set(false); this.changed.emit(project); }, error: () => { this.busy.set(false); this.error.set('Could not update project state.'); } }); }
}
