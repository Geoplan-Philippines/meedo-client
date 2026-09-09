export type TicketStatusCategory = 'BACKLOG' | 'UNSTARTED' | 'STARTED' | 'COMPLETED' | 'CANCELED';

export interface Status {
  id: string;
  name: string;
  color: string | null;
  isSystem: boolean;
  isArchived: boolean;
  category: TicketStatusCategory;
  organizationId: string;
}
