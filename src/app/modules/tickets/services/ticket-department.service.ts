import { Injectable, inject } from '@angular/core';
import { map, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { TEAM_OPTIONS_QUERY, TeamsService } from '../../settings/teams/services/teams.service';
import { Team } from '../../settings/teams/models/teams.model';

export interface TicketDepartmentOptions {
  isAdmin: boolean;
  teams: Team[];
}

/**
 * UI options only. The server resolves and enforces its own fresh scope.
 * Admins choose from the organization's teams, members from their own.
 */
@Injectable({ providedIn: 'root' })
export class TicketDepartmentService {
  private readonly auth = inject(AuthService);
  private readonly teams = inject(TeamsService);

  load() {
    const organizationId = this.auth.organizationId();
    if (!organizationId) return of<TicketDepartmentOptions>({ isAdmin: false, teams: [] });
    return this.auth.getActiveMemberRole(organizationId).pipe(
      switchMap(role => {
        const isAdmin = role === 'owner' || role === 'admin';
        return this.teams
          .list(isAdmin ? TEAM_OPTIONS_QUERY : { ...TEAM_OPTIONS_QUERY, mine: true })
          .pipe(map(page => ({ isAdmin, teams: page.data })));
      }),
    );
  }
}
