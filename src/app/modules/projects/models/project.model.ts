/** Lifecycle of a project, mirroring the server's `ProjectState` enum. */
export type ProjectState = 'BACKLOG' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** The user behind a member, as embedded on lead/member rows. */
export interface ProjectUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

/** A member reference — used for both the project lead and the member list. */
export interface ProjectMemberRef {
  id: string;
  userId: string;
  user: ProjectUser;
}

/** Join row between a project and a member. */
export interface ProjectMember {
  id: string;
  memberId: string;
  member: ProjectMemberRef;
}

/** Apptivo work order a project delivers against — billing context only. */
export interface ProjectWorkOrder {
  id: string;
  workOrderNumber: string;
  customerName: string | null;
  client?: { customerName: string } | null;
}

export interface Project {
  id: string;
  name: string;
  /** Uppercase prefix that renders task identifiers, e.g. `ENG` in "ENG-12". */
  key: string;
  description: string | null;
  state: ProjectState;
  priority: ProjectPriority | null;
  startDate: string | null;
  targetDate: string | null;
  /** The org's catch-all project for work with no client. Cannot be deleted. */
  isInternal: boolean;
  isArchived: boolean;
  organizationId: string;
  leadMemberId: string | null;
  lead: ProjectMemberRef | null;
  workOrderId: string | null;
  workOrder: ProjectWorkOrder | null;
  members: ProjectMember[];
  _count: { tickets: number };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListParams {
  page: number;
  limit: number;
  search?: string;
  state?: ProjectState[];
  priority?: ProjectPriority[];
  leadMemberId?: string;
  memberId?: string;
  includeArchived?: boolean;
  sortField?: 'name' | 'state' | 'priority' | 'startDate' | 'targetDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProjectPayload {
  name: string;
  /** Derived from the name by the server when omitted. */
  key?: string;
  description?: string;
  state?: ProjectState;
  priority?: ProjectPriority;
  startDate?: string;
  targetDate?: string;
  leadMemberId?: string;
  memberIds?: string[];
  workOrderId?: string;
}

/** All fields optional; `null` clears a value, `undefined` leaves it unchanged. */
export interface UpdateProjectPayload {
  name?: string;
  key?: string;
  description?: string | null;
  state?: ProjectState;
  priority?: ProjectPriority | null;
  startDate?: string | null;
  targetDate?: string | null;
  leadMemberId?: string | null;
  /** Full replacement set, like `assigneeIds` on tickets. */
  memberIds?: string[];
  workOrderId?: string | null;
}
