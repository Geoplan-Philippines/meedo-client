import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

export type ActionDropdownSeverity = 'default' | 'danger';

export interface ActionDropdownItem {
  label: string;
  icon?: string;
  disabled?: boolean;
  visible?: boolean;
  severity?: ActionDropdownSeverity;
  command: () => void;
}

@Component({
  selector: 'app-action-dropdown',
  imports: [ButtonModule, MenuModule],
  templateUrl: './action-dropdown.html',
  styleUrl: './action-dropdown.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionDropdown {
  readonly actions = input.required<ActionDropdownItem[]>();
  readonly ariaLabel = input('Open actions');
  readonly disabled = input(false);

  readonly menuItems = computed<MenuItem[]>(() =>
    this.actions()
      .filter((action) => action.visible !== false)
      .map((action) => ({
        label: action.label,
        icon: action.icon,
        disabled: action.disabled,
        styleClass: action.severity === 'danger' ? 'action-dropdown-item--danger' : undefined,
        command: () => action.command(),
      })),
  );
}
