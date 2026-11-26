import {
  FIELD_LONG_TEXT_MAX,
  FIELD_TEXT_MAX,
  FIELD_URL_MAX,
  FieldDefinition,
} from '../models/field-definition.model';

const HTTP_URL = /^https?:\/\//i;

export function parseFieldValues(
  definitions: readonly FieldDefinition[],
  raw: Record<string, unknown>,
): { values: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const known = new Map(definitions.map((definition) => [definition.key, definition]));

  for (const key of Object.keys(raw)) {
    const definition = known.get(key);
    if (!definition) {
      errors.push(`Unknown field "${key}".`);
      continue;
    }
    if (definition.isReadOnly) errors.push(`"${definition.label}" cannot be changed.`);
  }

  const values: Record<string, unknown> = {};
  for (const definition of definitions) {
    if (definition.isReadOnly) continue;
    const parsed = parseOne(definition, raw[definition.key], errors);
    if (parsed !== undefined) values[definition.key] = parsed;
  }

  return { values, errors };
}

function parseOne(definition: FieldDefinition, raw: unknown, errors: string[]): unknown {
  if (isEmpty(raw)) {
    if (definition.isRequired) errors.push(`"${definition.label}" is required.`);
    return null;
  }

  switch (definition.type) {
    case 'text':
      return parseText(definition, raw, errors, FIELD_TEXT_MAX);
    case 'long_text':
      return parseText(definition, raw, errors, FIELD_LONG_TEXT_MAX);
    case 'url':
      return parseUrl(definition, raw, errors);
    case 'number':
      return parseNumber(definition, raw, errors);
    case 'select':
      return parseSelect(definition, raw, errors);
    case 'date':
    case 'datetime':
      return parseText(definition, raw, errors, 64);
    default:
      errors.push(`"${definition.label}" has an unsupported type.`);
      return undefined;
  }
}

function parseText(definition: FieldDefinition, raw: unknown, errors: string[], max: number): string | undefined {
  if (typeof raw !== 'string') {
    errors.push(`"${definition.label}" must be text.`);
    return undefined;
  }
  const value = raw.trim();
  if (!value) {
    if (definition.isRequired) errors.push(`"${definition.label}" is required.`);
    return null as unknown as undefined;
  }
  if (value.length > max) {
    errors.push(`"${definition.label}" must be at most ${max} characters.`);
    return undefined;
  }
  return value;
}

function parseUrl(definition: FieldDefinition, raw: unknown, errors: string[]): string | undefined {
  const value = parseText(definition, raw, errors, FIELD_URL_MAX);
  if (!value) return value;
  if (!HTTP_URL.test(value)) {
    errors.push(`"${definition.label}" must start with http:// or https://.`);
    return undefined;
  }
  return value;
}

function parseNumber(definition: FieldDefinition, raw: unknown, errors: string[]): number | undefined {
  const number = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(number)) {
    errors.push(`"${definition.label}" must be a number.`);
    return undefined;
  }
  return number;
}

function parseSelect(definition: FieldDefinition, raw: unknown, errors: string[]): string | undefined {
  if (typeof raw !== 'string') {
    errors.push(`"${definition.label}" must be one of the allowed options.`);
    return undefined;
  }
  const value = raw.trim();
  if (!definition.options.includes(value)) {
    errors.push(`"${definition.label}" must be one of the allowed options.`);
    return undefined;
  }
  return value;
}

function isEmpty(raw: unknown): boolean {
  return raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
}

/** Reads a field from a record: real columns first, then the values map. */
export function readFieldValue(record: Record<string, unknown> | null | undefined, key: string): unknown {
  if (!record) return '';
  if (key === 'name' && (record['firstName'] != null || record['lastName'] != null)) {
    return [record['firstName'], record['lastName']].filter((part) => typeof part === 'string' && part.trim()).join(' ');
  }
  if (record[key] !== undefined && record[key] !== null) return record[key];
  const values = record['values'];
  if (values && typeof values === 'object' && !Array.isArray(values)) {
    return (values as Record<string, unknown>)[key];
  }
  return '';
}

export function sourceHref(source: string | undefined): string | null {
  if (!source || !HTTP_URL.test(source.trim())) return null;
  return source.trim();
}
