import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';
import { TimesheetEntry, TimesheetPeriodLock, TimesheetProject } from './models/timesheet.model';
import { Timesheet } from './timesheet';
import { TimesheetService } from './services/timesheet.service';

const emptyEntries: PaginatedApiResponse<TimesheetEntry> = {
  statusCode: 200,
  message: 'ok',
  data: [],
  meta: { total: 0, page: 1, limit: 50, lastPage: 1 },
};

const projects: TimesheetProject[] = [
  { id: 'project-1', customerName: 'Geoplan Internal Operations', workOrderNumber: 'WO-001', status: 'Open' },
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

  beforeEach(async () => {
    createCalls = 0;

    await TestBed.configureTestingModule({
      imports: [Timesheet],
      providers: [
        {
          provide: TimesheetService,
          useValue: {
            getEntries: () => of(emptyEntries),
            getProjects: () => of(projects),
            getPeriodLock: () => of(unlocked),
            createEntry: () => {
              createCalls += 1;
              return of({
                id: 'entry-1',
                organizationId: 'org-1',
                userId: 'user-1',
                projectId: 'project-1',
                workDate: '2026-06-22',
                hours: 8,
                location: 'OFC - DW',
                workType: 'OFFICE_DIRECT_WORK',
                task: 'Inspection',
                isOvertime: false,
                isNightDifferential: false,
                status: 'DRAFT',
                createdAt: '2026-06-22T00:00:00.000Z',
                updatedAt: '2026-06-22T00:00:00.000Z',
              } satisfies TimesheetEntry);
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

  it('blocks adding rows when the period is locked', () => {
    component.isLocked.set(true);
    component.addRow();

    expect(component.rows().length).toBe(0);
  });

  it('shows validation by not saving invalid hours', () => {
    component.addRow();
    const row = component.rows()[0];
    row.projectId = 'project-1';
    row.task = 'Inspection';
    row.cells[0].hours = 25;
    row.cells[0].dirty = true;

    component.saveRow(row);

    expect(createCalls).toBe(0);
  });
});
