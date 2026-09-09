import { Project, ProjectPriority, ProjectState } from '../models/project.model';

/** Lifecycle order so lists and pickers read the way work actually moves. */
export const PROJECT_STATES: { value: ProjectState; label: string; icon: string }[] = [
  { value: 'BACKLOG', label: 'Backlog', icon: 'pi-inbox' },
  { value: 'PLANNED', label: 'Planned', icon: 'pi-calendar' },
  { value: 'IN_PROGRESS', label: 'In progress', icon: 'pi-spinner' },
  { value: 'COMPLETED', label: 'Completed', icon: 'pi-check-circle' },
  { value: 'CANCELED', label: 'Canceled', icon: 'pi-times-circle' },
];

export const PROJECT_PRIORITIES: { value: ProjectPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export function projectStateLabel(state: ProjectState): string {
  return PROJECT_STATES.find((s) => s.value === state)?.label ?? state;
}

export function projectStateIcon(state: ProjectState): string {
  return PROJECT_STATES.find((s) => s.value === state)?.icon ?? 'pi-circle';
}

/** Theme token per state, so state colour is consistent across list and detail. */
export function projectStateColor(state: ProjectState): string {
  switch (state) {
    case 'IN_PROGRESS':
      return 'var(--color-info)';
    case 'COMPLETED':
      return 'var(--color-success)';
    case 'CANCELED':
      return 'var(--color-muted)';
    case 'PLANNED':
      return 'var(--color-warning)';
    default:
      return 'var(--color-body)';
  }
}

export function projectPriorityLabel(priority: ProjectPriority | null): string {
  return priority ? PROJECT_PRIORITIES.find((p) => p.value === priority)?.label ?? priority : 'No priority';
}

/**
 * Fraction of the start→target window that has already elapsed, as a percentage.
 * Returns null when the project has no bounded window to measure against.
 */
export function projectTimeProgress(project: Project, now: number = Date.now()): number | null {
  if (!project.startDate || !project.targetDate) return null;
  const start = new Date(project.startDate).getTime();
  const end = new Date(project.targetDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round(Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)));
}

/** True once the target date has passed while the project is still open. */
export function isProjectOverdue(project: Project, now: number = Date.now()): boolean {
  if (!project.targetDate) return false;
  if (project.state === 'COMPLETED' || project.state === 'CANCELED') return false;
  const target = new Date(project.targetDate).getTime();
  return !Number.isNaN(target) && target < now;
}
