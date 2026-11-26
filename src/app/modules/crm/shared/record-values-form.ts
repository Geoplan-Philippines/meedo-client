import { ChangeDetectionStrategy, Component, effect, input, untracked } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import {
  FIELD_LONG_TEXT_MAX,
  FIELD_TEXT_MAX,
  FIELD_URL_MAX,
  FieldDefinition,
} from '../models/field-definition.model';
import { parseFieldValues } from './parse-field-values';

@Component({
  selector: 'app-record-values-form',
  imports: [ReactiveFormsModule, InputTextModule, TextareaModule, SelectModule],
  templateUrl: './record-values-form.html',
  styleUrl: './record-values-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordValuesForm {
  readonly definitions = input.required<readonly FieldDefinition[]>();
  readonly initial = input<Record<string, unknown>>({});
  readonly disabled = input(false);
  readonly submitted = input(false);

  readonly form = new FormRecord<FormControl<string>>({});
  readonly textMax = FIELD_TEXT_MAX;
  readonly longTextMax = FIELD_LONG_TEXT_MAX;
  readonly urlMax = FIELD_URL_MAX;

  constructor() {
    effect(() => {
      const definitions = this.writable();
      const initial = this.initial();
      const disabled = this.disabled();
      untracked(() => this.rebuild(definitions, initial, disabled));
    });
  }

  writable(): FieldDefinition[] {
    return this.definitions()
      .filter((definition) => !definition.isReadOnly)
      .slice()
      .sort((a, b) => a.position - b.position);
  }

  parse(): { values: Record<string, unknown>; errors: string[] } {
    return parseFieldValues(this.definitions(), this.form.getRawValue());
  }

  maxlength(definition: FieldDefinition): number {
    if (definition.type === 'long_text') return this.longTextMax;
    if (definition.type === 'url') return this.urlMax;
    return this.textMax;
  }

  invalid(key: string): boolean {
    const control = this.form.controls[key];
    return !!control && control.invalid && (this.submitted() || control.touched);
  }

  private rebuild(definitions: FieldDefinition[], initial: Record<string, unknown>, disabled: boolean): void {
    const keys = new Set(definitions.map((definition) => definition.key));
    for (const key of Object.keys(this.form.controls)) {
      if (!keys.has(key)) this.form.removeControl(key);
    }
    for (const definition of definitions) {
      const value = stringifyValue(initial[definition.key]);
      const existing = this.form.controls[definition.key];
      if (existing) existing.setValue(value, { emitEvent: false });
      else this.form.addControl(definition.key, new FormControl(value, { nonNullable: true }));
    }
    if (disabled) this.form.disable({ emitEvent: false });
    else this.form.enable({ emitEvent: false });
  }
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}
