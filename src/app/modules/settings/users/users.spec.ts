import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { MemberDirectoryService, OrgMember } from '../../../core/members/member-directory.service';
import { TeamsService } from '../teams/services/teams.service';
import { UserService } from './services/user.service';

import { Users } from './users';

const member: OrgMember = {
  id: 'member-1', userId: 'user-1', organizationId: 'org-1', role: 'member', createdAt: '2026-01-01', displayName: 'Ada',
  user: { id: 'user-1', name: 'Ada', email: 'ada@example.com', image: null },
};

describe('Users', () => {
  let component: Users;
  let fixture: ComponentFixture<Users>;
  const directory = { list: vi.fn() };
  const teams = { list: vi.fn() };

  beforeEach(async () => {
    directory.list.mockReset().mockReturnValue(of({ data: [member], meta: { total: 40, page: 1, limit: 25, lastPage: 2 } }));
    teams.list.mockReset().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 20, lastPage: 0 } }));
    await TestBed.configureTestingModule({
      imports: [Users],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {
          organizationId: () => 'org-1',
          getActiveMemberRole: () => of('owner'),
        } },
        { provide: UserService, useValue: { getHikvisionUsers: () => of([]) } },
        { provide: MemberDirectoryService, useValue: directory },
        { provide: TeamsService, useValue: teams },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Users);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('asks for one page of members, newest first, and shows the total', () => {
    expect(directory.list).toHaveBeenCalledWith({ page: 1, limit: 25, sortField: 'createdAt', sortOrder: 'desc' });
    expect(fixture.nativeElement.textContent).toContain('Showing 1 to 25 of 40 users');
    expect(teams.list).not.toHaveBeenCalled();
  });

  it('takes the page, sort and search from the URL', async () => {
    await TestBed.inject(Router).navigateByUrl('/?page=2&sort=name&dir=asc&q=ada');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(directory.list).toHaveBeenLastCalledWith({ page: 2, limit: 25, search: 'ada', sortField: 'name', sortOrder: 'asc' });
    expect(component.list.searchInput()).toBe('ada');
  });
});
