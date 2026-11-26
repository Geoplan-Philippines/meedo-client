import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { copyText } from './copy-text';

@Component({
  selector: 'app-secret-reveal',
  imports: [ButtonModule, MessageModule],
  template: `
    <p-message severity="warn" icon="pi pi-exclamation-triangle" styleClass="ds-message">
      {{ heading() }} Copy it now. Meedo will not show it again.
    </p-message>
    <div class="secret-row">
      <code>{{ value() }}</code>
      <button
        pButton
        type="button"
        severity="secondary"
        [outlined]="true"
        [label]="copied() ? 'Copied' : 'Copy'"
        (click)="copy()"
      ></button>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.75rem; }
    .secret-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.75rem;
    }
    code {
      flex: 1 1 16rem;
      margin: 0;
      padding: 0.75rem 1rem;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8125rem;
      line-height: 1.5;
      color: var(--text-heading);
      background: var(--subtle);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      word-break: break-all;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretReveal {
  readonly heading = input('This secret is shown once.');
  readonly value = input.required<string>();
  readonly copied = signal(false);

  copy(): void {
    void copyText(this.value()).then((ok) => {
      if (ok) this.copied.set(true);
    });
  }
}
