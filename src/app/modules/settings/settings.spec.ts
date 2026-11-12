import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Settings } from './settings';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        // An owner sees every card, so nothing below is hidden by role.
        { provide: AuthService, useValue: { organizationId: () => 'org-id', getActiveMemberRole: () => of('owner') } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('leaves workspace navigation (Users, Teams, Projects, Customers) to the sidebar', () => {
    const element = fixture.nativeElement as HTMLElement;
    const groups = [...element.querySelectorAll('.settings-group > h2')].map((heading) => heading.textContent?.trim());
    expect(groups).toEqual(['General', 'Timekeeping', 'Tickets']);
    const cards = [...element.querySelectorAll('.settings-group a h3')].map((heading) => heading.textContent?.trim());
    expect(cards).toEqual(['Organization', 'Attendance', 'Categories', 'Statuses']);
    for (const route of ['users', 'teams', 'projects', 'customers']) {
      expect(element.querySelector(`a[href$="/${route}"]`)).toBeNull();
    }
  });
});
