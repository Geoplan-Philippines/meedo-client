import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';

/** A project as GET /maintenance/projects returns it. */
export interface ProjectRecord {
  id: string;
  apptivoId: string | null;
  isClosed?: boolean;
  archivedManually?: boolean;
  /** Shown name: displayName, else quoteSubject, else workOrderNumber (computed by the server). */
  name: string;
  displayName: string | null;
  workOrderNumber: string;
  quoteSubject: string | null;
  customerName: string;
  status: string;
  total: number;
  reportedDate: string | null;
  clientId: string | null;
  clientLocked: boolean;
  isArchived: boolean;
  client: { id: string; name: string; customerName: string; displayName: string | null; isArchived: boolean } | null;
}

/** Picker option: the record plus the text the ticket pickers show and filter on. */
export interface Project extends ProjectRecord {
  /** Name, client and WO number in one string, for filtering. */
  label: string;
  /** Client shown name, '' when the project has no client. */
  clientName: string;
}

export type PaginatedProjects = PaginatedApiResponse<ProjectRecord>;
