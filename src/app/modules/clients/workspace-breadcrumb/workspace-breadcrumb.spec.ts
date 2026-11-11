import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { WorkspaceService } from '../services/workspace.service';
import { WorkspaceBreadcrumb } from './workspace-breadcrumb';

describe('client ticket breadcrumbs', () => {
  it('links every step back to its own page', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkspaceBreadcrumb],
      providers: [
        provideRouter([]),
        { provide: WorkspaceService, useValue: {
          client: () => of({ name: 'Alpha' }),
          project: () => of({ name: 'Rollout', workOrderNumber: 'WO-1' }),
        } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(WorkspaceBreadcrumb);
    fixture.componentRef.setInput('clientId', 'c1');
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('tickets', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const links = [...fixture.nativeElement.querySelectorAll('a')] as HTMLAnchorElement[];
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Clients', 'Alpha', 'Rollout', 'Tickets']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/clients', '/clients/c1', '/clients/c1/projects/p1', '/clients/c1/projects/p1/tickets',
    ]);
    expect(links[3].getAttribute('aria-current')).toBe('page');
  });
});
