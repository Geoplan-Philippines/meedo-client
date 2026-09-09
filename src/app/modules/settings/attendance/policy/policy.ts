import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import {
  AttendancePolicy,
  UpdateAttendancePolicyPayload,
} from '../models/attendance.model';
import { TIME_PATTERN } from '../shared/attendance-settings.util';
import { AttendancePolicyService } from '../services/attendance-policy.service';

/** A short, editable set of common IANA zones; any value is accepted server-side. */
const TIMEZONE_OPTIONS = [
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
].map((zone) => ({ label: zone, value: zone }));

@Component({
  selector: 'app-settings-policy',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    ToggleSwitchModule,
  ],
  templateUrl: './policy.html',
  styleUrls: ['./policy.css', '../shared/attendance-time.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Policy implements OnInit {
  private readonly policyService = inject(AttendancePolicyService);

  readonly policy = signal<AttendancePolicy | null>(null);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saved = signal(false);

  readonly timezoneOptions = TIMEZONE_OPTIONS;

  private readonly time = [Validators.required, Validators.pattern(TIME_PATTERN)];

  readonly form = new FormGroup({
    timezone: new FormControl('Asia/Manila', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    autoClockOutEnabled: new FormControl(true, { nonNullable: true }),
    autoClockOutTime: new FormControl('18:00', { nonNullable: true, validators: this.time }),
    standardHoursPerDay: this.num(8, 0, 24),
    standardHoursPerWeek: this.num(40, 0, 168),
    maxHoursPerDay: this.num(24, 0, 24),
    graceMinutes: this.num(15, 0, 240),
    lunchMinutes: this.num(60, 0, 480),
    lunchIsPaid: new FormControl(false, { nonNullable: true }),
    overtimeAfterHoursPerDay: this.num(8, 0, 24),
    minimumOvertimeMinutes: this.num(30, 0, 480),
    overtimeMultiplier: this.num(1.25, 0, 10),
    restDayMultiplier: this.num(1.3, 0, 10),
    nightDifferentialMultiplier: this.num(0.1, 0, 10),
    nightDifferentialStart: new FormControl('22:00', { nonNullable: true, validators: this.time }),
    nightDifferentialEnd: new FormControl('06:00', { nonNullable: true, validators: this.time }),
  });

  private num(initial: number, min: number, max: number): FormControl<number> {
    return new FormControl(initial, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(min), Validators.max(max)],
    });
  }

  constructor() {
    // Any edit (including via toggles/selects that don't emit a native change) clears "Saved".
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.saved()) this.saved.set(false);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.policyService.get().subscribe({
      next: (policy) => {
        this.policy.set(policy);
        this.applyToForm(policy);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set('Failed to load the attendance policy. Please try again.');
      },
    });
  }

  private applyToForm(policy: AttendancePolicy): void {
    this.form.reset({
      timezone: policy.timezone,
      autoClockOutEnabled: policy.autoClockOutEnabled,
      autoClockOutTime: policy.autoClockOutTime,
      standardHoursPerDay: policy.standardHoursPerDay,
      standardHoursPerWeek: policy.standardHoursPerWeek,
      maxHoursPerDay: policy.maxHoursPerDay,
      graceMinutes: policy.graceMinutes,
      lunchMinutes: policy.lunchMinutes,
      lunchIsPaid: policy.lunchIsPaid,
      overtimeAfterHoursPerDay: policy.overtimeAfterHoursPerDay,
      minimumOvertimeMinutes: policy.minimumOvertimeMinutes,
      overtimeMultiplier: policy.overtimeMultiplier,
      restDayMultiplier: policy.restDayMultiplier,
      nightDifferentialMultiplier: policy.nightDifferentialMultiplier,
      nightDifferentialStart: policy.nightDifferentialStart,
      nightDifferentialEnd: policy.nightDifferentialEnd,
    });
    this.saved.set(false);
  }

  reset(): void {
    const policy = this.policy();
    if (policy) this.applyToForm(policy);
  }

  save(): void {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.getRawValue() as UpdateAttendancePolicyPayload;
    this.isSaving.set(true);
    this.saveError.set(null);
    this.policyService.update(payload).subscribe({
      next: (policy) => {
        this.policy.set(policy);
        this.applyToForm(policy);
        this.isSaving.set(false);
        this.saved.set(true);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.saveError.set(this.extractMessage(err) ?? 'Failed to save the policy. Please try again.');
      },
    });
  }

  private extractMessage(err: unknown): string | null {
    if (err && typeof err === 'object' && 'error' in err) {
      const message = (err as { error?: { message?: string | string[] } }).error?.message;
      if (Array.isArray(message)) return message[0] ?? null;
      if (typeof message === 'string') return message;
    }
    return null;
  }
}
