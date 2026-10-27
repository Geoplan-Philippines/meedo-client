import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
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
  let listAll: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const project = { id: 'p1', name: 'Rollout', clientId: 'c1', client: { id: 'c1', name: 'Alpha' } } as ProjectRecord;

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ clientId: 'c1' }));
    listAll = vi.fn().mockReturnValue(of([project]));
    await TestBed.configureTestingModule({
      imports: [Projects],
      providers: [
        provideRouter([]), provideHttpClient(),
        { provide: ActivatedRoute, useValue: {
          paramMap: params,
          snapshot: { paramMap: params.value, queryParamMap: convertToParamMap({}) },
        } },
        { provide: AuthService, useValue: { isAdmin: () => true } },
        { provide: ClientsService, useValue: { options: () => of([]) } },
        { provide: WorkspaceService, useValue: {
          client: (id: string) => of({ id, name: 'Alpha' }),
          project: () => of(project),
        } },
        { provide: ProjectAdminService, useValue: { listAll, statuses: () => of([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Projects);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('scopes projects to the route client without a hidden department filter', async () => {
    expect(listAll).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: 'c1', unassigned: false, teamId: null }));
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
});
