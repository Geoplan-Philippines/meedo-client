import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

interface RecognizeResponse {
  statusCode: number;
  message: string;
  data: {
    matched: boolean;
    similarity: number;
    threshold: number;
  };
}

@Injectable({
  providedIn: 'root',
})

export class AttendanceService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:8000/api/v1/timekeeping/attendance';

  recognize(image: Blob) {
    const formData = new FormData();
    formData.append('image', image, 'capture.jpg');

    return this.http.post<RecognizeResponse>(`${this.apiUrl}/face/recognize`, formData);
  }
}
