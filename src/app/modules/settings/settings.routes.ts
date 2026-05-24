import { Routes } from '@angular/router';
import { Settings } from './settings';
import { Teams } from './teams/teams';

export const settingsRoutes: Routes = [
  { 
    path: '', 
    component: Settings 
  },
  { 
    path: 'teams', 
    component: Teams 
  },
];
