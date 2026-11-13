import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { ApiCache, cacheContext } from '../../../core/http/api-cache';
import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { toHttpParams } from '../../../shared/data/page-query';
import { PickerQuery } from '../../../shared/data/paged-search';
import { PaginatedProjects, Project, ProjectRecord } from '../models/projects.model';
import { Ticket } from '../models/ticket.model';
import { clientDisplayName, projectDisplayName } from '../../../shared/utils/display-name.utils';

/**
 * Project pickers search the server one page at a time: most recently
 * reported first, active projects only. The API applies the caller's project
 * membership, so members only ever see their own projects here.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(ApiCache);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/projects`;

  search(query: PickerQuery): Observable<PaginatedApiResponse<Project>> {
    return this.http
      .get<PaginatedProjects>(this.baseUrl, {
        params: toHttpParams({ ...query, sortField: 'reportedDate', sortOrder: 'desc' }),
        context: cacheContext('projects'),
        withCredentials: true,
      })
      .pipe(map((page) => ({ ...page, data: page.data.map(toPickerProject) })));
  }

  /** Drop cached project pages after a sync or an admin edit so pickers show fresh names. */
  invalidate(): void {
    this.cache.invalidate(['projects']);
  }
}

export function toPickerProject(record: ProjectRecord): Project {
  const clientName = record.client?.name ?? record.customerName ?? '';
  return {
    ...record,
    clientName,
    label: [record.name, clientName, record.workOrderNumber].filter(Boolean).join(' · '),
  };
}

/** A ticket's own project as a picker option (it may be archived or outside the current search). */
export function ticketProjectOption(current: NonNullable<Ticket['project']>): Project {
  const name = projectDisplayName(current);
  const clientName = clientDisplayName(current.client) || current.customerName || '';
  return {
    id: current.id,
    apptivoId: '',
    name,
    displayName: current.displayName ?? null,
    workOrderNumber: current.workOrderNumber,
    quoteSubject: current.quoteSubject ?? null,
    customerName: current.customerName,
    status: '',
    total: 0,
    reportedDate: null,
    clientId: null,
    clientLocked: false,
    isArchived: current.isArchived ?? false,
    client: null,
    clientName,
    label: [name, clientName, current.workOrderNumber].filter(Boolean).join(' · '),
  };
}

/**
 * Picker options for a ticket: the search results, plus the ticket's current
 * project when it is not among them (archived by the sync, or simply not on
 * this page), so the field shows it instead of going blank. An archived one
 * can stay selected but cannot be picked for another ticket.
 */
export function withCurrentProject(projects: Project[], current: Ticket['project'] | undefined, allowHiddenCurrent = true): Project[] {
  if (!allowHiddenCurrent || !current || projects.some((project) => project.id === current.id)) return projects;
  return [ticketProjectOption({ ...current, isArchived: current.isArchived ?? true }), ...projects];
}
