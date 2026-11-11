import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
import { TicketDepartmentService, TicketDepartmentOptions } from './services/ticket-department.service';
import { Tickets } from './tickets';
import { TICKET_TITLE_MAX_LENGTH, TICKET_DESCRIPTION_MAX_LENGTH } from './tickets.constants';

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
  let department: TicketDepartmentOptions;
  const admin = signal(true);

  beforeEach(async () => {
    department = { isAdmin: true, teams: [] };
    admin.set(true);
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
        { provide: TicketDepartmentService, useValue: { load: () => of(department) } },
        { provide: AuthService, useValue: {
          isAdmin: admin, currentUser: () => ({ id: member.userId }), organizationId: () => member.organizationId,
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

  it('renders project and client from the ticket response when the project picker is empty', async () => {
    component.tickets.set([{ ...ticket, project: { id: 'restricted', displayName: 'Restricted rollout',
      workOrderNumber: null, customerName: null, client: { displayName: 'Acme client', customerName: null } } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.projects()).toEqual([]);
    expect(fixture.nativeElement.querySelector('.project-cell').textContent).toContain('Restricted rollout');
    expect(fixture.nativeElement.querySelector('[data-testid="ticket-client"]').textContent).toContain('Acme client');
    expect(fixture.nativeElement.querySelector('.project-cell a')).toBeNull();
  });

  it('keeps a non-member creator project read-only in the edit dialog and omits its link from PATCH', async () => {
    admin.set(false);
    component.openEditDialog({ ...ticket, createdById: member.userId, projectId: 'restricted',
      project: { id: 'restricted', displayName: 'Restricted rollout', workOrderNumber: null, customerName: null,
        client: { displayName: 'Acme client', customerName: null } } });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.editProjectReadOnly()).toBe(true);
    const context = fixture.nativeElement.querySelector('[data-testid="edit-ticket-project-context"]');
    expect(context.textContent).toContain('Restricted rollout');
    expect(context.textContent).toContain('Acme client');
    expect(fixture.nativeElement.querySelector('#edit-ticket-project')).toBeNull();
    component.updateTicket();
    expect(service.updateTicket).toHaveBeenCalledWith(ticket.id, expect.objectContaining({ projectId: undefined }));
  });

  it('lets members create without a department and keeps existing department clearing protected in edit', () => {
    const own = { id: 'own-team', name: 'Own department', organizationId: 'org-id' } as any;
    department = { isAdmin: false, teams: [own] }; component.loadDropdowns(); component.ticketForm.controls.title.setValue('Example member ticket');
    expect(component.ticketForm.controls.teamId.hasError('required')).toBe(false);
    component.saveTicket(); expect(service.createTicket).toHaveBeenCalledWith(expect.objectContaining({ assigneeIds: undefined }));
    component.setTeamValue('foreign-team'); expect(component.ticketForm.controls.teamId.value).toBe('');
    component.setTeamValue(own.id); component.setTeamValue(own.id); expect(component.ticketForm.controls.teamId.value).toBe('');
    component.openEditDialog({ ...ticket, teamId: own.id }); component.editTicketForm.controls.teamId.setValue(''); component.updateTicket(); expect(service.updateTicket).not.toHaveBeenCalled();
  });

  it('keeps the department empty state while allowing an independent member ticket', async () => {
    department = { isAdmin: false, teams: [] }; component.loadDropdowns(); fixture.detectChanges(); await fixture.whenStable();
    expect(component.noDepartments()).toBe(true); expect(fixture.nativeElement.textContent).toContain('You are not assigned to a department.');
    expect(fixture.nativeElement.querySelector('.add-btn').disabled).toBe(false);
    component.ticketForm.controls.title.setValue('Example independent work'); component.saveTicket(); expect(service.createTicket).toHaveBeenCalled();
  });

  it('rejects whitespace-only titles and over-limit fields in both create and edit submission paths', () => {
    component.openEditDialog(ticket);
    for (const form of [component.ticketForm, component.editTicketForm]) {
      form.controls.title.setValue(' \t\n ');
      expect(form.controls.title.hasError('required')).toBe(true);
    }
    component.saveTicket(); component.updateTicket();
    expect(service.createTicket).not.toHaveBeenCalled();
    expect(service.updateTicket).not.toHaveBeenCalled();
    for (const form of [component.ticketForm, component.editTicketForm]) {
      form.controls.title.setValue('x'.repeat(TICKET_TITLE_MAX_LENGTH + 1));
      expect(form.invalid).toBe(true);
      form.controls.title.setValue('Title');
      form.controls.description.setValue('x'.repeat(TICKET_DESCRIPTION_MAX_LENGTH + 1));
      expect(form.invalid).toBe(true);
    }
    component.saveTicket(); component.updateTicket();
    expect(service.createTicket).not.toHaveBeenCalled();
    expect(service.updateTicket).not.toHaveBeenCalled();
  });

  it('accepts the exact limits and trims valid create/edit payloads', () => {
    const title = 'x'.repeat(TICKET_TITLE_MAX_LENGTH);
    const description = 'd'.repeat(TICKET_DESCRIPTION_MAX_LENGTH);
    component.ticketForm.patchValue({ title, description });
    expect(component.canCreate()).toBe(true);
    component.saveTicket();
    expect(service.createTicket).toHaveBeenCalledWith(expect.objectContaining({ title, description }));
    component.openEditDialog(ticket);
    component.editTicketForm.patchValue({ title: '  Edited title  ', description: '  Description  ' });
    component.updateTicket();
    expect(service.updateTicket).toHaveBeenCalledWith(ticket.id, expect.objectContaining({ title: 'Edited title', description: 'Description' }));
  });

  it('wires create/edit native limits, counters, and whitespace errors to their inputs', async () => {
    component.openCreateDialog();
    component.ticketForm.controls.title.setValue(' '.repeat(3));
    fixture.detectChanges(); await fixture.whenStable();
    const title = fixture.nativeElement.querySelector('.compose-title') as HTMLInputElement;
    expect(title.maxLength).toBe(TICKET_TITLE_MAX_LENGTH);
    expect(title.getAttribute('aria-describedby')).toBe('create-title-feedback');
    expect(fixture.nativeElement.querySelector('#create-title-feedback').textContent).toContain('Title cannot be blank');
    expect(component.canCreate()).toBe(false);
    component.closeCreateDialog(); component.openEditDialog(ticket);
    fixture.detectChanges(); await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('#edit-ticket-title') as HTMLInputElement).maxLength).toBe(TICKET_TITLE_MAX_LENGTH);
    expect((fixture.nativeElement.querySelector('#edit-ticket-description') as HTMLTextAreaElement).maxLength).toBe(TICKET_DESCRIPTION_MAX_LENGTH);
  });

  it('switches List / Board in the URL, preserves other params, and follows navigation', async () => {
    const router = TestBed.inject(Router);
    expect(component.layout()).toBe('list');
    await router.navigateByUrl('/?keep=1');
    const boardButton = Array.from(fixture.nativeElement.querySelectorAll('[aria-label="Ticket layout"] button'))
      .find((element: any) => element.textContent.includes('Board')) as HTMLElement;
    boardButton.click();
    await fixture.whenStable();
    expect(router.parseUrl(router.url).queryParams).toEqual({ keep: '1', view: 'board' });
    expect(component.layout()).toBe('board');
    expect(fixture.nativeElement.querySelector('app-tickets-board')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('p-table')).toBeNull();
    component.setLayout('list');
    await fixture.whenStable();
    expect(router.parseUrl(router.url).queryParams).toEqual({ keep: '1' });
    expect(fixture.nativeElement.querySelector('p-table')).toBeTruthy();
    await router.navigateByUrl('/?view=board');
    await fixture.whenStable();
    expect(component.layout()).toBe('board');
    fixture.destroy();
    fixture = TestBed.createComponent(Tickets);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.layout()).toBe('board');
    expect(fixture.nativeElement.querySelector('app-tickets-board')).toBeTruthy();
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
