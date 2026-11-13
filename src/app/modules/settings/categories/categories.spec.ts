import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Categories } from './categories';
import { TicketCategoriesService } from '../../tickets/services/ticket-categories.service';
import { TicketCategory } from '../../tickets/models/ticket-categories.model';

const pageOf = (data: TicketCategory[]) => ({ data, meta: { total: data.length, page: 1, limit: 25, lastPage: 1 } });

const mockCategory: TicketCategory = {
  id: 'category-uuid-1',
  name: 'Hardware',
  description: 'Hardware tickets',
  organizationId: 'org-geo',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('Categories', () => {
  let component: Categories;
  let fixture: ComponentFixture<Categories>;
  let serviceMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    serviceMock = {
      list: vi.fn().mockReturnValue(of(pageOf([mockCategory]))),
      create: vi.fn().mockReturnValue(of(mockCategory)),
      update: vi.fn().mockReturnValue(of(mockCategory)),
      delete: vi.fn().mockReturnValue(of(mockCategory)),
    };

    await TestBed.configureTestingModule({
      imports: [Categories],
      providers: [
        provideRouter([]),
        { provide: TicketCategoriesService, useValue: serviceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Categories);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads one page of categories, A–Z by name', () => {
    expect(serviceMock.list).toHaveBeenCalledWith({ page: 1, limit: 25, sortField: 'name', sortOrder: 'asc' });
    expect(component.categories.rows()).toEqual([mockCategory]);
    expect(component.categories.total()).toBe(1);
  });

  it('shows an error when a load fails', async () => {
    serviceMock.list.mockReturnValue(throwError(() => new Error('network error')));
    component.load();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.categories.error()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Failed to load ticket categories. Please try again.');
    expect(component.categories.loading()).toBe(false);
  });

  it('does not call create when the form is invalid', () => {
    component.openCreate();
    component.form.controls.name.setValue('');
    component.save();
    expect(serviceMock.create).not.toHaveBeenCalled();
    expect(component.form.controls.name.touched).toBe(true);
  });

  it('creates a category and reloads the page from the server', async () => {
    const created: TicketCategory = { ...mockCategory, id: 'category-uuid-2', name: 'Software' };
    serviceMock.create.mockReturnValue(of(created));
    serviceMock.list.mockReturnValue(of(pageOf([mockCategory, created])));

    component.openCreate();
    component.form.setValue({ name: 'Software', description: '' });
    component.save();
    await fixture.whenStable();

    expect(serviceMock.create).toHaveBeenCalledWith({ name: 'Software', description: '' });
    expect(component.categories.rows()).toContain(created);
    expect(component.isDialogOpen()).toBe(false);
  });

  it('shows an error when create fails and keeps the dialog open', () => {
    serviceMock.create.mockReturnValue(throwError(() => new Error('boom')));

    component.openCreate();
    component.form.setValue({ name: 'Software', description: '' });
    component.save();

    expect(component.error()).toBe('Failed to create ticket category. Please try again.');
    expect(component.isDialogOpen()).toBe(true);
    expect(component.isSaving()).toBe(false);
  });

  it('updates a category in place', () => {
    const updated: TicketCategory = { ...mockCategory, name: 'Hardware (updated)' };
    serviceMock.update.mockReturnValue(of(updated));

    component.openEdit(mockCategory);
    component.form.controls.name.setValue('Hardware (updated)');
    component.save();

    expect(serviceMock.update).toHaveBeenCalledWith(mockCategory.id, {
      name: 'Hardware (updated)',
      description: mockCategory.description,
    });
    expect(component.categories.rows()[0]).toEqual(updated);
    expect(component.isDialogOpen()).toBe(false);
  });

  it('shows an error when update fails and keeps the dialog open', () => {
    serviceMock.update.mockReturnValue(throwError(() => new Error('boom')));

    component.openEdit(mockCategory);
    component.form.controls.name.setValue('Hardware (updated)');
    component.save();

    expect(component.error()).toBe('Failed to update ticket category. Please try again.');
    expect(component.isDialogOpen()).toBe(true);
  });

  it('clears the description when the field is emptied', () => {
    serviceMock.update.mockReturnValue(of({ ...mockCategory, description: '' }));

    component.openEdit(mockCategory);
    component.form.controls.description.setValue('');
    component.save();

    expect(serviceMock.update).toHaveBeenCalledWith(mockCategory.id, {
      name: mockCategory.name,
      description: '',
    });
  });

  it('removes a category after confirming delete', async () => {
    serviceMock.list.mockReturnValue(of(pageOf([])));
    component.askDelete(mockCategory);
    component.confirmDelete();
    await fixture.whenStable();

    expect(serviceMock.delete).toHaveBeenCalledWith(mockCategory.id);
    expect(component.categories.rows()).toEqual([]);
    expect(component.categoryToDelete()).toBeNull();
  });

  it('shows an error when delete fails and keeps the category in the list', () => {
    serviceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

    component.askDelete(mockCategory);
    component.confirmDelete();

    expect(component.error()).toBe('Failed to delete ticket category. Please try again.');
    expect(component.categories.rows()).toEqual([mockCategory]);
    expect(component.isDeleting()).toBe(false);
  });
});
