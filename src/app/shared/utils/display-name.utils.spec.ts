import { clientDisplayName, projectDisplayName } from './display-name.utils';

describe('display names', () => {
  it('shows a project as displayName, else quote subject, else WO number', () => {
    expect(projectDisplayName({ displayName: 'RTLS Phase 2', quoteSubject: 'Quote', workOrderNumber: 'SO-1' })).toBe('RTLS Phase 2');
    expect(projectDisplayName({ displayName: '  ', quoteSubject: 'Quote', workOrderNumber: 'SO-1' })).toBe('Quote');
    expect(projectDisplayName({ displayName: null, quoteSubject: null, workOrderNumber: 'SO-1' })).toBe('SO-1');
  });

  it('shows a client as displayName, else customer name', () => {
    expect(clientDisplayName({ displayName: 'Denso', customerName: 'Denso Philippines Corp.' })).toBe('Denso');
    expect(clientDisplayName({ displayName: null, customerName: 'Denso Philippines Corp.' })).toBe('Denso Philippines Corp.');
    expect(clientDisplayName(null)).toBe('');
  });
});
