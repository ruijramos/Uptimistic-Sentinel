import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TargetState } from '../../../core/models/target.model';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (!isActive) {
      <span class="status-pill paused">
        <span class="indicator-dot paused"></span>
        PAUSED
      </span>
    } @else if (state === 'UP') {
      <span class="status-pill up">
        <span class="indicator-dot up"></span>
        UP
      </span>
    } @else if (state === 'PENDING_DOWN') {
      <span class="status-pill pending_down" [attr.title]="'Debouncing: ' + failures + '/' + threshold + ' failures'">
        <span class="indicator-dot pending_down"></span>
        FAILING ({{ failures }}/{{ threshold }})
      </span>
    } @else if (state === 'DOWN') {
      <span class="status-pill down">
        <span class="indicator-dot down"></span>
        DOWN
      </span>
    }
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class StatusBadgeComponent {
  @Input() state: TargetState = 'UP';
  @Input() isActive: boolean = true;
  @Input() failures: number = 0;
  @Input() threshold: number = 3;
}
