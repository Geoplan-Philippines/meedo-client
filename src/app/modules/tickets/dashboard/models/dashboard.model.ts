/** One coloured segment of the "Queue by status" bar + its legend row. `color` is
 *  always a value already run through hex validation (real status colour or token). */
export interface StatusSegment {
  id: string;
  name: string;
  color: string;
  count: number;
  percent: number;
}

/** One row of the priority breakdown. `color` is the same `--priority-*` token the
 *  ticket list's dots use, so a priority reads the same colour in both places. */
export interface PrioritySegment {
  value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  label: string;
  color: string;
  count: number;
  percent: number;
}
