# MeedoV3

> Frontend application built with Angular CLI and powered by Bun as the package manager.

## Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/), required by Angular CLI
- [Bun](https://bun.sh/), the package manager

## Setup

```bash
git clone https://github.com/Geoplan-Philippines/meedov3.git
cd meedov3
bun install
```

## Development

```bash
bun run start
```

Runs at `http://localhost:4200`. Hot-reloads on file changes.

## Build

```bash
bun run build
```

Output goes to `dist/`. Production build by default.

## Testing

Run unit tests with [Vitest](https://vitest.dev/):

```bash
bun run test
```

## Deployment API and notification socket URL

`API_BASE_URL` is the single Docker build argument for the API endpoint and
notifications socket origin. `scripts/configure-api-url.cjs` writes it into
`environment.prod.ts`; that environment derives the socket origin using
`new URL(apiBaseUrl).origin`. The socket client appends `/notifications` as its
namespace, so `/api/v1` must not be part of the socket URL.

The existing deploy workflow passes its production API_URL on master and staging
API_URL on staging. No new repository variable or secret is required. The source
environment and Docker argument retain their staging default for local builds.
To check replacement without Docker, run `node scripts/configure-api-url.cjs
<API_BASE_URL> <temporary-environment-file>` against a copy of the production
environment. This is the same script the Dockerfile invokes.
