import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { Developers, agentPrompt, signatureSnippet, submitCurl } from './developers';
import { IntegrationService } from '../services/integration.service';

describe('Developers', () => {
  const api = {
    apiBaseUrl: 'http://localhost:8000/api/v1',
    docsUrl: 'http://localhost:8000/api/v1/docs/integration.md',
    getWebsite: vi.fn(),
    getOrganizationSlug: vi.fn(),
    getGuide: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getWebsite.mockReturnValue(of({
      slug: 'geoplan', hasKey: true, prefix: 'mdo_pk_abcd', createdAt: '2026-11-01', lastUsedAt: null,
    }));
    api.getOrganizationSlug.mockReturnValue(of('geoplan'));
    api.getGuide.mockReturnValue(of('# Meedo integration\nUse MEEDO_INTEGRATION_KEY'));
    await TestBed.configureTestingModule({
      imports: [Developers],
      providers: [provideRouter([]), { provide: IntegrationService, useValue: api }],
    }).compileComponents();
  });

  it('shows slug, prefix, paste-to-agent prompt, curls, and the signature snippet', async () => {
    const fixture = TestBed.createComponent(Developers);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('geoplan');
    expect(text).toContain('mdo_pk_abcd');
    expect(text).toContain('Paste this to your AI agent');
    expect(text).toContain('MEEDO_INTEGRATION_KEY');
    expect(text).toContain('/public/geoplan/leads');
    expect(text).toContain('/public/geoplan/subscribers');
    expect(text).toContain('X-Meedo-Signature');
    expect(text).toContain('Use MEEDO_INTEGRATION_KEY');
  });
});

describe('developer snippets', () => {
  it('points the agent at the guide, env var, and signed webhooks', () => {
    const prompt = agentPrompt('http://localhost:8000/api/v1', 'geoplan', 'http://localhost:8000/api/v1/docs/integration.md');
    expect(prompt).toContain('docs/integration.md');
    expect(prompt).toContain('MEEDO_INTEGRATION_KEY');
    expect(prompt).toContain('x-integration-key');
    expect(prompt).toContain('sha256=');
  });

  it('builds curl examples for public submit', () => {
    expect(submitCurl('http://localhost:8000/api/v1', 'geoplan', 'leads', { email: 'a@b.test' }))
      .toContain('/public/geoplan/leads');
    expect(signatureSnippet()).toContain('createHmac');
  });
});
