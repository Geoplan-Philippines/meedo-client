import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ToolbarModule } from 'primeng/toolbar';

/**
 * Shared frame for list pages: title, subtitle, primary action, optional tabs,
 * a toolbar (search, filters, view toggles) and the content below.
 *
 * Slots (attribute selectors on projected elements):
 * - `pageBreadcrumb`  above the title
 * - `pageMeta`        under the subtitle (status line, today's date, ...)
 * - `pageActions`     right of the title (primary action goes last)
 * - `pageSummary`     headline numbers (app-stat-strip) above the list
 * - `pageTabs`        a PrimeNG `p-tabs` tablist that filters the list
 * - `pageToolbar`     start of the PrimeNG Toolbar (search, filters)
 * - `pageToolbarEnd`  end of the PrimeNG Toolbar (view toggles, secondary actions)
 * - default           the list, board or other content
 *
 * Empty slots collapse, so a page only declares what it has.
 */
@Component({
  selector: 'app-page',
  imports: [ToolbarModule],
  templateUrl: './page-layout.html',
  styleUrl: './page-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-page' },
})
export class PageLayout {
  /** Page title, rendered as the page's only h1. */
  readonly heading = input.required<string>();
  readonly subtitle = input<string | null | undefined>();
}
