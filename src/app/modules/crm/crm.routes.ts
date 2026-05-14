import { Routes } from "@angular/router";
import { Newsletter } from "./newsletter/newsletter";
import { Subscribers } from "./newsletter/pages/subscribers/subscribers";
import { Leads } from "./leads/leads";

export const crmRoutes: Routes = [
  {
    path: 'leads',
    component: Leads,
  },
  {
    path: 'newsletter',
    component: Newsletter,
  },
  {
    path: 'newsletter/subscribers',
    component: Subscribers,
  }
]