export interface Envelope<T> {
  data: T;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  isArchived: boolean;
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
