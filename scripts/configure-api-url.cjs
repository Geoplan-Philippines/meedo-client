const fs = require('node:fs');
const path = require('node:path');

// The deployment's API_BASE_URL is the sole source for HTTP and Socket.IO.
const [apiBaseUrl, target = path.resolve(__dirname, '../src/environments/environment.prod.ts')] = process.argv.slice(2);
const url = new URL(apiBaseUrl);
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
  throw new Error('API_BASE_URL must be an HTTP(S) URL without credentials, query or fragment');
}
const source = fs.readFileSync(target, 'utf8');
const declaration = /^const apiBaseUrl = .*;$/m;
if (!declaration.test(source)) throw new Error('Missing apiBaseUrl declaration');
fs.writeFileSync(target, source.replace(declaration, () => `const apiBaseUrl = ${JSON.stringify(apiBaseUrl)};`));
