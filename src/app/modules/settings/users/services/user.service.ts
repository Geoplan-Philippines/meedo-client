import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment.dev';
import { ApiResponse } from '../../../../shared/interface/api-response.interface';
import {
  HikvisionDirectoryUser,
  MemberDetails,
  OnboardMemberPayload,
  OnboardMemberResponse,
  UpdateMemberPayload,
} from '../models/users.model';
import { ListStateConfig } from '../../../../shared/data/url-list-state';

/** Users list: newest members first, sortable by name, email, role and join date. */
export const USERS_LIST: ListStateConfig = {
  pageSize: 25,
  sortField: 'createdAt',
  sortOrder: 'desc',
  sortFields: ['name', 'email', 'role', 'createdAt'],
};

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiBaseUrl}/admin`;
  private readonly attendanceUrl = `${environment.apiBaseUrl}/attendance`;

  getHikvisionUsers(): Observable<HikvisionDirectoryUser[]> {
    return this.http
      .get<ApiResponse<{ users: Omit<HikvisionDirectoryUser, 'displayName'>[] }>>(
        `${this.attendanceUrl}/biometrics/users`,
        { withCredentials: true },
      )
      .pipe(
        map((response) => response.data.users.map((user) => ({
          ...user,
          displayName: user.name
            ? `${user.employeeNo} - ${user.name}`
            : user.employeeNo,
        }))),
      );
  }

  getMember(memberId: string): Observable<MemberDetails> {
    return this.http
      .get<ApiResponse<MemberDetails>>(`${this.adminUrl}/members/${memberId}`, {
        withCredentials: true,
      })
      .pipe(map((response) => response.data));
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

  updateMember(memberId: string, payload: UpdateMemberPayload): Observable<MemberDetails> {
    return this.http
      .patch<ApiResponse<MemberDetails>>(
        `${this.adminUrl}/members/${memberId}`,
        payload,
        { withCredentials: true },
      )
      .pipe(map((response) => response.data));
  }
}
