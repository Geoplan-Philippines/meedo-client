import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Match tickets: whitespace is removed before checking required text and limits.
export const campaignTextValidator = (limit: number): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
  const text = typeof control.value === 'string' ? control.value.trim() : '';
  if (!text) return { required: true };
  return text.length > limit ? { maxlength: true } : null;
};

export const campaignBodyRequired: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const document = new DOMParser().parseFromString(String(control.value ?? ''), 'text/html');
  return document.body.textContent?.trim() ? null : { required: true };
};
