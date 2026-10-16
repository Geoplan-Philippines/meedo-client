import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-input-feedback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './input-feedback.css',
  template: `
    <div [id]="feedbackId()" aria-live="polite" aria-atomic="true">
      @if (blank()) { <p class="error">{{ label() }} cannot be blank. Enter text other than whitespace.</p> }
      @if (nearLimit()) {
        <p [class.error]="value().length >= maxLength()">
          {{ value().length }} / {{ maxLength() }} characters.
          @if (value().length >= maxLength()) { Limit reached. }
          @else { {{ maxLength() - value().length }} characters remaining. }
        </p>
      }
    </div>
  `,
})
export class InputFeedback {
  readonly value = input('');
  readonly maxLength = input.required<number>();
  readonly feedbackId = input.required<string>();
  readonly label = input('Text');
  readonly required = input(false);
  readonly showRequired = input(false);
  readonly blank = computed(() => this.required() && !this.value().trim() && (this.showRequired() || this.value().length > 0));
  readonly nearLimit = computed(() => this.value().length >= Math.ceil(this.maxLength() * 0.9));
}
