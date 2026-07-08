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
                projectId: payload.projectId,
                workDate: payload.workDate,
                hours: payload.hours,
                location: payload.location ?? 'OFC - DW',
                workType: payload.workType ?? 'OFFICE_DIRECT_WORK',
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

  it('adds a project row and a new entry from the entry modal', () => {
    component.openAddProjectModal();
    component.onAddProjectChange('project-1');
    component.confirmAddProject();

    expect(component.tableProjectIds()).toEqual(['project-1']);

    const day = component.weekDays()[0];
    component.openEntryCellModal('project-1', day);
    const modal = component.entryModal();
    if (modal) {
      modal.hours = 8;
      modal.task = 'Inspection';
    }
    component.closeEntryModal(true);

    expect(component.entries().length).toBe(1);
    expect(component.entries()[0].projectId).toBe('project-1');
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
    const modal = component.entryModal();
    if (modal) {
      modal.hours = 25;
      modal.task = 'Inspection';
    }
    component.closeEntryModal(true);

    expect(createCalls).toBe(0);
  });
});
