import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { Target } from '../../core/models/target.model';
import { CheckLog, AlertHistoryItem } from '../../core/models/check-log.model';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-target-detail-modal',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  template: `
    @if (isOpen && target) {
      <div class="modal-backdrop" id="target-detail-backdrop" (click)="onBackdropClick($event)">
        <div class="modal-dialog modal-large glass-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-left">
              <app-status-badge
                [state]="target.current_state"
                [isActive]="target.is_active"
                [failures]="target.consecutive_failures"
                [threshold]="target.consecutive_failure_threshold"
              ></app-status-badge>
              <div>
                <h2 class="modal-title" id="target-detail-title">{{ target.name }}</h2>
                <div class="modal-subtitle-row">
                  <span class="protocol-tag">{{ target.protocol }}</span>
                  <span class="host-url font-mono">{{ target.host_or_url }}</span>
                  @if (target.port) {
                    <span class="port-tag font-mono">:{{ target.port }}</span>
                  }
                </div>
              </div>
            </div>
            <button type="button" class="btn-icon close-btn" id="btn-close-detail" (click)="closeModal()">
              ✕
            </button>
          </div>

          <!-- Quick Metrics Banner -->
          <div class="stats-banner">
            <div class="stat-card">
              <span class="stat-label">24h Uptime</span>
              <span class="stat-value" [class.text-success]="(target.uptime_percentage_24h ?? 100) >= 99">
                {{ target.uptime_percentage_24h ?? 100 }}%
              </span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Average Latency</span>
              <span class="stat-value">{{ target.avg_latency_24h_ms ?? 0 }} ms</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Check Frequency</span>
              <span class="stat-value">{{ target.interval_seconds }}s</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Failure Threshold</span>
              <span class="stat-value">{{ target.consecutive_failure_threshold }} consecutive</span>
            </div>
          </div>

          <!-- Tabs -->
          <div class="tabs-bar">
            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'logs'"
              (click)="activeTab.set('logs')"
              id="tab-btn-logs"
            >
              Recent Probe Logs
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'alerts'"
              (click)="activeTab.set('alerts')"
              id="tab-btn-alerts"
            >
              Incident & Recovery Alerts
            </button>
          </div>

          <div class="modal-body">
            @if (activeTab() === 'logs') {
              @if (loadingLogs()) {
                <div class="loading-state">Loading check logs...</div>
              } @else if (logs().length === 0) {
                <div class="empty-state">No check logs recorded yet for this target.</div>
              } @else {
                <table class="data-table font-mono" id="target-logs-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Checked At</th>
                      <th>Latency</th>
                      <th>Status Code / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (log of logs(); track log.id) {
                      <tr [class.row-failed]="!log.is_success">
                        <td>
                          <span class="mini-pill" [class.success]="log.is_success" [class.fail]="!log.is_success">
                            {{ log.is_success ? 'PASS' : 'FAIL' }}
                          </span>
                        </td>
                        <td>{{ formatTime(log.checked_at) }}</td>
                        <td>{{ log.response_time_ms }} ms</td>
                        <td>
                          @if (log.status_code) {
                            <span class="code-pill">HTTP {{ log.status_code }}</span>
                          }
                          @if (log.error_message) {
                            <span class="error-text">{{ log.error_message }}</span>
                          }
                          @if (!log.status_code && !log.error_message) {
                            <span class="text-muted">—</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            } @else {
              <!-- Alerts Tab -->
              @if (loadingAlerts()) {
                <div class="loading-state">Loading alert history...</div>
              } @else if (alerts().length === 0) {
                <div class="empty-state">No incident or recovery notifications triggered for this target.</div>
              } @else {
                <table class="data-table font-mono" id="target-alerts-table">
                  <thead>
                    <tr>
                      <th>Alert Type</th>
                      <th>Triggered At</th>
                      <th>Recipient</th>
                      <th>Delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of alerts(); track a.id) {
                      <tr>
                        <td>
                          <span class="mini-pill" [class.fail]="a.alert_type === 'DOWN'" [class.success]="a.alert_type === 'RECOVERED'">
                            {{ a.alert_type }}
                          </span>
                        </td>
                        <td>{{ formatTime(a.triggered_at) }}</td>
                        <td>{{ a.recipient }}</td>
                        <td>
                          @if (a.is_delivered) {
                            <span class="text-success">Sent via SMTP</span>
                          } @else {
                            <span class="text-danger" [attr.title]="a.delivery_error">Failed</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-large {
      max-width: 780px;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .modal-title {
      font-size: 18px;
      font-weight: 700;
    }
    .modal-subtitle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      font-size: 12px;
    }
    .protocol-tag {
      background: rgba(99, 102, 241, 0.2);
      color: #a5b4fc;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 10px;
    }
    .host-url {
      color: var(--text-secondary);
      max-width: 420px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .port-tag {
      color: var(--text-muted);
    }
    .stats-banner {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      padding: 16px 24px;
      background: rgba(0, 0, 0, 0.25);
      border-bottom: 1px solid var(--border-subtle);
    }
    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .stat-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .text-success { color: #34d399; }
    .text-danger { color: #f87171; }
    .tabs-bar {
      display: flex;
      gap: 24px;
      padding: 0 24px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-secondary);
      padding: 12px 4px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    .modal-body {
      padding: 16px 24px 24px;
      max-height: 400px;
      overflow-y: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .data-table th {
      text-align: left;
      padding: 8px 12px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      font-weight: 600;
      font-size: 11px;
    }
    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text-secondary);
    }
    .row-failed td {
      background: rgba(239, 68, 68, 0.04);
    }
    .mini-pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
    }
    .mini-pill.success {
      background: var(--success-bg);
      color: #34d399;
    }
    .mini-pill.fail {
      background: var(--danger-bg);
      color: #f87171;
    }
    .code-pill {
      background: rgba(255, 255, 255, 0.08);
      padding: 1px 6px;
      border-radius: 4px;
      color: var(--text-primary);
      margin-right: 6px;
    }
    .error-text {
      color: #f87171;
    }
    .loading-state, .empty-state {
      text-align: center;
      padding: 32px;
      color: var(--text-muted);
      font-size: 13px;
    }
  `]
})
export class TargetDetailModalComponent implements OnChanges {
  private readonly api = inject(ApiService);

  @Input() isOpen = false;
  @Input() target: Target | null = null;
  @Output() close = new EventEmitter<void>();

  readonly activeTab = signal<'logs' | 'alerts'>('logs');
  readonly logs = signal<CheckLog[]>([]);
  readonly alerts = signal<AlertHistoryItem[]>([]);
  readonly loadingLogs = signal<boolean>(false);
  readonly loadingAlerts = signal<boolean>(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.target) {
      this.loadLogs();
      this.loadAlerts();
    }
  }

  loadLogs(): void {
    if (!this.target) return;
    this.loadingLogs.set(true);
    this.api.getTargetLogs(this.target.id, 50).subscribe({
      next: (res) => {
        this.logs.set(res.logs);
        this.loadingLogs.set(false);
      },
      error: () => this.loadingLogs.set(false)
    });
  }

  loadAlerts(): void {
    if (!this.target) return;
    this.loadingAlerts.set(true);
    this.api.getTargetAlerts(this.target.id).subscribe({
      next: (res) => {
        this.alerts.set(res.alerts);
        this.loadingAlerts.set(false);
      },
      error: () => this.loadingAlerts.set(false)
    });
  }

  formatTime(isoStr: string): string {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleTimeString() + ' ' + d.toLocaleDateString();
  }

  onBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.close.emit();
  }
}
