import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { WorkspaceService } from '../services/workspace.service';
import { ClientTree } from './client-tree';

@Component({ template: '' })
class Destination {}

describe('user client navigation', () => {
  let fixture: ComponentFixture<ClientTree>;
  let http: HttpTestingController;
  let router: Router;
  let workspace: WorkspaceService;
  const userName = 'Maria Santos';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientTree],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        provideRouter([
          { path: 'clients', component: Destination },
          { path: 'clients/:clientId', component: Destination },
          { path: 'clients/:clientId/projects/:projectId', component: Destination },
          { path: 'clients/:clientId/projects/:projectId/tickets', component: Destination },
        ]),
        { provide: AuthService, useValue: { currentUser: () => ({ name: userName }) } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    workspace = TestBed.inject(WorkspaceService);
    fixture = TestBed.createComponent(ClientTree);
    fixture.detectChanges();
    const request = http.expectOne((req) => req.url.endsWith('/maintenance/clients/tree'));
    expect(request.request.params.get('hasActiveProjects')).toBe('true');
    expect(request.request.params.get('limit')).toBe('5');
    expect(request.request.params.has('teamId')).toBe(false);
    request.flush({
      data: [
        { id: 'beta', name: 'Beta Client With A Long Display Name', projectCount: 1 },
        { id: 'alpha', name: 'Alpha', projectCount: 3 },
      ],
      meta: { page: 1, limit: 5, lastPage: 1, total: 2 },
    });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('toggles the user item and renders plain client links with See all last', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('button')!;
    expect(button.textContent).toContain(userName);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    fixture.detectChanges();

    const list = element.querySelector('ul')!;
    expect(list.hidden).toBe(false);
    expect(list.querySelectorAll('button, ul')).toHaveLength(0);
    const links = [...list.querySelectorAll('a')];
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Alpha', 'Beta Client With A Long Display Name', 'See all...']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/clients/alpha', '/clients/beta', '/clients']);
    expect(links[1].title).toBe('Beta Client With A Long Display Name');
    const navigated = vi.fn();
    fixture.componentInstance.navigated.subscribe(navigated);
    links[0].click();
    await fixture.whenStable();
    expect(router.url).toBe('/clients/alpha');
    expect(navigated).toHaveBeenCalledOnce();

    button.click();
    fixture.detectChanges();
    expect(list.hidden).toBe(true);
  });

  it('keeps the user and client highlighted through client, project and tickets routes', async () => {
    for (const url of ['/clients/alpha', '/clients/alpha/projects/p1', '/clients/alpha/projects/p1/tickets']) {
      await router.navigateByUrl(url);
      fixture.detectChanges();
      expect(fixture.componentInstance.isActive()).toBe(true);
      expect(fixture.nativeElement.querySelector('a[aria-current="page"]').getAttribute('href')).toBe('/clients/alpha');
      expect(fixture.nativeElement.querySelector('button').classList.contains('bg-secondary')).toBe(true);
    }
    await router.navigateByUrl('/clients');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[aria-current="page"]').textContent).toContain('See all...');
  });

  it('expands the icon sidebar without navigating, and preserves dropdown state on remount', () => {
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();
    const expand = vi.fn();
    fixture.componentInstance.expandSidebar.subscribe(expand);
    fixture.nativeElement.querySelector('button').click();
    expect(expand).toHaveBeenCalledOnce();
    expect(workspace.clientsOpen()).toBe(true);
    expect(router.url).toBe('/');
    fixture.destroy();
    fixture = TestBed.createComponent(ClientTree);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-expanded')).toBe('true');
    http.expectNone((req) => req.url.endsWith('/clients/tree'));
  });
});
