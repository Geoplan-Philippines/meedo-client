export interface Team {
  id: string;
  name: string;
  isArchived: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamPayload {
  name: string;
  organizationId?: string;
}

/** A team ↔ user link row, plus the linked user (from `settings/teams/:id/members`). */
export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}
