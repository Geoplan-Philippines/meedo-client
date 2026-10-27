export type TimesheetEntryStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type TimesheetAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'LOCKED_PERIOD'
  | 'UNLOCKED_PERIOD'
  | 'EXPORTED';

export type TimesheetWorkType =
  | 'REGULAR'
  | 'REST_DAY'
  | 'LEAVE'
  | 'OFFSET';

export interface TimesheetProject {
  id: string;
  /** Shown name from the projects lookup (displayName, else quote subject, else WO number). */
  name?: string;
  /** Admin-set name (entry includes); null means the Apptivo name is shown. */
  displayName?: string | null;
  quoteSubject?: string | null;
  customerName?: string;
  workOrderNumber: string;
  status: string;
  reportedDate?: string | null;
  isArchived?: boolean;
  /** Picker text built by the client: "Client — Project name · WO number". */
  label?: string;
  client?: {
    customerName?: string;
    displayName?: string | null;
  } | null;
}

export interface TimesheetPerson {
  id: string;
  user?: {
    id: string;
    name?: string | null;
    email: string;
  };
}

export interface TimesheetUser {
  id: string;
  name?: string | null;
  email: string;
}

export interface TimesheetEntry {
  id: string;
  organizationId: string;
  userId: string;
  projectId: string;
  project?: TimesheetProject;
  user?: TimesheetUser;
  workDate: string;
  hours: number;
  location: string;
  workType: TimesheetWorkType;
  task: string;
  projectDescription?: string | null;
  isOvertime: boolean;
  isNightDifferential: boolean;
  status: TimesheetEntryStatus;
  submittedAt?: string | null;
  approvedAt?: string | null;
  approvedByMemberId?: string | null;
  approvedBy?: TimesheetPerson | null;
  rejectedAt?: string | null;
  rejectedByMemberId?: string | null;
  rejectedBy?: TimesheetPerson | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetEntryPayload {
  projectId: string;
  workDate: string;
  hours: number;
  location?: string;
  workType?: TimesheetWorkType;
  task: string;
  projectDescription?: string | null;
  isOvertime?: boolean;
  isNightDifferential?: boolean;
}

export interface TimesheetPeriodLock {
  id: string | null;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  isLocked: boolean;
  lockedAt: string | null;
  lockedByMemberId: string | null;
  lockedBy?: TimesheetPerson | null;
  unlockedAt: string | null;
  unlockedByMemberId: string | null;
  unlockedBy?: TimesheetPerson | null;
  unlockReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TimesheetAuditLog {
  id: string;
  organizationId: string;
  actorMemberId?: string | null;
  actor?: (TimesheetPerson & { role?: string }) | null;
  targetUserId?: string | null;
  targetUser?: TimesheetUser | null;
  timesheetEntryId?: string | null;
  action: TimesheetAuditAction;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

export interface SubmitWeekResult {
  submittedCount: number;
  entries: TimesheetEntry[];
}

export interface TimesheetSummaryEmployee {
  userId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  leaveHours: number;
  offsetHours: number;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  dailyTotals: Record<string, number>;
  projectTotals: Record<string, number>;
  entries: TimesheetEntry[];
}

export interface TimesheetSummary {
  periodStart: string;
  periodEnd: string;
  isLocked: boolean;
  totalEmployees: number;
  totalEntries: number;
  totalHours: number;
  totalsByStatus: Record<string, number>;
  employees: TimesheetSummaryEmployee[];
}

export interface TimesheetSummaryFilters {
  periodStart: string;
  periodEnd: string;
  employee?: string;
  projectId?: string;
  tag?: string;
  status?: TimesheetEntryStatus;
}

export interface BulkApproveResult {
  approvedCount: number;
  entries: TimesheetEntry[];
}

export interface BulkRejectResult {
  rejectedCount: number;
  entries: TimesheetEntry[];
}
