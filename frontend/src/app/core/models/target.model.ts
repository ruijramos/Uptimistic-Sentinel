export type ProtocolType = 'HTTP' | 'HTTPS' | 'TCP' | 'ICMP';
export type TargetState = 'UP' | 'PENDING_DOWN' | 'DOWN';

export interface ProtocolOptions {
  method?: string;
  expected_status_codes?: number[];
  headers?: Record<string, string>;
  verify_ssl?: boolean;
  follow_redirects?: boolean;
}

export interface Target {
  id: string;
  name: string;
  protocol: ProtocolType;
  host_or_url: string;
  port?: number | null;
  interval_seconds: number;
  timeout_seconds: number;
  consecutive_failure_threshold: number;
  is_active: boolean;
  current_state: TargetState;
  consecutive_failures: number;
  consecutive_successes: number;
  last_checked_at?: string | null;
  last_state_change_at?: string | null;
  next_run_at?: string | null;
  protocol_options: ProtocolOptions;
  created_at?: string | null;
  updated_at?: string | null;

  // Computed metrics
  uptime_percentage_24h?: number;
  avg_latency_24h_ms?: number;
  recent_latencies?: number[];
}

export interface TargetCreatePayload {
  name: string;
  protocol: ProtocolType;
  host_or_url: string;
  port?: number | null;
  interval_seconds: number;
  timeout_seconds: number;
  consecutive_failure_threshold: number;
  is_active?: boolean;
  protocol_options?: ProtocolOptions;
}

export interface TargetUpdatePayload {
  name?: string;
  protocol?: ProtocolType;
  host_or_url?: string;
  port?: number | null;
  interval_seconds?: number;
  timeout_seconds?: number;
  consecutive_failure_threshold?: number;
  is_active?: boolean;
  protocol_options?: ProtocolOptions;
}
