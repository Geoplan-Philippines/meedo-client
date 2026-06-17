export interface TicketAssignee {
  id: string;
  memberId: string;
  member?: {
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  };
}

export interface Ticket {
  id: string;
  title: string;
  ticketNumber: number;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  assignees?: TicketAssignee[];
  ticketStatusId?: string;
  categoryId?: string;
  projectId?: string;
  teamId?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  ticketStatus?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface TicketListParams {
  page: number;
  limit: number;
  search?: string;
  ticketStatusId?: string;
  priority?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateTicketPayload {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  ticketStatusId?: string;
  categoryId?: string;
  projectId?: string;
  teamId?: string;
  assigneeIds?: string[];
}

export interface UpdateTicketPayload {
  title?: string;
  // null clears the field on the server; undefined leaves it unchanged.
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  ticketStatusId?: string | null;
  categoryId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  assigneeIds?: string[];
}
