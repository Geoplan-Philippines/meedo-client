import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { Editor, type ChainedCommands } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { NodeSelection } from '@tiptap/pm/state';
import { Markdown } from 'tiptap-markdown';

import { FileAttachment } from './attachment-node';

/** Result the host's upload handler must resolve with for one uploaded file. */
export interface UploadedAttachment {
  url: string;
  name: string;
  mimeType: string;
  bytes?: number | null;
  /** 'image' renders inline; anything else becomes a file chip. */
  resourceType?: string;
}

/** A file the host uploads on behalf of the editor. */
export type UploadHandler = (file: File) => Promise<UploadedAttachment>;

/** One in-flight (or failed) upload shown in the editor toolbar. */
interface UploadTask {
  id: number;
  name: string;
  status: 'uploading' | 'error';
  /** Kept so a failed upload can be retried. */
  file: File;
  at: number | null;
  message: string;
  retriable: boolean;
}

/** Client-side ceiling — mirrors the server's MAX_ATTACHMENT_BYTES. */
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** Pulls real File objects out of a clipboard/drag payload (via files or items). */
function extractFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  if (dt.files && dt.files.length) return Array.from(dt.files);
  // Some sources (e.g. a pasted screenshot) expose files only through items.
  return Array.from(dt.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file);
}

/** True when a drag payload carries files (not just selected text/html). */
function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes('Files');
}

/** One entry in the `/` block menu. `run` applies the block to the current line. */
interface SlashItem {
  id: string;
  label: string;
  hint: string;
  /** PrimeIcons class, e.g. `pi pi-list`. Ignored when `glyph` is set. */
  icon?: string;
  /** Short text badge shown instead of an icon (used for H1/H2/H3 and inline marks). */
  glyph?: string;
  /** Visual style applied to the glyph badge for inline mark items. */
  glyphFormat?: 'bold' | 'italic' | 'underline';
  /**
   * Inline marks (bold/italic/underline) don't clear block structure.
   * Set `true` to skip the `clearNodes()` call in `selectItem`.
   */
  inline?: boolean;
  keywords: string[];
  run: (chain: ChainedCommands) => ChainedCommands;
}

/**
 * Linear-style WYSIWYG markdown editor. Always editable — you type markdown and it
 * transforms live (`# ` heading, `- ` bullet, `[ ] ` checklist, `**bold**`, `> ` quote,
 * ``` code, `---` rule). Type `/` at the start of a line to pick a block from a menu
 * instead. Select text to get a floating Bold / Italic / Underline toolbar.
 *
 * When a host `upload` handler is supplied, the editor also accepts **attachments**:
 * paste, drag-and-drop, or the Attach button. Images render inline; other file types
 * become download chips. Reads/writes plain **markdown** and **autosaves**: it emits
 * `contentSave` shortly after you stop typing and on blur, so the host can PATCH
 * without a Save button.
 */
@Component({
  selector: 'app-markdown-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './markdown-editor.css',
  host: { class: 'md-editor' },
  template: `
    <div
      class="md-shell"
      [class.md-shell--drag]="dragActive()"
      (dragenter)="onDragEnter($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onShellDrop($event)"
    >
      <div #host class="md-host"></div>

      @if (dragActive()) {
        <div class="md-dropzone" aria-hidden="true">
          <i class="pi pi-paperclip" aria-hidden="true"></i>
          <span>Drop files to attach</span>
        </div>
      }

      @if (canAttach()) {
        <div class="md-toolbar">
          <button
            type="button"
            class="md-attach"
            (click)="triggerFilePicker()"
            [attr.aria-label]="'Attach files'"
          >
            <i class="pi pi-paperclip" aria-hidden="true"></i>
            <span>Attach</span>
          </button>
          <span class="md-toolbar-hint">or paste / drop a file</span>

          @if (uploads().length) {
            <ul class="md-uploads" aria-live="polite">
              @for (task of uploads(); track task.id) {
                <li class="md-upload" [class.md-upload--error]="task.status === 'error'">
                  @if (task.status === 'uploading') {
                    <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
                    <span class="md-upload__name">{{ task.name }}</span>
                    <span class="md-upload__state">Uploading…</span>
                  } @else {
                    <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
                    <span class="md-upload__name">{{ task.name }}</span>
                    <span class="md-upload__state">{{ task.message }}</span>
                    @if (task.retriable) {
                      <button type="button" class="md-upload__btn" (click)="retryUpload(task)">Retry</button>
                    }
                    <button
                      type="button"
                      class="md-upload__btn md-upload__btn--dismiss"
                      (click)="dismissUpload(task.id)"
                      aria-label="Dismiss"
                    >
                      <i class="pi pi-times" aria-hidden="true"></i>
                    </button>
                  }
                </li>
              }
            </ul>
          }
        </div>
      }

      <input
        #fileInput
        type="file"
        class="md-file-input"
        multiple
        (change)="onFilesSelected($event)"
      />
    </div>

    <!-- Portaled to <body> in ngAfterViewInit so the dialog/scroll container can't clip it. -->
    <div
      #slashMenu
      [id]="menuId"
      class="slash-menu"
      role="listbox"
      aria-label="Insert block"
      [hidden]="!slashOpen()"
      [style.left.px]="menuPos().left"
      [style.top.px]="menuPos().top"
      (mousedown)="$event.preventDefault()"
    >
      @for (item of filteredItems(); track item.id; let i = $index) {
        <button
          type="button"
          class="slash-item"
          role="option"
          [id]="optionId(item.id)"
          [attr.aria-selected]="i === activeIndex()"
          [class.is-active]="i === activeIndex()"
          (click)="selectItem(item)"
          (mouseenter)="activeIndex.set(i)"
        >
          <span class="slash-ic" aria-hidden="true">
            @if (item.glyph) {
              <span
                class="slash-glyph"
                [class.slash-glyph--bold]="item.glyphFormat === 'bold'"
                [class.slash-glyph--italic]="item.glyphFormat === 'italic'"
                [class.slash-glyph--underline]="item.glyphFormat === 'underline'"
              >{{ item.glyph }}</span>
            } @else {
              <i [class]="item.icon"></i>
            }
          </span>
          <span class="slash-text">
            <span class="slash-label">{{ item.label }}</span>
            <span class="slash-hint">{{ item.hint }}</span>
          </span>
        </button>
      }
    </div>

    <!-- Floating format bar — portaled to <body>. Appears on non-empty text selection. -->
    <div
      #formatBar
      class="fmt-bar"
      role="toolbar"
      aria-label="Text formatting"
      [hidden]="!formatBarOpen()"
      [style.left.px]="formatBarPos().left"
      [style.top.px]="formatBarPos().top"
      (mousedown)="$event.preventDefault()"
    >
      <button
        type="button"
        class="fmt-btn"
        [class.is-active]="isBold()"
        [attr.aria-pressed]="isBold()"
        aria-label="Bold"
        title="Bold (Ctrl+B)"
        (click)="applyBold()"
      ><strong aria-hidden="true">B</strong></button>
      <span class="fmt-sep" aria-hidden="true"></span>
      <button
        type="button"
        class="fmt-btn fmt-btn--italic"
        [class.is-active]="isItalic()"
        [attr.aria-pressed]="isItalic()"
        aria-label="Italic"
        title="Italic (Ctrl+I)"
        (click)="applyItalic()"
      ><em aria-hidden="true">I</em></button>
      <span class="fmt-sep" aria-hidden="true"></span>
      <button
        type="button"
        class="fmt-btn"
        [class.is-active]="isUnderline()"
        [attr.aria-pressed]="isUnderline()"
        aria-label="Underline"
        title="Underline (Ctrl+U)"
        (click)="applyUnderline()"
      ><span class="fmt-u-label" aria-hidden="true">U</span></button>
    </div>
  `,
})
export class MarkdownEditor implements AfterViewInit {
  /** Markdown source. Synced into the editor when it changes externally and the user isn't editing. */
  readonly value = input('');
  readonly placeholder = input('Write something…');
  readonly ariaLabel = input('');
  /**
   * Host-provided uploader. When set, the editor accepts pasted / dropped / picked
   * files: images render inline, other types become download chips. Left unset the
   * attach affordances hide and the editor behaves exactly as before.
   */
  readonly upload = input<UploadHandler | null>(null);
  /** Emits the current markdown a beat after typing stops, and immediately on blur. */
  readonly contentSave = output<string>();

  private readonly hostEl = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly slashMenuEl = viewChild.required<ElementRef<HTMLElement>>('slashMenu');
  private readonly formatBarEl = viewChild.required<ElementRef<HTMLElement>>('formatBar');
  private readonly fileInputEl = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly destroyRef = inject(DestroyRef);

  // ─── Attachments ────────────────────────────────────────
  protected readonly canAttach = computed(() => !!this.upload());
  protected readonly dragActive = signal(false);
  protected readonly uploads = signal<UploadTask[]>([]);
  /** dragenter/leave fire per child element; counting keeps the overlay from flickering. */
  private dragDepth = 0;
  private nextUploadId = 0;

  private editor: Editor | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** The last markdown the editor has reconciled with (emitted or received). */
  private lastKnownValue = '';

  /** Cmd on macOS, Ctrl elsewhere — the modifier that opens a link on click. */
  private readonly isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  /** Hover title on links, teaching the modifier-click affordance. */
  private readonly openLinkHint = `${this.isMac ? '⌘' : 'Ctrl'} + click to open link`;

  // ─── Slash command menu ─────────────────────────────────
  private static nextId = 0;
  /** Unique per instance so multiple editors on a page don't share ARIA ids. */
  protected readonly menuId = `md-slash-${MarkdownEditor.nextId++}`;

  protected readonly slashOpen = signal(false);
  protected readonly slashQuery = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly menuPos = signal<{ left: number; top: number }>({ left: 0, top: 0 });

  /** Doc range covering the `/` and its query text, replaced when an item is chosen. */
  private slashRange: { from: number; to: number } | null = null;

  // ─── Floating format bar ─────────────────────────────────
  protected readonly formatBarOpen = signal(false);
  protected readonly formatBarPos = signal<{ left: number; top: number }>({ left: 0, top: 0 });
  protected readonly isBold = signal(false);
  protected readonly isItalic = signal(false);
  protected readonly isUnderline = signal(false);

  protected readonly slashItems: SlashItem[] = [
    { id: 'text', label: 'Text', hint: 'Plain paragraph', icon: 'pi pi-align-left',
      keywords: ['text', 'paragraph', 'body', 'plain'], run: (c) => c.setParagraph() },
    { id: 'bold', label: 'Bold', hint: 'Make text bold · Ctrl+B', glyph: 'B',
      glyphFormat: 'bold', inline: true,
      keywords: ['bold', 'strong', 'b'], run: (c) => c.toggleBold() },
    { id: 'italic', label: 'Italic', hint: 'Italicize text · Ctrl+I', glyph: 'I',
      glyphFormat: 'italic', inline: true,
      keywords: ['italic', 'emphasis', 'em', 'i'], run: (c) => c.toggleItalic() },
    { id: 'underline', label: 'Underline', hint: 'Underline text · Ctrl+U', glyph: 'U',
      glyphFormat: 'underline', inline: true,
      keywords: ['underline', 'u'], run: (c) => c.toggleUnderline() },
    { id: 'h1', label: 'Heading 1', hint: 'Large section heading', glyph: 'H1',
      keywords: ['heading', 'title', 'h1', 'big'], run: (c) => c.setHeading({ level: 1 }) },
    { id: 'h2', label: 'Heading 2', hint: 'Medium section heading', glyph: 'H2',
      keywords: ['heading', 'subtitle', 'h2'], run: (c) => c.setHeading({ level: 2 }) },
    { id: 'h3', label: 'Heading 3', hint: 'Small section heading', glyph: 'H3',
      keywords: ['heading', 'h3', 'subheading'], run: (c) => c.setHeading({ level: 3 }) },
    { id: 'bullet', label: 'Bulleted list', hint: 'Simple bulleted list', icon: 'pi pi-list',
      keywords: ['bullet', 'unordered', 'list', 'ul'], run: (c) => c.toggleBulletList() },
    { id: 'ordered', label: 'Numbered list', hint: 'Ordered list with numbers', icon: 'pi pi-sort-numeric-down',
      keywords: ['numbered', 'ordered', 'list', 'ol'], run: (c) => c.toggleOrderedList() },
    { id: 'task', label: 'To-do list', hint: 'Checklist with checkboxes', icon: 'pi pi-check-square',
      keywords: ['todo', 'task', 'checklist', 'checkbox'], run: (c) => c.toggleTaskList() },
    { id: 'quote', label: 'Quote', hint: 'Capture a quotation', icon: 'pi pi-comment',
      keywords: ['quote', 'blockquote', 'citation'], run: (c) => c.toggleBlockquote() },
    { id: 'code', label: 'Code block', hint: 'Formatted code snippet', icon: 'pi pi-code',
      keywords: ['code', 'snippet', 'pre', 'fenced'], run: (c) => c.toggleCodeBlock() },
    { id: 'divider', label: 'Divider', hint: 'Visual separator', icon: 'pi pi-minus',
      keywords: ['divider', 'rule', 'separator', 'hr'], run: (c) => c.setHorizontalRule() },
  ];

  protected readonly filteredItems = computed(() => {
    const q = this.slashQuery().trim().toLowerCase();
    if (!q) return this.slashItems;
    return this.slashItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q)),
    );
  });

  protected optionId(itemId: string): string {
    return `${this.menuId}-${itemId}`;
  }

  constructor() {
    effect(() => {
      const next = this.value();
      const editor = this.editor;
      if (!editor) return;
      if (next === this.lastKnownValue) return;
      this.lastKnownValue = next;
      if (!editor.isFocused) {
        editor.commands.setContent(next, { emitUpdate: false });
      }
    });

    effect(() => {
      const dom = this.editor?.view.dom;
      if (!dom) return;
      const open = this.slashOpen();
      dom.setAttribute('aria-expanded', String(open));
      const active = open ? this.filteredItems()[this.activeIndex()] : undefined;
      if (active) dom.setAttribute('aria-activedescendant', this.optionId(active.id));
      else dom.removeAttribute('aria-activedescendant');
    });

    this.destroyRef.onDestroy(() => {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.detachViewportListeners();
      this.detachFormatListeners();
      this.slashMenuEl().nativeElement.remove();
      this.formatBarEl().nativeElement.remove();
      this.editor?.destroy();
    });
  }

  ngAfterViewInit(): void {
    document.body.appendChild(this.slashMenuEl().nativeElement);
    document.body.appendChild(this.formatBarEl().nativeElement);

    this.editor = new Editor({
      element: this.hostEl().nativeElement,
      content: this.value(),
      editorProps: {
        attributes: {
          class: 'md-prose',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-haspopup': 'listbox',
          'aria-expanded': 'false',
          'aria-controls': this.menuId,
          ...(this.ariaLabel() ? { 'aria-label': this.ariaLabel() } : {}),
        },
        handleKeyDown: (_view, event) => this.onEditorKeyDown(event),
        handlePaste: (_view, event) => this.onEditorPaste(event),
        handleDrop: (view, event) => this.onEditorDrop(view, event as DragEvent),
        handleClick: (_view, _pos, event) => this.onEditorClickOpenLink(event),
      },
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          // Pasted/typed URLs autolink. openOnClick stays false because this editor is
          // ALWAYS editable — a plain click must place the caret to edit, not navigate.
          // Opening is a deliberate Ctrl/Cmd+click, handled in onEditorClickOpenLink.
          // rel/target harden the eventual external nav (no window.opener, no referrer/SEO leak).
          link: {
            openOnClick: false,
            autolink: true,
            defaultProtocol: 'https',
            HTMLAttributes: {
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
              title: this.openLinkHint,
            },
          },
        }),
        Underline,
        TaskList,
        TaskItem.configure({ nested: true }),
        Image.configure({ inline: false, allowBase64: false }),
        FileAttachment,
        Placeholder.configure({ placeholder: () => this.placeholder() }),
        Markdown.configure({
          // html: true lets raw HTML (e.g. <u>) survive the markdown round-trip — required
          // for underline. It also preserves ANY HTML pasted into the description, so this is
          // only XSS-safe while the SOLE render path is back through this TipTap schema
          // (ProseMirror drops nodes/marks not in the schema — <script>, onerror, etc.).
          // If description is ever rendered via a different markdown→HTML path (email digest,
          // PDF export, an [innerHTML] binding), sanitize (e.g. DOMPurify) at that boundary.
          html: true,
          tightLists: true,
          transformPastedText: true,
          transformCopiedText: true,
          // Re-link bare URLs stored in the saved markdown so they stay clickable
          // after a reload (autolinked URLs serialize back to plain text).
          linkify: true,
        }),
      ],
      onUpdate: () => {
        this.scheduleSave();
        this.updateSlashState();
        this.updateFormatBar();
      },
      onSelectionUpdate: () => {
        this.updateSlashState();
        this.updateFormatBar();
      },
      onBlur: () => {
        this.flushSave();
        this.closeSlash();
        this.closeFormatBar();
      },
    });
    this.lastKnownValue = this.value();
  }

  /**
   * The editor is always editable, so a plain click must place the caret to edit —
   * never navigate. Opening a link is a deliberate Ctrl/Cmd+click (same convention as
   * VS Code and note apps). Returns true only when it consumed the click to open.
   */
  private onEditorClickOpenLink(event: MouseEvent): boolean {
    if (!event.metaKey && !event.ctrlKey) return false;
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    const href = anchor?.getAttribute('href');
    // Attachment chips own their own click (download) — never open them as links.
    if (!anchor || !href || anchor.hasAttribute('data-file') || anchor.classList.contains('md-file__download')) {
      return false;
    }
    event.preventDefault();
    window.open(href, '_blank', 'noopener,noreferrer');
    return true;
  }

  // ─── Attachments ────────────────────────────────────────
  /** ProseMirror paste hook — intercepts pasted files (images and others). */
  private onEditorPaste(event: ClipboardEvent): boolean {
    if (!this.upload()) return false;
    const files = extractFiles(event.clipboardData);
    if (!files.length) return false;
    event.preventDefault();
    this.handleFiles(files, null);
    return true;
  }

  /** ProseMirror drop hook — uploads dropped files at the drop position. */
  private onEditorDrop(view: Editor['view'], event: DragEvent): boolean {
    if (!this.upload()) return false;
    const files = extractFiles(event.dataTransfer);
    if (!files.length) return false;
    event.preventDefault();
    this.resetDrag();
    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null;
    this.handleFiles(files, pos);
    return true;
  }

  protected onDragEnter(event: DragEvent): void {
    if (!this.canAttach() || !hasFiles(event)) return;
    event.preventDefault();
    this.dragDepth++;
    this.dragActive.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!this.canAttach() || !hasFiles(event)) return;
    // Required so the browser fires a drop event over the whole shell (toolbar included).
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onDragLeave(event: DragEvent): void {
    if (!this.canAttach()) return;
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dragActive.set(false);
  }

  /** Catches drops that land on the toolbar/padding (outside the editable). */
  protected onShellDrop(event: DragEvent): void {
    this.resetDrag();
    if (!this.canAttach()) return;
    // The editor's own handleDrop already claimed drops inside the text.
    if (event.defaultPrevented) return;
    const files = extractFiles(event.dataTransfer);
    if (!files.length) return;
    event.preventDefault();
    this.handleFiles(files, null);
  }

  protected triggerFilePicker(): void {
    this.fileInputEl().nativeElement.click();
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = ''; // let the same file be picked again later
    if (files.length) this.handleFiles(files, null);
  }

  protected retryUpload(task: UploadTask): void {
    this.removeTask(task.id);
    void this.uploadOne(task.file, task.at);
  }

  protected dismissUpload(id: number): void {
    this.removeTask(id);
  }

  private resetDrag(): void {
    this.dragDepth = 0;
    this.dragActive.set(false);
  }

  private handleFiles(files: File[], at: number | null): void {
    this.editor?.commands.focus();
    for (const file of files) void this.uploadOne(file, at);
  }

  private async uploadOne(file: File, at: number | null): Promise<void> {
    const handler = this.upload();
    if (!handler) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      this.addTask(file, at, 'error', {
        message: `Too large — ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB max`,
        retriable: false,
      });
      return;
    }

    const task = this.addTask(file, at, 'uploading');
    try {
      const result = await handler(file);
      this.insertAttachment(result, at);
      this.removeTask(task.id);
    } catch (err) {
      // Never swallow: an upload OR insert failure both surface here.
      console.error('Attachment failed:', err);
      this.setTaskError(task.id);
    }
  }

  private insertAttachment(att: UploadedAttachment, at: number | null): void {
    const editor = this.editor;
    if (!editor) return;

    // Decide from the browser mime type ONLY — never Cloudinary's resourceType,
    // which labels PDFs (and other docs) as 'image', producing a broken <img>.
    const isImage = (att.mimeType ?? '').startsWith('image/');
    const node = isImage
      ? { type: 'image', attrs: { src: att.url, alt: att.name, title: att.name } }
      : {
          type: 'fileAttachment',
          attrs: { href: att.url, name: att.name, size: att.bytes ?? null, mime: att.mimeType ?? null },
        };

    const pos = at != null ? Math.min(at, editor.state.doc.content.size) : null;
    try {
      const chain = editor.chain().focus();
      if (pos != null) chain.insertContentAt(pos, node);
      else chain.insertContent(node);
      // A trailing space after an inline chip keeps typing natural.
      if (!isImage) chain.insertContent(' ');
      chain.run();
    } catch (err) {
      // Graceful fallback: if the node insert ever fails, drop in a plain markdown
      // link so the uploaded file is never lost — it's still downloadable.
      console.error('Attachment node insert failed, falling back to link:', err);
      const link = `[${att.name}](${att.url}) `;
      const chain = editor.chain().focus();
      if (pos != null) chain.insertContentAt(pos, link);
      else chain.insertContent(link);
      chain.run();
    }
    this.scheduleSave();
  }

  private addTask(
    file: File,
    at: number | null,
    status: UploadTask['status'],
    opts?: { message?: string; retriable?: boolean },
  ): UploadTask {
    const task: UploadTask = {
      id: this.nextUploadId++,
      name: file.name,
      status,
      file,
      at,
      message: opts?.message ?? 'Upload failed.',
      retriable: opts?.retriable ?? true,
    };
    this.uploads.update((list) => [...list, task]);
    return task;
  }

  private removeTask(id: number): void {
    this.uploads.update((list) => list.filter((task) => task.id !== id));
  }

  private setTaskError(id: number): void {
    this.uploads.update((list) =>
      list.map((task) => (task.id === id ? { ...task, status: 'error' as const } : task)),
    );
  }

  // ─── Format bar ─────────────────────────────────────────
  protected applyBold(): void { this.editor?.chain().focus().toggleBold().run(); }
  protected applyItalic(): void { this.editor?.chain().focus().toggleItalic().run(); }
  protected applyUnderline(): void { this.editor?.chain().focus().toggleUnderline().run(); }

  private updateFormatBar(): void {
    const editor = this.editor;
    if (!editor) return;
    const { selection, doc } = editor.state;

    if (selection.empty) { this.closeFormatBar(); return; }
    // A NodeSelection (selected image / file chip) is non-empty but holds no
    // formattable text — never show the Bold/Italic/Underline bar over it.
    if (selection instanceof NodeSelection) { this.closeFormatBar(); return; }
    // Don't show inside code blocks — formatting doesn't apply there.
    if (selection.$from.parent.type.name === 'codeBlock') { this.closeFormatBar(); return; }
    // Don't show while the slash menu is open.
    if (this.slashOpen()) { this.closeFormatBar(); return; }

    this.isBold.set(editor.isActive('bold'));
    this.isItalic.set(editor.isActive('italic'));
    this.isUnderline.set(editor.isActive('underline'));

    if (!this.formatBarOpen()) {
      this.formatBarOpen.set(true);
      this.attachFormatListeners();
    }
    this.positionFormatBar();
  }

  private closeFormatBar(): void {
    if (!this.formatBarOpen()) return;
    this.formatBarOpen.set(false);
    this.detachFormatListeners();
  }

  private positionFormatBar(): void {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    this.applyFormatBarPos(rect, 116, 36);

    // Refine with real element dimensions once rendered.
    requestAnimationFrame(() => {
      if (!this.formatBarOpen()) return;
      const sel2 = window.getSelection();
      if (!sel2 || !sel2.rangeCount) return;
      const rect2 = sel2.getRangeAt(0).getBoundingClientRect();
      const el = this.formatBarEl().nativeElement;
      this.applyFormatBarPos(rect2, el.offsetWidth || 116, el.offsetHeight || 36);
    });
  }

  private applyFormatBarPos(selRect: DOMRect, barW: number, barH: number): void {
    const gap = 6;
    const margin = 8;
    let left = selRect.left + selRect.width / 2 - barW / 2;
    let top = selRect.top - barH - gap;
    left = Math.max(margin, Math.min(left, window.innerWidth - barW - margin));
    if (top < margin) top = selRect.bottom + gap;
    this.formatBarPos.set({ left: Math.round(left), top: Math.round(top) });
  }

  private readonly onFormatViewportChange = (): void => {
    if (this.formatBarOpen()) requestAnimationFrame(() => this.positionFormatBar());
  };

  private attachFormatListeners(): void {
    window.addEventListener('scroll', this.onFormatViewportChange, true);
    window.addEventListener('resize', this.onFormatViewportChange);
  }

  private detachFormatListeners(): void {
    window.removeEventListener('scroll', this.onFormatViewportChange, true);
    window.removeEventListener('resize', this.onFormatViewportChange);
  }

  // ─── Slash menu behaviour ───────────────────────────────
  /** Returns true when the key was consumed by the open menu. */
  private onEditorKeyDown(event: KeyboardEvent): boolean {
    if (!this.slashOpen()) return false;
    const items = this.filteredItems();
    if (!items.length) return false;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        this.activeIndex.set((this.activeIndex() + 1) % items.length);
        this.scrollActiveIntoView();
        return true;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        this.activeIndex.set((this.activeIndex() - 1 + items.length) % items.length);
        this.scrollActiveIntoView();
        return true;
      case 'Enter':
      case 'Tab':
        event.preventDefault();
        event.stopPropagation();
        this.selectItem(items[this.activeIndex()]);
        return true;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.closeSlash();
        return true;
      default:
        return false;
    }
  }

  /** Recompute whether a `/` block menu is active for the current caret position. */
  private updateSlashState(): void {
    const editor = this.editor;
    if (!editor) return;
    const { selection, doc } = editor.state;
    if (!selection.empty) return this.closeSlash();

    const { $from } = selection;
    if ($from.parent.type.name === 'codeBlock') return this.closeSlash();

    const cursor = $from.pos;
    const blockStart = $from.start();
    const textBefore = doc.textBetween(blockStart, cursor, '\n', '￼');
    const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBefore);
    if (!match) return this.closeSlash();

    const from = blockStart + match.index + match[0].indexOf('/');
    this.slashRange = { from, to: cursor };
    this.slashQuery.set(match[1]);

    if (!this.filteredItems().length) return this.closeSlash();
    if (this.activeIndex() >= this.filteredItems().length) this.activeIndex.set(0);

    if (!this.slashOpen()) {
      this.slashOpen.set(true);
      this.attachViewportListeners();
    }
    this.positionMenu(from);
  }

  protected selectItem(item: SlashItem): void {
    const editor = this.editor;
    const range = this.slashRange;
    if (!editor || !range) return;
    this.closeSlash();
    const base = editor.chain().focus().deleteRange(range);
    // Block items need clearNodes() to lift the cursor out of any wrapper (quote/list).
    // Inline marks must NOT call clearNodes() or they'd collapse the block structure.
    const chain = item.inline ? base : base.clearNodes();
    item.run(chain).run();
    this.scheduleSave();
  }

  private closeSlash(): void {
    if (!this.slashOpen()) return;
    this.slashOpen.set(false);
    this.slashQuery.set('');
    this.activeIndex.set(0);
    this.slashRange = null;
    this.detachViewportListeners();
  }

  private positionMenu(pos: number): void {
    const editor = this.editor;
    if (!editor) return;
    const coords = editor.view.coordsAtPos(pos);
    this.menuPos.set({ left: Math.round(coords.left), top: Math.round(coords.bottom + 6) });
    requestAnimationFrame(() => this.clampMenu(pos));
  }

  private clampMenu(pos: number): void {
    const editor = this.editor;
    if (!editor || !this.slashOpen()) return;
    const rect = this.slashMenuEl().nativeElement.getBoundingClientRect();
    const coords = editor.view.coordsAtPos(pos);
    const gap = 6;
    const margin = 8;

    let top = coords.bottom + gap;
    if (top + rect.height > window.innerHeight - margin) {
      const above = coords.top - rect.height - gap;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - rect.height - margin);
    }
    let left = coords.left;
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    this.menuPos.set({ left: Math.round(left), top: Math.round(top) });
  }

  private scrollActiveIntoView(): void {
    requestAnimationFrame(() => {
      const active = this.slashMenuEl().nativeElement.querySelector('.slash-item.is-active');
      active?.scrollIntoView({ block: 'nearest' });
    });
  }

  private readonly onViewportChange = (): void => {
    if (this.slashOpen() && this.slashRange) this.positionMenu(this.slashRange.from);
  };

  private attachViewportListeners(): void {
    window.addEventListener('scroll', this.onViewportChange, true);
    window.addEventListener('resize', this.onViewportChange);
  }

  private detachViewportListeners(): void {
    window.removeEventListener('scroll', this.onViewportChange, true);
    window.removeEventListener('resize', this.onViewportChange);
  }

  // ─── Autosave ───────────────────────────────────────────
  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.emitSave(), 900);
  }

  private flushSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.emitSave();
  }

  private emitSave(): void {
    const markdown = this.readMarkdown();
    this.lastKnownValue = markdown;
    this.contentSave.emit(markdown);
  }

  private readMarkdown(): string {
    const storage = this.editor?.storage as { markdown?: { getMarkdown(): string } } | undefined;
    return storage?.markdown?.getMarkdown() ?? '';
  }
}
