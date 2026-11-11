import { environment } from './environment.prod';

describe('production deployment environment', () => {
  it('uses the API origin for the notifications namespace without the API path', () => {
    expect(environment.notificationsSocketUrl).toBe(new URL(environment.apiBaseUrl).origin);
    expect(new URL(`${environment.notificationsSocketUrl}/notifications`).pathname).toBe('/notifications');
    expect(environment.production).toBe(true);
  });
});
