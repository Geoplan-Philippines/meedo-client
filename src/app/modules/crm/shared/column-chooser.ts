import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ColumnOption } from './column-visibility';

@Component({
  selector: 'app-column-chooser',
  imports: [ButtonModule],
  template: `
    <div class="chooser">
      <button
        pButton
        type="button"
        severity="secondary"
        [outlined]="true"
        icon="pi pi-table"
        label="Columns"
        [attr.aria-expanded]="open()"
        aria-controls="column-chooser-panel"
        (click)="open.set(!open())"
      ></button>
      @if (open()) {
        <div id="column-chooser-panel" class="chooser-panel" role="group" aria-label="Visible columns">
          @for (column of columns(); track column.id) {
            <label class="chooser-item">
              <input
                type="checkbox"
                [checked]="selected().includes(column.id)"
                [disabled]="!!column.locked"
                (change)="toggle(column)"
              />
              {{ column.label }}
            </label>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: inline-block; position: relative; }
    .chooser-panel {
      position: absolute;
      right: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 12rem;
      margin-top: 0.375rem;
      padding: 0.75rem;
      background: var(--popover);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .chooser-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-body);
      cursor: pointer;
    }
    .chooser-item:has(input:disabled) { color: var(--text-muted); cursor: default; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnChooser {
  readonly columns = input.required<readonly ColumnOption[]>();
  readonly selected = input.required<readonly string[]>();
  readonly selectedChange = output<string[]>();
  readonly open = signal(false);

  toggle(column: ColumnOption): void {
    if (column.locked) return;
    const current = new Set(this.selected());
    if (current.has(column.id)) current.delete(column.id);
    else current.add(column.id);
    this.selectedChange.emit(this.columns().filter((item) => item.locked || current.has(item.id)).map((item) => item.id));
  }
}
