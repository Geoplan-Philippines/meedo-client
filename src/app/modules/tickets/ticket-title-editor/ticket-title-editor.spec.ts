import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TICKET_TITLE_MAX_LENGTH } from '../tickets.constants';
import { TicketTitleEditor } from './ticket-title-editor';

describe('TicketTitleEditor', () => {
  let fixture: ComponentFixture<TicketTitleEditor>;
  let saved: ReturnType<typeof vi.fn<(value: string) => void>>;
  beforeEach(async () => {
    fixture = TestBed.createComponent(TicketTitleEditor);
    fixture.componentRef.setInput('value', 'Saved title');
    saved = vi.fn<(value: string) => void>(); fixture.componentInstance.titleSave.subscribe(saved);
    fixture.detectChanges(); await fixture.whenStable();
  });

  it('enforces the shared native title limit, exposes a counter description, and saves trimmed text', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.maxLength).toBe(TICKET_TITLE_MAX_LENGTH);
    expect(input.getAttribute('aria-describedby')).toBe(fixture.componentInstance.feedbackId);
    fixture.componentInstance.draft.set('  New title  ');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(saved).toHaveBeenCalledWith('New title');
  });

  it('disables Save and prevents blur/Enter from submitting whitespace-only text', async () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    input.value = '   '; input.dispatchEvent(new Event('input'));
    fixture.detectChanges(); await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Title cannot be blank');
    input.dispatchEvent(new Event('blur'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(saved).not.toHaveBeenCalled();
  });

  it('accepts exactly the title limit, rejects programmatic overflow, and cancels without saving', () => {
    const component = fixture.componentInstance;
    component.draft.set('x'.repeat(TICKET_TITLE_MAX_LENGTH + 1)); component.save();
    expect(saved).not.toHaveBeenCalled();
    component.draft.set('x'.repeat(TICKET_TITLE_MAX_LENGTH)); component.save();
    expect(saved).toHaveBeenCalledOnce();
    saved.mockClear();
    component.draft.set('Unsaved');
    fixture.nativeElement.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(component.draft()).toBe('Saved title');
    expect(saved).not.toHaveBeenCalled();
  });
});
