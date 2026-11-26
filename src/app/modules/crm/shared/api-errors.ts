import { HttpErrorResponse } from '@angular/common/http';

/** Nest validation messages, joined so the page can show every error at once. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const message = error.error?.message;
  if (Array.isArray(message)) return message.filter((item) => typeof item === 'string' && item.trim()).join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}
