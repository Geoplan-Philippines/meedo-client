const apiBaseUrl = 'https://meedo-v3-api-stg.geoplanph.com/api/v1';

export const environment = {
  production: true,
  notificationsSocketUrl: new URL(apiBaseUrl).origin,
  apiBaseUrl,
};
