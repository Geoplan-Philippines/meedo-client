import { loadColumns, saveColumns } from './column-visibility';

const columns = [
  { id: 'name', label: 'Name', locked: true },
  { id: 'email', label: 'Email' },
  { id: 'company', label: 'Company' },
];

describe('column visibility', () => {
  beforeEach(() => localStorage.clear());

  it('returns every column when nothing is stored', () => {
    expect(loadColumns('meedo.test.columns', columns)).toEqual(['name', 'email', 'company']);
  });

  it('keeps locked columns and drops unknown ids', () => {
    saveColumns('meedo.test.columns', ['email', 'mystery']);
    expect(loadColumns('meedo.test.columns', columns)).toEqual(['name', 'email']);
  });
});
