import { TestBed } from '@angular/core/testing';
import { InputFeedback } from './input-feedback';

describe('InputFeedback', () => {
  it('shows the live counter only within the final ten percent and describes the limit in text', async () => {
    const fixture = TestBed.createComponent(InputFeedback);
    fixture.componentRef.setInput('maxLength', 200);
    fixture.componentRef.setInput('feedbackId', 'feedback');
    fixture.componentRef.setInput('value', 'x'.repeat(179));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
    fixture.componentRef.setInput('value', 'x'.repeat(180));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('180 / 200');
    expect(fixture.nativeElement.querySelector('#feedback').getAttribute('aria-live')).toBe('polite');
    fixture.componentRef.setInput('value', 'x'.repeat(200));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.error').textContent).toContain('Limit reached');
  });

  it('announces whitespace-only required fields without showing an error for an untouched empty field', () => {
    const fixture = TestBed.createComponent(InputFeedback);
    fixture.componentRef.setInput('maxLength', 5000);
    fixture.componentRef.setInput('feedbackId', 'required-feedback');
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('label', 'Comment');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
    fixture.componentRef.setInput('value', ' \n\t ');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Comment cannot be blank');
    fixture.componentRef.setInput('value', '');
    fixture.componentRef.setInput('showRequired', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Comment cannot be blank');
  });
});
