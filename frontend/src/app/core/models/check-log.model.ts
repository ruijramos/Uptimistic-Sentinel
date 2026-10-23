export interface CheckLog {
  id: number;
  target_id: string;
  checked_at: string;
  is_success: boolean;
  response_time_ms: number;
  status_code?: number | null;
  error_message?: string | null;
}

export interface AlertHistoryItem {
  id: number;
  target_id: string;
  target_name?: string;
  target_protocol?: string;
  triggered_at: string;
  alert_type: 'DOWN' | 'RECOVERED';
  recipient: string;
  is_delivered: boolean;
  delivery_error?: string | null;
}
