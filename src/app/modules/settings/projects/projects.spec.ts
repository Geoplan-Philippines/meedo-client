import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { WorkspaceService } from '../../clients/services/workspace.service';
import { ClientsService } from '../customers/services/clients.service';
import { ProjectAdminService } from './services/project-admin.service';
import { ProjectRecord } from './models/project-admin.model';
import { Projects } from './projects';

describe('Projects client navigation', () => {
  let fixture: ComponentFixture<Projects>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let listAll: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let detail: ReturnType<typeof vi.fn>;
  const isAdmin = signal(true);
  const project = { id: 'p1', name: 'Rollout', clientId: 'c1', client: { id: 'c1', name: 'Alpha' } } as ProjectRecord;
  const second = { id: 'p2', name: 'Migration', clientId: 'c1', client: { id: 'c1', name: 'Alpha' } } as ProjectRecord;

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ clientId: 'c1' }));
    queryParams = new BehaviorSubject(convertToParamMap({}));
    isAdmin.set(true);
    listAll = vi.fn().mockReturnValue(of({
      data: [project, second],
      meta: { total: 2, page: 1, limit: 25, lastPage: 1, clientCount: 1, clientTotals: [{ clientId: 'c1', count: 2 }] },
    }));
    detail = vi.fn((id: string) => of({ ...(id === 'p2' ? second : project), history: [], slaPolicies: [] }));
    await TestBed.configureTestingModule({
      imports: [Projects],
      providers: [
        provideRouter([]), provideHttpClient(),
        { provide: ActivatedRoute, useValue: {
          paramMap: params,
          queryParamMap: queryParams,
          snapshot: { paramMap: params.value, queryParamMap: queryParams.value },
        } },
        { provide: AuthService, useValue: { isAdmin } },
        { provide: ClientsService, useValue: { list: () => of({ data: [], meta: { page: 1, limit: 20, total: 0, lastPage: 0 } }), get: () => of({ id: 'c1', name: 'Alpha', customerName: 'Alpha', isArchived: false }) } },
        { provide: WorkspaceService, useValue: {
          client: (id: string) => of({ id, name: 'Alpha' }),
          project: () => of(project),
          refreshProjects: vi.fn(),
        } },
        { provide: ProjectAdminService, useValue: { list: listAll, detail, statuses: () => of([]), members: () => of([]), memberOptions: () => of([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Projects);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('asks for one page scoped to the route client without a hidden department filter', async () => {
    expect(listAll).toHaveBeenLastCalledWith({
      page: 1, limit: 25, sortField: 'reportedDate', sortOrder: 'desc',
      status: null, includeArchived: false, includeClosed: true,
      clientId: 'c1', unassigned: false, teamId: null,
    });
    expect(fixture.nativeElement.textContent).toContain('2 projects across 1 customer');
    params.next(convertToParamMap({ clientId: 'c2' }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(listAll).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: 'c2', teamId: null }));
    params.next(convertToParamMap({ clientId: 'unassigned' }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(listAll).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: null, unassigned: true }));
  });

  it('opens project tickets from a client page and preserves the admin detail drawer', async () => {
    fixture.nativeElement.querySelector('.row').click();
    expect(navigate).toHaveBeenCalledWith(['/clients', 'c1', 'projects', 'p1', 'tickets']);
    expect(fixture.componentInstance.selectedProjectId()).toBeNull();

    params.next(convertToParamMap({}));
    fixture.detectChanges();
    await fixture.whenStable();
    navigate.mockClear();
    fixture.componentInstance.openProject(project);
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.selectedProjectId()).toBe('p1');
  });

  const manageButtons = (): HTMLButtonElement[] =>
    [...fixture.nativeElement.querySelectorAll('[data-action="manage-project"] button')] as HTMLButtonElement[];

  it('gives admins a labelled Manage action that opens the drawer for that row without navigating', async () => {
    const buttons = manageButtons();
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Manage project Rollout', 'Manage project Migration']);

    buttons[1].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.selectedProjectId()).toBe('p2');
    expect(detail).toHaveBeenLastCalledWith('p2');
  });

  it('closes the drawer in place, keeping the URL filters and the closed-projects toggle', async () => {
    const component = fixture.componentInstance;
    queryParams.next(convertToParamMap({ q: 'Mig', includeClosed: 'false' }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(listAll).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Mig', includeClosed: false }));
    const loads = listAll.mock.calls.length;

    manageButtons()[0].click();
    component.closeDrawer();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
    expect(component.selectedProjectId()).toBeNull();
    expect(component.list.search()).toBe('Mig');
    expect(component.list.filters().includeClosed).toBe(false);
    expect(listAll.mock.calls.length).toBe(loads);
  });

  it('still opens project tickets when the row itself is clicked', () => {
    fixture.nativeElement.querySelector('.row').click();
    expect(navigate).toHaveBeenCalledWith(['/clients', 'c1', 'projects', 'p1', 'tickets']);
    expect(fixture.componentInstance.selectedProjectId()).toBeNull();
  });

  it('patches the row from a drawer save without reloading the list', () => {
    const loads = listAll.mock.calls.length;
    fixture.componentInstance.onProjectChanged({ ...second, name: 'Migration v2' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Migration v2');
    expect(listAll.mock.calls.length).toBe(loads);
  });

  it('shows no Manage action to non-admins', () => {
    isAdmin.set(false);
    fixture.detectChanges();
    expect(manageButtons()).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('.row')).toHaveLength(2);
  });
});
