import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { ActiveMember, MemberDirectoryService, OrgMember } from '../../core/members/member-directory.service';
import { WorkspaceService } from '../clients/services/workspace.service';
import { Ticket, TicketFacets } from './models/ticket.model';
import { ProjectRecord } from './models/projects.model';
import { ProjectsService } from './services/projects.service';
import { StatusesService } from './services/statuses.service';
import { TicketCategoriesService } from './services/ticket-categories.service';
import { TicketsService } from './services/tickets.service';
import { TicketDepartmentService, TicketDepartmentOptions } from './services/ticket-department.service';
import { Tickets } from './tickets';
import { TICKET_TITLE_MAX_LENGTH, TICKET_DESCRIPTION_MAX_LENGTH } from './tickets.constants';

const member: OrgMember = {
  id: 'org-member-id', userId: 'session-user-id', organizationId: 'org-id',
  role: 'member', createdAt: '2026-01-01', displayName: 'QA Member',
  user: { id: 'session-user-id', name: 'QA Member', email: 'qa@example.com', image: null },
};
const activeMember: ActiveMember = { id: member.id, userId: member.userId, organizationId: member.organizationId, role: 'member' };
const ticket: Ticket = {
  id: 'ticket-id', title: 'Ticket', ticketNumber: 123456, priority: 'MEDIUM',
  organizationId: 'org-id', createdAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z',
};
const facets: TicketFacets = {
  views: { all: 0, active: 0, backlog: 0, closed: 0 }, statuses: [], priorities: [],
};
const page = <T>(data: T[], total = data.length) => ({ statusCode: 200, message: 'Success', data, meta: { total, page: 1, limit: 25, lastPage: Math.ceil(total / 25) } });

// The page renders many PrimeNG components (tabs, select button, icon field, paginator, dialogs),
// which jsdom renders slowly, so this file allows 15 s per test.
describe('Tickets', { timeout: 15_000 }, () => {
  let component: Tickets;
  let fixture: ComponentFixture<Tickets>;
  let service: {
    getAll: ReturnType<typeof vi.fn<TicketsService['getAll']>>;
    getFacets: ReturnType<typeof vi.fn<TicketsService['getFacets']>>;
    getById: ReturnType<typeof vi.fn>;
    createTicket: ReturnType<typeof vi.fn<TicketsService['createTicket']>>;
    updateTicket: ReturnType<typeof vi.fn<TicketsService['updateTicket']>>;
  };
  let department: TicketDepartmentOptions;
  let directory: { list: ReturnType<typeof vi.fn>; activeMember: ReturnType<typeof vi.fn<() => Observable<ActiveMember | null>>> };
  let workspace: { project: ReturnType<typeof vi.fn<(id: string) => Observable<ProjectRecord | null>>>; client: ReturnType<typeof vi.fn> };
  let projects: { search: ReturnType<typeof vi.fn>; invalidate: ReturnType<typeof vi.fn> };
  const admin = signal(true);

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Rebuilds the component so it reads the current URL and services on init. */
  const recreate = async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(Tickets);
    component = fixture.componentInstance;
    await settle();
  };

  beforeEach(async () => {
    department = { isAdmin: true, teams: [] };
    directory = {
      list: vi.fn().mockReturnValue(of(page([member]))),
      activeMember: vi.fn<() => Observable<ActiveMember | null>>().mockReturnValue(of(activeMember)),
    };
    workspace = { project: vi.fn<(id: string) => Observable<ProjectRecord | null>>().mockReturnValue(of(null)), client: vi.fn() };
    projects = { search: vi.fn().mockReturnValue(of(page([]))), invalidate: vi.fn() };
    admin.set(true);
    service = {
      getAll: vi.fn<TicketsService['getAll']>().mockReturnValue(of({ ...page([] as Ticket[], 100) })),
      getFacets: vi.fn<TicketsService['getFacets']>().mockReturnValue(of(facets)),
      getById: vi.fn().mockReturnValue(of(ticket)),
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
        { provide: MemberDirectoryService, useValue: directory },
        { provide: WorkspaceService, useValue: workspace },
        { provide: ProjectsService, useValue: projects },
        { provide: StatusesService, useValue: { options: () => of([]) } },
        { provide: TicketCategoriesService, useValue: { options: () => of([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Tickets);
    component = fixture.componentInstance;
    await settle();
  });

  it('should create and resolve the organization Member ID', () => {
    expect(component).toBeTruthy();
    expect(component.currentMemberId()).toBe(member.id);
    const button = fixture.nativeElement.querySelector('.my-issues-toggle') as HTMLButtonElement;
    expect(button.textContent).toContain('My issues');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('asks the API for one page, newest first, and loads no project or member lists up front', () => {
    expect(service.getAll).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, limit: 25, view: 'all', sortField: 'createdAt', sortOrder: 'desc', assigneeId: undefined,
    }));
    expect(fixture.nativeElement.textContent).toContain('Showing 1 to 25 of 100 tickets');
    expect(projects.search).not.toHaveBeenCalled();
    expect(directory.list).not.toHaveBeenCalled();
  });

  it('takes tab, facets, search, sort and page from the URL', async () => {
    await TestBed.inject(Router).navigateByUrl('/?tab=active&status=s1&priority=HIGH&team=t1&team=t2&q=inspection&page=3&sort=dueDate&dir=asc');
    await settle();
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 3, view: 'active', search: 'inspection', ticketStatusId: ['s1'], priority: ['HIGH'],
      teamId: ['t1', 't2'], sortField: 'dueDate', sortOrder: 'asc',
    }));
    expect(service.getFacets).toHaveBeenLastCalledWith({
      view: 'active', search: 'inspection', teamId: ['t1', 't2'], assigneeId: undefined, projectId: undefined,
    });
    expect(component.list.searchInput()).toBe('inspection');
  });

  it('renders project and client from the ticket response without a project list', async () => {
    service.getAll.mockReturnValue(of(page([{ ...ticket, project: { id: 'restricted', displayName: 'Restricted rollout',
      workOrderNumber: null, customerName: null, client: { displayName: 'Acme client', customerName: null } } }])));
    await recreate();
    expect(fixture.nativeElement.querySelector('.project-cell').textContent).toContain('Restricted rollout');
    expect(fixture.nativeElement.querySelector('[data-testid="ticket-client"]').textContent).toContain('Acme client');
    expect(fixture.nativeElement.querySelector('.project-cell a')).toBeNull();
  });

  it('keeps a non-member creator project read-only in the edit dialog and omits its link from PATCH', async () => {
    admin.set(false);
    workspace.project.mockReturnValue(of(null));
    component.openEditDialog({ ...ticket, createdById: member.userId, projectId: 'restricted',
      project: { id: 'restricted', displayName: 'Restricted rollout', workOrderNumber: null, customerName: null,
        client: { displayName: 'Acme client', customerName: null } } });
    await settle();
    expect(workspace.project).toHaveBeenCalledWith('restricted');
    expect(component.editProjectReadOnly()).toBe(true);
    const context = fixture.nativeElement.querySelector('[data-testid="edit-ticket-project-context"]');
    expect(context.textContent).toContain('Restricted rollout');
    expect(context.textContent).toContain('Acme client');
    expect(fixture.nativeElement.querySelector('#edit-ticket-project')).toBeNull();
    component.updateTicket();
    expect(service.updateTicket).toHaveBeenCalledWith(ticket.id, expect.objectContaining({ projectId: undefined }));
  });

  it('lets a member edit the project of a ticket on one of their own projects', async () => {
    admin.set(false);
    workspace.project.mockReturnValue(of({ id: 'own', name: 'Own project' } as ProjectRecord));
    component.openEditDialog({ ...ticket, createdById: member.userId, projectId: 'own',
      project: { id: 'own', displayName: 'Own project', workOrderNumber: null, customerName: null } });
    await settle();
    expect(component.editProjectReadOnly()).toBe(false);
    expect(component.editProjectOptions().map((option) => option.id)).toEqual(['own']);
  });

  it('searches projects and assignees on the server when the compose pickers open', async () => {
    component.openCreateDialog();
    component.composeProjects.open();
    component.composeAssignees.open();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(projects.search).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(directory.list).toHaveBeenCalledWith({ page: 1, limit: 20, sortField: 'name', sortOrder: 'asc', teamId: undefined });
    fixture.detectChanges();
    component.toggleAssigneeValue(member.id);
    expect(component.selectedAssignees()).toEqual([member]);
  });

  it('lets members create without a department and keeps existing department clearing protected in edit', () => {
    const own = { id: 'own-team', name: 'Own department', organizationId: 'org-id' } as never;
    department = { isAdmin: false, teams: [own] }; component.loadDropdowns(); component.ticketForm.controls.title.setValue('Example member ticket');
    expect(component.ticketForm.controls.teamId.hasError('required')).toBe(false);
    component.saveTicket(); expect(service.createTicket).toHaveBeenCalledWith(expect.objectContaining({ assigneeIds: undefined }));
    component.setTeamValue('foreign-team'); expect(component.ticketForm.controls.teamId.value).toBe('');
    component.setTeamValue('own-team'); component.setTeamValue('own-team'); expect(component.ticketForm.controls.teamId.value).toBe('');
    component.openEditDialog({ ...ticket, teamId: 'own-team' }); component.editTicketForm.controls.teamId.setValue(''); component.updateTicket(); expect(service.updateTicket).not.toHaveBeenCalled();
  });

  it('keeps the department empty state while allowing an independent member ticket', async () => {
    department = { isAdmin: false, teams: [] }; component.loadDropdowns(); await settle();
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
    await settle();
    const title = fixture.nativeElement.querySelector('.compose-title') as HTMLInputElement;
    expect(title.maxLength).toBe(TICKET_TITLE_MAX_LENGTH);
    expect(title.getAttribute('aria-describedby')).toBe('create-title-feedback');
    expect(fixture.nativeElement.querySelector('#create-title-feedback').textContent).toContain('Title cannot be blank');
    expect(component.canCreate()).toBe(false);
    component.closeCreateDialog(); component.openEditDialog(ticket);
    await settle();
    expect((fixture.nativeElement.querySelector('#edit-ticket-title') as HTMLInputElement).maxLength).toBe(TICKET_TITLE_MAX_LENGTH);
    expect((fixture.nativeElement.querySelector('#edit-ticket-description') as HTMLTextAreaElement).maxLength).toBe(TICKET_DESCRIPTION_MAX_LENGTH);
  });

  it('switches List / Board in the URL, preserves other params, and follows navigation', async () => {
    const router = TestBed.inject(Router);
    expect(component.layout()).toBe('list');
    await router.navigateByUrl('/?keep=1');
    await settle();
    const boardButton = Array.from(fixture.nativeElement.querySelectorAll('[aria-label="Ticket layout"] [role="button"]'))
      .find((element) => (element as HTMLElement).textContent?.includes('Board')) as HTMLElement;
    boardButton.click();
    await settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ keep: '1', view: 'board' });
    expect(component.layout()).toBe('board');
    expect(fixture.nativeElement.querySelector('app-tickets-board')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('p-table')).toBeNull();
    component.setLayout('list');
    await settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ keep: '1' });
    expect(fixture.nativeElement.querySelector('p-table')).toBeTruthy();
    await router.navigateByUrl('/?view=board');
    await recreate();
    expect(component.layout()).toBe('board');
    expect(fixture.nativeElement.querySelector('app-tickets-board')).toBeTruthy();
  });

  it('toggles My issues for both requests, keeps filters and goes back to page 1', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?tab=active&status=status-id&priority=HIGH&team=team-1&team=team-2&q=inspection&page=3');
    await settle();
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));

    const button = fixture.nativeElement.querySelector('.my-issues-toggle') as HTMLButtonElement;
    button.click();
    await settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({
      tab: 'active', status: 'status-id', priority: 'HIGH', team: ['team-1', 'team-2'], q: 'inspection', assignee: 'me',
    });
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 1, assigneeId: member.id, view: 'active', search: 'inspection',
      teamId: ['team-1', 'team-2'], ticketStatusId: ['status-id'], priority: ['HIGH'],
    }));
    expect(service.getFacets).toHaveBeenLastCalledWith({
      view: 'active', search: 'inspection', teamId: ['team-1', 'team-2'], assigneeId: member.id, projectId: undefined,
    });
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    await settle();
    expect(router.parseUrl(router.url).queryParams['assignee']).toBeUndefined();
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, assigneeId: undefined }));
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: undefined }));
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('follows the sidebar between My tickets (?assignee=me) and Tickets without a remount', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?assignee=me');
    await settle();
    expect(component.myIssues()).toBe(true);
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, assigneeId: member.id }));
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: member.id }));

    await router.navigateByUrl('/');
    await settle();
    expect(component.myIssues()).toBe(false);
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, assigneeId: undefined }));
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: undefined }));
  });

  it('opens from ?assignee=me and waits for the member ID instead of loading every ticket first', async () => {
    const router = TestBed.inject(Router);
    const member$ = new Subject<ActiveMember | null>();
    directory.activeMember.mockReturnValue(member$);
    await router.navigateByUrl('/?assignee=me');
    service.getAll.mockClear();
    service.getFacets.mockClear();
    fixture.destroy();
    fixture = TestBed.createComponent(Tickets);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.myIssues()).toBe(true);
    expect(component.awaitingMember()).toBe(true);
    expect(service.getAll).not.toHaveBeenCalled();
    expect(service.getFacets).not.toHaveBeenCalled();

    member$.next(activeMember);
    member$.complete();
    await settle();
    expect(service.getAll).toHaveBeenCalled();
    expect(service.getAll.mock.calls.every(([params]) => params.assigneeId === member.id)).toBe(true);
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: member.id }));
    const button = fixture.nativeElement.querySelector('.my-issues-toggle') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('drops ?assignee=me and lists every ticket when the user has no member ID in this organization', async () => {
    const router = TestBed.inject(Router);
    directory.activeMember.mockReturnValue(of(null));
    await router.navigateByUrl('/?assignee=me&keep=1');
    await recreate();
    await settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ keep: '1' });
    expect(component.myIssues()).toBe(false);
    expect(service.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: undefined }));
    expect(fixture.nativeElement.querySelector('.my-issues-toggle')).toBeNull();
    component.toggleMyIssues();
    expect(component.myIssues()).toBe(false);
  });

  it('refreshes facet scope when teams are selected, removed, or cleared', async () => {
    component.toggleMyIssues();
    await settle();
    component.toggleTeam('team-1');
    await settle();
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: ['team-1'], assigneeId: member.id }));
    component.toggleTeam('team-2');
    await settle();
    component.removeTeam('team-1');
    await settle();
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: ['team-2'] }));
    component.toggleTeam('team-2');
    await settle();
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: undefined }));
    component.toggleTeam('team-1');
    await settle();
    component.clearFilters();
    await settle();
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: undefined, assigneeId: member.id }));
  });

  it('refreshes the list and facets after creating and editing a ticket', async () => {
    component.toggleMyIssues();
    await settle();
    service.getFacets.mockClear();
    service.getAll.mockClear();
    component.ticketForm.controls.title.setValue('New ticket');
    component.saveTicket();
    await settle();
    expect(service.createTicket).toHaveBeenCalledOnce();
    expect(service.getFacets).toHaveBeenCalled();
    expect(service.getAll).toHaveBeenCalled();
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: member.id }));
    const facetCalls = service.getFacets.mock.calls.length;
    component.openEditDialog(ticket);
    component.editTicketForm.controls.title.setValue('Edited ticket');
    component.updateTicket();
    await settle();
    expect(service.updateTicket).toHaveBeenCalledOnce();
    expect(service.getFacets.mock.calls.length).toBeGreaterThan(facetCalls);
  });

  it('does not replace scoped facets with a late response from the previous scope', async () => {
    const previous = new Subject<TicketFacets>();
    const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
    service.getFacets.mockReturnValueOnce(previous);
    component.toggleTeam('team-1');
    // The first facets request stays open on purpose, so wait on timers rather than whenStable.
    await tick(); fixture.detectChanges();
    component.toggleMyIssues();
    await tick(); fixture.detectChanges();
    await tick();
    expect(service.getFacets).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: ['team-1'], assigneeId: member.id }));
    previous.next({ ...facets, views: { ...facets.views, all: 99 } });
    expect(component.facets()).toEqual(facets);
    previous.complete();
  });
});
