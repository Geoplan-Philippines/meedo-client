import { Injector } from '@angular/core';
import { UrlTree } from '@angular/router';
import { Observable, take } from 'rxjs';

import { DataPrefetcher } from '../../core/prefetch/prefetch.service';
import { MemberDirectoryService } from '../../core/members/member-directory.service';
import { defaultListQuery } from '../../shared/data/url-list-state';
import { TICKETS_LIST, TicketsService, ticketFacetParams, ticketListParams } from '../../modules/tickets/services/tickets.service';
import { StatusesService } from '../../modules/tickets/services/statuses.service';
import { TicketCategoriesService } from '../../modules/tickets/services/ticket-categories.service';
import { TicketDepartmentService } from '../../modules/tickets/services/ticket-department.service';
import { CLIENTS_LIST, ClientsService } from '../../modules/settings/customers/services/clients.service';
import { PROJECTS_LIST, ProjectAdminService, projectPageQuery } from '../../modules/settings/projects/services/project-admin.service';
import { WorkspaceService } from '../../modules/clients/services/workspace.service';
import { USERS_LIST } from '../../modules/settings/users/services/user.service';
import { TEAMS_LIST, TeamsService } from '../../modules/settings/teams/services/teams.service';
import { CrmService, LEADS_LIST, SUBSCRIBERS_LIST } from '../../modules/crm/services/crm.service';
import { FieldDefinitionsService } from '../../modules/crm/services/field-definitions.service';
import { CAMPAIGNS_LIST, CampaignsService } from '../../modules/crm/services/campaigns.service';
import { MY_TICKETS_QUERY_PARAMS } from '../../modules/tickets/tickets.constants';

/** Starts a request and lets the API cache keep the answer. */
function warm(request: Observable<unknown>): void {
  request.pipe(take(1)).subscribe({ error: () => undefined });
}

const path = (...parts: (string | null)[]) => (segments: readonly string[]) =>
  segments.length === parts.length && parts.every((part, index) => part === null || part === segments[index]);

/** The ticket list's first requests for a scope: the page, its facet counts and the pickers' lookups. */
function warmTickets(injector: Injector, scope: { assigneeId?: string; projectId?: string }): void {
  const tickets = injector.get(TicketsService);
  const params = ticketListParams(defaultListQuery(TICKETS_LIST), scope);
  warm(tickets.getAll(params));
  warm(tickets.getFacets(ticketFacetParams(params)));
  warm(injector.get(StatusesService).options());
  warm(injector.get(TicketCategoriesService).options());
  warm(injector.get(TicketDepartmentService).load());
}

/**
 * What each screen asks for first, keyed by its URL. Each prefetcher builds
 * the same query the screen builds from an empty URL, so a hovered link warms
 * exactly the cache entry the screen will read.
 */
export const ROUTE_PREFETCHERS: readonly DataPrefetcher[] = [
  {
    match: path('tickets'),
    prefetch: (injector: Injector, url: UrlTree) => {
      if (url.queryParams['assignee'] !== MY_TICKETS_QUERY_PARAMS.assignee) {
        warmTickets(injector, {});
        return;
      }
      // "My tickets" needs the caller's member id first (cached for the page too).
      injector.get(MemberDirectoryService).activeMember().pipe(take(1)).subscribe((member) => {
        if (member) warmTickets(injector, { assigneeId: member.id });
      });
    },
  },
  {
    match: (segments) => segments.length === 2 && segments[0] === 'tickets' && segments[1] !== 'dashboard',
    prefetch: (injector, _url, segments) => warm(injector.get(TicketsService).getById(segments[1])),
  },
  {
    match: path('clients'),
    prefetch: (injector) => warm(injector.get(ClientsService).list(defaultListQuery(CLIENTS_LIST))),
  },
  {
    match: path('clients', null),
    prefetch: (injector, _url, segments) => {
      warm(injector.get(ProjectAdminService).list(projectPageQuery(defaultListQuery(PROJECTS_LIST), segments[1])));
      warm(injector.get(WorkspaceService).client(segments[1]));
    },
  },
  {
    match: path('clients', null, 'projects', null, 'tickets'),
    prefetch: (injector, _url, segments) => {
      warmTickets(injector, { projectId: segments[3] });
      warm(injector.get(WorkspaceService).project(segments[3]));
    },
  },
  {
    match: path('settings', 'projects'),
    prefetch: (injector) => warm(injector.get(ProjectAdminService).list(projectPageQuery(defaultListQuery(PROJECTS_LIST), null))),
  },
  {
    match: path('settings', 'users'),
    prefetch: (injector) => warm(injector.get(MemberDirectoryService).list(defaultListQuery(USERS_LIST))),
  },
  {
    match: path('settings', 'teams'),
    prefetch: (injector) => warm(injector.get(TeamsService).list(defaultListQuery(TEAMS_LIST))),
  },
  {
    match: path('crm', 'leads'),
    prefetch: (injector) => {
      const crm = injector.get(CrmService);
      warm(crm.listLeads(defaultListQuery(LEADS_LIST)));
      warm(crm.getLeadsStats());
    },
  },
  {
    match: path('crm', 'leads', 'new'),
    prefetch: (injector) => warm(injector.get(FieldDefinitionsService).list('lead')),
  },
  {
    match: (segments) => segments.length === 3 && segments[0] === 'crm' && segments[1] === 'leads' && segments[2] !== 'new',
    prefetch: (injector, _url, segments) => {
      warm(injector.get(CrmService).getLead(segments[2]));
      warm(injector.get(FieldDefinitionsService).list('lead'));
    },
  },
  {
    match: path('crm', 'newsletter', 'subscribers'),
    prefetch: (injector) => warm(injector.get(CrmService).listSubscribers(defaultListQuery(SUBSCRIBERS_LIST))),
  },
  {
    match: path('crm', 'newsletter', 'campaigns'),
    prefetch: (injector) => warm(injector.get(CampaignsService).list(defaultListQuery(CAMPAIGNS_LIST))),
  },
];
