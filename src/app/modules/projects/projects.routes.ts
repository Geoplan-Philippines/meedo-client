import { Routes } from '@angular/router';
import { Projects } from './projects';
import { ProjectDetail } from './project-detail/project-detail';
import { Tickets } from '../tickets/tickets';

export const projectsRoutes: Routes = [
  {
    path: '',
    component: Projects,
  },
  {
    // Named `projectId` (not `id`) so component input binding feeds it straight
    // into the Tasks tab's `projectId` input.
    path: ':projectId',
    component: ProjectDetail,
    children: [
      // Tasks is the project's default tab, the way Linear opens on Issues.
      { path: '', redirectTo: 'tasks', pathMatch: 'full' },
      { path: 'tasks', component: Tickets },
    ],
  },
];
