export interface WebsiteIntegration {
  slug: string;
  hasKey: boolean;
  prefix: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export interface IntegrationKeySecret {
  key: string;
  prefix: string;
}

export type WebhookEvent = 'lead.created' | 'subscriber.created' | 'subscriber.unsubscribed';

export const WEBHOOK_EVENTS: readonly { value: WebhookEvent; label: string }[] = [
  { value: 'lead.created', label: 'Lead created' },
  { value: 'subscriber.created', label: 'Subscriber created' },
  { value: 'subscriber.unsubscribed', label: 'Subscriber unsubscribed' },
];

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  prefix?: string;
  createdAt: string;
  secret?: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  success: boolean;
  statusCode?: number | null;
  attempt?: number;
  error?: string | null;
  createdAt: string;
}

export function webhookEventLabel(event: string): string {
  return WEBHOOK_EVENTS.find((item) => item.value === event)?.label ?? event;
}

export function readOrganizationSlug(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  if (typeof record['slug'] === 'string' && record['slug'].trim()) return record['slug'].trim();
  const nested = record['data'] ?? record['organization'];
  if (nested && typeof nested === 'object') {
    const slug = (nested as Record<string, unknown>)['slug'];
    if (typeof slug === 'string' && slug.trim()) return slug.trim();
  }
  return '';
}
