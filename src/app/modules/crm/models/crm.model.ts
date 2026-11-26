export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST';

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
  status?: LeadStatus;
  isArchived?: boolean;
  createdAt: string;
}

export interface Subscriber {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface LeadsStatsResponse {
  data: LeadsStats;
}
