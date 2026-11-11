import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NotFound } from './not-found';

@Component({ template: '' })
class TimekeepingDestination {}

describe('not-found return home', () => {
  it('follows the root redirect to timekeeping', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', pathMatch: 'full', redirectTo: 'timekeeping' },
          { path: 'timekeeping', component: TimekeepingDestination },
          { path: '**', component: NotFound },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/missing');
    const home = harness.routeNativeElement!.querySelector(
      'a[href="/"]',
    ) as HTMLAnchorElement;
    expect(home.textContent).toContain('Return home');
    home.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/timekeeping');
  });
});
