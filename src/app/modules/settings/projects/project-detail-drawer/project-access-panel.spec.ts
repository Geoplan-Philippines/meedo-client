import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProjectAdminService } from '../services/project-admin.service';
import { ProjectAccessPanel } from './project-access-panel';

describe('project member and state drawer', () => {
  const project = { id: 'example-project', name: 'Example internal project', isArchived: false, isClosed: false, apptivoId: null };
  const api = { members: vi.fn(), memberOptions: vi.fn(), addMember: vi.fn(), removeMember: vi.fn(), setClosed: vi.fn(), setArchived: vi.fn() };
  beforeEach(() => { vi.clearAllMocks(); api.members.mockReturnValue(of([{ userId: 'example-user', user: { id: 'example-user', name: 'Example Member', email: 'member@example.test' } }])); api.memberOptions.mockReturnValue(of([])); api.addMember.mockReturnValue(of({})); api.removeMember.mockReturnValue(of({})); api.setClosed.mockReturnValue(of({ ...project, isClosed: true })); api.setArchived.mockReturnValue(of({ ...project, isArchived: true })); TestBed.configureTestingModule({ imports: [ProjectAccessPanel], providers: [{ provide: ProjectAdminService, useValue: api }] }); });
  it('shows members but hides mutation controls and member options from ordinary members', () => {
    const fixture = TestBed.createComponent(ProjectAccessPanel); fixture.componentRef.setInput('project', project); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Example Member'); expect(fixture.nativeElement.querySelector('select')).toBeNull(); expect(fixture.nativeElement.querySelector('input')).toBeNull(); expect(api.memberOptions).not.toHaveBeenCalled(); fixture.componentInstance.add('example-other'); expect(api.addMember).not.toHaveBeenCalled();
  });
  it('lets admins add and remove members with confirmation', () => {
    const fixture = TestBed.createComponent(ProjectAccessPanel); fixture.componentRef.setInput('project', project); fixture.componentRef.setInput('isAdmin', true); fixture.detectChanges(); fixture.componentInstance.add('example-other'); expect(api.addMember).toHaveBeenCalledWith(project.id, 'example-other');
    vi.spyOn(window, 'confirm').mockReturnValue(false); fixture.componentInstance.remove('example-user'); expect(api.removeMember).not.toHaveBeenCalled(); vi.mocked(window.confirm).mockReturnValue(true); fixture.componentInstance.remove('example-user'); expect(api.removeMember).toHaveBeenCalledWith(project.id, 'example-user'); vi.restoreAllMocks();
  });
  it('toggles closed and confirms manual archive or restore', () => {
    const fixture = TestBed.createComponent(ProjectAccessPanel); fixture.componentRef.setInput('project', project); fixture.componentRef.setInput('isAdmin', true); fixture.detectChanges(); const changed = vi.fn(); fixture.componentInstance.changed.subscribe(changed);
    fixture.componentInstance.setClosed({ target: { checked: true } } as unknown as Event); expect(api.setClosed).toHaveBeenCalledWith(project.id, true); expect(changed).toHaveBeenCalledWith(expect.objectContaining({ isClosed: true }));
    vi.spyOn(window, 'confirm').mockReturnValue(true); fixture.componentInstance.archive(); expect(api.setArchived).toHaveBeenCalledWith(project.id, true); fixture.componentRef.setInput('project', { ...project, isArchived: true }); fixture.componentInstance.archive(); expect(api.setArchived).toHaveBeenLastCalledWith(project.id, false); vi.restoreAllMocks();
  });
});
