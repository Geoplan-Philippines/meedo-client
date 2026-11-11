import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Neutral tag for a record archived in Meedo. Source disappearance is a separate marker. */
@Component({
  selector: 'app-archived-tag',
  template: `<span class="archived-tag" title="Archived in Meedo">Archived</span>`,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .archived-tag {
      display: inline-flex;
      align-items: center;
      padding: 0.0625rem 0.4375rem;
      border: 1px solid var(--border-strong);
      border-radius: 100px;
      background: var(--background);
      color: var(--text-body);
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1.4;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivedTag {}
