import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputFeedback } from '../../../shared/ui/input-feedback/input-feedback';
import { TICKET_TITLE_MAX_LENGTH } from '../tickets.constants';

@Component({
  selector: 'app-ticket-title-editor',
  imports: [FormsModule, ButtonModule, InputFeedback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './ticket-title-editor.css',
  template: `
    <h1 [attr.aria-label]="value()">
      <input aria-label="Ticket title" [ngModel]="draft()" (ngModelChange)="draft.set($event)"
        [maxLength]="maxLength" [attr.aria-describedby]="feedbackId" [attr.aria-invalid]="editing() && !valid()"
        (focus)="editing.set(true)" (blur)="save()" (keydown.enter)="$event.preventDefault(); save()"
        (keydown.escape)="cancel()" enterkeyhint="done" />
    </h1>
    <app-input-feedback [value]="draft()" [maxLength]="maxLength" [feedbackId]="feedbackId"
      label="Title" [required]="true" [showRequired]="editing()" />
    @if (editing()) {
      <div class="actions" (mousedown)="$event.preventDefault()">
        <button pButton type="button" size="small" label="Save title" (click)="save()" [disabled]="!valid()"></button>
        <button pButton type="button" size="small" severity="secondary" [text]="true" label="Cancel" (click)="cancel()"></button>
      </div>
    }
  `,
})
export class TicketTitleEditor {
  readonly value = input.required<string>();
  readonly titleSave = output<string>();
  readonly draft = signal('');
  readonly editing = signal(false);
  readonly maxLength = TICKET_TITLE_MAX_LENGTH;
  private static nextId = 0;
  readonly feedbackId = `ticket-title-feedback-${TicketTitleEditor.nextId++}`;

  constructor() { effect(() => this.draft.set(this.value())); }

  valid(): boolean { return !!this.draft().trim() && this.draft().length <= this.maxLength; }
  save(): void {
    if (!this.valid()) return;
    const title = this.draft().replace(/\s+/g, ' ').trim();
    this.draft.set(title);
    this.editing.set(false);
    if (title !== this.value()) this.titleSave.emit(title);
  }
  cancel(): void { this.draft.set(this.value()); this.editing.set(false); }
}
