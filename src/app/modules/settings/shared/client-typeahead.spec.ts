import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ClientsService } from '../customers/services/clients.service';
import { ClientTypeahead } from './client-typeahead';

describe('ClientTypeahead', () => {
  const client = { id: 'example-client', name: 'Example Client', customerName: 'Example Client', isArchived: false };
  const api = { list: vi.fn(), get: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of({ data: [client], meta: { page: 1, limit: 20, total: 1, lastPage: 1 } }));
    api.get.mockReturnValue(of(client));
    TestBed.configureTestingModule({ imports: [ClientTypeahead], providers: [{ provide: ClientsService, useValue: api }] });
  });
  it('searches server-side in pages of twenty and selects a result', () => {
    const fixture = TestBed.createComponent(ClientTypeahead);
    const picker = fixture.componentInstance;
    const selected = vi.fn(); picker.valueChange.subscribe(selected);
    fixture.detectChanges(); picker.show(); fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20, search: '' }));
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = ' Example '; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 20, search: 'Example' }));
    (fixture.nativeElement.querySelector('[role=option]') as HTMLButtonElement).click();
    expect(selected).toHaveBeenCalledWith(client);
  });
  it('shows empty and error states', () => {
    const fixture = TestBed.createComponent(ClientTypeahead); fixture.detectChanges();
    api.list.mockReturnValueOnce(of({ data: [], meta: { page: 1, limit: 20, total: 0, lastPage: 0 } }));
    fixture.componentInstance.show(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No matching clients');
    api.list.mockReturnValueOnce(throwError(() => new Error('Invented failure')));
    fixture.componentInstance.load(1); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
  });
});
