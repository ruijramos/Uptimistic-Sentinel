import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Target, TargetCreatePayload, TargetUpdatePayload } from '../models/target.model';
import { CheckLog, AlertHistoryItem } from '../models/check-log.model';
import { SystemSettings } from '../models/settings.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  // --- Target Endpoints ---

  getTargets(): Observable<{ targets: Target[]; total: number }> {
    return this.http.get<{ targets: Target[]; total: number }>(`${this.baseUrl}/targets`);
  }

  getTarget(id: string): Observable<{ target: Target }> {
    return this.http.get<{ target: Target }>(`${this.baseUrl}/targets/${id}`);
  }

  createTarget(payload: TargetCreatePayload): Observable<{ target: Target }> {
    return this.http.post<{ target: Target }>(`${this.baseUrl}/targets`, payload);
  }

  updateTarget(id: string, payload: TargetUpdatePayload): Observable<{ target: Target }> {
    return this.http.put<{ target: Target }>(`${this.baseUrl}/targets/${id}`, payload);
  }

  deleteTarget(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/targets/${id}`);
  }

  pauseTarget(id: string): Observable<{ target: Target }> {
    return this.http.post<{ target: Target }>(`${this.baseUrl}/targets/${id}/pause`, {});
  }

  resumeTarget(id: string): Observable<{ target: Target }> {
    return this.http.post<{ target: Target }>(`${this.baseUrl}/targets/${id}/resume`, {});
  }

  checkTargetNow(id: string): Observable<{ result: any; target: Target }> {
    return this.http.post<{ result: any; target: Target }>(`${this.baseUrl}/targets/${id}/check-now`, {});
  }

  // --- Log & Alert Endpoints ---

  getTargetLogs(targetId: string, limit = 50): Observable<{ logs: CheckLog[]; limit: number; offset: number }> {
    return this.http.get<{ logs: CheckLog[]; limit: number; offset: number }>(
      `${this.baseUrl}/targets/${targetId}/logs?limit=${limit}`
    );
  }

  getTargetAlerts(targetId: string): Observable<{ alerts: AlertHistoryItem[] }> {
    return this.http.get<{ alerts: AlertHistoryItem[] }>(`${this.baseUrl}/targets/${targetId}/alerts`);
  }

  getRecentAlerts(limit = 20): Observable<{ alerts: AlertHistoryItem[]; total: number }> {
    return this.http.get<{ alerts: AlertHistoryItem[]; total: number }>(`${this.baseUrl}/alerts?limit=${limit}`);
  }

  // --- Settings Endpoints ---

  getSettings(): Observable<{ settings: SystemSettings }> {
    return this.http.get<{ settings: SystemSettings }>(`${this.baseUrl}/settings`);
  }

  updateSettings(settings: SystemSettings): Observable<{ message: string; settings: SystemSettings }> {
    return this.http.put<{ message: string; settings: SystemSettings }>(`${this.baseUrl}/settings`, settings);
  }

  sendTestEmail(recipient?: string): Observable<{ success: boolean; message: string; recipients: string[] }> {
    return this.http.post<{ success: boolean; message: string; recipients: string[] }>(
      `${this.baseUrl}/settings/test-email`,
      recipient ? { recipient } : {}
    );
  }
}
