import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';

const ADMIN_ROLES = new Set(['owner', 'admin']);

export function isOrganizationAdmin(role: string | null | undefined): boolean {
  return role?.split(',').some((value) => ADMIN_ROLES.has(value.trim())) ?? false;
}

export const orgAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const organizationId = authService.organizationId();
  const settingsUrl = router.createUrlTree(['/settings']);

  if (!organizationId) return settingsUrl;

  return authService.getActiveMemberRole(organizationId).pipe(
    map((role) => isOrganizationAdmin(role) ? true : settingsUrl),
    catchError(() => of(settingsUrl)),
  );
};
