/** A headline number in the top metric strip. `attention` cells tint their value
 *  when non-zero (urgent / overdue), so colour conveys state rather than decorates. */
export interface DashboardMetric {
  key: string;
  label: string;
  value: number;
  tone: 'default' | 'attention';
}

/** One coloured segment of the "Queue by status" bar + its legend row. `color` is
 *  always a value already run through hex validation (real status colour or token). */
export interface StatusSegment {
  id: string;
  name: string;
  color: string;
  count: number;
  percent: number;
}

/** One row of the priority breakdown. `color` mirrors the ticket list's priority
 *  mapping (a token var) so a priority reads the same colour in both places. */
export interface PrioritySegment {
  value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  label: string;
  color: string;
  count: number;
  percent: number;
}
