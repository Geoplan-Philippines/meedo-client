import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StatTone = 'success' | 'warning' | 'danger' | 'info';

export interface StatItem {
  label: string;
  /** Null or undefined renders a placeholder with a "No data" label for screen readers. */
  value: string | number | null | undefined;
  /** Optional status dot before the label. */
  tone?: StatTone;
  /** Optional muted qualifier after the value, e.g. "incl. 2 late". */
  hint?: string;
}

/**
 * Headline numbers above a list: label over value, separated by hairlines.
 * No card surface, so it reads the same on the page in both themes.
 */
@Component({
  selector: 'app-stat-strip',
  template: `
    <dl class="stats">
      @for (item of items(); track item.label) {
        <div class="stat">
          <dt class="stat-label">
            @if (item.tone) {
              <span [class]="'ds-dot ds-dot--' + item.tone" aria-hidden="true"></span>
            }
            {{ item.label }}
          </dt>
          <dd class="stat-value">
            @if (item.value === null || item.value === undefined) {
              <span aria-hidden="true">-</span><span class="ds-sr-only">No data</span>
            } @else {
              {{ item.value }}
            }
            @if (item.hint) {
              <span class="stat-hint">{{ item.hint }}</span>
            }
          </dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host { display: block; }
    .stats {
      display: flex;
      flex-wrap: wrap;
      margin: 0;
      row-gap: 0.75rem;
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 7.5rem;
      padding: 0 1.5rem;
      border-left: 1px solid var(--divider);
    }
    .stat:first-child {
      padding-left: 0;
      border-left: 0;
    }
    .stat-label {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .stat-value {
      margin: 0;
      font-size: 1.25rem;
      line-height: 1.3;
      font-weight: 600;
      color: var(--text-heading);
      font-variant-numeric: tabular-nums;
    }
    .stat-hint {
      margin-left: 0.375rem;
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--text-muted);
    }
    @media (max-width: 767.98px) {
      .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .stat, .stat:first-child { padding: 0; border-left: 0; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'label() || null' },
})
export class StatStrip {
  readonly items = input.required<StatItem[]>();
  /** Accessible name for the group, e.g. "Lead statistics". */
  readonly label = input<string>();
}
