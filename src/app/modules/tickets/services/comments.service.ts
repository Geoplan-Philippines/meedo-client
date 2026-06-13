import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { CreateCommentPayload, TicketComment, UpdateCommentPayload } from '../models/ticket-comment.model';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { THREAD_PAGE_SIZE } from '../tickets.constants';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tickets`;

  getComments(ticketId: string, page = 1, limit = THREAD_PAGE_SIZE) {
    return this.http.get<PaginatedApiResponse<TicketComment>>(`${this.baseUrl}/${ticketId}/comments`, {
      params: { page, limit },
      withCredentials: true,
    });
  }

  addComment(ticketId: string, payload: CreateCommentPayload) {
    return this.http
      .post<ApiResponse<TicketComment>>(`${this.baseUrl}/${ticketId}/comments`, payload, {
        withCredentials: true,
      })
      .pipe(map(res => res.data));
  }

  updateComment(ticketId: string, commentId: string, payload: UpdateCommentPayload) {
    return this.http
      .patch<ApiResponse<TicketComment>>(`${this.baseUrl}/${ticketId}/comments/${commentId}`, payload, {
        withCredentials: true,
      })
      .pipe(map(res => res.data));
  }

  deleteComment(ticketId: string, commentId: string) {
    return this.http.delete<void>(`${this.baseUrl}/${ticketId}/comments/${commentId}`, {
      withCredentials: true,
    });
  }
}
