import { Routes } from '@angular/router';

// Pages sit directly under the layout; the sidebar's Website section is their only navigation.
export const crmRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'leads' },
  { path: 'leads', loadComponent: () => import('./leads/leads').then(m => m.Leads) },
  { path: 'newsletter', loadComponent: () => import('./newsletter/newsletter').then(m => m.Newsletter) },
  { path: 'newsletter/subscribers', loadComponent: () => import('./newsletter/subscribers/subscribers').then(m => m.Subscribers) },
  { path: 'newsletter/campaigns', loadComponent: () => import('./newsletter/campaign/campaign-list').then(m => m.CampaignList) },
  { path: 'newsletter/campaigns/new', loadComponent: () => import('./newsletter/campaign/campaign-form').then(m => m.CampaignForm) },
  { path: 'newsletter/campaigns/:id', loadComponent: () => import('./newsletter/campaign/campaign-form').then(m => m.CampaignForm) },
];
