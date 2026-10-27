import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Newsletter } from './newsletter';

describe('Newsletter', () => {
  let component: Newsletter;
  let fixture: ComponentFixture<Newsletter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Newsletter],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Newsletter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
