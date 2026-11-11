import { notificationRoute } from './notification-route';

describe('notification route allowlist', () => {
  it('builds ticket segments and a membership-filtered project destination without reading payload links', () => {
    expect(
      notificationRoute({ entityType: 'ticket', entityId: 'a/b?c#d' }),
    ).toEqual(['/tickets', 'a/b?c#d']);
    expect(
      notificationRoute({ entityType: 'project', entityId: 'project' }),
    ).toEqual(['/settings', 'projects']);
    expect(
      notificationRoute({ entityType: 'client', entityId: 'client' }),
    ).toBeNull();
    expect(
      notificationRoute({ entityType: 'ticket', entityId: '' }),
    ).toBeNull();
    expect(
      notificationRoute({ entityType: '__proto__', entityId: 'id' }),
    ).toBeNull();
  });
});
