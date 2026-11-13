import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Navigation, provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { Team } from '../../settings/teams/models/teams.model';
import { MemberDirectoryService } from '../../../core/members/member-directory.service';
import { WorkspaceService } from '../../clients/services/workspace.service';
import { Ticket } from '../models/ticket.model';
import { ProjectsService } from '../services/projects.service';
import { StatusesService } from '../services/statuses.service';
import { TicketCategoriesService } from '../services/ticket-categories.service';
import { TicketDepartmentService } from '../services/ticket-department.service';
import { TicketsService } from '../services/tickets.service';
import { TicketDetail } from './ticket-detail';

const seed: Ticket = { id: 'ticket', title: 'Seeded confidential ticket', ticketNumber: 123456,
  organizationId: 'org', teamId: 'own', priority: 'HIGH', createdAt: '', updatedAt: '' };
const own = { id: 'own', name: 'Own department', organizationId: 'org' } as Team;

describe('TicketDetail department access', () => {
  let response: Subject<Ticket>;
  let update: ReturnType<typeof vi.fn>;
  let admin: boolean;
  const emptyPage = { data: [], meta: { total: 0, page: 1, limit: 20, lastPage: 0 } };
  const directoryList = vi.fn(() => of(emptyPage));
  const projectSearch = vi.fn(() => of(emptyPage));

  beforeEach(async () => {
    response = new Subject<Ticket>();
    update = vi.fn(() => of(seed));
    admin = true;
    directoryList.mockClear();
    projectSearch.mockClear();
    await TestBed.configureTestingModule({ imports: [TicketDetail], providers: [provideRouter([]), provideHttpClient(),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: seed.id })), snapshot: {} } },
      { provide: TicketsService, useValue: { getById: () => response, getAll: () => of({ data: [] }), updateTicket: update } },
      { provide: TicketDepartmentService, useValue: { load: () => of({ isAdmin: false, teams: [own] }) } },
      { provide: AuthService, useValue: { isAdmin: () => admin, organizationId: () => 'org', currentUser: () => ({ id: 'u' }) } },
      { provide: MemberDirectoryService, useValue: { list: directoryList } },
      { provide: WorkspaceService, useValue: { project: () => of(null) } },
      { provide: ProjectsService, useValue: { search: projectSearch } },
      { provide: StatusesService, useValue: { options: () => of([]) } },
      { provide: TicketCategoriesService, useValue: { options: () => of([]) } },
    ] }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'getCurrentNavigation').mockReturnValue({ extras: { state: { ticket: seed } } } as unknown as Navigation);
  });

  for (const status of [403, 404]) {
    it(`clears seeded content and renders not available on ${status}`, async () => {
      const fixture = TestBed.createComponent(TicketDetail);
      expect(fixture.componentInstance.ticket()).toEqual(seed);
      response.error(new HttpErrorResponse({ status }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.componentInstance.ticket()).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Ticket not available');
      expect(fixture.nativeElement.textContent).not.toContain(seed.title);
      expect(fixture.nativeElement.querySelector('app-ticket-thread')).toBeNull();
    });
  }

  it('uses restricted detail team options and refuses a forged team selection', () => {
    const fixture = TestBed.createComponent(TicketDetail);
    expect(fixture.componentInstance.teams()).toEqual([own]);
    fixture.componentInstance.setTeam({ ...own, id: 'other' });
    expect(update).not.toHaveBeenCalled();
    fixture.componentInstance.setTeam(own);
    expect(update).toHaveBeenCalledWith(seed.id, { teamId: own.id });
    fixture.destroy();
  });

  for (const creator of [false, true]) {
    it(`renders ticket project and client as read-only context for a non-member ${creator ? 'creator' : 'assignee'}`, async () => {
      admin = false;
      const fixture = TestBed.createComponent(TicketDetail);
      response.next({ ...seed, createdById: creator ? 'u' : 'admin', projectId: 'private-project',
        project: { id: 'private-project', displayName: 'Restricted rollout', customerName: null, workOrderNumber: null,
          client: { displayName: 'Acme client', customerName: null } } });
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain('Restricted rollout');
      expect(fixture.nativeElement.querySelector('[data-testid="ticket-client"]').textContent).toContain('Acme client');
      expect(fixture.nativeElement.querySelector('[aria-label="Ticket project"]').disabled).toBe(true);
      expect(fixture.componentInstance.projectOptions()).toEqual([]);
      expect(fixture.componentInstance.canEditProject()).toBe(false);
      fixture.componentInstance.clearProject();
      expect(update).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('a[href*="private-project"]')).toBeNull();
      fixture.destroy();
    });
  }

  it('searches assignees within the ticket team on the server only when the picker opens', async () => {
    const fixture = TestBed.createComponent(TicketDetail);
    response.next(seed);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(directoryList).not.toHaveBeenCalled();
    expect(projectSearch).not.toHaveBeenCalled();
    fixture.componentInstance.assignees.open();
    fixture.componentInstance.projectPicker.open();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(directoryList).toHaveBeenCalledWith({ page: 1, limit: 20, sortField: 'name', sortOrder: 'asc', teamId: 'own' });
    expect(projectSearch).toHaveBeenCalledWith({ page: 1, limit: 20 });
    fixture.destroy();
  });
});
