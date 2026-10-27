export interface TicketAssignee {
  id: string;
  memberId: string;
  member?: {
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  };
}

/** A lightweight reference to another ticket this one is linked to. The server
 *  returns these (like `assignees`) so the sidebar can render a row without a
 *  second fetch; writes go through `relatedTicketIds` on the update payload. */
export interface TicketRelation {
  id: string;
  ticketNumber: number;
  title: string;
  ticketStatus?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface Ticket {
  id: string;
  title: string;
  ticketNumber: number;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  assignees?: TicketAssignee[];
  ticketStatusId?: string | null;
  team?: { id: string; name: string } | null;
  categoryId?: string;
  projectId?: string;
  teamId?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  ticketStatus?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  project?: {
    id: string;
    customerName: string;
    workOrderNumber: string;
    displayName?: string | null;
    quoteSubject?: string | null;
    isArchived?: boolean;
    client?: { customerName: string; displayName?: string | null } | null;
  } | null;
  /** Other tickets this one is linked to (symmetric — the server keeps both sides in sync). */
  relatedTickets?: TicketRelation[];
  /** SLA state calculated by the server on read; null when no policy applies. */
  sla?: TicketSla | null;
}

export type SlaState = 'ok' | 'at_risk' | 'breached' | 'met';

export interface SlaTarget {
  dueAt: string;
  state: SlaState;
}

export interface TicketSla {
  policyId: string;
  policyName: string;
  /** project = policy for the ticket's project; organization = org-wide default. */
  scope: 'project' | 'organization';
  response: SlaTarget;
  resolution: SlaTarget;
}

/** Board views, separated as tabs. `all` applies no status-category filter. */
export type TicketView = 'backlog' | 'active' | 'closed' | 'all';

export interface TicketListParams {
  noStatus?: boolean;
  page: number;
  limit: number;
  search?: string;
  view?: TicketView;
  ticketStatusId?: string[];
  priority?: string[];
  teamId?: string[];
  categoryId?: string;
  /** Only tickets on this project (set by the /clients/:clientId/projects/:projectId/tickets route). */
  projectId?: string;
  assigneeId?: string;
  includeArchived?: boolean;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TicketFacetsParams {
  priority?: string[];
  view?: TicketView;
  teamId?: string[];
  categoryId?: string;
  projectId?: string;
  assigneeId?: string;
  search?: string;
  includeArchived?: boolean;
}

/** Counts powering the view tabs and the filter-menu badges. */
export interface TicketFacets {
  noStatusCount?: number;
  views: Record<TicketView, number>;
  statuses: { ticketStatusId: string; count: number }[];
  priorities: { priority: string; count: number }[];
}

export interface CreateTicketPayload {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  ticketStatusId?: string;
  categoryId?: string;
  projectId?: string;
  teamId?: string;
  assigneeIds?: string[];
}

export interface UpdateTicketPayload {
  title?: string;
  // null clears the field on the server; undefined leaves it unchanged.
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  ticketStatusId?: string | null;
  categoryId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  assigneeIds?: string[];
  /** Full replacement set of linked ticket IDs (like `assigneeIds`). */
  relatedTicketIds?: string[];
}
