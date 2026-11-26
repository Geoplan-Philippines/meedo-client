export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST';

export const LEAD_STATUSES: readonly LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'LOST'];

export interface LeadsStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  lost: number;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  company?: string;
  message?: string;
  source?: string;
  status?: LeadStatus;
  isArchived?: boolean;
  values?: Record<string, unknown>;
  receivedAt?: string;
  createdAt: string;
}

export type SubscriberStatus = 'SUBSCRIBED' | 'UNSUBSCRIBED';

export const SUBSCRIBER_STATUSES: readonly SubscriberStatus[] = ['SUBSCRIBED', 'UNSUBSCRIBED'];

export interface SubscriberStats {
  total: number;
  newThisMonth: number;
  unsubscribed: number;
}

export interface Subscriber {
  id: string;
  email: string;
  name?: string;
  source?: string;
  status?: SubscriberStatus;
  isArchived?: boolean;
  values?: Record<string, unknown>;
  consentAt?: string;
  unsubscribedAt?: string;
  createdAt: string;
}

export interface LeadsStatsResponse {
  data: LeadsStats;
}

export interface SubscriberStatsResponse {
  data: SubscriberStats;
}
