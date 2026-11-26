import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { IntegrationKeySettings } from './integration-key';
import { IntegrationService } from '../../../crm/services/integration.service';
import { AuthService } from '../../../../core/auth/auth.service';

describe('IntegrationKeySettings', () => {
  const api = {
    getWebsite: vi.fn(),
    createKey: vi.fn(),
    rotateKey: vi.fn(),
    revokeKey: vi.fn(),
  };
  const isAdmin = signal(true);

  beforeEach(async () => {
    vi.clearAllMocks();
    isAdmin.set(true);
    api.getWebsite.mockReturnValue(of({ slug: 'geoplan', hasKey: false, prefix: null, createdAt: null, lastUsedAt: null }));
    await TestBed.configureTestingModule({
      imports: [IntegrationKeySettings],
      providers: [
        provideRouter([]),
        { provide: IntegrationService, useValue: api },
        { provide: AuthService, useValue: { isAdmin } },
      ],
    }).compileComponents();
  });

  async function render(): Promise<ComponentFixture<IntegrationKeySettings>> {
    const fixture = TestBed.createComponent(IntegrationKeySettings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('creates a key and shows the full secret once', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.createKey.mockReturnValue(of({ key: 'mdo_pk_fullsecret', prefix: 'mdo_pk_full' }));
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('No website key yet');
    fixture.componentInstance.create();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.createKey).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('mdo_pk_fullsecret');
    expect(fixture.nativeElement.textContent).toContain('will not show it again');
  });

  it('hides write actions for members', async () => {
    isAdmin.set(false);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).not.toContain('Create key');
    expect(fixture.nativeElement.textContent).toContain('Only admins');
  });
});
