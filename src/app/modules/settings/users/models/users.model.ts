export type OnboardMemberRole = 'member';

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  role: string;
  createdAt: string;
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface ListMembersResponse {
  members: OrganizationMember[];
  total: number;
}

export interface OnboardMemberPayload {
  name: string;
  email: string;
  password: string;
  employeeCode?: string;
  biometricsId?: string;
  teamId?: string;
  role: OnboardMemberRole;
}

export interface OnboardMemberResponse {
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    biometricsId: string | null;
  };
  member: {
    id: string;
    userId: string;
    organizationId: string;
    role: string;
  };
}
