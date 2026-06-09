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

export interface PaginatedProjects {
  data: Omit<Project, 'displayName'>[];
  meta: {
    total: number;
    limit: number;
    page: number;
    lastPage: number;
  };
}
