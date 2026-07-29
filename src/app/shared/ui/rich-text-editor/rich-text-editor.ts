import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  input,
  model,
  signal,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';

type BubbleMark = 'bold' | 'italic' | 'underline';

interface SlashMenuItem {
  label: string;
  description: string;
  icon: string;
}

const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  { label: 'Text', description: 'Plain paragraph', icon: '¶' },
  { label: 'Bold', description: 'Bold text', icon: 'B' },
  { label: 'Italic', description: 'Italic text', icon: 'I' },
  { label: 'Underline', description: 'Underlined text', icon: 'U' },
  { label: 'Bulleted list', description: 'Simple bullet list', icon: '•' },
  { label: 'Numbered list', description: 'Ordered list', icon: '1.' },
  { label: 'Heading 1', description: 'Large section heading', icon: 'H1' },
  { label: 'Heading 2', description: 'Medium section heading', icon: 'H2' },
  { label: 'Heading 3', description: 'Small section heading', icon: 'H3' },
  { label: 'Quote', description: 'Blockquote', icon: '❝' },
  { label: 'Code block', description: 'Fenced code block', icon: '</>' },
  { label: 'Divider', description: 'Horizontal rule', icon: '—' },
];

@Component({
  selector: 'app-rich-text-editor',
  imports: [CommonModule],
  templateUrl: './rich-text-editor.html',
  styleUrl: './rich-text-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextEditor implements AfterViewInit, OnDestroy {
  @ViewChild('editorHost', { static: true }) private editorHost!: ElementRef<HTMLDivElement>;
  @ViewChild('bubbleMenuHost', { static: true }) private bubbleMenuHost!: ElementRef<HTMLDivElement>;

  readonly content = model<string>('');
  readonly editable = input<boolean>(true);
  readonly placeholder = input<string>('Write something…');

  readonly menuOpen = signal(false);
  readonly menuQuery = signal('');
  readonly menuPosition = signal({ top: 0, left: 0 });
  readonly activeIndex = signal(0);
  readonly activeMarks = signal<Set<BubbleMark>>(new Set());
  
  readonly filteredItems = computed(() => {
    const query = this.menuQuery().trim().toLowerCase();
    const items = SLASH_MENU_ITEMS;
    return query ? items.filter((item) => item.label.toLowerCase().includes(query)) : items;
  });

  private editor: Editor | null = null;
  private slashPos: number | null = null;

  constructor() {
    effect(() => {
      const value = this.content();
      if (!this.editor) return;
      if (normalizeHtml(value) !== normalizeHtml(this.editor.getHTML())) {
        this.editor.commands.setContent(ensureContent(value), { emitUpdate: false });
      }
    });

    effect(() => {
      const editable = this.editable();
      this.editor?.setEditable(editable);
      if (!editable) this.closeMenu();
    });
  }

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.editorHost.nativeElement,
      extensions: [
        StarterKit.configure({ bulletList: false, orderedList: false, listItem: false }),
        BulletList,
        OrderedList,
        ListItem,
        BubbleMenu.configure({
          element: this.bubbleMenuHost.nativeElement,
          shouldShow: ({ editor, from, to }) => this.editable() && !editor.state.selection.empty && from !== to,
          options: { placement: 'top', offset: 8 },
        }),
      ],
      editable: this.editable(),
      content: ensureContent(this.content()),
      onUpdate: ({ editor }) => {
        this.content.set(normalizeHtml(editor.getHTML()));
        this.updateSlashMenu(editor);
        this.updateActiveMarks(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        this.updateSlashMenu(editor);
        this.updateActiveMarks(editor);
      },
      editorProps: {
        handleKeyDown: (_view, event) => this.handleKeyDown(event),
      },
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  selectItem(item: SlashMenuItem): void {
    if (!this.editor || this.slashPos == null) return;
    const { from } = this.editor.state.selection;
    const chain = this.editor.chain().focus().deleteRange({ from: this.slashPos, to: from });

    switch (item.label) {
      case 'Text':
        chain.setParagraph();
        break;
      case 'Bold':
        chain.toggleBold();
        break;
      case 'Italic':
        chain.toggleItalic();
        break;
      case 'Underline':
        chain.toggleUnderline();
        break;
      case 'Bulleted list':
        chain.toggleBulletList();
        break;
      case 'Numbered list':
        chain.toggleOrderedList();
        break;
      case 'Heading 1':
        chain.toggleHeading({ level: 1 });
        break;
      case 'Heading 2':
        chain.toggleHeading({ level: 2 });
        break;
      case 'Heading 3':
        chain.toggleHeading({ level: 3 });
        break;
      case 'Quote':
        chain.toggleBlockquote();
        break;
      case 'Code block':
        chain.toggleCodeBlock();
        break;
      case 'Divider':
        chain.setHorizontalRule();
        break;
    }

    chain.run();
    this.closeMenu();
  }

  toggleMark(mark: BubbleMark): void {
    if (!this.editor) return;
    const chain = this.editor.chain().focus();
    if (mark === 'bold') chain.toggleBold();
    else if (mark === 'italic') chain.toggleItalic();
    else chain.toggleUnderline();
    chain.run();
    this.updateActiveMarks(this.editor);
  }

  private updateActiveMarks(editor: Editor): void {
    const active = new Set<BubbleMark>();
    if (editor.isActive('bold')) active.add('bold');
    if (editor.isActive('italic')) active.add('italic');
    if (editor.isActive('underline')) active.add('underline');
    this.activeMarks.set(active);
  }

  private updateSlashMenu(editor: Editor): void {
    if (!this.editable()) {
      this.closeMenu();
      return;
    }
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 50), from, '\n', '\n');
    const match = /(?:^|\s)\/([a-zA-Z0-9 ]*)$/.exec(textBefore);

    if (!match) {
      this.closeMenu();
      return;
    }

    this.slashPos = from - match[1].length - 1;
    this.menuQuery.set(match[1]);
    this.activeIndex.set(0);

    const coords = editor.view.coordsAtPos(from);
    this.menuPosition.set({ top: Math.min(coords.bottom + 4, window.innerHeight - 240), left: Math.min(coords.left, window.innerWidth - 360) });
    this.menuOpen.set(true);
  }

  private closeMenu(): void {
    this.menuOpen.set(false);
    this.slashPos = null;
    this.menuQuery.set('');
  }

  private handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.menuOpen()) return false;
    const items = this.filteredItems();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.set((this.activeIndex() + 1) % Math.max(items.length, 1));
      return true;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set((this.activeIndex() - 1 + items.length) % Math.max(items.length, 1));
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      const item = items[this.activeIndex()];
      if (item) this.selectItem(item);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
      return true;
    }
    return false;
  }
}

function normalizeHtml(html: string): string {
  return html === '<p></p>' ? '' : html;
}

function ensureContent(html: string): string {
  return html && html.trim() ? html : '<p></p>';
}
