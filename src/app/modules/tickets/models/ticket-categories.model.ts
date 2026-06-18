export interface TicketCategory {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketCategoryPayload {
  name: string;
  description?: string;
}

export interface UpdateTicketCategoryPayload {
  name?: string;
  description?: string;
}
