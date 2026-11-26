import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment.dev';

@Component({
  selector: 'app-unsubscribe',
  templateUrl: './unsubscribe.html',
  styleUrl: './unsubscribe.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnsubscribePage {
  private readonly http = inject(HttpClient);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  readonly done = signal(false);

  constructor() {
    inject(Title).setTitle('Unsubscribed | Meedo');
    const url = `${environment.apiBaseUrl}/public/unsubscribe/${encodeURIComponent(this.token)}`;
    this.http.post(url, {}).subscribe({
      next: () => this.done.set(true),
      error: () => this.done.set(true),
    });
  }
}
