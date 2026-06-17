export type TicketActivityType =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'COMMENTED'
  | 'ARCHIVED'
  | 'RESTORED';

export interface ActivityActor {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

export interface TicketActivity {
  id: string;
  ticketId: string;
  actorMemberId: string | null;
  actor: ActivityActor | null;
  type: TicketActivityType;
  meta: Record<string, unknown> | null;
  createdAt: string;
}
