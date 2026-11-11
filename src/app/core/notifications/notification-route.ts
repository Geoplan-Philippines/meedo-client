import { AppNotification } from './notification.model';

/** Payload URLs are never trusted. Angular encodes entity IDs as route segments. */
export function notificationRoute(
  item: Pick<AppNotification, 'entityType' | 'entityId'>,
): string[] | null {
  if (typeof item.entityId !== 'string' || !item.entityId.trim()) return null;
  switch (item.entityType) {
    case 'ticket':
      return ['/tickets', item.entityId];
    // Project notifications open the membership-filtered projects screen.
    case 'project':
      return ['/settings', 'projects'];
    default:
      return null;
  }
}
