import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Categories } from './categories';
import { TicketCategoriesService } from '../../tickets/services/ticket-categories.service';
import { TicketCategory } from '../../tickets/models/ticket-categories.model';

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
      list: vi.fn().mockReturnValue(of([mockCategory])),
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
    await fixture.whenStable();
  });

  it('loads categories on init', () => {
    expect(component.categories()).toEqual([mockCategory]);
  });

  it('shows an error when the initial load fails', () => {
    serviceMock.list.mockReturnValue(throwError(() => new Error('network error')));
    component.load();
    expect(component.error()).toBe('Failed to load ticket categories. Please try again.');
    expect(component.isLoading()).toBe(false);
  });

  it('does not call create when the form is invalid', () => {
    component.openCreate();
    component.form.controls.name.setValue('');
    component.save();
    expect(serviceMock.create).not.toHaveBeenCalled();
    expect(component.form.controls.name.touched).toBe(true);
  });

  it('creates a category and appends it to the list', () => {
    const created: TicketCategory = { ...mockCategory, id: 'category-uuid-2', name: 'Software' };
    serviceMock.create.mockReturnValue(of(created));

    component.openCreate();
    component.form.setValue({ name: 'Software', description: '' });
    component.save();

    expect(serviceMock.create).toHaveBeenCalledWith({ name: 'Software', description: '' });
    expect(component.categories()).toContain(created);
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
    expect(component.categories()[0]).toEqual(updated);
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

  it('removes a category after confirming delete', () => {
    component.askDelete(mockCategory);
    component.confirmDelete();

    expect(serviceMock.delete).toHaveBeenCalledWith(mockCategory.id);
    expect(component.categories()).toEqual([]);
    expect(component.categoryToDelete()).toBeNull();
  });

  it('shows an error when delete fails and keeps the category in the list', () => {
    serviceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

    component.askDelete(mockCategory);
    component.confirmDelete();

    expect(component.error()).toBe('Failed to delete ticket category. Please try again.');
    expect(component.categories()).toEqual([mockCategory]);
    expect(component.isDeleting()).toBe(false);
  });
});
