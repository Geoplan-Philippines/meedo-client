import { Ticket, TicketAssignee } from '../models/ticket.model';
import { getAvatarClass } from '../../../shared/utils/avatar.utils';

/** View-model for a rendered assignee avatar (initials + colour class + name). */
export interface AssigneeAvatar {
  initials: string;
  className: string;
  name: string;
}

/** Two-letter initials from a display name or email; '?' when empty. */
export function initialsFrom(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Map one ticket assignee to its avatar view-model. */
export function toAssigneeAvatar(assignee: TicketAssignee): AssigneeAvatar {
  const name = assignee.member?.user?.name ?? assignee.member?.user?.email ?? '';
  return {
    initials: initialsFrom(name),
    className: getAvatarClass(name || assignee.memberId),
    name: name || 'Unknown',
  };
}

/** First `limit` assignee avatars for a row; the rest collapse into a +N chip. */
export function visibleAssignees(ticket: Ticket, limit = 3): AssigneeAvatar[] {
  return (ticket.assignees ?? []).slice(0, limit).map(toAssigneeAvatar);
}

/** How many assignees overflow past `limit` (drives the +N chip). */
export function extraAssigneeCount(ticket: Ticket, limit = 3): number {
  return Math.max(0, (ticket.assignees?.length ?? 0) - limit);
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Only let validated hex colours from the API into inline styles; otherwise fall back to a theme token. */
export function safeStatusColor(color?: string | null, fallback = 'var(--text-body)'): string {
  return color && HEX_COLOR_PATTERN.test(color) ? color : fallback;
}

/** Compact relative timestamp ("just now", "3h ago", "2d ago"); absolute date past a week. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 45) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A fresh Date at local midnight — used to flag overdue due dates. */
export function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Serialize a due date for the API as UTC midnight of the user's local date.
 *  Avoids the UTC shift from toISOString() (e.g. UTC+8 midnight → yesterday UTC). */
export function serializeDueDate(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
}
