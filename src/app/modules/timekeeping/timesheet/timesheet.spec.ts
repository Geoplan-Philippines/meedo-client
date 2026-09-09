import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { TimesheetEntry, TimesheetEntryPayload, TimesheetPeriodLock, TimesheetProject } from './models/timesheet.model';
import { Timesheet } from './timesheet';
import { TimesheetService } from './services/timesheet.service';

const emptyEntries: PaginatedApiResponse<TimesheetEntry> = {
  statusCode: 200,
  message: 'ok',
  data: [],
  meta: { total: 0, page: 1, limit: 50, lastPage: 1 },
};

const projects: TimesheetProject[] = [
  { id: 'project-1', customerName: 'Geoplan Internal Operations', workOrderNumber: 'WO-001', status: 'Open', displayName: 'Geoplan Internal Operations — WO-001' },
];

const unlocked: TimesheetPeriodLock = {
  id: null,
  organizationId: 'org-1',
  periodStart: '2026-06-22',
  periodEnd: '2026-06-28',
  isLocked: false,
  lockedAt: null,
  lockedByMemberId: null,
  lockedBy: null,
  unlockedAt: null,
  unlockedByMemberId: null,
  unlockedBy: null,
  unlockReason: null,
  createdAt: null,
  updatedAt: null,
};

describe('Timesheet', () => {
  let fixture: ComponentFixture<Timesheet>;
  let component: Timesheet;
  let createCalls: number;
  let entriesData: TimesheetEntry[];

  beforeEach(async () => {
    createCalls = 0;
    entriesData = [];

    await TestBed.configureTestingModule({
      imports: [Timesheet],
      providers: [
        {
          provide: TimesheetService,
          useValue: {
            getEntries: () => of({ ...emptyEntries, data: entriesData }),
            getProjects: () => of(projects),
            getPeriodLock: () => of(unlocked),
            createEntry: (payload: TimesheetEntryPayload) => {
              createCalls += 1;
              const entry = {
                id: 'entry-1',
                organizationId: 'org-1',
                userId: 'user-1',
                workOrderId: payload.workOrderId,
                workDate: payload.workDate,
                hours: payload.hours,
                location: payload.location ?? 'OFC - DW',
                workType: payload.workType ?? 'REGULAR',
                task: payload.task,
                isOvertime: payload.isOvertime ?? false,
                isNightDifferential: payload.isNightDifferential ?? false,
                status: 'DRAFT',
                createdAt: '2026-06-22T00:00:00.000Z',
                updatedAt: '2026-06-22T00:00:00.000Z',
              } satisfies TimesheetEntry;
              entriesData = [...entriesData, entry];
              return of(entry);
            },
            updateEntry: () => of({}),
            deleteEntry: () => of({}),
            submitWeek: () => of({ submittedCount: 1, entries: [] }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Timesheet);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders and loads project/tag options', () => {
    expect(component).toBeTruthy();
    expect(component.projects()[0].workOrderNumber).toBe('WO-001');
  });

  it('adds a project row and a new entry from the cell modal', () => {
    component.openAddProjectModal();
    component.onAddProjectChange('project-1');
    component.confirmAddProject();

    expect(component.tableProjectIds()).toEqual(['project-1']);

    const day = component.weekDays()[0];
    component.openEntryCellModal('project-1', day);
    const modal = component.cellModal();
    if (modal) {
      component.patchModalRow(modal.rows[0].localId, { hours: 8, task: 'Inspection' });
    }
    component.closeCellModal(true);

    expect(component.entries().length).toBe(1);
    expect(component.entries()[0].projectId).toBe('project-1');
  });

  it('adds a second task row to the same project/day cell without duplicating the first', () => {
    component.openAddProjectModal();
    component.onAddProjectChange('project-1');
    component.confirmAddProject();

    const day = component.weekDays()[0];
    component.openEntryCellModal('project-1', day);
    let modal = component.cellModal();
    if (modal) {
      component.patchModalRow(modal.rows[0].localId, { hours: 3, task: 'Site inspection' });
    }
    component.closeCellModal(true);

    expect(component.entries().length).toBe(1);
    expect(createCalls).toBe(1);

    component.openEntryCellModal('project-1', day);
    modal = component.cellModal();
    expect(modal?.rows.length).toBe(1);
    expect(modal?.rows[0].hours).toBe(3);

    component.addModalRow();
    modal = component.cellModal();
    expect(modal?.rows.length).toBe(2);
    if (modal) {
      component.patchModalRow(modal.rows[1].localId, { hours: 5, task: 'Report writing' });
    }
    component.closeCellModal(true);

    expect(createCalls).toBe(2);
    expect(component.entries().length).toBe(2);
    const cellEntries = component.entriesForCell('project-1', day);
    expect(component.cellHoursTotal(cellEntries)).toBe(8);
  });

  it('does not add a project row when the period is locked', () => {
    component.isLocked.set(true);
    component.openAddProjectModal();
    component.onAddProjectChange('project-1');
    component.confirmAddProject();

    expect(component.tableProjectIds()).toEqual([]);
  });

  it('shows validation by not saving invalid hours', () => {
    component.openAddProjectModal();
    component.onAddProjectChange('project-1');
    component.confirmAddProject();

    const day = component.weekDays()[0];
    component.openEntryCellModal('project-1', day);
    const modal = component.cellModal();
    if (modal) {
      component.patchModalRow(modal.rows[0].localId, { hours: 25, task: 'Inspection' });
    }
    component.closeCellModal(true);

    expect(createCalls).toBe(0);
  });
});
