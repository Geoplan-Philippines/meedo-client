import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ClientsService } from '../customers/services/clients.service';
import { ClientTypeahead } from './client-typeahead';
import { PICKER_SEARCH_DEBOUNCE_MS } from '../../../shared/data/paged-search';

const pause = () => new Promise((resolve) => setTimeout(resolve, PICKER_SEARCH_DEBOUNCE_MS + 50));

describe('ClientTypeahead', () => {
  const client = { id: 'example-client', name: 'Example Client', customerName: 'Example Client', isArchived: false };
  const api = { options: vi.fn(), get: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    api.options.mockReturnValue(of({ data: [client], meta: { page: 1, limit: 20, total: 1, lastPage: 1 } }));
    api.get.mockReturnValue(of(client));
    TestBed.configureTestingModule({ imports: [ClientTypeahead], providers: [{ provide: ClientsService, useValue: api }] });
  });

  it('searches the lightweight picker rows server-side in pages of twenty and selects a result', async () => {
    const fixture = TestBed.createComponent(ClientTypeahead);
    const picker = fixture.componentInstance;
    const selected = vi.fn(); picker.valueChange.subscribe(selected);
    fixture.detectChanges(); picker.show(); await pause(); fixture.detectChanges();
    expect(api.options).toHaveBeenCalledWith({ page: 1, limit: 20, includeArchived: false });
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = ' Example '; input.dispatchEvent(new Event('input'));
    // Typing is debounced: one request after the pause, not one per keystroke.
    expect(api.options).toHaveBeenCalledTimes(1);
    await pause(); fixture.detectChanges();
    expect(api.options).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: 'Example', includeArchived: false });
    (fixture.nativeElement.querySelector('[role=option]') as HTMLButtonElement).click();
    expect(selected).toHaveBeenCalledWith(client);
  });

  it('appends the next page on "Show more"', async () => {
    api.options.mockReturnValueOnce(of({ data: [client], meta: { page: 1, limit: 20, total: 2, lastPage: 2 } }));
    const fixture = TestBed.createComponent(ClientTypeahead); fixture.detectChanges();
    fixture.componentInstance.show(); await pause();
    api.options.mockReturnValueOnce(of({ data: [{ ...client, id: 'second', name: 'Second' }], meta: { page: 2, limit: 20, total: 2, lastPage: 2 } }));
    fixture.componentInstance.results.loadMore(); await pause();
    expect(api.options).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(fixture.componentInstance.results.items().map((item) => item.id)).toEqual(['example-client', 'second']);
  });

  it('shows empty and error states', async () => {
    const fixture = TestBed.createComponent(ClientTypeahead); fixture.detectChanges();
    api.options.mockReturnValueOnce(of({ data: [], meta: { page: 1, limit: 20, total: 0, lastPage: 0 } }));
    fixture.componentInstance.show(); await pause(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No matching clients');
    api.options.mockReturnValueOnce(throwError(() => new Error('Invented failure')));
    fixture.componentInstance.results.refresh(); await pause(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
  });
});
