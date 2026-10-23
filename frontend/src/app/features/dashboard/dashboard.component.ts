import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TargetStateService } from '../../core/services/target-state.service';
import { Target } from '../../core/models/target.model';
import { SparklineChartComponent } from '../../shared/components/sparkline-chart/sparkline-chart.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { TargetFormComponent } from '../target-form/target-form.component';
import { SettingsModalComponent } from '../settings/settings-modal.component';
import { TargetDetailModalComponent } from '../target-detail/target-detail-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SparklineChartComponent,
    StatusBadgeComponent,
    TargetFormComponent,
    SettingsModalComponent,
    TargetDetailModalComponent
  ],
  template: `
    <div class="dashboard-layout">
      <!-- Top Navigation Bar -->
      <header class="top-nav glass-panel">
        <div class="nav-brand">
          <div class="brand-logo">
            <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="brand-svg">
              <defs>
                <linearGradient id="nav_bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#0F172A"/>
                  <stop offset="100%" stop-color="#020617"/>
                </linearGradient>
                <linearGradient id="nav_shield" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#6366F1"/>
                  <stop offset="60%" stop-color="#4F46E5"/>
                  <stop offset="100%" stop-color="#06B6D4"/>
                </linearGradient>
                <linearGradient id="nav_pulse" x1="12" y1="24" x2="36" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#06B6D4"/>
                  <stop offset="45%" stop-color="#10B981"/>
                  <stop offset="100%" stop-color="#34D399"/>
                </linearGradient>
              </defs>
              <rect width="48" height="48" rx="12" fill="url(#nav_bg)"/>
              <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" stroke="rgba(255, 255, 255, 0.14)" stroke-width="1.5"/>
              <path d="M24 7L38 12V22C38 30.5 32 37.5 24 41C16 37.5 10 30.5 10 22V12L24 7Z" 
                    fill="#6366F1" fill-opacity="0.1" 
                    stroke="url(#nav_shield)" stroke-width="2.5" stroke-linejoin="round"/>
              <path d="M12 24H18L21 28L24.5 14L28 33L30.5 24H36" 
                    stroke="url(#nav_pulse)" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="24.5" cy="14" r="2.2" fill="#34D399"/>
            </svg>
          </div>
          <div>
            <h1 class="brand-title">UPTIMISTIC SENTINEL</h1>
            <span class="brand-subtitle">Self-Hosted Infrastructure Monitor</span>
          </div>
        </div>

        <div class="nav-actions">
          <div class="sync-status">
            <span class="sync-dot"></span>
            <span>Live auto-poll</span>
          </div>

          <button
            type="button"
            class="btn btn-secondary"
            id="btn-open-settings"
            (click)="isSettingsModalOpen.set(true)"
          >
            ⚙ Settings
          </button>

          <button
            type="button"
            class="btn btn-primary"
            id="btn-open-add-target"
            (click)="openAddModal()"
          >
            + Add Target
          </button>
        </div>
      </header>

      <!-- Metric Cards Grid -->
      <section class="metrics-grid">
        <!-- Card 1: Total Monitored -->
        <div class="metric-card glass-panel" id="metric-total">
          <div class="metric-header">
            <span class="metric-label">Monitored Targets</span>
            <span class="metric-icon">🎯</span>
          </div>
          <div class="metric-body">
            <span class="metric-number">{{ state.totalCount() }}</span>
            <span class="metric-subtext">{{ state.pausedCount() }} paused</span>
          </div>
        </div>

        <!-- Card 2: Operational (UP) -->
        <div class="metric-card glass-panel card-up" id="metric-up">
          <div class="metric-header">
            <span class="metric-label">Operational (UP)</span>
            <span class="indicator-dot up"></span>
          </div>
          <div class="metric-body">
            <span class="metric-number text-success">{{ state.upCount() }}</span>
            <span class="metric-subtext">Healthy services</span>
          </div>
        </div>

        <!-- Card 3: Failing / Outages (DOWN) -->
        <div class="metric-card glass-panel card-down" id="metric-down">
          <div class="metric-header">
            <span class="metric-label">Outages & Debounce</span>
            <span class="indicator-dot down"></span>
          </div>
          <div class="metric-body">
            <span class="metric-number" [class.text-danger]="state.downCount() > 0" [class.text-muted]="state.downCount() === 0">
              {{ state.downCount() }}
            </span>
            <span class="metric-subtext">
              @if (state.pendingCount() > 0) {
                <span class="text-warning">{{ state.pendingCount() }} failing (debouncing)</span>
              } @else {
                Zero active alerts
              }
            </span>
          </div>
        </div>

        <!-- Card 4: 24h Average Uptime -->
        <div class="metric-card glass-panel" id="metric-uptime">
          <div class="metric-header">
            <span class="metric-label">24h Fleet Uptime</span>
            <span class="metric-icon">📊</span>
          </div>
          <div class="metric-body">
            <span class="metric-number text-success">{{ state.overallUptimePct() }}%</span>
            <span class="metric-subtext">Rolling 24-hour baseline</span>
          </div>
        </div>

        <!-- Card 5: Fleet Average Latency -->
        <div class="metric-card glass-panel" id="metric-latency">
          <div class="metric-header">
            <span class="metric-label">Average Latency</span>
            <span class="metric-icon">⚡</span>
          </div>
          <div class="metric-body">
            <span class="metric-number">{{ state.avgLatencyMs() }} <small class="unit">ms</small></span>
            <span class="metric-subtext">Across active endpoints</span>
          </div>
        </div>
      </section>

      <!-- Controls Toolbar -->
      <section class="toolbar-section">
        <!-- Filter Tabs -->
        <div class="filter-pills" id="filter-pills-bar">
          <button
            type="button"
            class="filter-pill"
            [class.active]="state.activeFilter() === 'ALL'"
            (click)="state.activeFilter.set('ALL')"
            id="filter-all"
          >
            All ({{ state.totalCount() }})
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="state.activeFilter() === 'UP'"
            (click)="state.activeFilter.set('UP')"
            id="filter-up"
          >
            Operational ({{ state.upCount() }})
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="state.activeFilter() === 'PENDING_DOWN'"
            (click)="state.activeFilter.set('PENDING_DOWN')"
            id="filter-pending"
          >
            Failing Debounce ({{ state.pendingCount() }})
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="state.activeFilter() === 'DOWN'"
            (click)="state.activeFilter.set('DOWN')"
            id="filter-down"
          >
            Down ({{ state.downCount() }})
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="state.activeFilter() === 'PAUSED'"
            (click)="state.activeFilter.set('PAUSED')"
            id="filter-paused"
          >
            Paused ({{ state.pausedCount() }})
          </button>
        </div>

        <!-- Search Input -->
        <div class="search-box">
          <input
            type="text"
            id="input-search-targets"
            class="form-input search-input"
            placeholder="Search by name, URL, or protocol..."
            [ngModel]="state.searchQuery()"
            (ngModelChange)="state.searchQuery.set($event)"
          />
        </div>
      </section>

      <!-- Targets Table -->
      <section class="table-section glass-panel">
        @if (state.loading() && state.targets().length === 0) {
          <div class="state-message" id="loading-spinner">
            <div class="spinner"></div>
            <span>Connecting to Sentinel probe worker...</span>
          </div>
        } @else if (state.filteredTargets().length === 0) {
          <div class="state-message" id="empty-targets-message">
            <span class="empty-icon">🛰️</span>
            <h3>No monitored targets found</h3>
            <p>Add your first HTTP/HTTPS endpoint, TCP service port, or ICMP host to begin monitoring.</p>
            <button
              type="button"
              class="btn btn-primary"
              id="btn-empty-add-target"
              (click)="openAddModal()"
            >
              + Create First Target
            </button>
          </div>
        } @else {
          <div class="table-container">
            <table class="targets-table" id="targets-table">
              <thead>
                <tr>
                  <th style="width: 130px;">Status</th>
                  <th>Service / Target</th>
                  <th style="width: 140px;">24h Trend</th>
                  <th style="width: 90px;">Uptime</th>
                  <th style="width: 100px;">Latency</th>
                  <th style="width: 90px;">Interval</th>
                  <th style="width: 140px;">Last Checked</th>
                  <th style="width: 150px; text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (target of state.filteredTargets(); track target.id) {
                  <tr
                    class="target-row"
                    [id]="'target-row-' + target.id"
                    (click)="openDetailModal(target)"
                  >
                    <!-- Status Badge -->
                    <td>
                      <app-status-badge
                        [state]="target.current_state"
                        [isActive]="target.is_active"
                        [failures]="target.consecutive_failures"
                        [threshold]="target.consecutive_failure_threshold"
                      ></app-status-badge>
                    </td>

                    <!-- Target Info -->
                    <td>
                      <div class="target-identity">
                        <span class="target-name">{{ target.name }}</span>
                        <div class="target-meta">
                          <span class="proto-badge" [attr.data-proto]="target.protocol">{{ target.protocol }}</span>
                          <span class="target-endpoint font-mono">{{ target.host_or_url }}</span>
                          @if (target.port) {
                            <span class="target-port font-mono">:{{ target.port }}</span>
                          }
                        </div>
                      </div>
                    </td>

                    <!-- Sparkline -->
                    <td>
                      <app-sparkline-chart
                        [data]="target.recent_latencies"
                        [state]="target.current_state"
                      ></app-sparkline-chart>
                    </td>

                    <!-- 24h Uptime -->
                    <td>
                      <span
                        class="uptime-pill"
                        [class.uptime-good]="(target.uptime_percentage_24h ?? 100) >= 99"
                        [class.uptime-fair]="(target.uptime_percentage_24h ?? 100) >= 95 && (target.uptime_percentage_24h ?? 100) < 99"
                        [class.uptime-poor]="(target.uptime_percentage_24h ?? 100) < 95"
                      >
                        {{ target.uptime_percentage_24h ?? 100 }}%
                      </span>
                    </td>

                    <!-- Latency -->
                    <td>
                      <span class="latency-cell font-mono">
                        {{ target.avg_latency_24h_ms ? target.avg_latency_24h_ms + ' ms' : '—' }}
                      </span>
                    </td>

                    <!-- Interval -->
                    <td>
                      <span class="interval-cell">{{ target.interval_seconds }}s</span>
                    </td>

                    <!-- Last Checked -->
                    <td>
                      <span class="time-cell font-mono">{{ formatRelativeTime(target.last_checked_at) }}</span>
                    </td>

                    <!-- Actions -->
                    <td (click)="$event.stopPropagation()" style="text-align: right;">
                      <div class="action-buttons">
                        <!-- Check Now Button -->
                        <button
                          type="button"
                          class="btn-icon"
                          [id]="'btn-check-' + target.id"
                          title="Execute Probe Immediately"
                          (click)="onCheckNow(target.id)"
                          [disabled]="isChecking(target.id)"
                        >
                          @if (isChecking(target.id)) {
                            <span class="spinner-mini"></span>
                          } @else {
                            <span>🔄</span>
                          }
                        </button>

                        <!-- Pause / Resume Button -->
                        <button
                          type="button"
                          class="btn-icon"
                          [id]="'btn-pause-' + target.id"
                          [title]="target.is_active ? 'Pause Monitor' : 'Resume Monitor'"
                          (click)="state.togglePause(target)"
                        >
                          <span>{{ target.is_active ? '⏸' : '▶' }}</span>
                        </button>

                        <!-- Edit Button -->
                        <button
                          type="button"
                          class="btn-icon"
                          [id]="'btn-edit-' + target.id"
                          title="Edit Configuration"
                          (click)="openEditModal(target)"
                        >
                          <span>✏️</span>
                        </button>

                        <!-- Delete Button -->
                        <button
                          type="button"
                          class="btn-icon btn-icon-delete"
                          [id]="'btn-delete-' + target.id"
                          title="Delete Monitor"
                          (click)="onDelete(target)"
                        >
                          <span>🗑️</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Dashboard Footer -->
      <footer class="dashboard-footer">
        <div class="footer-left">
          <span class="footer-brand">Uptimistic Sentinel</span>
          <span class="footer-separator">•</span>
          <span class="footer-meta">Self-Hosted Infrastructure Monitor</span>
        </div>

        <div class="footer-right">
          <a
            href="https://github.com/ruijramos/Uptimistic-Sentinel"
            target="_blank"
            rel="noopener noreferrer"
            class="github-link"
            id="link-github-repo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="github-icon">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            <span>Find out more on GitHub</span>
            <span class="external-arrow">↗</span>
          </a>
        </div>
      </footer>

      <!-- Target Form Modal (Create / Edit) -->
      <app-target-form
        [isOpen]="isTargetModalOpen()"
        [targetToEdit]="selectedTargetForEdit()"
        (close)="isTargetModalOpen.set(false)"
        (saved)="onTargetSaved($event)"
      ></app-target-form>

      <!-- Operational Settings Modal -->
      <app-settings-modal
        [isOpen]="isSettingsModalOpen()"
        (close)="isSettingsModalOpen.set(false)"
      ></app-settings-modal>

      <!-- Target Detail & Logs Modal -->
      <app-target-detail-modal
        [isOpen]="isDetailModalOpen()"
        [target]="selectedTargetForDetail()"
        (close)="isDetailModalOpen.set(false)"
      ></app-target-detail-modal>
    </div>
  `,
  styles: [`
    .dashboard-layout {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px 32px 64px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Top Nav */
    .top-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-svg {
      display: block;
      border-radius: 9px;
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.35);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
      cursor: pointer;
    }
    .brand-svg:hover {
      transform: scale(1.08);
      box-shadow: 0 0 22px rgba(16, 185, 129, 0.5);
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: linear-gradient(135deg, #ffffff, #c7d2fe);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .brand-subtitle {
      font-size: 11px;
      color: var(--text-muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      display: block;
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .sync-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-muted);
      padding-right: 8px;
    }
    .sync-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--success);
      box-shadow: 0 0 6px var(--success-glow);
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
    }
    .metric-card {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 105px;
    }
    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .metric-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .metric-number {
      font-size: 26px;
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1.1;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .metric-number small.unit {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .metric-subtext {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
      display: block;
    }

    /* Toolbar Section */
    .toolbar-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .filter-pills {
      display: flex;
      gap: 8px;
      background: rgba(17, 23, 38, 0.6);
      padding: 4px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
    }
    .filter-pill {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-pill:hover {
      color: var(--text-primary);
    }
    .filter-pill.active {
      background: var(--bg-elevated);
      color: #ffffff;
      box-shadow: var(--shadow-sm);
    }
    .search-box {
      min-width: 300px;
    }
    .search-input {
      padding: 8px 14px;
      font-size: 13px;
    }

    /* Targets Table */
    .table-section {
      overflow: hidden;
    }
    .table-container {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .targets-table {
      width: 100%;
      min-width: 720px;
      border-collapse: collapse;
      text-align: left;
    }
    .targets-table th {
      background: rgba(10, 14, 25, 0.7);
      padding: 12px 18px;
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-subtle);
    }
    .target-row {
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .target-row:hover {
      background: var(--bg-card-hover);
    }
    .target-row td {
      padding: 14px 18px;
      vertical-align: middle;
      font-size: 13px;
    }
    .target-identity {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .target-name {
      font-weight: 600;
      color: var(--text-primary);
    }
    .target-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .proto-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .proto-badge[data-proto="TCP"] {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.3);
    }
    .proto-badge[data-proto="ICMP"] {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.3);
    }
    .target-endpoint {
      font-size: 11px;
      color: var(--text-secondary);
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .target-port {
      color: var(--text-muted);
      font-size: 11px;
    }
    .uptime-pill {
      font-size: 12px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
    }
    .uptime-good {
      color: #34d399;
      background: var(--success-bg);
    }
    .uptime-fair {
      color: #fbbf24;
      background: var(--warning-bg);
    }
    .uptime-poor {
      color: #f87171;
      background: var(--danger-bg);
    }
    .latency-cell, .interval-cell, .time-cell {
      font-size: 12px;
      color: var(--text-secondary);
    }
    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
    .btn-icon-delete:hover {
      color: #f87171;
      background: var(--danger-bg);
    }

    /* States & Spinners */
    .state-message {
      text-align: center;
      padding: 64px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: var(--text-secondary);
    }
    .empty-icon {
      font-size: 40px;
      margin-bottom: 4px;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .spinner-mini {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive Breakpoints */
    @media (max-width: 1200px) {
      .metrics-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }
    }

    @media (max-width: 900px) {
      .dashboard-layout {
        padding: 20px 20px 48px;
        gap: 20px;
      }
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
    }

    @media (max-width: 768px) {
      .top-nav {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
        padding: 16px;
      }
      .nav-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: 10px;
      }
      .nav-actions .btn {
        flex: 1;
        padding: 8px 12px;
        font-size: 12px;
      }
      .toolbar-section {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .filter-pills {
        overflow-x: auto;
        max-width: 100%;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }
      .filter-pills::-webkit-scrollbar {
        display: none;
      }
      .filter-pill {
        white-space: nowrap;
        flex-shrink: 0;
        padding: 6px 12px;
        font-size: 11px;
      }
      .search-box {
        width: 100%;
        min-width: 0;
      }
      .search-input {
        width: 100%;
      }
    }

    @media (max-width: 540px) {
      .dashboard-layout {
        padding: 12px 12px 36px;
        gap: 16px;
      }
      .metrics-grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .metric-card {
        padding: 14px 16px;
        min-height: 85px;
      }
      .metric-number {
        font-size: 22px;
      }
      .brand-title {
        font-size: 16px;
      }
      .brand-subtitle {
        font-size: 10px;
      }
      .sync-status span:last-child {
        display: none;
      }
    }

    /* Dashboard Footer */
    .dashboard-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 24px;
      margin-top: 8px;
      border-top: 1px solid var(--border-glass);
      color: var(--text-muted);
      font-size: 13px;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .footer-brand {
      font-weight: 600;
      color: var(--text-secondary);
    }
    .footer-separator {
      color: var(--text-muted);
      opacity: 0.5;
    }
    .footer-meta {
      color: var(--text-muted);
    }
    .github-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-glass);
      border-radius: 9999px;
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
      font-size: 13px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .github-link:hover {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.4);
      color: #ffffff;
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.25);
      transform: translateY(-1px);
    }
    .github-icon {
      transition: transform 0.2s ease;
    }
    .github-link:hover .github-icon {
      transform: scale(1.1);
    }
    .external-arrow {
      font-size: 13px;
      opacity: 0.7;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }
    .github-link:hover .external-arrow {
      opacity: 1;
      transform: translate(2px, -2px);
    }
    @media (max-width: 768px) {
      .dashboard-footer {
        flex-direction: column;
        gap: 14px;
        text-align: center;
      }
      .footer-left {
        flex-direction: column;
        gap: 4px;
      }
      .footer-separator {
        display: none;
      }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly state = inject(TargetStateService);

  readonly isTargetModalOpen = signal<boolean>(false);
  readonly selectedTargetForEdit = signal<Target | null>(null);

  readonly isSettingsModalOpen = signal<boolean>(false);

  readonly isDetailModalOpen = signal<boolean>(false);
  readonly selectedTargetForDetail = signal<Target | null>(null);

  ngOnInit(): void {
    this.state.startAutoPolling(12000);
  }

  ngOnDestroy(): void {
    this.state.stopAutoPolling();
  }

  isChecking(targetId: string): boolean {
    return this.state.checkingTargetIds().has(targetId);
  }

  onCheckNow(targetId: string): void {
    this.state.checkNow(targetId);
  }

  openAddModal(): void {
    this.selectedTargetForEdit.set(null);
    this.isTargetModalOpen.set(true);
  }

  openEditModal(target: Target): void {
    this.selectedTargetForEdit.set(target);
    this.isTargetModalOpen.set(true);
  }

  openDetailModal(target: Target): void {
    this.selectedTargetForDetail.set(target);
    this.isDetailModalOpen.set(true);
  }

  onTargetSaved(savedTarget: Target): void {
    this.state.updateTargetInList(savedTarget);
    // Reload list to ensure fresh metrics
    this.state.loadTargets();
  }

  onDelete(target: Target): void {
    if (confirm(`Are you sure you want to delete monitor '${target.name}'? Historical check logs will be permanently removed.`)) {
      this.state.deleteTarget(target.id);
    }
  }

  formatRelativeTime(isoStr?: string | null): string {
    if (!isoStr) return 'Never';
    const seconds = Math.floor((new Date().getTime() - new Date(isoStr).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
}
