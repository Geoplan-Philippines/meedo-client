import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientsService } from '../customers/services/clients.service';
import { ProjectAdminService } from '../projects/services/project-admin.service';
import { ClientOption } from '../customers/models/client.model';
import { ClientTypeahead } from './client-typeahead';
import { trimmedRequired } from '../../tickets/utils/ticket-validation';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-new-internal-record', imports: [ReactiveFormsModule, ClientTypeahead], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section><h2>New {{ kind() }}</h2><p>Internal records are managed here and are never changed by the Apptivo sync.</p>
      <form [formGroup]="form" (ngSubmit)="save()">
        <label [for]="kind()+'-new-name'">Name (required)</label><input [id]="kind()+'-new-name'" formControlName="name" maxlength="200" aria-describedby="new-record-feedback" [attr.aria-invalid]="form.controls.name.touched && form.controls.name.invalid" />
        @if (kind() === 'project') { <app-client-typeahead inputId="new-project-client" label="Client (required)" [value]="form.controls.clientId.value" (valueChange)="selectClient($event)" /> }
        <p id="new-record-feedback" aria-live="polite">{{ form.controls.name.value.trim().length }} / 200 characters</p>
        @if (error()) { <p role="alert">{{ error() }}</p> }
        <button type="submit" [disabled]="busy()">{{ busy() ? 'Creating…' : 'Create '+kind() }}</button><button type="button" (click)="cancelled.emit()" [disabled]="busy()">Cancel</button>
      </form>
    </section>
  `,
  styles: [`section{padding:1.5rem;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text-body)}h2{font-weight:600;color:var(--text-heading)}label,input,select{display:block;margin:.5rem 0}input,select{width:100%;max-width:35rem;padding:.625rem;border:1px solid var(--border-strong);border-radius:4px;background:var(--surface);color:var(--text-heading)}button{padding:.625rem 1rem;border:1px solid var(--border);border-radius:4px;margin-right:.5rem;cursor:pointer}button[type=submit]{background:var(--primary);color:var(--primary-foreground)}[role=alert]{color:var(--muted-destructive-foreground)}:is(input,select,button):focus-visible{outline:2px solid var(--ring)}`],
})
export class NewInternalRecord {
  readonly kind = input<'client' | 'project'>('client');
  readonly saved = output<void>(); readonly cancelled = output<void>();
  private readonly clientsApi = inject(ClientsService); private readonly projectsApi = inject(ProjectAdminService); private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false); readonly error = signal('');
  readonly form = new FormGroup({ name: new FormControl('', { nonNullable: true, validators: [trimmedRequired, Validators.maxLength(200)] }), clientId: new FormControl('', { nonNullable: true }) });
  selectClient(client: ClientOption | null) { this.form.controls.clientId.setValue(client?.id ?? ''); }
  save() {
    if (this.busy()) return;
    this.form.controls.name.setValue(this.form.controls.name.value.trim()); this.form.markAllAsTouched();
    if (this.form.invalid || (this.kind() === 'project' && !this.form.controls.clientId.value)) { this.error.set('Enter a name of at most 200 characters and select a client for a project.'); return; }
    this.busy.set(true); this.error.set('');
    const request: Observable<unknown> = this.kind() === 'client' ? this.clientsApi.create(this.form.controls.name.value) : this.projectsApi.create(this.form.controls.name.value, this.form.controls.clientId.value);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: () => { this.busy.set(false); this.saved.emit(); }, error: () => { this.busy.set(false); this.error.set('Could not create this record. Check your access and try again.'); } });
  }
}
