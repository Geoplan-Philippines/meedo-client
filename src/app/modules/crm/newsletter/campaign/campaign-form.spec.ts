import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { CampaignsService } from '../../services/campaigns.service';
import { CampaignForm } from './campaign-form';
import { CAMPAIGN_LIMITS, Campaign } from './campaign.model';

describe('CampaignForm', () => {
  let fixture: ComponentFixture<CampaignForm>;
  const admin = signal(true);
  let id: string | null;
  const payload = { name: 'Example draft', subject: 'Example news', body: '<p>Example content</p>' };
  const draft = { id: 'example-id', ...payload, status: 'DRAFT' } as Campaign;
  const api = { get: vi.fn(), create: vi.fn(), update: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks(); admin.set(true); id = null;
    api.get.mockReturnValue(of(draft)); api.create.mockReturnValue(of(draft)); api.update.mockReturnValue(of(draft));
    TestBed.configureTestingModule({ imports: [CampaignForm], providers: [provideRouter([]),
      { provide: ActivatedRoute, useFactory: () => ({ snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } }) },
      { provide: AuthService, useValue: { isAdmin: admin } }, { provide: CampaignsService, useValue: api },
    ] });
  });
  const render = () => { fixture = TestBed.createComponent(CampaignForm); fixture.detectChanges(); return fixture.componentInstance; };
  const text = () => fixture.nativeElement.textContent as string;

  it('rejects whitespace before required checks and links accessible error feedback', () => {
    const component = render(); component.form.setValue({ name: '   ', subject: '  ', body: '   ' }); component.save(); fixture.detectChanges();
    expect(api.create).not.toHaveBeenCalled(); expect(text()).toContain('Name is required'); expect(text()).toContain('Body is required');
    const name = fixture.nativeElement.querySelector('#name') as HTMLInputElement;
    expect(name.maxLength).toBe(200); expect(name.getAttribute('aria-describedby')).toBe('name-feedback'); expect(name.getAttribute('aria-invalid')).toBe('true');
  });
  it('rejects empty rich text and labels the real editor', async () => {
    const component = render(); component.form.setValue({ ...payload, body: '<p> &nbsp; </p>' }); component.save(); fixture.detectChanges(); await fixture.whenStable();
    expect(api.create).not.toHaveBeenCalled();
    const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
    expect(editor.getAttribute('aria-label')).toBe('Campaign body'); expect(editor.getAttribute('aria-describedby')).toBe('body-feedback');
  });
  it.each(['name', 'subject', 'body'] as const)('shows %s counters near the limit and rejects overflow', field => {
    const component = render(); component.form.setValue(payload);
    component.form.controls[field].setValue('x'.repeat(CAMPAIGN_LIMITS[field] - 1)); fixture.detectChanges();
    expect(text()).toContain(`${CAMPAIGN_LIMITS[field] - 1} / ${CAMPAIGN_LIMITS[field]}`);
    component.form.controls[field].setValue('x'.repeat(CAMPAIGN_LIMITS[field] + 1)); component.save();
    expect(api.create).not.toHaveBeenCalled();
  });
  it('accepts exact limits, trims payload, creates and navigates to the list', () => {
    const component = render(); const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.form.setValue({ name: ` ${'n'.repeat(200)} `, subject: ` ${'s'.repeat(200)} `, body: ` ${'b'.repeat(20000)} ` }); component.save();
    expect(api.create).toHaveBeenCalledWith({ name: 'n'.repeat(200), subject: 's'.repeat(200), body: 'b'.repeat(20000) });
    expect(navigate).toHaveBeenCalledWith(['/crm/newsletter/campaigns']);
  });
  it('loads an existing draft and updates it', () => {
    id = draft.id; const component = render(); vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(component.form.getRawValue()).toEqual(payload); component.save(); expect(api.update).toHaveBeenCalledWith(id, payload);
  });
  it('keeps archives read-only with no save control', () => {
    id = draft.id; api.get.mockReturnValue(of({ ...draft, status: 'ARCHIVED' }));
    const component = render(); component.save();
    expect(text()).toContain('Restore this campaign'); expect(fixture.nativeElement.querySelector('button[type=submit]')).toBeNull(); expect(api.update).not.toHaveBeenCalled();
  });
  it('hides member create controls and prevents saving', () => {
    admin.set(false); const component = render(); component.form.setValue(payload); component.save();
    expect(text()).toContain('owner or admin'); expect(api.create).not.toHaveBeenCalled(); expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
  it('lets members view an existing draft without editing', () => {
    id = draft.id; admin.set(false); const component = render(); component.save();
    expect((fixture.nativeElement.querySelector('#name') as HTMLInputElement).readOnly).toBe(true); expect(api.update).not.toHaveBeenCalled();
  });
  it('shows load failure and retries', () => {
    id = draft.id; api.get.mockReturnValueOnce(throwError(() => new Error('Invented failure')));
    const component = render(); expect(text()).toContain('could not be loaded'); component.load(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('form')).toBeTruthy();
  });
  it('prevents double submit and reports save errors', () => {
    const pending = new Subject<Campaign>(); api.create.mockReturnValue(pending);
    const component = render(); component.form.setValue(payload); component.save(); component.save();
    expect(api.create).toHaveBeenCalledTimes(1); pending.error(new Error('Invented failure')); fixture.detectChanges();
    expect(text()).toContain('could not be saved'); expect(component.saving()).toBe(false);
  });
});
