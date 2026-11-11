import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { WebcamImage, WebcamModule } from 'ngx-webcam';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Observable, Subject } from 'rxjs';
import { AttendanceService } from './services/attendance.service';

interface RecognitionResult {
  matched: boolean;
  similarity: number;
  threshold: number;
}

@Component({
  selector: 'app-attendance',
  imports: [WebcamModule, Button, RouterLink],
  templateUrl: './attendance.html',
  styleUrl: './attendance.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class Attendance {
  private readonly attendanceService = inject(AttendanceService);

  private readonly trigger = new Subject<void>();
  readonly trigger$: Observable<void> = this.trigger.asObservable();

  readonly previewImage = signal<string | null>(null);
  readonly recognizing = signal(false);
  readonly result = signal<RecognitionResult | null>(null);
  readonly error = signal<string | null>(null);

  capture(): void {
    this.trigger.next();
  }

  handleImage(event: WebcamImage): void {
    this.previewImage.set(event.imageAsDataUrl);
    this.recognize(event.imageAsDataUrl);
  }

  private recognize(dataUrl: string): void {
    this.recognizing.set(true);
    this.result.set(null);
    this.error.set(null);

    const blob = this.dataUrlToBlob(dataUrl);

    this.attendanceService.recognize(blob).subscribe({
      next: (response) => {
        this.result.set(response.data);
        this.recognizing.set(false);
      },
      error: () => {
        this.error.set('Recognition failed. Try again.');
        this.recognizing.set(false);
      },
    });
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const [meta, base64] = dataUrl.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
  }
}
