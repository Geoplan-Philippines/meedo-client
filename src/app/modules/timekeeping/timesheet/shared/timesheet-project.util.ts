import { clientDisplayName, projectDisplayName } from '../../../../shared/utils/display-name.utils';
import { TimesheetEntry, TimesheetProject } from '../models/timesheet.model';

/** Shown project name (admin display name, else quote subject, else WO number). */
export function timesheetProjectName(project: TimesheetProject | null | undefined): string {
  if (!project) return '';
  return project.name?.trim() || projectDisplayName(project);
}

/** Shown client name, falling back to the customer name stored on the project. */
export function timesheetClientName(project: TimesheetProject | null | undefined): string {
  if (!project) return '';
  return clientDisplayName(project.client) || project.customerName?.trim() || '';
}

/** "Client — Project name · WO number"; the WO number is left out when it is the name. */
export function timesheetProjectLabel(project: TimesheetProject | null | undefined): string {
  if (!project) return '—';
  const name = timesheetProjectName(project);
  const client = timesheetClientName(project);
  const workOrder = project.workOrderNumber?.trim() ?? '';
  const title = client ? `${client} — ${name}` : name;
  return workOrder && workOrder !== name ? `${title} · ${workOrder}` : title || '—';
}

/**
 * Adds the projects that loaded entries already use but the active list leaves out
 * (archived by the sync), so their rows keep a name and an "Archived" tag.
 */
export function withEntryProjects(projects: TimesheetProject[], entries: TimesheetEntry[]): TimesheetProject[] {
  const known = new Set(projects.map((project) => project.id));
  const extra = new Map<string, TimesheetProject>();
  for (const entry of entries) {
    if (entry.project && !known.has(entry.project.id) && !extra.has(entry.project.id)) {
      const project = { ...entry.project, isArchived: entry.project.isArchived ?? true };
      extra.set(project.id, { ...project, label: timesheetProjectLabel(project) });
    }
  }
  return extra.size ? [...projects, ...extra.values()] : projects;
}
