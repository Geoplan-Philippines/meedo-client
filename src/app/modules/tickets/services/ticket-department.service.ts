import { Injectable, inject } from '@angular/core';
import { map, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { TeamsService } from '../../settings/teams/services/teams.service';
import { Team } from '../../settings/teams/models/teams.model';

export interface TicketDepartmentOptions {
  isAdmin: boolean;
  teams: Team[];
}

/** UI options only. The server resolves and enforces its own fresh scope. */
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
        return (isAdmin ? this.teams.getTeams(organizationId) : this.teams.getUserTeams(organizationId))
          .pipe(map(teams => ({ isAdmin, teams })));
      }),
    );
  }
}
