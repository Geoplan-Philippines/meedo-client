export interface AppNotification {
  id: string;
  organizationId: string;
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
  link: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  readAt: string | null;
  createdAt: string;
}
