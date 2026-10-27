import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SlaState, SlaTarget, TicketSla } from '../models/ticket.model';

const STATE_LABELS: Record<SlaState, string> = {
  ok: 'On track',
  at_risk: 'At risk',
  breached: 'Breached',
  met: 'Met',
};

/** Most urgent first: a breached target outranks one at risk, which outranks an open one. */
const URGENCY: Record<SlaState, number> = { breached: 3, at_risk: 2, ok: 1, met: 0 };

type BadgeTarget = 'summary' | 'response' | 'resolution';

/**
 * SLA state pill. `summary` (board cards) shows the most urgent of the two targets;
 * `response` / `resolution` (detail view) show one target with its due time.
 */
@Component({
  selector: 'app-sla-badge',
  imports: [DatePipe],
  template: `
    @if (shown(); as shown) {
      <span
        [class]="'sla-badge sla-badge--' + shown.target.state"
        [attr.title]="tooltip()"
        [attr.aria-label]="ariaLabel()"
      >
        <i [class]="'pi ' + icon()" aria-hidden="true"></i>
        <span>{{ label() }}</span>
      </span>
      @if (target() !== 'summary') {
        <span class="sla-badge__due">due {{ shown.target.dueAt | date: 'MMM d, h:mm a' }}</span>
      }
    }
  `,
  styleUrl: './sla-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlaBadge {
  readonly sla = input.required<TicketSla>();
  readonly target = input<BadgeTarget>('summary');

  readonly shown = computed<{ name: string; target: SlaTarget }>(() => {
    const sla = this.sla();
    const which = this.target();
    if (which === 'response') return { name: 'First response', target: sla.response };
    if (which === 'resolution') return { name: 'Resolution', target: sla.resolution };
    return URGENCY[sla.response.state] >= URGENCY[sla.resolution.state]
      ? { name: 'First response', target: sla.response }
      : { name: 'Resolution', target: sla.resolution };
  });

  readonly label = computed(() => {
    const { state } = this.shown().target;
    return this.target() === 'summary' ? `SLA ${STATE_LABELS[state].toLowerCase()}` : STATE_LABELS[state];
  });

  readonly icon = computed(() => {
    switch (this.shown().target.state) {
      case 'breached':
        return 'pi-exclamation-circle';
      case 'at_risk':
        return 'pi-clock';
      case 'met':
        return 'pi-check-circle';
      default:
        return 'pi-stopwatch';
    }
  });

  readonly ariaLabel = computed(() => {
    const { name, target } = this.shown();
    return `${name} SLA: ${STATE_LABELS[target.state]}`;
  });

  readonly tooltip = computed(() => {
    const sla = this.sla();
    const due = (target: SlaTarget) => new Date(target.dueAt).toLocaleString();
    return [
      `${sla.policyName} (${sla.scope === 'project' ? 'project policy' : 'org default'})`,
      `First response: ${STATE_LABELS[sla.response.state]}, due ${due(sla.response)}`,
      `Resolution: ${STATE_LABELS[sla.resolution.state]}, due ${due(sla.resolution)}`,
    ].join('\n');
  });
}
