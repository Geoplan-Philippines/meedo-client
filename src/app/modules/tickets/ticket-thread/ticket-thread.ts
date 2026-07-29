import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { forkJoin, finalize } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AuthService } from '../../../core/auth/auth.service';
import { CommentsService } from '../services/comments.service';
import { ActivityService } from '../services/activity.service';
import { TicketComment } from '../models/ticket-comment.model';
import { TicketActivity, TicketActivityType } from '../models/ticket-activity.model';
import { THREAD_PAGE_SIZE, TICKET_COMMENT_MAX_LENGTH } from '../tickets.constants';
import { getAvatarClass } from '../../../shared/utils/avatar.utils';
import { LinkifyPipe } from '../../../shared/pipes/linkify';
import { initialsFrom, relativeTime } from '../utils/ticket.utils';

@Component({
  selector: 'app-ticket-thread',
  imports: [ButtonModule, TextareaModule, SkeletonModule, ConfirmDialogModule, DatePipe, NgTemplateOutlet, ReactiveFormsModule, LinkifyPipe],
  // Own ConfirmationService instance drives this component's <p-confirmDialog>;
  // MessageService is intentionally inherited from the parent (see below).
  providers: [ConfirmationService],
  templateUrl: './ticket-thread.html',
  styleUrl: './ticket-thread.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketThread {
  private readonly commentsService = inject(CommentsService);
  private readonly activityService = inject(ActivityService);
  private readonly authService = inject(AuthService);
  // Intentionally reuses the parent Tickets component's MessageService/<p-toast>.
  // This component must be rendered within Tickets (project pattern: each feature owns its toast).
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ticketId = input.required<string>();

  readonly comments = signal<TicketComment[]>([]);
  readonly activities = signal<TicketActivity[]>([]);
  readonly commentsTotal = signal(0);
  readonly activitiesTotal = signal(0);
  readonly isLoading = signal(false);
  readonly isPostingComment = signal(false);
  readonly isPostingReply = signal(false);
  readonly isSavingComment = signal(false);
  readonly loadingMoreComments = signal(false);
  readonly loadingMoreActivity = signal(false);
  readonly editingCommentId = signal<string | null>(null);
  readonly deletingCommentId = signal<string | null>(null);
  /** Top-level comment id whose inline reply composer is open, if any. */
  readonly replyingToId = signal<string | null>(null);

  private commentsPage = 1;
  private activitiesPage = 1;

  readonly hasMoreComments = computed(() => this.comments().length < this.commentsTotal());
  readonly hasMoreActivity = computed(() => this.activities().length < this.activitiesTotal());

  /** Display name of the signed-in user, for the composer avatars. */
  readonly currentUserName = computed(() => {
    const user = this.authService.currentUser();
    return user?.name ?? user?.email ?? '';
  });

  readonly commentControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(TICKET_COMMENT_MAX_LENGTH)],
  });
  readonly editCommentControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(TICKET_COMMENT_MAX_LENGTH)],
  });
  readonly replyControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(TICKET_COMMENT_MAX_LENGTH)],
  });

  private readonly replyBox = viewChild<ElementRef<HTMLTextAreaElement>>('replyBox');

  constructor() {
    // The dialog keeps this component alive and rebinds [ticketId] when another
    // ticket is opened, so react to ticketId changes instead of loading once in
    // ngOnInit (which would leave the previous ticket's thread on screen).
    effect(() => {
      this.ticketId();
      this.reload();
    });

    // Move focus into the reply box as soon as it appears (composer opens).
    effect(() => {
      this.replyBox()?.nativeElement.focus();
    });
  }

  private reload(): void {
    const ticketId = this.ticketId();
    this.commentsPage = 1;
    this.activitiesPage = 1;
    this.editingCommentId.set(null);
    this.replyingToId.set(null);
    this.isLoading.set(true);

    forkJoin({
      comments: this.commentsService.getComments(ticketId, 1, THREAD_PAGE_SIZE),
      activities: this.activityService.getActivity(ticketId, 1, THREAD_PAGE_SIZE),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.comments.set(res.comments.data);
          this.commentsTotal.set(res.comments.meta.total);
          this.activities.set(res.activities.data);
          this.activitiesTotal.set(res.activities.meta.total);
        },
        error: (err: unknown) => {
          console.error('Error loading ticket thread:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load comments and activity' });
        },
      });
  }

  loadMoreComments(): void {
    this.loadingMoreComments.set(true);
    this.commentsService.getComments(this.ticketId(), this.commentsPage + 1, THREAD_PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingMoreComments.set(false)))
      .subscribe({
        next: (res) => {
          this.commentsPage += 1;
          this.comments.update((current) => [...current, ...res.data]);
          this.commentsTotal.set(res.meta.total);
        },
        error: (err: unknown) => {
          console.error('Error loading more comments:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load more comments' });
        },
      });
  }

  loadMoreActivity(): void {
    this.loadingMoreActivity.set(true);
    this.activityService.getActivity(this.ticketId(), this.activitiesPage + 1, THREAD_PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingMoreActivity.set(false)))
      .subscribe({
        next: (res) => {
          this.activitiesPage += 1;
          this.activities.update((current) => [...current, ...res.data]);
          this.activitiesTotal.set(res.meta.total);
        },
        error: (err: unknown) => {
          console.error('Error loading more activity:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load more activity' });
        },
      });
  }

  /** Enter posts the comment; Shift+Enter inserts a newline. */
  onCommentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      // Guard the keyboard path too: [disabled] only blocks the button, so a rapid
      // double-Enter could fire twice before the request settles and re-renders.
      if (this.isPostingComment()) return;
      this.postComment();
    }
  }

  /** Enter saves the edit; Shift+Enter inserts a newline. */
  onEditCommentKeydown(event: KeyboardEvent, comment: TicketComment): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (this.isSavingComment()) return;
      this.saveEditComment(comment);
    }
  }

  /** Enter sends the reply; Shift+Enter inserts a newline; Escape closes the composer. */
  onReplyKeydown(event: KeyboardEvent, parent: TicketComment): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelReply();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (this.isPostingReply()) return;
      this.postReply(parent);
    }
  }

  postComment(): void {
    if (this.commentControl.invalid) {
      this.commentControl.markAsTouched();
      return;
    }
    const body = this.commentControl.getRawValue().trim();
    if (!body) return;

    this.isPostingComment.set(true);
    this.commentsService.addComment(this.ticketId(), { body })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isPostingComment.set(false)))
      .subscribe({
        next: (comment) => {
          this.commentControl.reset('');
          // Comments read oldest → newest, so a new top-level comment lands at the bottom.
          this.comments.update((current) => [...current, comment]);
          this.commentsTotal.update((total) => total + 1);
          // Posting creates a COMMENTED activity entry server-side; refresh just the timeline.
          this.refreshActivity();
        },
        error: (err: unknown) => {
          console.error('Error posting comment:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to post comment' });
        },
      });
  }

  startReply(comment: TicketComment): void {
    this.replyingToId.set(comment.id);
    this.replyControl.reset('');
  }

  cancelReply(): void {
    this.replyingToId.set(null);
    this.replyControl.reset('');
  }

  postReply(parent: TicketComment): void {
    if (this.replyControl.invalid) {
      this.replyControl.markAsTouched();
      return;
    }
    const body = this.replyControl.getRawValue().trim();
    if (!body) return;

    this.isPostingReply.set(true);
    this.commentsService.addComment(this.ticketId(), { body, parentId: parent.id })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isPostingReply.set(false)))
      .subscribe({
        next: (reply) => {
          // Replies don't create activity entries, so only patch the thread locally.
          this.comments.update((current) =>
            current.map((c) => (c.id === parent.id ? { ...c, replies: [...(c.replies ?? []), reply] } : c)),
          );
          this.cancelReply();
        },
        error: (err: unknown) => {
          console.error('Error posting reply:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to post reply' });
        },
      });
  }

  startEditComment(comment: TicketComment): void {
    this.editingCommentId.set(comment.id);
    this.editCommentControl.setValue(comment.body);
  }

  cancelEditComment(): void {
    this.editingCommentId.set(null);
    this.editCommentControl.reset('');
  }

  saveEditComment(comment: TicketComment): void {
    if (this.editCommentControl.invalid) {
      this.editCommentControl.markAsTouched();
      return;
    }
    const body = this.editCommentControl.getRawValue().trim();
    if (!body) return;

    this.isSavingComment.set(true);
    this.commentsService.updateComment(this.ticketId(), comment.id, { body })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isSavingComment.set(false)))
      .subscribe({
        next: (updated) => {
          // Editing does not generate an activity entry; patch the comment (or reply) in place,
          // preserving its replies and permissions.
          this.comments.update((current) => current.map((c) => this.patchInThread(c, updated)));
          this.cancelEditComment();
        },
        error: (err: unknown) => {
          console.error('Error updating comment:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update comment' });
        },
      });
  }

  /** Confirm before deleting — removal is permanent and there's no undo. */
  confirmDelete(comment: TicketComment): void {
    const noun = comment.parentId !== null ? 'reply' : 'comment';
    this.confirmationService.confirm({
      header: `Delete ${noun}?`,
      message: `This ${noun} will be permanently removed. This can't be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', text: true },
      accept: () => this.deleteComment(comment),
    });
  }

  deleteComment(comment: TicketComment): void {
    this.deletingCommentId.set(comment.id);
    this.commentsService.deleteComment(this.ticketId(), comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.deletingCommentId.set(null)))
      .subscribe({
        next: () => {
          const isReply = comment.parentId !== null;
          // Deleting does not generate an activity entry, so only update comments locally.
          this.comments.update((current) =>
            current
              .filter((c) => c.id !== comment.id)
              .map((c) =>
                c.replies?.some((r) => r.id === comment.id)
                  ? { ...c, replies: c.replies.filter((r) => r.id !== comment.id) }
                  : c,
              ),
          );
          // Only top-level comments count toward pagination totals.
          if (!isReply) this.commentsTotal.update((total) => Math.max(0, total - 1));
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: isReply ? 'Reply removed' : 'Comment removed' });
        },
        error: (err: unknown) => {
          console.error('Error deleting comment:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete comment' });
        },
      });
  }

  /** Patch a single comment/reply body in the thread tree, leaving the rest untouched. */
  private patchInThread(comment: TicketComment, updated: TicketComment): TicketComment {
    if (comment.id === updated.id) {
      return { ...comment, body: updated.body, updatedAt: updated.updatedAt };
    }
    if (comment.replies?.some((r) => r.id === updated.id)) {
      return {
        ...comment,
        replies: comment.replies.map((r) =>
          r.id === updated.id ? { ...r, body: updated.body, updatedAt: updated.updatedAt } : r,
        ),
      };
    }
    return comment;
  }

  /** Reloads only the activity timeline (used after a comment creates a server-side activity entry). */
  private refreshActivity(): void {
    this.activitiesPage = 1;
    this.activityService.getActivity(this.ticketId(), 1, THREAD_PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.activities.set(res.data);
          this.activitiesTotal.set(res.meta.total);
        },
        error: (err: unknown) => console.error('Error refreshing activity:', err),
      });
  }

  authorName(comment: TicketComment): string {
    return comment.author?.user?.name ?? comment.author?.user?.email ?? 'Unknown';
  }

  /** Two-letter initials for an avatar bubble. */
  initials(name: string): string {
    return initialsFrom(name);
  }

  /** Deterministic avatar colour class for a name. */
  avatarClass(name: string): string {
    return getAvatarClass(name);
  }

  /** Compact "3h ago" style timestamp. */
  relTime(iso: string): string {
    return relativeTime(iso);
  }

  actorName(activity: TicketActivity): string {
    return activity.actor?.user?.name ?? activity.actor?.user?.email ?? 'System';
  }

  activityLabel(activity: TicketActivity): string {
    const labels: Record<TicketActivityType, string> = {
      CREATED: 'created the ticket',
      STATUS_CHANGED: 'changed the status',
      ASSIGNEE_CHANGED: 'updated the assignees',
      PRIORITY_CHANGED: 'changed the priority',
      COMMENTED: 'added a comment',
      ARCHIVED: 'archived the ticket',
      RESTORED: 'restored the ticket',
    };
    return labels[activity.type] ?? 'updated the ticket';
  }
}
