import { defineConfig } from 'vitest/config';

// Angular's Vitest runner shares one module cache across spec files by default
// (isolate: false). Specs that mock a package with vi.mock, such as
// notifications-socket.service.spec.ts mocking socket.io-client, then pass or
// fail depending on which file loaded the real module first. Running each spec
// file in its own module context makes those mocks reliable.
export default defineConfig({
  test: {
    isolate: true,
  },
});
