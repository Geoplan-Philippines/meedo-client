import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { OrgMember } from '../models/members.model';

@Injectable({ providedIn: 'root' })
export class MembersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth/organization`;

  getMembers(organizationId: string) {
    return this.http.get<{ members: OrgMember[] }>(
      `${this.baseUrl}/get-full-organization`,
      { params: { organizationId }, withCredentials: true }
    ).pipe(
      map(res => res.members.map(m => ({
        ...m,
        displayName: m.user?.name ?? m.user?.email ?? m.id,
      })))
    );
  }
}
