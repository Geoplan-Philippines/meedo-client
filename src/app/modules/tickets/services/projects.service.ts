import { Injectable, effect, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { PaginatedProjects, Project, ProjectRecord } from '../models/projects.model';
import { Ticket } from '../models/ticket.model';
import { clientDisplayName, projectDisplayName } from '../../../shared/utils/display-name.utils';

/** Server maximum for maintenance lists; ~800 projects load in 4–5 requests. */
const PAGE_SIZE = 200;

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/projects`;

  /** Active projects, every page, shared by all ticket pickers until invalidated. */
  private active$: Observable<Project[]> | null = null;
  private identityKey: string | undefined;
  constructor() { effect(() => {
    const key = `${this.auth.currentUser?.()?.id ?? ''}:${this.auth.organizationId?.() ?? ''}`;
    if (this.identityKey !== undefined && this.identityKey !== key) this.active$ = null;
    this.identityKey = key;
  }); }

  /** Every active (non-archived) project, sorted by client then name. */
  getAll(): Observable<Project[]> {
    this.active$ ??= this.fetchAllPages().pipe(
      map((records) => records.map(toPickerProject).sort(compareProjects)),
      // A failed load must not be cached; the next caller retries.
      catchError((error: unknown) => {
        this.active$ = null;
        throw error;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.active$;
  }

  /** Drop the cache after a sync or an admin edit so pickers show fresh names. */
  invalidate(): void {
    this.active$ = null;
  }

  private fetchAllPages(): Observable<ProjectRecord[]> {
    return this.fetchPage(1).pipe(
      switchMap((first) => {
        const rest = Array.from({ length: Math.max(0, first.meta.lastPage - 1) }, (_, i) => this.fetchPage(i + 2));
        return rest.length
          ? forkJoin(rest).pipe(map((pages) => [first, ...pages].flatMap((page) => page.data)))
          : of(first.data);
      }),
    );
  }

  private fetchPage(page: number): Observable<PaginatedProjects> {
    return this.http.get<PaginatedProjects>(this.baseUrl, {
      params: { page, limit: PAGE_SIZE, sortField: 'workOrderNumber', sortOrder: 'asc' },
      withCredentials: true,
    });
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

/**
 * Picker options for a ticket: the active projects, plus the ticket's current project
 * when the sync has archived it, so the field shows it (tagged "Archived") instead of
 * going blank. It can stay selected but cannot be picked for another ticket.
 */
export function withCurrentProject(projects: Project[], current: Ticket['project'] | undefined, allowHiddenCurrent = true): Project[] {
  if (!allowHiddenCurrent || !current || projects.some((project) => project.id === current.id)) return projects;
  const name = projectDisplayName(current);
  const clientName = clientDisplayName(current.client) || current.customerName || '';
  const archived: Project = {
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
    isArchived: current.isArchived ?? true,
    client: null,
    clientName,
    label: [name, clientName, current.workOrderNumber].filter(Boolean).join(' · '),
  };
  return [archived, ...projects];
}

/** Most rows a picker popover renders; typing narrows the list further. */
export const PROJECT_PICKER_LIMIT = 100;

/** Case-insensitive match on name, client and WO number, capped for rendering. */
export function filterProjects(projects: Project[], query: string): { items: Project[]; total: number } {
  const needle = query.trim().toLowerCase();
  const matches = needle ? projects.filter((project) => project.label.toLowerCase().includes(needle)) : projects;
  return { items: matches.slice(0, PROJECT_PICKER_LIMIT), total: matches.length };
}

function compareProjects(a: Project, b: Project): number {
  return (
    a.clientName.localeCompare(b.clientName, undefined, { sensitivity: 'base' }) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}
