import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';
import { ClientOption } from '../customers/models/client.model';
import { ClientsService } from '../customers/services/clients.service';

const PAGE_SIZE = 20;
type SearchResult = { options: ClientOption[]; lastPage: number; error: boolean };

@Component({
  selector: 'app-client-typeahead',
  template: `
    <div class="client-picker">
      <label [for]="inputId()">{{ label() }}</label>
      @if (selected(); as client) {
        <div class="selection"><span>{{ client.name }}</span><button type="button" (click)="clear()" [attr.aria-label]="'Clear '+label()">Clear</button></div>
      }
      <input [id]="inputId()" type="search" role="combobox" aria-autocomplete="list" [attr.aria-expanded]="open()" [attr.aria-controls]="inputId()+'-results'" [attr.placeholder]="placeholder()" [value]="query()" (input)="search($event)" (focus)="show()" (keydown.escape)="open.set(false)" autocomplete="off" />
      @if (open()) {
        <div class="results" [id]="inputId()+'-results'" role="listbox" [attr.aria-label]="label()+' results'">
          @if (loading()) { <p role="status">Loading clients...</p> }
          @else if (error()) { <p role="alert">Could not load clients. <button type="button" (click)="load(page())">Retry</button></p> }
          @else if (!options().length) { <p role="status">No matching clients.</p> }
          @else {
            @for (client of options(); track client.id) { <button type="button" role="option" [attr.aria-selected]="selected()?.id === client.id" (click)="choose(client)">{{ client.name }}</button> }
            <div class="pages"><button type="button" [disabled]="page() <= 1" (click)="load(page()-1)">Previous</button><span>Page {{ page() }} of {{ lastPage() }}</span><button type="button" [disabled]="page() >= lastPage()" (click)="load(page()+1)">Next</button></div>
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
  private readonly requests = new Subject<{ page: number; search: string }>();
  readonly selected = signal<ClientOption | null>(null);
  readonly options = signal<ClientOption[]>([]); readonly query = signal('');
  readonly open = signal(false); readonly loading = signal(false); readonly error = signal(false);
  readonly page = signal(1); readonly lastPage = signal(0);

  constructor() {
    this.requests.pipe(
      tap(() => { this.loading.set(true); this.error.set(false); }),
      switchMap(({ page, search }) => this.api.list({ page, limit: PAGE_SIZE, search, includeArchived: this.includeArchived(), sortField: 'customerName', sortOrder: 'asc' }).pipe(
        map((response): SearchResult => ({ options: response.data, lastPage: response.meta.lastPage, error: false })),
        catchError(() => of<SearchResult>({ options: [], lastPage: 0, error: true })),
      )),
      takeUntilDestroyed(this.destroy),
    ).subscribe(result => { this.options.set(result.options); this.lastPage.set(result.lastPage); this.loading.set(false); this.error.set(result.error); });
    effect(() => {
      const id = this.value(); const current = this.current();
      if (!id) { this.selected.set(null); return; }
      if (this.selected()?.id === id) return;
      if (current?.id === id) { this.selected.set(current); return; }
      this.api.get(id).pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: client => this.selected.set(client), error: () => this.selected.set(null) });
    });
  }
  show() { this.open.set(true); this.load(1); }
  search(event: Event) { this.query.set((event.target as HTMLInputElement).value); this.open.set(true); this.load(1); }
  load(page: number) { this.page.set(page); this.requests.next({ page, search: this.query().trim() }); }
  choose(client: ClientOption) { this.selected.set(client); this.query.set(''); this.open.set(false); this.valueChange.emit(client); }
  clear() { this.selected.set(null); this.query.set(''); this.valueChange.emit(null); this.open.set(true); this.load(1); }
}
