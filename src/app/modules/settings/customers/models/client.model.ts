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

export type ClientSortField = 'customerName' | 'projectCount' | 'createdAt';

export interface ClientListParams {
  page: number;
  limit: number;
  search?: string;
  includeArchived?: boolean;
  sortField?: ClientSortField;
  sortOrder?: 'asc' | 'desc';
}
