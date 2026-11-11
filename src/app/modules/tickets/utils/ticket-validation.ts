import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Required text must contain something other than whitespace. */
export function trimmedRequired(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim() ? null : { required: true };
}
