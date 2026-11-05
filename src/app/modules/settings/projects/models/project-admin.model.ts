import { ProjectRecord } from '../../../tickets/models/projects.model';

export type { ProjectRecord };

export type ProjectSortField = 'workOrderNumber' | 'quoteSubject' | 'reportedDate' | 'total' | 'status' | 'createdAt';

export interface ProjectListFilters {
  search: string;
  clientId: string | null;
  /** Only projects with no client (the tree's "Unassigned" node). */
  unassigned: boolean;
  /** Sidebar Dept (team): projects with a ticket for this team. */
  teamId: string | null;
  status: string | null;
  includeArchived: boolean;
  includeClosed?: boolean;
  sortField: ProjectSortField;
  sortOrder: 'asc' | 'desc';
}

export type SlaPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface EffectiveSlaPolicy {
  id: string;
  name: string;
  priority: SlaPriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  projectId: string | null;
  /** project = policy for this project; organization = org default. */
  scope: 'project' | 'organization';
}

export interface ProjectHistoryEntry {
  id: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
  actor: { id: string; user: { name: string | null; email: string } } | null;
}

export interface ProjectDetail extends ProjectRecord {
  apptivoQuoteRefId: string | null;
  ticketCount: number;
  openTicketCount: number;
  timesheetHours: number;
  approvedTimesheetHours: number;
  slaPolicies: EffectiveSlaPolicy[];
  history: ProjectHistoryEntry[];
}

/** Body of PATCH /maintenance/projects/:id. null clears a value. */
export interface UpdateProjectPayload {
  displayName?: string | null;
  clientId?: string | null;
}

export interface SyncCounts {
  synced: number;
  created: number;
  updated: number;
  missing?: number;
  archived: number;
  unarchived: number;
}

export interface ProjectSyncResult extends SyncCounts {
  message: string;
  unmatched: number;
  clients: SyncCounts;
}
