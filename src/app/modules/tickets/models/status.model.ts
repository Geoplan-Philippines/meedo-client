export interface Status {
  id: string;
  name: string;
  color: string;
  isArchived: boolean;
  organizationId: string;
}

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}
