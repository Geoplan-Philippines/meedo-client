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

/** A row from Better Auth's `list-team-members` (team ↔ user link). */
export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  createdAt: string;
}
