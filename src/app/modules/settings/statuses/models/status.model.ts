export interface Status {
  id: string;
  name: string;
  color: string;
  isArchived: boolean;
  /** Built-in "standard" status: always present, never editable/archivable/deletable. */
  isSystem: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStatusPayload {
  name: string;
  color: string;
}

export interface UpdateStatusPayload {
  name?: string;
  color?: string;
  isArchived?: boolean;
}
