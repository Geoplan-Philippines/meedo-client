import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment.dev';
import { PaginatedWorkOrders } from '../models/work-order.model';

@Injectable({ providedIn: 'root' })
export class WorkOrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/maintenance/work-orders`;

  getAll() {
    return this.http
      .get<PaginatedWorkOrders>(this.baseUrl, {
        params: { page: 1, limit: 50 },
        withCredentials: true,
      })
      .pipe(
        map(res =>
          res.data.map(workOrder => ({
            ...workOrder,
            displayName: `${workOrder.workOrderNumber} – ${workOrder.customerName}`,
          })),
        ),
      );
  }
}
