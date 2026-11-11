import { Editor, Extension } from '@tiptap/core';
import { Node, Slice } from '@tiptap/pm/model';
import { EditorState, Plugin, Transaction } from '@tiptap/pm/state';

/** Measure the saved source, including syntax and attachment URLs, as well as the visible text. */
export function markdownSource(editor: Editor, doc: Node = editor.state.doc): string {
  const storage = editor.storage as unknown as { markdown: { serializer: { serialize(doc: Node): string } } };
  return storage.markdown.serializer.serialize(doc);
}

/** Preserve the document and formatting around the selection; trim only the incoming slice. */
export function fitPastedContent(state: EditorState, slice: Slice, limit: number, serialize: (doc: Node) => string): Transaction {
  let low = 0, high = slice.content.size, best = state.tr;
  while (low <= high) {
    const end = Math.floor((low + high) / 2);
    let content = slice.content.cut(0, end);
    let last = content.lastChild;
    while (last && !last.isText) last = last.lastChild;
    const finalUnit = last?.text?.charCodeAt(last.text.length - 1);
    // A UTF-16 limit must not leave half an emoji at the paste boundary.
    if (end > 0 && finalUnit !== undefined && finalUnit >= 0xd800 && finalUnit <= 0xdbff) {
      content = slice.content.cut(0, end - 1);
    }
    const prefix = end === slice.content.size ? slice : Slice.maxOpen(content);
    const candidate = state.tr.replaceSelection(prefix);
    if (serialize(candidate.doc).length <= limit) {
      best = candidate;
      low = end + 1;
    } else {
      high = end - 1;
    }
  }
  return best.scrollIntoView();
}

export function markdownLengthLimit(limit: () => number | null, blocked: () => void): Extension {
  return Extension.create({
    name: 'markdownLengthLimit',
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [new Plugin({
        filterTransaction(transaction, state) {
          const max = limit();
          if (!transaction.docChanged || max === null) return true;
          const nextLength = markdownSource(editor, transaction.doc).length;
          // Allow deleting from an already oversized legacy value so it can be corrected.
          if (nextLength <= max || nextLength < markdownSource(editor, state.doc).length) return true;
          blocked();
          return false;
        },
      })];
    },
  });
}
