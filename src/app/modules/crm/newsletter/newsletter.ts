import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-newsletter',
  imports: [RouterLink],
  templateUrl: './newsletter.html',
  styleUrl: './newsletter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Newsletter {

}
