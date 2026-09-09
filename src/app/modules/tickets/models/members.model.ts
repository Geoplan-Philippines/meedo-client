export interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  displayName: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}
