export interface LeadsStats {
  total: number;
  pending: number;
  qualified: number;
  converted: number;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  company?: string;
  message?: string;
  status?: string;
  createdAt: string;
}

export interface Subscriber {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface LeadsResponse {
  data: Lead[];
}

export interface SubscribersResponse {
  data: Subscriber[];
}

export interface LeadsStatsResponse {
  data: LeadsStats;
}
