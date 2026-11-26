import { Routes } from '@angular/router';

// Pages sit directly under the layout; the sidebar's Website section is their only navigation.
export const crmRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'leads' },
  { path: 'leads', data: { preload: true }, loadComponent: () => import('./leads/leads').then(m => m.Leads) },
  { path: 'leads/new', loadComponent: () => import('./leads/lead-editor').then(m => m.LeadEditor) },
  { path: 'leads/:id', loadComponent: () => import('./leads/lead-editor').then(m => m.LeadEditor) },
  { path: 'newsletter', loadComponent: () => import('./newsletter/newsletter').then(m => m.Newsletter) },
  { path: 'newsletter/subscribers', data: { preload: true }, loadComponent: () => import('./newsletter/subscribers/subscribers').then(m => m.Subscribers) },
  { path: 'newsletter/subscribers/:id', loadComponent: () => import('./newsletter/subscribers/subscriber-editor').then(m => m.SubscriberEditor) },
  { path: 'newsletter/campaigns', data: { preload: true }, loadComponent: () => import('./newsletter/campaign/campaign-list').then(m => m.CampaignList) },
  { path: 'newsletter/campaigns/new', loadComponent: () => import('./newsletter/campaign/campaign-form').then(m => m.CampaignForm) },
  { path: 'newsletter/campaigns/:id', loadComponent: () => import('./newsletter/campaign/campaign-form').then(m => m.CampaignForm) },
  { path: 'developers', data: { preload: true }, loadComponent: () => import('./developers/developers').then(m => m.Developers) },
];
