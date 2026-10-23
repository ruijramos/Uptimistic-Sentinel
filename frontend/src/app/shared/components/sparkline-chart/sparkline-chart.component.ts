import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sparkline-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sparkline-container" [attr.title]="tooltipText()">
      @if (hasData()) {
        <svg [attr.viewBox]="viewBox()" class="sparkline-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="strokeColor()" stop-opacity="0.35" />
              <stop offset="100%" [attr.stop-color]="strokeColor()" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          <!-- Gradient Area Fill -->
          <polygon [attr.points]="areaPoints()" [attr.fill]="'url(#' + gradientId() + ')'" />

          <!-- Line Stroke -->
          <polyline
            [attr.points]="linePoints()"
            fill="none"
            [attr.stroke]="strokeColor()"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- Latest point indicator -->
          @if (latestPoint()) {
            <circle
              [attr.cx]="latestPoint()!.x"
              [attr.cy]="latestPoint()!.y"
              r="2.5"
              [attr.fill]="strokeColor()"
            />
          }
        </svg>
      } @else {
        <div class="empty-sparkline">
          <span class="no-data-text">No probe logs</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .sparkline-container {
      width: 110px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .sparkline-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .empty-sparkline {
      font-size: 10px;
      color: var(--text-muted);
      border-bottom: 1px dashed var(--border-subtle);
      width: 100%;
      text-align: center;
      padding-bottom: 2px;
    }
    .no-data-text {
      font-family: var(--font-mono);
      font-size: 10px;
    }
  `]
})
export class SparklineChartComponent {
  private readonly _data = signal<number[]>([]);
  private readonly _state = signal<string>('UP');

  @Input()
  set data(val: number[] | undefined | null) {
    this._data.set(val || []);
  }

  @Input()
  set state(val: string | undefined | null) {
    this._state.set(val || 'UP');
  }

  readonly width = 110;
  readonly height = 32;
  readonly padding = 3;

  readonly gradientId = computed(() => `spark-grad-${Math.random().toString(36).substring(2, 9)}`);

  readonly hasData = computed(() => this._data().length > 1);

  readonly strokeColor = computed(() => {
    const s = this._state();
    if (s === 'DOWN') return '#ef4444';
    if (s === 'PENDING_DOWN') return '#f59e0b';
    return '#10b981';
  });

  readonly viewBox = computed(() => `0 0 ${this.width} ${this.height}`);

  readonly coords = computed(() => {
    const vals = this._data();
    if (vals.length < 2) return [];

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;

    const usableWidth = this.width - this.padding * 2;
    const usableHeight = this.height - this.padding * 2;
    const step = usableWidth / (vals.length - 1);

    return vals.map((val, idx) => {
      const x = this.padding + idx * step;
      // Invert Y because SVG coordinate 0 is top
      const normalized = (val - min) / range;
      const y = this.height - this.padding - normalized * usableHeight;
      return { x, y, val };
    });
  });

  readonly linePoints = computed(() => {
    return this.coords().map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

  readonly areaPoints = computed(() => {
    const points = this.coords();
    if (!points.length) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const baseLine = this.height;
    return `${first.x.toFixed(1)},${baseLine} ${this.linePoints()} ${last.x.toFixed(1)},${baseLine}`;
  });

  readonly latestPoint = computed(() => {
    const pts = this.coords();
    return pts.length ? pts[pts.length - 1] : null;
  });

  readonly tooltipText = computed(() => {
    const pts = this._data();
    if (!pts.length) return 'No check history yet';
    const latest = pts[pts.length - 1];
    return `Latest latency: ${latest} ms (${pts.length} readings)`;
  });
}
