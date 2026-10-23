import { Component, EventEmitter, Input, Output, inject, OnInit, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Target, ProtocolType, TargetCreatePayload, TargetUpdatePayload } from '../../core/models/target.model';

@Component({
  selector: 'app-target-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (isOpen) {
      <div class="modal-backdrop" id="target-form-modal-backdrop" (click)="onBackdropClick($event)">
        <div class="modal-dialog glass-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2 class="modal-title" id="target-form-title">
                {{ isEditing ? 'Edit Monitor Target' : 'Add New Target' }}
              </h2>
              <p class="modal-subtitle">Configure multi-protocol endpoint health probing</p>
            </div>
            <button type="button" class="btn-icon close-btn" id="btn-close-target-form" (click)="closeModal()">
              ✕
            </button>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="modal-body">
            @if (errorMessage()) {
              <div class="alert-box error-alert" id="target-form-error">
                <span>{{ errorMessage() }}</span>
                <button
                  type="button"
                  class="alert-close-btn"
                  (click)="errorMessage.set(null)"
                  title="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            }

            <!-- Target Friendly Name -->
            <div class="form-group">
              <label class="form-label" for="target-name">Target Friendly Name</label>
              <input
                type="text"
                id="target-name"
                class="form-input"
                formControlName="name"
                placeholder="e.g. Production API Gateway, Auth Service"
              />
              @if (form.get('name')?.invalid && form.get('name')?.touched) {
                <span class="form-error">Target name is required (max 128 chars).</span>
              }
            </div>

            <!-- Protocol & Port Row -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label" for="target-protocol">Protocol</label>
                <select id="target-protocol" class="form-select" formControlName="protocol">
                  <option value="HTTPS">HTTPS (Web Endpoint)</option>
                  <option value="HTTP">HTTP (Plain Web)</option>
                  <option value="TCP">TCP Port Check (IP / Socket)</option>
                  <option value="ICMP">ICMP Ping (Host Reachability)</option>
                </select>
              </div>

              @if (isTcp()) {
                <div class="form-group flex-1">
                  <label class="form-label" for="target-port">Port Number</label>
                  <input
                    type="number"
                    id="target-port"
                    class="form-input"
                    formControlName="port"
                    placeholder="e.g. 5432, 6379, 8080"
                  />
                  @if (form.get('port')?.invalid && form.get('port')?.touched) {
                    <span class="form-error">Valid port (1-65535) is required for TCP.</span>
                  }
                </div>
              }
            </div>

            <!-- Host or URL -->
            <div class="form-group">
              <label class="form-label" for="target-host">
                {{ isHttp() ? 'Full Endpoint URL' : 'Host / IP Address' }}
              </label>
              <input
                type="text"
                id="target-host"
                class="form-input"
                formControlName="host_or_url"
                [placeholder]="isHttp() ? 'https://api.internal.corp/healthz' : '192.168.1.100 or host.internal.corp'"
              />
              @if (form.get('host_or_url')?.invalid && form.get('host_or_url')?.touched) {
                <span class="form-error">
                  {{ isHttp() ? 'Must start with http:// or https://' : 'Host or IP address is required.' }}
                </span>
              }
            </div>

            <!-- Operational Thresholds Grid -->
            <div class="form-grid-3">
              <div class="form-group">
                <label class="form-label" for="target-interval">Interval (sec)</label>
                <input
                  type="number"
                  id="target-interval"
                  class="form-input"
                  formControlName="interval_seconds"
                  min="10"
                  max="3600"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="target-timeout">Timeout (sec)</label>
                <input
                  type="number"
                  id="target-timeout"
                  class="form-input"
                  formControlName="timeout_seconds"
                  min="1"
                  max="60"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="target-threshold">Failures Before Alert</label>
                <input
                  type="number"
                  id="target-threshold"
                  class="form-input"
                  formControlName="consecutive_failure_threshold"
                  min="1"
                  max="20"
                />
              </div>
            </div>

            <!-- HTTP Advanced Protocol Options Accordion -->
            @if (isHttp()) {
              <div class="advanced-section">
                <div class="advanced-header">
                  <span class="advanced-title">HTTP Options</span>
                </div>

                <div class="form-row">
                  <div class="form-group flex-1">
                    <label class="form-label" for="target-method">HTTP Method</label>
                    <select id="target-method" class="form-select" formControlName="http_method">
                      <option value="GET">GET</option>
                      <option value="HEAD">HEAD</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>

                  <div class="form-group flex-2">
                    <label class="form-label" for="target-status-codes">Expected Status Codes</label>
                    <input
                      type="text"
                      id="target-status-codes"
                      class="form-input"
                      formControlName="expected_status_codes"
                      placeholder="e.g. 200, 201, 204"
                    />
                  </div>
                </div>

                <div class="checkbox-group">
                  <label class="checkbox-label" for="target-verify-ssl">
                    <input
                      type="checkbox"
                      id="target-verify-ssl"
                      formControlName="verify_ssl"
                    />
                    <span>Verify SSL/TLS Certificate (Disable for self-signed internal certs)</span>
                  </label>
                </div>
              </div>
            }

            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                id="btn-cancel-target"
                (click)="closeModal()"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                id="btn-save-target"
                [disabled]="form.invalid || isSubmitting()"
              >
                @if (isSubmitting()) {
                  <span>Saving...</span>
                } @else {
                  <span>{{ isEditing ? 'Save Changes' : 'Create Monitor' }}</span>
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
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
      margin-top: 16px;
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .form-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
    .advanced-section {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px;
      margin-top: 8px;
      margin-bottom: 16px;
    }
    .advanced-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
      display: block;
    }
    .checkbox-group {
      margin-top: 8px;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
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
      .form-row {
        flex-direction: column;
        gap: 0;
      }
      .form-grid-3 {
        grid-template-columns: 1fr;
        gap: 0;
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
export class TargetFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  @Input() isOpen = false;
  @Input() targetToEdit: Target | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Target>();

  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(128)]],
    protocol: ['HTTPS', [Validators.required]],
    host_or_url: ['', [Validators.required]],
    port: [null],
    interval_seconds: [60, [Validators.required, Validators.min(10), Validators.max(3600)]],
    timeout_seconds: [10, [Validators.required, Validators.min(1), Validators.max(60)]],
    consecutive_failure_threshold: [3, [Validators.required, Validators.min(1), Validators.max(20)]],
    http_method: ['GET'],
    expected_status_codes: ['200, 201, 204'],
    verify_ssl: [true]
  });

  get isEditing(): boolean {
    return !!this.targetToEdit;
  }

  isTcp(): boolean {
    return this.form.get('protocol')?.value === 'TCP';
  }

  isHttp(): boolean {
    const proto = this.form.get('protocol')?.value;
    return proto === 'HTTP' || proto === 'HTTPS';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.errorMessage.set(null);
      this.isSubmitting.set(false);

      if (this.targetToEdit) {
        const opts = this.targetToEdit.protocol_options || {};
        const codesStr = (opts.expected_status_codes || [200, 201, 204]).join(', ');
        this.form.patchValue({
          name: this.targetToEdit.name,
          protocol: this.targetToEdit.protocol,
          host_or_url: this.targetToEdit.host_or_url,
          port: this.targetToEdit.port,
          interval_seconds: this.targetToEdit.interval_seconds,
          timeout_seconds: this.targetToEdit.timeout_seconds,
          consecutive_failure_threshold: this.targetToEdit.consecutive_failure_threshold,
          http_method: opts.method || 'GET',
          expected_status_codes: codesStr,
          verify_ssl: opts.verify_ssl ?? true
        });
      } else {
        this.form.reset({
          name: '',
          protocol: 'HTTPS',
          host_or_url: '',
          port: null,
          interval_seconds: 60,
          timeout_seconds: 10,
          consecutive_failure_threshold: 3,
          http_method: 'GET',
          expected_status_codes: '200, 201, 204',
          verify_ssl: true
        });
      }
    }
  }

  onBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.errorMessage.set(null);
    this.close.emit();
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const val = this.form.value;
    const codes = (val.expected_status_codes as string)
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));

    const protocolOptions: any = {};
    if (val.protocol === 'HTTP' || val.protocol === 'HTTPS') {
      protocolOptions.method = val.http_method;
      protocolOptions.expected_status_codes = codes.length ? codes : [200, 204];
      protocolOptions.verify_ssl = val.verify_ssl;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    if (this.isEditing && this.targetToEdit) {
      const payload: TargetUpdatePayload = {
        name: val.name,
        protocol: val.protocol as ProtocolType,
        host_or_url: val.host_or_url,
        port: val.protocol === 'TCP' ? val.port : null,
        interval_seconds: val.interval_seconds,
        timeout_seconds: val.timeout_seconds,
        consecutive_failure_threshold: val.consecutive_failure_threshold,
        protocol_options: protocolOptions
      };

      this.api.updateTarget(this.targetToEdit.id, payload).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.saved.emit(res.target);
          this.closeModal();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err.error?.error || 'Failed to update target');
        }
      });
    } else {
      const payload: TargetCreatePayload = {
        name: val.name,
        protocol: val.protocol as ProtocolType,
        host_or_url: val.host_or_url,
        port: val.protocol === 'TCP' ? val.port : null,
        interval_seconds: val.interval_seconds,
        timeout_seconds: val.timeout_seconds,
        consecutive_failure_threshold: val.consecutive_failure_threshold,
        is_active: true,
        protocol_options: protocolOptions
      };

      this.api.createTarget(payload).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.saved.emit(res.target);
          this.closeModal();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err.error?.error || 'Failed to create target');
        }
      });
    }
  }
}
