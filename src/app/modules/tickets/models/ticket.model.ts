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

export interface PaginatedApiResponse<T> {
  statusCode: number;
  message: string;
  data: T[];
  meta: {
    total: number;
    limit: number;
    page: number;
    lastPage: number;
  };
}

export interface UpdateTicketPayload {
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  ticketStatusId?: string;
  categoryId?: string;
  projectId?: string;
  teamId?: string;
  assigneeIds?: string[];
}
