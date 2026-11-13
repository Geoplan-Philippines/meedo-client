import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../../environments/environment.dev';
import { cacheContext } from '../http/api-cache';
import { PaginatedApiResponse } from '../../shared/interface/paginated-response.interface';
import { PageQuery, toHttpParams } from '../../shared/data/page-query';

/** An organization member as the member list returns it, plus the name to show. */
export interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: string;
  displayName: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export type MemberSortField = 'name' | 'email' | 'role' | 'createdAt';

export interface MemberListQuery extends PageQuery {
  /** Only members assigned to this team. */
  teamId?: string | null;
  role?: 'member' | 'admin' | 'owner' | null;
}

/** The signed-in user's membership in the active organization. */
export interface ActiveMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
}

/**
 * The organization's member directory, one page at a time: the users list,
 * assignee pickers and the employee pickers all search it on the server
 * instead of loading every member.
 */
@Injectable({ providedIn: 'root' })
export class MemberDirectoryService {
  private readonly http = inject(HttpClient);
  private readonly membersUrl = `${environment.apiBaseUrl}/settings/members`;
  private readonly organizationUrl = `${environment.apiBaseUrl}/auth/organization`;

  list(query: MemberListQuery): Observable<PaginatedApiResponse<OrgMember>> {
    return this.http
      .get<PaginatedApiResponse<Omit<OrgMember, 'displayName'>>>(this.membersUrl, {
        params: toHttpParams(query),
        context: cacheContext('members'),
        withCredentials: true,
      })
      .pipe(map((response) => ({ ...response, data: response.data.map(withDisplayName) })));
  }

  /** The caller's own member row (its id is what tickets store as an assignee). */
  activeMember(): Observable<ActiveMember | null> {
    return this.http
      .get<ActiveMember | null>(`${this.organizationUrl}/get-active-member`, {
        context: cacheContext('members'),
        withCredentials: true,
      })
      .pipe(catchError(() => of(null)));
  }
}

export function withDisplayName(member: Omit<OrgMember, 'displayName'>): OrgMember {
  return { ...member, displayName: member.user?.name || member.user?.email || member.id };
}
