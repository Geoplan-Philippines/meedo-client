import { Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { PrefetchService } from '../../core/prefetch/prefetch.service';
import { ROUTE_PREFETCHERS } from '../prefetch/route-prefetchers';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, Header],
  templateUrl: './main-layout.html',
})
export class MainLayout {
  constructor() {
    // Hovered links warm their screen's first requests while the app chrome is up.
    inject(DestroyRef).onDestroy(inject(PrefetchService).register(ROUTE_PREFETCHERS));
  }
}
