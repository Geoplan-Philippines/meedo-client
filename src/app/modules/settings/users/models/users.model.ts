export type OrganizationMemberRole = 'member' | 'admin' | 'owner';
export type OnboardMemberRole = 'member';

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  role: OrganizationMemberRole;
  createdAt: string;
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface MemberDetails {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationMemberRole;
  createdAt: string;
  teamId: string | null;
  /** The member's team, so the edit form can show it without loading every team. */
  team?: { id: string; name: string } | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    employeeCode: string | null;
    biometricsId: string | null;
  };
}

export interface HikvisionDirectoryUser {
  employeeNo: string;
  name: string;
  userType: string;
  enabled: boolean;
  displayName: string;
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

export interface UpdateMemberPayload {
  name: string;
  email: string;
  employeeCode: string | null;
  biometricsId: string | null;
  teamId: string | null;
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
