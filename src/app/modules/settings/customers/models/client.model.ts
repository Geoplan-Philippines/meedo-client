export interface ClientRecord {
  id: string;
  apptivoId: string | null;
  missingFromApptivoAt?: string | null;
  /** Shown name: displayName, else customerName (computed by the server). */
  name: string;
  displayName: string | null;
  customerName: string | null;
  isArchived: boolean;
  /** All linked projects, archived ones included. */
  projectCount: number;
  /** Linked projects that are not archived. */
  activeProjectCount: number;
}

export interface ClientOption {
  id: string;
  name: string;
  customerName: string | null;
  isArchived: boolean;
}

/** `name` is the shown name (display name, else the Apptivo customer name). */
export type ClientSortField = 'name' | 'customerName' | 'projectCount' | 'createdAt';

export interface ClientListParams {
  page: number;
  limit: number;
  search?: string;
  includeArchived?: boolean;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}
