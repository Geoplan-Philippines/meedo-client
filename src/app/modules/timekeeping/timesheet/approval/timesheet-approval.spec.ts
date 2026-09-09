import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { TimesheetApproval } from './timesheet-approval';
import { TimesheetAuditLog, TimesheetPeriodLock, TimesheetProject, TimesheetSummary } from '../models/timesheet.model';
import { TimesheetService } from '../services/timesheet.service';

const summary: TimesheetSummary = {
  periodStart: '2026-06-22',
  periodEnd: '2026-06-28',
  isLocked: false,
  totalEmployees: 1,
  totalEntries: 1,
  totalHours: 8,
  totalsByStatus: { SUBMITTED: 1 },
  employees: [
    {
      userId: 'user-1',
      employeeName: 'Timesheet Member',
      employeeEmail: 'member@geoplanph.com',
      department: 'Business Development Group',
      totalHours: 8,
      regularHours: 8,
      overtimeHours: 0,
      leaveHours: 0,
      offsetHours: 0,
      status: 'PENDING',
      dailyTotals: { '2026-06-22': 8 },
      projectTotals: { 'Geoplan Internal Operations — WO-001': 8 },
      entries: [
        {
          id: 'entry-1',
          organizationId: 'org-1',
          userId: 'user-1',
          workOrderId: 'work-order-1',
          workDate: '2026-06-22',
          hours: 8,
          location: 'OFC - DW',
          workType: 'REGULAR',
          task: 'Inspection',
          isOvertime: false,
          isNightDifferential: false,
          status: 'SUBMITTED',
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        },
      ],
    },
  ],
};

const lock: TimesheetPeriodLock = {
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

const projects: TimesheetProject[] = [
  { id: 'project-1', customerName: 'Geoplan Internal Operations', workOrderNumber: 'WO-001', status: 'Open' },
];

const auditLogs: PaginatedApiResponse<TimesheetAuditLog> = {
  statusCode: 200,
  message: 'ok',
  data: [],
  meta: { total: 0, page: 1, limit: 8, lastPage: 1 },
};

describe('TimesheetApproval', () => {
  let fixture: ComponentFixture<TimesheetApproval>;
  let component: TimesheetApproval;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimesheetApproval],
      providers: [
        {
          provide: TimesheetService,
          useValue: {
            getSummary: () => of(summary),
            getProjects: () => of(projects),
            getPeriodLock: () => of(lock),
            getAuditLogs: () => of(auditLogs),
            bulkApprove: () => of({ approvedCount: 1, entries: [] }),
            bulkReject: () => of({ rejectedCount: 1, entries: [] }),
            lockPeriod: () => of({ ...lock, isLocked: true }),
            unlockPeriod: () => of({ ...lock, isLocked: false, unlockReason: 'Correction window' }),
            exportTimesheet: () => of({ body: new Blob(), headers: new Headers() }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TimesheetApproval);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the approval summary', () => {
    expect(component).toBeTruthy();
    expect(component.employees().length).toBe(1);
    expect(component.employees()[0].status).toBe('PENDING');
  });

  it('selects submitted entries for approval when unlocked', () => {
    component.toggleAllSubmitted(true);

    expect(component.selectedCount()).toBe(1);
  });

  it('does not select submitted entries when the period is locked', () => {
    component.periodLock.set({ ...lock, isLocked: true });

    component.toggleAllSubmitted(true);

    expect(component.selectedCount()).toBe(0);
  });
});
