import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { TeamsService } from '../teams/services/teams.service';
import { UserService } from './services/user.service';

import { Users } from './users';

describe('Users', () => {
  let component: Users;
  let fixture: ComponentFixture<Users>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Users],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {
          organizationId: () => 'org-1',
          getActiveMemberRole: () => of('owner'),
        } },
        { provide: UserService, useValue: { getUsers: () => of([]), getHikvisionUsers: () => of([]) } },
        { provide: TeamsService, useValue: { getTeams: () => of([]) } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Users);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
