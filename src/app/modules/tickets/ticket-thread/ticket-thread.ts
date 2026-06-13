import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { forkJoin, finalize } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

import { CommentsService } from '../services/comments.service';
import { ActivityService } from '../services/activity.service';
import { TicketComment } from '../models/ticket-comment.model';
import { TicketActivity, TicketActivityType } from '../models/ticket-activity.model';
import { THREAD_PAGE_SIZE, TICKET_COMMENT_MAX_LENGTH } from '../tickets.constants';

@Component({
  selector: 'app-ticket-thread',
  imports: [ButtonModule, TextareaModule, SkeletonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './ticket-thread.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketThread implements OnInit {
  private readonly commentsService = inject(CommentsService);
  private readonly activityService = inject(ActivityService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ticketId = input.required<string>();

  readonly comments = signal<TicketComment[]>([]);
  readonly activities = signal<TicketActivity[]>([]);
  readonly commentsTotal = signal(0);
  readonly activitiesTotal = signal(0);
  readonly isLoading = signal(false);
  readonly isPostingComment = signal(false);
  readonly isSavingComment = signal(false);
  readonly loadingMoreComments = signal(false);
  readonly loadingMoreActivity = signal(false);
  readonly editingCommentId = signal<string | null>(null);
  readonly deletingCommentId = signal<string | null>(null);

  private commentsPage = 1;
  private activitiesPage = 1;

  readonly hasMoreComments = computed(() => this.comments().length < this.commentsTotal());
  readonly hasMoreActivity = computed(() => this.activities().length < this.activitiesTotal());

  readonly commentControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(TICKET_COMMENT_MAX_LENGTH)],
  });
  readonly editCommentControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(TICKET_COMMENT_MAX_LENGTH)],
  });

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    const ticketId = this.ticketId();
    this.commentsPage = 1;
    this.activitiesPage = 1;
    this.editingCommentId.set(null);
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

  postComment(): void {
    if (this.commentControl.invalid) {
      this.commentControl.markAsTouched();
      return;
    }
    const body = this.commentControl.getRawValue().trim();
    if (!body) return;

    this.isPostingComment.set(true);
    this.commentsService.addComment(this.ticketId(), { body })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.commentControl.reset('');
          this.isPostingComment.set(false);
          this.reload();
        },
        error: (err: unknown) => {
          console.error('Error posting comment:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to post comment' });
          this.isPostingComment.set(false);
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSavingComment.set(false);
          this.cancelEditComment();
          this.reload();
        },
        error: (err: unknown) => {
          console.error('Error updating comment:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update comment' });
          this.isSavingComment.set(false);
        },
      });
  }

  deleteComment(comment: TicketComment): void {
    this.deletingCommentId.set(comment.id);
    this.commentsService.deleteComment(this.ticketId(), comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingCommentId.set(null);
          this.reload();
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Comment removed' });
        },
        error: (err: unknown) => {
          console.error('Error deleting comment:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete comment' });
          this.deletingCommentId.set(null);
        },
      });
  }

  authorName(comment: TicketComment): string {
    return comment.author?.user?.name ?? comment.author?.user?.email ?? 'Unknown';
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
