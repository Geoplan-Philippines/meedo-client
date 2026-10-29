import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { PaginatedApiResponse } from '../../../../shared/interface/paginated-response.interface';
import { TimesheetApproval } from './timesheet-approval';
import { TimesheetAuditLog, TimesheetPeriodLock, TimesheetProject, TimesheetSummary } from '../models/timesheet.model';
import { TimesheetService } from '../services/timesheet.service';
import { manilaTodayKey } from '../entry-form/timesheet-entry-form';

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
          projectId: 'project-1',
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
  it.each([
    ['2026-10-27T15:59:59Z', '2026-10-27'],
    ['2026-10-27T16:00:00Z', '2026-10-28'],
  ])('selects the Manila calendar day near midnight at %s', (instant, day) => {
    expect(manilaTodayKey(new Date(instant))).toBe(day);
  });
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

  it('blocks individual and employee selections while locked', () => {
    const employee = summary.employees[0];
    component.periodLock.set({ ...lock, isLocked: true });

    component.toggleEntry(employee.entries[0], true);
    component.toggleEmployeeSubmitted(employee, true);

    expect(component.selectedCount()).toBe(0);
  });

  it('disables selection controls and retains the locked indication', async () => {
    const controls = () => Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(controls().length).toBe(2);
    expect(controls().every((control) => !control.disabled)).toBe(true);

    component.periodLock.set({ ...lock, isLocked: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(controls().every((control) => control.disabled)).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-label="Period is locked"]')).toBeTruthy();
  });

  it('clears existing selection and closes rejection when a lock arrives', async () => {
    component.toggleAllSubmitted(true);
    component.openRejectDialog();
    expect(component.selectedCount()).toBe(1);
    expect(component.showRejectDialog()).toBe(true);

    component.periodLock.set({ ...lock, isLocked: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedCount()).toBe(0);
    expect(component.showRejectDialog()).toBe(false);
  });

  it('does not dispatch bulk or employee decisions while locked, even with a stale selection', () => {
    const service = TestBed.inject(TimesheetService);
    const approve = vi.spyOn(service, 'bulkApprove');
    const reject = vi.spyOn(service, 'bulkReject');
    component.periodLock.set({ ...lock, isLocked: true });
    component.selectedEntryIds.set(new Set(['entry-1']));
    component.rejectReason.set('Correction');

    component.approveSelected();
    component.rejectSelected();
    component.approveEmployee(summary.employees[0]);
    component.rejectEmployee(summary.employees[0]);
    component.openRejectDialog();

    expect(approve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
    expect(component.showRejectDialog()).toBe(false);
  });

  it('permits individual and employee selection again after unlocking', async () => {
    component.periodLock.set({ ...lock, isLocked: true });
    fixture.detectChanges();
    await fixture.whenStable();
    component.periodLock.set(lock);
    fixture.detectChanges();
    await fixture.whenStable();

    component.toggleEntry(summary.employees[0].entries[0], true);
    expect(component.selectedCount()).toBe(1);
    component.toggleAllSubmitted(false);
    component.toggleEmployeeSubmitted(summary.employees[0], true);
    expect(component.selectedCount()).toBe(1);
  });

  it('uses the summary lock state when no period-lock response is available', () => {
    component.periodLock.set(null);
    component.summary.set({ ...summary, isLocked: true });

    component.toggleAllSubmitted(true);
    component.toggleEntry(summary.employees[0].entries[0], true);

    expect(component.selectedCount()).toBe(0);
  });
});
