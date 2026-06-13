export interface CommentAuthor {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorMemberId: string | null;
  author: CommentAuthor | null;
  body: string;
  canModify: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentPayload {
  body: string;
}

export interface UpdateCommentPayload {
  body: string;
}
