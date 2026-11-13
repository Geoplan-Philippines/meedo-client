import { toHttpParams } from './page-query';

describe('toHttpParams', () => {
  it('leaves out empty values and repeats arrays', () => {
    const params = toHttpParams({
      page: 2, limit: 25, search: '  acme  ', blank: '   ', none: null, missing: undefined,
      flag: false, ids: ['a', 'b'], empty: [] as string[],
    });
    expect(params.keys().sort()).toEqual(['flag', 'ids', 'limit', 'page', 'search']);
    expect(params.get('search')).toBe('acme');
    expect(params.get('flag')).toBe('false');
    expect(params.getAll('ids')).toEqual(['a', 'b']);
  });
});
