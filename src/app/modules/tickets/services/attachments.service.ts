import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';

import { environment } from '../../../../environments/environment.dev';
import { ApiResponse } from '../../../shared/interface/api-response.interface';
import { UploadedAttachment } from '../../../shared/ui/markdown-editor/markdown-editor';

/**
 * Uploads description attachments (pasted / dropped / picked files) to the
 * tickets attachment endpoint, which hosts them on Cloudinary and returns a URL.
 * Wired into the shared markdown editor via its `[upload]` handler.
 */
@Injectable({ providedIn: 'root' })
export class TicketAttachmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tickets/attachments`;

  upload(file: File): Promise<UploadedAttachment> {
    const form = new FormData();
    form.append('file', file);

    return firstValueFrom(
      this.http
        .post<ApiResponse<UploadedAttachment>>(this.baseUrl, form, { withCredentials: true })
        .pipe(map((res) => res.data)),
    );
  }
}
