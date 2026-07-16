import { Node, mergeAttributes } from '@tiptap/core';

/**
 * A URL that forces a download rather than opening in the tab. Cloudinary honours
 * the `fl_attachment` delivery flag (sets Content-Disposition: attachment); other
 * hosts fall back to the plain URL plus the anchor's `download` attribute.
 */
export function toDownloadUrl(url: string): string {
  if (/^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\//.test(url)) {
    return url.replace('/upload/', '/upload/fl_attachment/');
  }
  return url;
}

/** One uniform file icon for every attachment type (kept deliberately consistent). */
const FILE_ICON = 'pi pi-file';

/**
 * Inline, atomic node for a non-image attachment rendered as a compact, uniform
 * download chip (file icon · filename · download glyph, plus remove while editing).
 * The whole chip is a download link — Cloudinary's `fl_attachment` forces a save,
 * so it works even for files that can't be previewed inline. It serialises to an
 * inline HTML anchor (`<a data-file …>name</a>`) via tiptap-markdown's html
 * pass-through, so it round-trips through the stored markdown and re-parses back.
 */
export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (el) => el.getAttribute('href'),
        renderHTML: (attrs) => (attrs['href'] ? { href: attrs['href'] } : {}),
      },
      name: {
        default: 'file',
        parseHTML: (el) => el.getAttribute('data-name') || el.textContent || 'file',
        renderHTML: (attrs) => ({ 'data-name': attrs['name'] }),
      },
      size: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-size');
          return raw ? Number(raw) : null;
        },
        renderHTML: (attrs) => (attrs['size'] != null ? { 'data-size': String(attrs['size']) } : {}),
      },
      mime: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mime'),
        renderHTML: (attrs) => (attrs['mime'] ? { 'data-mime': attrs['mime'] } : {}),
      },
    };
  },

  parseHTML() {
    // Higher priority than the generic link mark so file anchors become chips.
    return [{ tag: 'a[data-file]', priority: 100 }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-file': 'true',
        class: 'md-file',
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
      node.attrs['name'],
    ];
  },

  addNodeView() {
    return ({ editor, node, getPos }) => {
      const name: string = node.attrs['name'] ?? 'file';
      const href: string = node.attrs['href'] ?? '';

      const dom = document.createElement('span');
      dom.className = 'md-file';
      dom.setAttribute('contenteditable', 'false');

      // The whole chip is a download link. No target=_blank: the fl_attachment URL
      // carries Content-Disposition: attachment, so the browser saves the file
      // without navigating the app away or leaving a blank tab.
      const download = document.createElement('a');
      download.className = 'md-file__download';
      download.href = toDownloadUrl(href);
      download.setAttribute('download', name);
      download.title = `Download ${name}`;
      download.setAttribute('aria-label', `Download ${name}`);

      const icon = document.createElement('i');
      icon.className = `md-file__icon ${FILE_ICON}`;
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'md-file__name';
      label.textContent = name;

      const dl = document.createElement('i');
      dl.className = 'md-file__dl pi pi-download';
      dl.setAttribute('aria-hidden', 'true');

      download.append(icon, label, dl);
      dom.append(download);

      // Remove only makes sense while editing.
      if (editor.isEditable) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'md-file__remove';
        remove.setAttribute('aria-label', `Remove attachment ${name}`);
        remove.title = 'Remove';
        remove.innerHTML = '<i class="pi pi-times" aria-hidden="true"></i>';
        remove.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const pos = getPos();
          if (typeof pos !== 'number' || !editor.isEditable) return;
          editor.view.dispatch(editor.view.state.tr.delete(pos, pos + node.nodeSize));
          editor.view.focus();
        });
        dom.append(remove);
      }

      return {
        dom,
        // Atom: no editable content, and PM must not read our DOM back into the doc.
        ignoreMutation: () => true,
        // Let clicks (download / remove) reach the DOM instead of PM's handlers.
        stopEvent: () => true,
      };
    };
  },
});
