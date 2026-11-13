import { Routes } from '@angular/router';
export const notificationsRoutes: Routes = [{ path: '', data: { preload: true }, loadComponent: () => import('./notifications-page').then(m => m.NotificationsPage) }];
