import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Editor } from '@tiptap/core';
import { vi } from 'vitest';
import { TICKET_DESCRIPTION_MAX_LENGTH } from '../../../modules/tickets/tickets.constants';
import { MarkdownEditor } from './markdown-editor';
import { markdownSource } from './markdown-limit';

describe('MarkdownEditor length validation', () => {
  let fixture: ComponentFixture<MarkdownEditor>;
  let editor: Editor;
  const paste = () => new Event('paste', { cancelable: true }) as ClipboardEvent;
  async function mount(value: string, maxLength: number | null = TICKET_DESCRIPTION_MAX_LENGTH) {
    fixture = TestBed.createComponent(MarkdownEditor);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('maxLength', maxLength);
    fixture.componentRef.setInput('ariaLabel', 'Ticket description');
    fixture.detectChanges(); await fixture.whenStable();
    editor = (fixture.componentInstance as unknown as { editor: Editor }).editor;
  }

  it('truncates a large text paste, immediately updates the counter, and saves only bounded source', async () => {
    await mount('');
    const saved = vi.fn(); fixture.componentInstance.contentSave.subscribe(saved);
    const changed = vi.fn(); fixture.componentInstance.contentChange.subscribe(changed);
    editor.view.pasteText('x'.repeat(TICKET_DESCRIPTION_MAX_LENGTH + 100), paste());
    fixture.detectChanges();
    expect(markdownSource(editor).length).toBe(TICKET_DESCRIPTION_MAX_LENGTH);
    expect(fixture.nativeElement.textContent).toContain('5000 / 5000');
    expect(fixture.nativeElement.querySelector('.md-limit-notice').textContent).toContain('trimmed');
    expect(fixture.nativeElement.querySelector('.md-limit-notice').getAttribute('aria-live')).toBe('polite');
    expect(editor.view.dom.getAttribute('aria-describedby')).toContain('feedback');
    editor.view.dom.dispatchEvent(new FocusEvent('blur'));
    expect(changed).toHaveBeenLastCalledWith('x'.repeat(TICKET_DESCRIPTION_MAX_LENGTH));
    expect(saved).toHaveBeenLastCalledWith('x'.repeat(TICKET_DESCRIPTION_MAX_LENGTH));
  });

  it('counts serialized formatting and rejects overflow from typing, formatting and attachment insertion', async () => {
    await mount('x'.repeat(20), 20);
    editor.commands.setTextSelection(21);
    editor.commands.insertContent('extra');
    expect(markdownSource(editor)).toBe('x'.repeat(20));
    editor.commands.selectAll(); editor.commands.toggleBold();
    expect(markdownSource(editor)).toBe('x'.repeat(20));
    editor.commands.setTextSelection(21);
    editor.commands.insertContent({ type: 'image', attrs: { src: 'https://example.com/long-image-url.png' } });
    expect(markdownSource(editor)).toBe('x'.repeat(20));
  });

  it('trims only the pasted rich content, preserving existing prefix, suffix and formatting', async () => {
    await mount('**prefix** suffix', 40);
    editor.commands.setTextSelection(7);
    editor.view.pasteHTML('<p><em>' + 'y'.repeat(100) + '</em></p>', paste());
    const source = markdownSource(editor);
    expect(source.length).toBeLessThanOrEqual(40);
    expect(source).toContain('prefix');
    expect(source).toContain('suffix');
    expect(editor.getHTML()).toContain('<strong>');
    expect(editor.getHTML()).toContain('<em>');
    expect(source).toContain('y');
  });

  it('replaces selected text at the limit and permits undo and deletion', async () => {
    await mount('x'.repeat(20), 20);
    editor.commands.setTextSelection({ from: 1, to: 11 });
    editor.view.pasteText('y'.repeat(100), paste());
    expect(markdownSource(editor)).toBe('y'.repeat(10) + 'x'.repeat(10));
    editor.commands.undo();
    expect(markdownSource(editor)).toBe('x'.repeat(20));
    editor.commands.selectAll(); editor.commands.deleteSelection();
    expect(markdownSource(editor)).toBe('');
  });

  it('does not limit unconfigured shared-editor consumers', async () => {
    await mount('', null);
    editor.commands.insertContent('x'.repeat(TICKET_DESCRIPTION_MAX_LENGTH + 1));
    expect(markdownSource(editor).length).toBe(TICKET_DESCRIPTION_MAX_LENGTH + 1);
    expect(fixture.nativeElement.querySelector('app-input-feedback')).toBeNull();
  });

  it('does not split a pasted emoji at the character boundary', async () => {
    await mount('a', 20);
    editor.commands.setTextSelection(2);
    editor.view.pasteText('😀'.repeat(20), paste());
    expect(markdownSource(editor)).toBe('a' + '😀'.repeat(9));
  });
});
