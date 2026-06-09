export interface TicketCategory {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
}

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}
