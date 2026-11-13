export const CAMPAIGN_LIMITS = { name: 200, subject: 200, body: 20_000 } as const;

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  subject: string;
  body: string;
  status: 'DRAFT' | 'ARCHIVED';
  createdByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CampaignPayload = Pick<Campaign, 'name' | 'subject' | 'body'>;
export interface CampaignListParams {
  page: number;
  limit: number;
  search?: string;
  includeArchived?: boolean;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}
