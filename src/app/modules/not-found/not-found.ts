import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-not-found',
  imports: [NgOptimizedImage, RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {
  private readonly title = inject(Title);

  constructor() {
    this.title.setTitle('Page not found | Meedo');
  }
}
