import { Pipe, PipeTransform } from '@angular/core';

/** One segment of linkified text: a URL to render as an anchor, or a plain run. */
export interface LinkifyPart {
  readonly text: string;
  /** Non-null when this segment is a URL — bind it to an anchor's href. */
  readonly href: string | null;
}

// http(s):// or a bare www. host, greedily up to the next whitespace or `<`.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<]+/gi;
// Punctuation that commonly trails a URL in prose and isn't part of it.
const TRAILING = new Set(['.', ',', ';', ':', '!', '?', ']', '}', "'", '"']);

/**
 * Trims trailing sentence punctuation off a matched URL, but keeps a closing
 * paren that balances one inside the URL (e.g. Wikipedia `..._(disambiguation)`).
 */
function splitTrailing(url: string): { url: string; trailing: string } {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (ch === ')') {
      const slice = url.slice(0, end);
      const opens = (slice.match(/\(/g) ?? []).length;
      const closes = (slice.match(/\)/g) ?? []).length;
      if (opens >= closes) break; // this ) belongs to the URL
      end--;
    } else if (TRAILING.has(ch)) {
      end--;
    } else {
      break;
    }
  }
  return { url: url.slice(0, end), trailing: url.slice(end) };
}

/**
 * Splits plain text into text/URL segments so URLs can render as safe anchors.
 * The caller must render each part via interpolation + an `[href]` binding, which
 * Angular escapes and URL-sanitizes — never via innerHTML.
 */
export function linkifyParts(input: string): LinkifyPart[] {
  const parts: LinkifyPart[] = [];
  if (!input) return parts;

  const matcher = new RegExp(URL_PATTERN); // own lastIndex, not the shared literal
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(input)) !== null) {
    const { url, trailing } = splitTrailing(match[0]);
    if (match.index > lastIndex) {
      parts.push({ text: input.slice(lastIndex, match.index), href: null });
    }
    parts.push({ text: url, href: url.toLowerCase().startsWith('www.') ? `https://${url}` : url });
    if (trailing) parts.push({ text: trailing, href: null });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    parts.push({ text: input.slice(lastIndex), href: null });
  }
  return parts;
}

/** Turns a plain string into linkified segments for clickable-URL rendering. */
@Pipe({ name: 'linkify' })
export class LinkifyPipe implements PipeTransform {
  transform(value: string | null | undefined): LinkifyPart[] {
    return linkifyParts(value ?? '');
  }
}
