import { ProjectState } from '../../projects/models/project.model';

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

/** The project a task lives in. `key` supplies the "ENG" in "ENG-12". */
export interface TicketProject {
  id: string;
  name: string;
  key: string;
  state: ProjectState;
  isInternal: boolean;
}

/** Optional Apptivo work order a task bills against — client context, not ownership. */
export interface TicketWorkOrder {
  id: string;
  workOrderNumber: string;
  customerName: string;
  client?: { customerName: string } | null;
}

/** A lightweight reference to another ticket this one is linked to. The server
 *  returns these (like `assignees`) so the sidebar can render a row without a
 *  second fetch; writes go through `relatedTicketIds` on the update payload. */
export interface TicketRelation {
  id: string;
  number: number;
  title: string;
  project?: { key: string } | null;
  ticketStatus?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface Ticket {
  id: string;
  title: string;
  /** Sequential within the owning project; render with the project key as "ENG-12". */
  number: number;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  assignees?: TicketAssignee[];
  ticketStatusId: string | null;
  categoryId: string | null;
  /** Every task belongs to exactly one project; internal work uses the org's internal project. */
  projectId: string;
  project?: TicketProject | null;
  workOrderId: string | null;
  workOrder?: TicketWorkOrder | null;
  teamId: string | null;
  organizationId: string;
  isArchived: boolean;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ticketStatus?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
  } | null;
  team?: {
    id: string;
    name: string;
  } | null;
  /** Other tickets this one is linked to (symmetric — the server keeps both sides in sync). */
  relatedTickets?: TicketRelation[];
}

/** Board views, separated as tabs. `all` applies no status-category filter. */
export type TicketView = 'backlog' | 'active' | 'closed' | 'all';

export interface TicketListParams {
  page: number;
  limit: number;
  search?: string;
  view?: TicketView;
  /** Scopes the list to one project's tasks. */
  projectId?: string;
  ticketStatusId?: string[];
  priority?: string[];
  teamId?: string[];
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TicketFacetsParams {
  view?: TicketView;
  search?: string;
  projectId?: string;
}

/** Counts powering the view tabs and the filter-menu badges. */
export interface TicketFacets {
  views: Record<TicketView, number>;
  statuses: { ticketStatusId: string; count: number }[];
  priorities: { priority: string; count: number }[];
}

export interface CreateTicketPayload {
  title: string;
  /** Required — the server allocates the task number from this project's counter. */
  projectId: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  ticketStatusId?: string;
  categoryId?: string;
  workOrderId?: string;
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
  /** Moving a task to another project reallocates its number from that project. */
  projectId?: string;
  workOrderId?: string | null;
  teamId?: string | null;
  assigneeIds?: string[];
  /** Full replacement set of linked ticket IDs (like `assigneeIds`). */
  relatedTicketIds?: string[];
}
