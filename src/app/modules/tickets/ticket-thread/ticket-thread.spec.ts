import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { ActivityService } from '../services/activity.service';
import { CommentsService } from '../services/comments.service';
import { TicketComment } from '../models/ticket-comment.model';
import { TICKET_COMMENT_MAX_LENGTH } from '../tickets.constants';
import { TicketThread } from './ticket-thread';

const comment: TicketComment = { id: 'comment', ticketId: 'ticket', authorMemberId: null, author: null,
  parentId: null, body: 'Original comment', canModify: true, createdAt: '2026-10-16', updatedAt: '2026-10-16', replies: [] };
const page = { data: [comment], meta: { page: 1, limit: 50, total: 1, lastPage: 1 } };

describe('TicketThread validation', () => {
  let fixture: ComponentFixture<TicketThread>;
  let component: TicketThread;
  let service: { getComments: ReturnType<typeof vi.fn>; addComment: ReturnType<typeof vi.fn>; updateComment: ReturnType<typeof vi.fn> };
  beforeEach(async () => {
    service = { getComments: vi.fn().mockReturnValue(of(page)), addComment: vi.fn().mockReturnValue(of(comment)), updateComment: vi.fn().mockReturnValue(of(comment)) };
    await TestBed.configureTestingModule({ imports: [TicketThread], providers: [MessageService,
      { provide: CommentsService, useValue: service },
      { provide: ActivityService, useValue: { getActivity: () => of({ ...page, data: [] }) } },
      { provide: AuthService, useValue: { currentUser: () => ({ name: 'QA' }) } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(TicketThread); component = fixture.componentInstance;
    fixture.componentRef.setInput('ticketId', 'ticket');
    fixture.detectChanges(); await fixture.whenStable();
  });

  it.each(['comment', 'reply', 'edit'] as const)('rejects blank and oversized %s through submit and keyboard paths', kind => {
    const control = kind === 'comment' ? component.commentControl : kind === 'reply' ? component.replyControl : component.editCommentControl;
    const submit = () => kind === 'comment' ? component.postComment() : kind === 'reply' ? component.postReply(comment) : component.saveEditComment(comment);
    for (const value of ['', ' \n\t ', 'x'.repeat(TICKET_COMMENT_MAX_LENGTH + 1)]) {
      control.setValue(value); submit();
      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      if (kind === 'comment') component.onCommentKeydown(event);
      else if (kind === 'reply') component.onReplyKeydown(event, comment);
      else component.onEditCommentKeydown(event, comment);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(service.addComment).not.toHaveBeenCalled(); expect(service.updateComment).not.toHaveBeenCalled();
  });

  it.each(['comment', 'reply', 'edit'] as const)('accepts the exact limit for %s and trims submitted whitespace', kind => {
    const control = kind === 'comment' ? component.commentControl : kind === 'reply' ? component.replyControl : component.editCommentControl;
    const submit = () => kind === 'comment' ? component.postComment() : kind === 'reply' ? component.postReply(comment) : component.saveEditComment(comment);
    control.setValue('x'.repeat(TICKET_COMMENT_MAX_LENGTH)); submit();
    const request = kind === 'edit' ? service.updateComment : service.addComment;
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0].at(-1).body).toHaveLength(TICKET_COMMENT_MAX_LENGTH);
    control.setValue('  Valid text  '); submit();
    expect(request.mock.calls.at(-1)?.at(-1).body).toBe('Valid text');
  });

  it('renders native limits and live feedback, disabling invalid comment, reply and edit buttons', async () => {
    component.startReply(comment); component.startEditComment(comment);
    component.commentControl.setValue(' '); component.replyControl.setValue(' '); component.editCommentControl.setValue(' ');
    fixture.detectChanges(); await fixture.whenStable();
    const areas = fixture.nativeElement.querySelectorAll('textarea') as NodeListOf<HTMLTextAreaElement>;
    expect(areas.length).toBe(3);
    for (const area of areas) {
      expect(area.maxLength).toBe(TICKET_COMMENT_MAX_LENGTH);
      const feedback = fixture.nativeElement.querySelector('#' + area.getAttribute('aria-describedby'));
      expect(feedback.textContent).toContain('cannot be blank');
      expect(feedback.getAttribute('aria-live')).toBe('polite');
    }
    for (const label of ['Post comment', 'Send reply']) {
      expect((fixture.nativeElement.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).disabled).toBe(true);
    }
    const save = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button: any) => button.textContent.includes('Save')) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });
});
