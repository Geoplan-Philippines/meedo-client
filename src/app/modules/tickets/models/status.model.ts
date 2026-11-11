export type TicketStatusCategory = 'BACKLOG' | 'UNSTARTED' | 'STARTED' | 'COMPLETED' | 'CANCELED';

export interface Status {
  id: string;
  name: string;
  color: string;
  isArchived: boolean;
  category: TicketStatusCategory;
  organizationId: string;
  isSystem?: boolean;
  createdAt?: string;
}
