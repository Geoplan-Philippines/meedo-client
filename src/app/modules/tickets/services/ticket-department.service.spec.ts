import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { TicketDepartmentService } from './ticket-department.service';

describe('TicketDepartmentService', () => {
  let role: string;
  let auth: { organizationId: ReturnType<typeof vi.fn>; getActiveMemberRole: ReturnType<typeof vi.fn> };
  let http: HttpTestingController;
  let service: TicketDepartmentService;

  beforeEach(() => {
    role = 'member';
    auth = { organizationId: vi.fn(() => 'org'), getActiveMemberRole: vi.fn(() => of(role)) };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: auth }] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TicketDepartmentService);
  });
  afterEach(() => http.verify());

  it('uses own-team memberships and excludes memberships in another organization', () => {
    let result: unknown;
    service.load().subscribe(value => result = value);
    const request = http.expectOne(req => req.url.endsWith('/organization/list-user-teams'));
    expect(request.request.withCredentials).toBe(true);
    request.flush([{ id: 'a', organizationId: 'org' }, { id: 'b', organizationId: 'org' }, { id: 'foreign', organizationId: 'other' }]);
    expect(result).toEqual({ isAdmin: false, teams: [{ id: 'a', organizationId: 'org' }, { id: 'b', organizationId: 'org' }] });
    expect(auth.getActiveMemberRole).toHaveBeenCalledWith('org');
  });

  for (const adminRole of ['admin', 'owner']) {
    it(`${adminRole} keeps organization-wide team options`, () => {
      role = adminRole;
      let result: unknown;
      service.load().subscribe(value => result = value);
      const request = http.expectOne(req => req.url.endsWith('/organization/list-teams'));
      expect(request.request.params.get('organizationId')).toBe('org');
      request.flush([{ id: 'any-team', organizationId: 'org' }]);
      expect(result).toEqual({ isAdmin: true, teams: [{ id: 'any-team', organizationId: 'org' }] });
    });
  }

  it('reloads role and memberships instead of caching removed access', () => {
    const results: unknown[] = [];
    service.load().subscribe(value => results.push(value));
    http.expectOne(req => req.url.endsWith('/list-user-teams')).flush([{ id: 'a', organizationId: 'org' }]);
    service.load().subscribe(value => results.push(value));
    http.expectOne(req => req.url.endsWith('/list-user-teams')).flush([]);
    expect(results[1]).toEqual({ isAdmin: false, teams: [] });
    expect(auth.getActiveMemberRole).toHaveBeenCalledTimes(2);
  });

  it('returns no options without an active organization', () => {
    auth.organizationId.mockReturnValue(null);
    let result: unknown;
    service.load().subscribe(value => result = value);
    expect(result).toEqual({ isAdmin: false, teams: [] });
    expect(auth.getActiveMemberRole).not.toHaveBeenCalled();
  });
});
