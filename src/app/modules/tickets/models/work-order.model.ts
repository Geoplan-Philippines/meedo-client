import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';

/** An Apptivo work order, synced into Meedo. Named `WorkOrder` (not `Project`) so it
 *  stays distinct from the Linear-style projects that tickets now live in. */
export interface WorkOrder {
  id: string;
  apptivoId: string;
  workOrderNumber: string;
  customerName: string;
  displayName: string;
  status: string;
  total: number;
  reportedDate: string | null;
  isArchived: boolean;
}

export type PaginatedWorkOrders = PaginatedApiResponse<Omit<WorkOrder, 'displayName'>>;
