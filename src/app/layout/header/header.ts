import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { DialogModule } from 'primeng/dialog';
import { LayoutService } from '../layout.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-header',
  imports: [ButtonModule, AvatarModule, DialogModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  protected readonly layoutService = inject(LayoutService);
  protected readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  readonly isLogoutDialogOpen = signal(false);
  readonly isLoggingOut = signal(false);

  askLogout(): void {
    this.isLogoutDialogOpen.set(true);
  }

  cancelLogout(): void {
    if (this.isLoggingOut()) return;
    this.isLogoutDialogOpen.set(false);
  }

  async confirmLogout(): Promise<void> {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);

    try {
      await this.authService.logout();
    } catch (err) {
      console.error('[Header] Sign out request failed; clearing session anyway.', err);
    }

    await this.router.navigate(['/auth/login']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }
}
