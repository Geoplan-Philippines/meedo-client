import { Routes } from '@angular/router';

/**
 * Client pages reuse Customers, Projects and Tickets:
 *   /clients                                        -> All Clients (Customers)
 *   /clients/:clientId                              -> Projects for one client
 *   /clients/:clientId/projects/:projectId           -> Project detail in the Projects screen
 *   /clients/:clientId/projects/:projectId/tickets  -> Tickets (list/board) for one project
 */
export const clientsRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('../settings/customers/customers').then((m) => m.Customers),
  },
  {
    path: ':clientId/projects',
    pathMatch: 'full',
    redirectTo: ':clientId',
  },
  {
    path: ':clientId',
    pathMatch: 'full',
    loadComponent: () => import('../settings/projects/projects').then((m) => m.Projects),
  },
  {
    path: ':clientId/projects/:projectId',
    pathMatch: 'full',
    loadComponent: () => import('../settings/projects/projects').then((m) => m.Projects),
  },
  {
    path: ':clientId/projects/:projectId/tickets',
    loadComponent: () => import('../tickets/tickets').then((m) => m.Tickets),
  },
];
