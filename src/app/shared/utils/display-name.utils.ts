/**
 * Shown names for Apptivo-synced projects and clients. Mirrors the server rule:
 * a project shows its admin-set displayName, else the quote subject, else the WO
 * number; a client shows its displayName, else the Apptivo customer name.
 */

export interface ProjectNameFields {
  displayName?: string | null;
  quoteSubject?: string | null;
  workOrderNumber: string | null;
}

export interface ClientNameFields {
  displayName?: string | null;
  customerName?: string | null;
}

function nonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function projectDisplayName(project: ProjectNameFields): string {
  return nonBlank(project.displayName) ?? nonBlank(project.quoteSubject) ?? nonBlank(project.workOrderNumber) ?? 'Unnamed project';
}

export function clientDisplayName(client: ClientNameFields | null | undefined): string {
  return nonBlank(client?.displayName) ?? nonBlank(client?.customerName) ?? '';
}
