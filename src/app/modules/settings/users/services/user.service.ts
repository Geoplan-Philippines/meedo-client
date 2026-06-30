import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import {
  ListMembersResponse,
  OnboardMemberPayload,
  OnboardMemberResponse,
  OrganizationMember,
} from '../models/users.model';

const MEMBERS_PAGE_SIZE = 100;

interface MembersPage extends ListMembersResponse {
  offset: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiBaseUrl}/admin`;
  private readonly organizationUrl = `${environment.apiBaseUrl}/auth/organization`;

  getUsers(organizationId: string): Observable<OrganizationMember[]> {
    return this.getMembersPage(organizationId, 0).pipe(
      expand((page) => {
        const nextOffset = page.offset + page.members.length;
        return page.members.length > 0 && nextOffset < page.total
          ? this.getMembersPage(organizationId, nextOffset)
          : EMPTY;
      }),
      reduce(
        (members, page) => [...members, ...page.members],
        [] as OrganizationMember[],
      ),
    );
  }

  onboardMember(payload: OnboardMemberPayload): Observable<OnboardMemberResponse> {
    return this.http
      .post<ApiResponse<OnboardMemberResponse>>(
        `${this.adminUrl}/onboard-member`,
        payload,
        { withCredentials: true },
      )
      .pipe(map((response) => response.data));
  }

  private getMembersPage(organizationId: string, offset: number): Observable<MembersPage> {
    return this.http
      .get<ListMembersResponse>(`${this.organizationUrl}/list-members`, {
        params: {
          organizationId,
          limit: MEMBERS_PAGE_SIZE,
          offset,
          sortBy: 'createdAt',
          sortDirection: 'desc',
        },
        withCredentials: true,
      })
      .pipe(map((response) => ({ ...response, offset })));
  }
}
