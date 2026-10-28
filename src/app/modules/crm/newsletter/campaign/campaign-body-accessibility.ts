import { AfterViewInit, Directive, ElementRef, effect, inject, input, Renderer2, signal } from '@angular/core';

/** Label the existing editor's actual editable element without changing shared UI. */
@Directive({ selector: 'app-rich-text-editor[campaignBodyAccessibility]' })
export class CampaignBodyAccessibility implements AfterViewInit {
  readonly invalid = input(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly ready = signal(false);
  constructor() {
    effect(() => {
      if (!this.ready()) return;
      const editor = this.host.nativeElement.querySelector('[contenteditable]');
      if (!editor) return;
      for (const [name, value] of Object.entries({ role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Campaign body', 'aria-describedby': 'body-feedback', 'aria-invalid': String(this.invalid()) })) {
        this.renderer.setAttribute(editor, name, value);
      }
    });
  }
  ngAfterViewInit() { this.ready.set(true); }
}
