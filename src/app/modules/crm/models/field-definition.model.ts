export type FieldCollection = 'lead' | 'subscriber';

export type FieldType = 'text' | 'long_text' | 'number' | 'select' | 'url' | 'date' | 'datetime';

export const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
export const FIELD_KEY_MAX = 40;
export const FIELD_TEXT_MAX = 500;
export const FIELD_LONG_TEXT_MAX = 5000;
export const FIELD_URL_MAX = 2048;

export interface FieldDefinition {
  id: string;
  collection: FieldCollection;
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  isRequired: boolean;
  isReadOnly: boolean;
  isSystem: boolean;
  position: number;
}

export interface CreateFieldDefinitionPayload {
  collection: FieldCollection;
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  isRequired?: boolean;
}

export interface UpdateFieldDefinitionPayload {
  label?: string;
  isRequired?: boolean;
  options?: string[];
}

export const FIELD_TYPES: readonly { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date and time' },
];
