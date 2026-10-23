export interface SystemSettings {
  alert_recipients: string[];
  default_check_interval_seconds: number;
  default_timeout_seconds: number;
  max_timeout_seconds: number;
  default_failure_threshold: number;
  log_retention_days: number;
}
