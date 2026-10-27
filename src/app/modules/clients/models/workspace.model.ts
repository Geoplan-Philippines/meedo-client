/** Route value of :clientId for projects with no client, linked from All Clients. */
export const UNASSIGNED_CLIENT_ID = 'unassigned';

/** One client row of the sidebar tree (GET /maintenance/clients/tree). */
export interface ClientTreeNode {
  id: string;
  /** Shown name: display name, else the Apptivo customer name. */
  name: string;
  /** Active projects belonging to the client. */
  projectCount: number;
}

/** Workspace URLs, shared by the tree, breadcrumbs and pages. */
export const workspaceLinks = {
  clientProjects: (clientId: string) => ['/clients', clientId],
  project: (clientId: string, projectId: string) => ['/clients', clientId, 'projects', projectId],
  projectTickets: (clientId: string, projectId: string) => ['/clients', clientId, 'projects', projectId, 'tickets'],
};
