import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { TeamsService } from '../settings/teams/services/teams.service';
import { OrgMember } from './models/members.model';
import { Ticket, TicketFacets } from './models/ticket.model';
import { MembersService } from './services/members.service';
import { ProjectsService } from './services/projects.service';
import { StatusesService } from './services/statuses.service';
import { TicketCategoriesService } from './services/ticket-categories.service';
import { TicketsService } from './services/tickets.service';
import { Tickets } from './tickets';

const member: OrgMember = {
  id: 'org-member-id', userId: 'session-user-id', organizationId: 'org-id',
  role: 'member', displayName: 'QA Member',
  user: { id: 'session-user-id', name: 'QA Member', email: 'qa@example.com', image: null },
};
const ticket: Ticket = {
  id: 'ticket-id', title: 'Ticket', ticketNumber: 123456, priority: 'MEDIUM',
  organizationId: 'org-id', createdAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z',
};
const facets: TicketFacets = {
  views: { all: 0, active: 0, backlog: 0, closed: 0 }, statuses: [], priorities: [],
};

describe('Tickets', () => {
  let component: Tickets;
  let fixture: ComponentFixture<Tickets>;
  let service: {
    getAll: ReturnType<typeof vi.fn<TicketsService['getAll']>>;
    getFacets: ReturnType<typeof vi.fn<TicketsService['getFacets']>>;
    createTicket: ReturnType<typeof vi.fn<TicketsService['createTicket']>>;
    updateTicket: ReturnType<typeof vi.fn<TicketsService['updateTicket']>>;
  };

  beforeEach(async () => {
    service = {
      getAll: vi.fn<TicketsService['getAll']>().mockReturnValue(of({
        statusCode: 200, message: 'Success', data: [],
        meta: { total: 100, page: 1, limit: 10, lastPage: 10 },
      })),
      getFacets: vi.fn<TicketsService['getFacets']>().mockReturnValue(of(facets)),
      createTicket: vi.fn<TicketsService['createTicket']>().mockReturnValue(of(ticket)),
      updateTicket: vi.fn<TicketsService['updateTicket']>().mockReturnValue(of(ticket)),
    };
    await TestBed.configureTestingModule({
      imports: [Tickets],
      providers: [
        provideRouter([]), provideHttpClient(),
        { provide: TicketsService, useValue: service },
        { provide: AuthService, useValue: {
          currentUser: () => ({ id: member.userId }), organizationId: () => member.organizationId,
        } },
        { provide: MembersService, useValue: { getMembers: () => of([member]) } },
        { provide: TeamsService, useValue: { getTeams: () => of([]), listTeamMembers: () => of([]) } },
        { provide: ProjectsService, useValue: { getAll: () => of([]) } },
        { provide: StatusesService, useValue: { getAll: () => of([]) } },
        { provide: TicketCategoriesService, useValue: { getAll: () => of([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Tickets);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and resolve the organization Member ID', () => {
    expect(component).toBeTruthy();
    expect(component.currentMemberId()).toBe(member.id);
    const button = fixture.nativeElement.querySelector('.my-issues-toggle') as HTMLButtonElement;
    expect(button.textContent).toContain('My issues');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles My issues for both requests, preserves filters, and resets the table to page 1', async () => {
    component.setView('active');
    component.toggleStatus('status-id');
    component.togglePriority('HIGH');
    component.toggleTeam('team-1');
    component.toggleTeam('team-2');
    component.searchControl.setValue('inspection', { emitEvent: false });
    component.onLazyLoad({ first: 20, rows: 10 });
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));

    const button = fixture.nativeElement.querySelector('.my-issues-toggle') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 1, assigneeId: member.id, view: 'active', search: 'inspection',
      teamId: ['team-1', 'team-2'], ticketStatusId: ['status-id'], priority: ['HIGH'],
    }));
    expect(service.getFacets).toHaveBeenLastCalledWith({
      view: 'active', search: 'inspection', teamId: ['team-1', 'team-2'], assigneeId: member.id,
    });
    expect(button.getAttribute('aria-pressed')).toBe('true');

    component.onLazyLoad({ first: 30, rows: 10 });
    button.click();
    await fixture.whenStable();
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, assigneeId: undefined }));
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: undefined }));
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('hides My issues when membership is unavailable or belongs to another user or organization', async () => {
    for (const members of [[], [{ ...member, userId: 'other-user' }], [{ ...member, organizationId: 'other-org' }]]) {
      component.members.set(members);
      await fixture.whenStable();
      expect(component.currentMemberId()).toBeNull();
      expect(fixture.nativeElement.querySelector('.my-issues-toggle')).toBeNull();
      component.toggleMyIssues();
      expect(component.myIssues()).toBe(false);
    }
  });

  it('refreshes facet scope when teams are selected, removed, or cleared', () => {
    component.toggleMyIssues();
    component.toggleTeam('team-1');
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: ['team-1'], assigneeId: member.id }));
    component.toggleTeam('team-2');
    component.removeTeam('team-1');
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: ['team-2'] }));
    component.toggleTeam('team-2');
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: undefined }));
    component.toggleTeam('team-1');
    component.clearFilters();
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: undefined, assigneeId: member.id }));
  });

  it('refreshes facets after creating and editing a ticket', () => {
    component.toggleMyIssues();
    service.getFacets.mockClear();
    component.ticketForm.controls.title.setValue('New ticket');
    component.saveTicket();
    expect(service.createTicket).toHaveBeenCalledOnce();
    expect(service.getFacets).toHaveBeenCalledOnce();
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: member.id }));
    component.openEditDialog(ticket);
    component.editTicketForm.controls.title.setValue('Edited ticket');
    component.updateTicket();
    expect(service.updateTicket).toHaveBeenCalledOnce();
    expect(service.getFacets).toHaveBeenCalledTimes(2);
  });

  it('does not replace scoped facets with a late response from the previous scope', () => {
    const previous = new Subject<TicketFacets>();
    service.getFacets.mockReturnValueOnce(previous);
    component.toggleTeam('team-1');
    component.toggleMyIssues();
    previous.next({ ...facets, views: { ...facets.views, all: 99 } });
    expect(component.facets()).toEqual(facets);
    previous.complete();
  });
});
