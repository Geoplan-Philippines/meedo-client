/** Page size for the comment/activity thread in the ticket detail dialog. */
export const THREAD_PAGE_SIZE = 50;

/** Input limits shared by ticket creation, detail editing, comments and replies.
 * Mirrors the backend ticket/comment DTO constants. */
export const TICKET_TITLE_MAX_LENGTH = 200;
export const TICKET_DESCRIPTION_MAX_LENGTH = 5000;
export const TICKET_COMMENT_MAX_LENGTH = 5000;

/** Query params for the tickets list scoped to the signed-in member ("My tickets" in the sidebar). */
export const MY_TICKETS_QUERY_PARAMS = { assignee: 'me' } as const;
