import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { copyText } from './copy-text';

@Component({
  selector: 'app-copy-block',
  imports: [ButtonModule],
  template: `
    <div class="head">
      <h2>{{ heading() }}</h2>
      <button
        pButton
        type="button"
        severity="secondary"
        [outlined]="true"
        size="small"
        [label]="copied() ? 'Copied' : 'Copy'"
        (click)="copy()"
      ></button>
    </div>
    <pre>{{ text() }}</pre>
  `,
  styles: `
    :host { display: block; }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    h2 {
      margin: 0;
      font-family: var(--font-body);
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-heading);
    }
    pre {
      margin: 0;
      padding: 0.75rem 1rem;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8125rem;
      line-height: 1.5;
      white-space: pre-wrap;
      color: var(--text-heading);
      background: var(--subtle);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyBlock {
  readonly heading = input.required<string>();
  readonly text = input.required<string>();
  readonly copied = signal(false);

  copy(): void {
    void copyText(this.text()).then((ok) => {
      if (ok) this.copied.set(true);
    });
  }
}
