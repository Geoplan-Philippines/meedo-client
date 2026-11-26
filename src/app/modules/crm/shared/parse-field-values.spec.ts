import { FieldDefinition } from '../models/field-definition.model';
import { parseFieldValues, readFieldValue, sourceHref } from './parse-field-values';

const def = (partial: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label' | 'type'>): FieldDefinition => ({
  id: partial.key,
  collection: 'lead',
  options: [],
  isRequired: false,
  isReadOnly: false,
  isSystem: false,
  position: 0,
  ...partial,
});

describe('parseFieldValues', () => {
  it('collects unknown, readonly, required, length and url errors together', () => {
    const definitions = [
      def({ key: 'email', label: 'Email', type: 'text', isRequired: true }),
      def({ key: 'notes', label: 'Notes', type: 'long_text' }),
      def({ key: 'site', label: 'Site', type: 'url' }),
      def({ key: 'status', label: 'Status', type: 'text', isReadOnly: true }),
    ];
    const { values, errors } = parseFieldValues(definitions, {
      email: '',
      notes: 'x'.repeat(5001),
      site: 'ftp://example.test',
      status: 'NEW',
      mystery: 'nope',
    });
    expect(values['email']).toBeNull();
    expect(errors).toEqual([
      '"Status" cannot be changed.',
      'Unknown field "mystery".',
      '"Email" is required.',
      '"Notes" must be at most 5000 characters.',
      '"Site" must start with http:// or https://.',
    ]);
  });

  it('accepts http urls, numbers and select options', () => {
    const definitions = [
      def({ key: 'site', label: 'Site', type: 'url' }),
      def({ key: 'score', label: 'Score', type: 'number' }),
      def({ key: 'size', label: 'Size', type: 'select', options: ['S', 'M'] }),
    ];
    const { values, errors } = parseFieldValues(definitions, {
      site: 'https://geoplan.test',
      score: '12',
      size: 'M',
    });
    expect(errors).toEqual([]);
    expect(values).toEqual({ site: 'https://geoplan.test', score: 12, size: 'M' });
  });
});

describe('readFieldValue', () => {
  it('joins first and last name, then falls back to values', () => {
    expect(readFieldValue({ firstName: 'Ada', lastName: 'Lovelace' }, 'name')).toBe('Ada Lovelace');
    expect(readFieldValue({ values: { industry: 'Survey' } }, 'industry')).toBe('Survey');
  });
});

describe('sourceHref', () => {
  it('returns http(s) sources only', () => {
    expect(sourceHref('https://geoplan.test/form')).toBe('https://geoplan.test/form');
    expect(sourceHref('website')).toBeNull();
  });
});
