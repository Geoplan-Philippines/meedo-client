import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'app-theme';
const DARK_CLASS = 'app-dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly _theme = signal<Theme>(this.readStoredTheme());

  readonly theme = this._theme.asReadonly();
  readonly isDark = computed(() => this._theme() === 'dark');

  constructor() {
    // Keep the <html> class and localStorage in sync with the signal.
    effect(() => {
      const isDark = this._theme() === 'dark';
      this.document.documentElement.classList.toggle(DARK_CLASS, isDark);
      try {
        this.document.defaultView?.localStorage.setItem(STORAGE_KEY, this._theme());
      } catch {
        // Storage may be unavailable (private mode/SSR); ignore.
      }
    });
  }

  toggle(): void {
    this._theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }

  setTheme(theme: Theme): void {
    this._theme.set(theme);
  }

  /** Defaults to light unless the user previously chose dark (no system detection). */
  private readStoredTheme(): Theme {
    try {
      return this.document.defaultView?.localStorage.getItem(STORAGE_KEY) === 'dark'
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  }
}
