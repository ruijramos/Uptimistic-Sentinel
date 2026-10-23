import { Component, EventEmitter, Input, Output, inject, OnInit, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { SystemSettings } from '../../core/models/settings.model';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (isOpen) {
      <div class="modal-backdrop" id="settings-modal-backdrop" (click)="onBackdropClick($event)">
        <div class="modal-dialog glass-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2 class="modal-title" id="settings-title">Operational Settings</h2>
              <p class="modal-subtitle">Dynamic runtime rules applied without restarting the server</p>
            </div>
            <button type="button" class="btn-icon close-btn" id="btn-close-settings" (click)="closeModal()">
              ✕
            </button>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="modal-body">
            @if (feedbackMessage()) {
              <div
                class="alert-box"
                [class.success-alert]="feedbackType() === 'success'"
                [class.error-alert]="feedbackType() === 'error'"
                id="settings-feedback"
              >
                <span>{{ feedbackMessage() }}</span>
                <button
                  type="button"
                  class="alert-close-btn"
                  (click)="feedbackMessage.set(null)"
                  title="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            }

            <!-- Alert Email Recipients -->
            <div class="form-group">
              <label class="form-label" for="settings-recipients">
                Alert Email Recipients (Comma-Separated)
              </label>
              <textarea
                id="settings-recipients"
                class="form-textarea"
                rows="2"
                formControlName="alert_recipients_raw"
                placeholder="ops@internal.corp, alerts@yourcompany.com"
              ></textarea>
              <span class="form-hint">
                These addresses receive DOWN and RECOVERED alert notifications via native smtplib.
              </span>
            </div>

            <!-- Operational Defaults Grid -->
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" for="settings-default-interval">Default Check Interval (s)</label>
                <input
                  type="number"
                  id="settings-default-interval"
                  class="form-input"
                  formControlName="default_check_interval_seconds"
                  min="10"
                  max="3600"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="settings-default-timeout">Default Probe Timeout (s)</label>
                <input
                  type="number"
                  id="settings-default-timeout"
                  class="form-input"
                  formControlName="default_timeout_seconds"
                  min="1"
                  max="60"
                />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" for="settings-failure-threshold">Default Failure Threshold</label>
                <input
                  type="number"
                  id="settings-failure-threshold"
                  class="form-input"
                  formControlName="default_failure_threshold"
                  min="1"
                  max="20"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="settings-retention">Log Retention (Days)</label>
                <input
                  type="number"
                  id="settings-retention"
                  class="form-input"
                  formControlName="log_retention_days"
                  min="1"
                  max="365"
                />
              </div>
            </div>

            <!-- SMTP Test Box -->
            <div class="smtp-test-box">
              <div class="smtp-test-info">
                <strong>Verify SMTP Mail Relay</strong>
                <p>Send a real test email through the server's configured SMTP relay.</p>
              </div>
              <button
                type="button"
                class="btn btn-secondary"
                id="btn-test-email"
                (click)="onTestEmail()"
                [disabled]="isTestingEmail()"
              >
                @if (isTestingEmail()) {
                  <span>Testing Connection...</span>
                } @else {
                  <span>Send Test Email</span>
                }
              </button>
            </div>

            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                id="btn-cancel-settings"
                (click)="closeModal()"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                id="btn-save-settings"
                [disabled]="form.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <span>Saving...</span>
                } @else {
                  <span>Save Settings</span>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .modal-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .modal-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .close-btn {
      font-size: 16px;
      cursor: pointer;
    }
    .modal-body {
      padding: 24px;
    }
    .form-hint {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .smtp-test-box {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 8px;
      margin-bottom: 16px;
    }
    .smtp-test-info strong {
      font-size: 13px;
      color: var(--text-primary);
    }
    .smtp-test-info p {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
    }
    .alert-box {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .alert-close-btn {
      background: transparent;
      border: none;
      color: currentColor;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      opacity: 0.7;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .alert-close-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }
    .success-alert {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: #6ee7b7;
    }
    .error-alert {
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: #fca5a5;
    }
    @media (max-width: 600px) {
      .modal-body {
        padding: 16px;
      }
      .modal-header {
        padding: 16px;
      }
      .form-grid-2 {
        grid-template-columns: 1fr;
        gap: 0;
      }
      .smtp-test-box {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .smtp-test-box .btn {
        width: 100%;
      }
      .modal-footer {
        flex-direction: column-reverse;
        gap: 8px;
      }
      .modal-footer .btn {
        width: 100%;
      }
    }
  `]
})
export class SettingsModalComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  readonly isSaving = signal<boolean>(false);
  readonly isTestingEmail = signal<boolean>(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly feedbackType = signal<'success' | 'error'>('success');

  form: FormGroup = this.fb.group({
    alert_recipients_raw: ['', [Validators.required]],
    default_check_interval_seconds: [60, [Validators.required, Validators.min(10), Validators.max(3600)]],
    default_timeout_seconds: [10, [Validators.required, Validators.min(1), Validators.max(60)]],
    max_timeout_seconds: [30, [Validators.required]],
    default_failure_threshold: [3, [Validators.required, Validators.min(1), Validators.max(20)]],
    log_retention_days: [30, [Validators.required, Validators.min(1), Validators.max(365)]]
  });

  ngOnInit(): void {
    this.loadCurrentSettings();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.feedbackMessage.set(null);
      this.isSaving.set(false);
      this.isTestingEmail.set(false);
      this.loadCurrentSettings();
    }
  }

  loadCurrentSettings(): void {
    this.api.getSettings().subscribe({
      next: (res) => {
        const s = res.settings;
        this.form.patchValue({
          alert_recipients_raw: (s.alert_recipients || []).join(', '),
          default_check_interval_seconds: s.default_check_interval_seconds ?? 60,
          default_timeout_seconds: s.default_timeout_seconds ?? 10,
          max_timeout_seconds: s.max_timeout_seconds ?? 30,
          default_failure_threshold: s.default_failure_threshold ?? 3,
          log_retention_days: s.log_retention_days ?? 30
        });
      }
    });
  }

  onBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.feedbackMessage.set(null);
    this.close.emit();
  }

  onTestEmail(): void {
    const rawEmails = this.form.get('alert_recipients_raw')?.value as string;
    const firstEmail = rawEmails ? rawEmails.split(',')[0].trim() : undefined;

    this.isTestingEmail.set(true);
    this.feedbackMessage.set(null);

    this.api.sendTestEmail(firstEmail).subscribe({
      next: (res) => {
        this.isTestingEmail.set(false);
        this.feedbackType.set('success');
        this.feedbackMessage.set(res.message);
      },
      error: (err) => {
        this.isTestingEmail.set(false);
        this.feedbackType.set('error');
        this.feedbackMessage.set(err.error?.message || 'SMTP delivery test failed. Check backend credentials.');
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const val = this.form.value;
    const recipients = (val.alert_recipients_raw as string)
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    const payload: SystemSettings = {
      alert_recipients: recipients,
      default_check_interval_seconds: val.default_check_interval_seconds,
      default_timeout_seconds: val.default_timeout_seconds,
      max_timeout_seconds: val.max_timeout_seconds,
      default_failure_threshold: val.default_failure_threshold,
      log_retention_days: val.log_retention_days
    };

    this.isSaving.set(true);
    this.feedbackMessage.set(null);

    this.api.updateSettings(payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.feedbackType.set('success');
        this.feedbackMessage.set('Settings updated successfully!');
        setTimeout(() => this.closeModal(), 1200);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.feedbackType.set('error');
        this.feedbackMessage.set(err.error?.error || 'Failed to update settings');
      }
    });
  }
}
