import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApptivoSyncPanel } from './apptivo-sync-panel';
import { WorkspaceService } from '../../clients/services/workspace.service';
import { ProjectsService } from '../../tickets/services/projects.service';

describe('Settings Apptivo import', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ApptivoSyncPanel], providers: [
    provideHttpClient(), provideHttpClientTesting(),
    { provide: WorkspaceService, useValue: { invalidate: vi.fn() } },
    { provide: ProjectsService, useValue: { invalidate: vi.fn() } },
  ] }));
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); vi.restoreAllMocks(); });

  it('requires confirmation and makes no request when cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const panel = TestBed.createComponent(ApptivoSyncPanel).componentInstance;
    panel.sync('projects');
    expect(panel.busy()).toBe(false);
    TestBed.inject(HttpTestingController).expectNone(r => r.url.endsWith('/sync'));
  });
  it.each(['projects', 'clients'] as const)('imports %s with credentials and reports reference-only counts', kind => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const panel = TestBed.createComponent(ApptivoSyncPanel).componentInstance;
    panel.sync(kind);
    const request = TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith(`/maintenance/${kind}/sync`));
    expect(request.request.method).toBe('POST'); expect(request.request.withCredentials).toBe(true);
    request.flush({ data: { created: 2, updated: 3, missing: 1, unmatched: 2 } });
    expect(panel.message()).toContain('2 added, 3 references refreshed, 1 marked missing');
    expect(panel.message()).toContain('2 work orders have no matching customer');
    expect(panel.busy()).toBe(false);
  });
  it('shows an error after failure and allows a later retry', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const panel = TestBed.createComponent(ApptivoSyncPanel).componentInstance;
    panel.sync('clients');
    TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/clients/sync')).flush({}, {status: 500, statusText: 'Invented failure'});
    expect(panel.error()).toContain('failed'); expect(panel.busy()).toBe(false);
  });
});
