import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { Target, TargetCreatePayload, TargetUpdatePayload } from '../models/target.model';

@Injectable({
  providedIn: 'root'
})
export class TargetStateService {
  private readonly api = inject(ApiService);

  // Core State Signals
  readonly targets = signal<Target[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly checkingTargetIds = signal<Set<string>>(new Set());
  
  // UI Filter Signals
  readonly activeFilter = signal<'ALL' | 'UP' | 'PENDING_DOWN' | 'DOWN' | 'PAUSED'>('ALL');
  readonly searchQuery = signal<string>('');

  private pollIntervalId: any = null;

  // --- Computed Signals for Metrics & Filtering ---

  readonly totalCount = computed(() => this.targets().length);

  readonly upCount = computed(() => 
    this.targets().filter(t => t.is_active && t.current_state === 'UP').length
  );

  readonly pendingCount = computed(() => 
    this.targets().filter(t => t.is_active && t.current_state === 'PENDING_DOWN').length
  );

  readonly downCount = computed(() => 
    this.targets().filter(t => t.is_active && t.current_state === 'DOWN').length
  );

  readonly pausedCount = computed(() => 
    this.targets().filter(t => !t.is_active).length
  );

  readonly overallUptimePct = computed(() => {
    const activeList = this.targets().filter(t => t.is_active);
    if (!activeList.length) return 100.0;
    const sum = activeList.reduce((acc, t) => acc + (t.uptime_percentage_24h ?? 100), 0);
    return Math.round((sum / activeList.length) * 10) / 10;
  });

  readonly avgLatencyMs = computed(() => {
    const activeWithLatency = this.targets().filter(t => t.is_active && (t.avg_latency_24h_ms ?? 0) > 0);
    if (!activeWithLatency.length) return 0;
    const sum = activeWithLatency.reduce((acc, t) => acc + (t.avg_latency_24h_ms || 0), 0);
    return Math.round((sum / activeWithLatency.length) * 10) / 10;
  });

  readonly filteredTargets = computed(() => {
    const filter = this.activeFilter();
    const query = this.searchQuery().toLowerCase().trim();

    return this.targets().filter(target => {
      // 1. Status Filter
      if (filter === 'PAUSED' && target.is_active) return false;
      if (filter === 'UP' && (!target.is_active || target.current_state !== 'UP')) return false;
      if (filter === 'PENDING_DOWN' && (!target.is_active || target.current_state !== 'PENDING_DOWN')) return false;
      if (filter === 'DOWN' && (!target.is_active || target.current_state !== 'DOWN')) return false;

      // 2. Search Filter
      if (query) {
        const matchesName = target.name.toLowerCase().includes(query);
        const matchesHost = target.host_or_url.toLowerCase().includes(query);
        const matchesProtocol = target.protocol.toLowerCase().includes(query);
        if (!matchesName && !matchesHost && !matchesProtocol) return false;
      }

      return true;
    });
  });

  // --- Actions ---

  loadTargets(): void {
    this.loading.set(true);
    this.api.getTargets().subscribe({
      next: (res) => {
        this.targets.set(res.targets);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (err) => {
        this.error.set('Failed to connect to monitoring service API');
        this.loading.set(false);
      }
    });
  }

  checkNow(targetId: string): void {
    // Add to in-flight set
    const currentSet = new Set(this.checkingTargetIds());
    currentSet.add(targetId);
    this.checkingTargetIds.set(currentSet);

    this.api.checkTargetNow(targetId).subscribe({
      next: (res) => {
        this.updateTargetInList(res.target);
        this.removeCheckingId(targetId);
      },
      error: () => {
        this.removeCheckingId(targetId);
      }
    });
  }

  togglePause(target: Target): void {
    const action$ = target.is_active 
      ? this.api.pauseTarget(target.id) 
      : this.api.resumeTarget(target.id);

    action$.subscribe({
      next: (res) => {
        this.updateTargetInList(res.target);
      }
    });
  }

  deleteTarget(targetId: string): void {
    this.api.deleteTarget(targetId).subscribe({
      next: () => {
        this.targets.update(list => list.filter(t => t.id !== targetId));
      }
    });
  }

  updateTargetInList(updated: Target): void {
    this.targets.update(list => 
      list.map(t => t.id === updated.id ? updated : t)
    );
  }

  private removeCheckingId(id: string): void {
    const set = new Set(this.checkingTargetIds());
    set.delete(id);
    this.checkingTargetIds.set(set);
  }

  startAutoPolling(intervalMs = 12000): void {
    this.loadTargets();
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }
    this.pollIntervalId = setInterval(() => {
      // Background silent refresh
      this.api.getTargets().subscribe({
        next: (res) => this.targets.set(res.targets)
      });
    }, intervalMs);
  }

  stopAutoPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }
}
