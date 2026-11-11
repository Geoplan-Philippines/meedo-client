/** Route value of :clientId for projects with no client, linked from All Clients. */
export const UNASSIGNED_CLIENT_ID = 'unassigned';

/** Workspace URLs, shared by breadcrumbs and pages. */
export const workspaceLinks = {
  clientProjects: (clientId: string) => ['/clients', clientId],
  project: (clientId: string, projectId: string) => ['/clients', clientId, 'projects', projectId],
  projectTickets: (clientId: string, projectId: string) => ['/clients', clientId, 'projects', projectId, 'tickets'],
};
