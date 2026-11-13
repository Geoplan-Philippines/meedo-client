import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../../../core/auth/auth.service';
import { RichTextEditor } from '../../../../shared/ui/rich-text-editor/rich-text-editor';
import { PageLayout } from '../../../../shared/ui/page-layout/page-layout';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { CampaignsService } from '../../services/campaigns.service';
import { CAMPAIGN_LIMITS, Campaign, CampaignPayload } from './campaign.model';
import { campaignBodyRequired, campaignTextValidator } from './campaign-validation';
import { CampaignBodyAccessibility } from './campaign-body-accessibility';

@Component({
  selector: 'app-campaign-form',
  imports: [
    ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SkeletonModule,
    PageLayout, EmptyState, RichTextEditor, CampaignBodyAccessibility,
  ],
  templateUrl: './campaign-form.html',
  styleUrl: './campaign-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignForm {
  private readonly service = inject(CampaignsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly isAdmin = inject(AuthService).isAdmin;
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly campaign = signal<Campaign | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly submitted = signal(false);
  readonly values = signal<CampaignPayload>({ name: '', subject: '', body: '' });
  readonly limits = CAMPAIGN_LIMITS;
  readonly canEdit = computed(() => this.isAdmin() && (!this.id || this.campaign()?.status === 'DRAFT'));
  readonly fields = ['name', 'subject', 'body'] as const;
  readonly textFields = ['name', 'subject'] as const;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [campaignTextValidator(CAMPAIGN_LIMITS.name)] }),
    subject: new FormControl('', { nonNullable: true, validators: [campaignTextValidator(CAMPAIGN_LIMITS.subject)] }),
    body: new FormControl('', { nonNullable: true, validators: [campaignTextValidator(CAMPAIGN_LIMITS.body), campaignBodyRequired] }),
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.values.set(this.form.getRawValue()));
    if (this.id) this.load();
  }

  load() {
    if (!this.id) return;
    this.loading.set(true); this.loadError.set('');
    this.service.get(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: campaign => { this.campaign.set(campaign); this.form.patchValue(campaign); this.loading.set(false); },
      error: () => { this.loadError.set('The campaign could not be loaded.'); this.loading.set(false); },
    });
  }

  length(field: keyof CampaignPayload) { return this.values()[field].trim().length; }
  nearLimit(field: keyof CampaignPayload) { return this.length(field) >= this.limits[field] * .9; }
  invalid(field: keyof CampaignPayload) {
    this.values();
    return this.form.controls[field].invalid && (this.submitted() || this.form.controls[field].touched || this.length(field) > 0);
  }
  bodyChanged(body: string) { this.form.controls.body.setValue(body); this.form.controls.body.markAsTouched(); }

  save() {
    if (!this.canEdit() || this.saving() || this.loading() || this.loadError()) return;
    this.submitted.set(true);
    for (const field of this.fields) this.form.controls[field].setValue(this.form.controls[field].value.trim());
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true); this.error.set('');
    const payload = this.form.getRawValue();
    const request = this.id ? this.service.update(this.id, payload) : this.service.create(payload);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); void this.router.navigate(['/crm/newsletter/campaigns']); },
      error: () => { this.saving.set(false); this.error.set('The draft could not be saved. Check your access and try again.'); },
    });
  }
}
