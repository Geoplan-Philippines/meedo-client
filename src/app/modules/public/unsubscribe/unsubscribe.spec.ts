import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment.dev';
import { UnsubscribePage } from './unsubscribe';

describe('UnsubscribePage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnsubscribePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: 'tok-1' }) } } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the token and shows the same confirmation whether the token is valid', async () => {
    const fixture = TestBed.createComponent(UnsubscribePage);
    fixture.detectChanges();
    const req = http.expectOne(`${environment.apiBaseUrl}/public/unsubscribe/tok-1`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('You are unsubscribed');
    expect(fixture.nativeElement.textContent).not.toContain('invalid');
    expect(fixture.nativeElement.textContent).not.toContain('tok-1');
  });
});
