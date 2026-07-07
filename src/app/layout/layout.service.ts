import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  sidebarOpen = signal<boolean>(false);
  sidebarCollapsed = signal<boolean>(false);

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  toggleSidebarCollapsed() {
    this.sidebarCollapsed.update(v => !v);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }
}
