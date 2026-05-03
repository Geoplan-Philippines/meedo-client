import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { LayoutService } from '../layout.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ButtonModule, AvatarModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  layoutService = inject(LayoutService);
}
