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
  /** Null for top-level comments; the parent comment id for replies. */
  parentId: string | null;
  body: string;
  canModify: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present on top-level comments only (one level of nesting). */
  replies?: TicketComment[];
}

export interface CommentPayload {
  body: string;
}

export interface CreateCommentPayload extends CommentPayload {
  /** When set, posts the comment as a reply to this top-level comment. */
  parentId?: string;
}

export type UpdateCommentPayload = CommentPayload;
