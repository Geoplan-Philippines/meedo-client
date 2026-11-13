import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';

import { TimesheetService } from '../services/timesheet.service';
import { TimesheetProject } from '../models/timesheet.model';
import { timesheetProjectLabel } from '../shared/timesheet-project.util';
import { pagedSearch } from '../../../../shared/data/paged-search';

/** A dropdown of 50 matches is plenty; typing narrows it further. */
const PROJECT_PICKER_PAGE_SIZE = 50;

/**
 * Timesheet project dropdown that searches the server as the user types
 * instead of loading every project. The current project (which may be
 * archived, or simply not in the latest results) stays in the options so the
 * field never goes blank.
 */
@Component({
  selector: 'app-timesheet-project-picker',
  imports: [FormsModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-select
      [inputId]="inputId()"
      [ngModel]="value()"
      (ngModelChange)="pick($event)"
      [options]="options()"
      optionLabel="label"
      optionValue="id"
      [filter]="true"
      filterBy="label"
      [filterPlaceholder]="'Search client, project or WO number'"
      (onFilter)="results.search($event.filter)"
      (onShow)="results.open()"
      [loading]="results.loading()"
      [showClear]="clearable()"
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      [ariaLabel]="ariaLabel()"
      [emptyFilterMessage]="results.loading() ? 'Searching…' : 'No matching projects'"
      scrollHeight="min(18rem, 45vh)"
      panelStyleClass="timesheet-project-panel"
      appendTo="body"
      [styleClass]="styleClass()"
    />
  `,
})
export class TimesheetProjectPicker {
  private static nextId = 0;
  private readonly api = inject(TimesheetService);

  readonly inputId = input('timesheet-project-' + TimesheetProjectPicker.nextId++);
  readonly value = input<string | null>(null);
  /** Projects the parent already knows (e.g. from loaded entries), used to label the current value. */
  readonly known = input<readonly TimesheetProject[]>([]);
  /** Filters over existing entries may pick archived projects; new entries may not. */
  readonly includeArchived = input(false);
  readonly placeholder = input('Select a project');
  readonly ariaLabel = input('Project');
  readonly clearable = input(true);
  readonly disabled = input(false);
  readonly styleClass = input('w-full');

  readonly changed = output<TimesheetProject | null>();

  readonly results = pagedSearch<TimesheetProject>({
    pageSize: PROJECT_PICKER_PAGE_SIZE,
    fetch: (query) => this.api.searchProjects({ ...query, ...(this.includeArchived() ? { includeArchived: true } : {}) }),
  });
  private readonly picked = signal<TimesheetProject | null>(null);

  readonly options = computed(() => {
    const found = this.results.items();
    const id = this.value();
    if (!id || found.some((project) => project.id === id)) return found;
    const current = [this.picked(), ...this.known()].find((project) => project?.id === id);
    return current ? [{ ...current, label: current.label ?? timesheetProjectLabel(current) }, ...found] : found;
  });

  pick(id: string | null): void {
    const project = id ? this.options().find((option) => option.id === id) ?? null : null;
    this.picked.set(project);
    this.changed.emit(project);
  }
}
