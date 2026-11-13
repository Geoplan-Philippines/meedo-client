import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClientOption } from '../customers/models/client.model';
import { ClientsService } from '../customers/services/clients.service';
import { pagedSearch } from '../../../shared/data/paged-search';

@Component({
  selector: 'app-client-typeahead',
  template: `
    <div class="client-picker">
      <label [for]="inputId()">{{ label() }}</label>
      @if (selected(); as client) {
        <div class="selection"><span>{{ client.name }}</span><button type="button" (click)="clear()" [attr.aria-label]="'Clear '+label()">Clear</button></div>
      }
      <input [id]="inputId()" type="search" role="combobox" aria-autocomplete="list" [attr.aria-expanded]="open()" [attr.aria-controls]="inputId()+'-results'" [attr.placeholder]="placeholder()" [value]="results.term()" (input)="search($event)" (focus)="show()" (keydown.escape)="open.set(false)" autocomplete="off" />
      @if (open()) {
        <div class="results" [id]="inputId()+'-results'" role="listbox" [attr.aria-label]="label()+' results'">
          @if (results.failed()) { <p role="alert">Could not load clients. <button type="button" (click)="results.refresh()">Retry</button></p> }
          @else if (!results.items().length) { <p role="status">{{ results.loading() ? 'Loading clients...' : 'No matching clients.' }}</p> }
          @else {
            @for (client of results.items(); track client.id) { <button type="button" role="option" [attr.aria-selected]="selected()?.id === client.id" (click)="choose(client)">{{ client.name }}</button> }
            <div class="pages"><span>{{ results.items().length }} of {{ results.total() }}</span>@if (results.hasMore()) { <button type="button" [disabled]="results.loading()" (click)="results.loadMore()">Show more</button> }</div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './client-typeahead.css', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientTypeahead {
  private static nextId = 0;
  readonly inputId = input('client-typeahead-' + ClientTypeahead.nextId++);
  readonly label = input('Client'); readonly placeholder = input('Search clients');
  readonly value = input<string | null>(null); readonly current = input<ClientOption | null>(null);
  readonly includeArchived = input(false);
  readonly valueChange = output<ClientOption | null>();
  private readonly api = inject(ClientsService);
  private readonly destroy = inject(DestroyRef);
  readonly selected = signal<ClientOption | null>(null);
  readonly open = signal(false);
  /** Server-side search over the lightweight picker rows. */
  readonly results = pagedSearch<ClientOption>({
    fetch: (query) => this.api.options({ ...query, includeArchived: this.includeArchived() }),
  });

  constructor() {
    effect(() => {
      const id = this.value(); const current = this.current();
      if (!id) { this.selected.set(null); return; }
      if (this.selected()?.id === id) return;
      if (current?.id === id) { this.selected.set(current); return; }
      this.api.get(id).pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: client => this.selected.set(client), error: () => this.selected.set(null) });
    });
  }
  show() { this.open.set(true); this.results.open(); }
  search(event: Event) { this.open.set(true); this.results.search((event.target as HTMLInputElement).value); }
  choose(client: ClientOption) { this.selected.set(client); this.results.search(''); this.open.set(false); this.valueChange.emit(client); }
  clear() { this.selected.set(null); this.valueChange.emit(null); this.open.set(true); this.results.search(''); }
}
