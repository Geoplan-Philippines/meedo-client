import { PaginatedApiResponse } from '../../../shared/interface/paginated-response.interface';

export interface Project {
  id: string;
  apptivoId: string;
  workOrderNumber: string;
  customerName: string;
  displayName: string;
  status: string;
  total: number;
  reportedDate: string | null;
}

export type PaginatedProjects = PaginatedApiResponse<Omit<Project, 'displayName'>>;
