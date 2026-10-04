// Read-only build inspection. Run after npm run build; never loads environment files.
// node tests/performance-snapshot.cjs Raporlar/performance/after-bundle.json
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');

const manifest = JSON.parse(fs.readFileSync('.next/app-build-manifest.json', 'utf8'));
const routes = {};
for (const route of Object.keys(manifest.pages)) {
  if (!route.endsWith('/page')) continue;
  const groups = ['/layout', ...(route.startsWith('/admin/') ? ['/admin/layout',
    ...(route.includes('(protected)') ? ['/admin/(protected)/layout'] : [])] : []), route];
  const files = [...new Set(groups.flatMap(key => manifest.pages[key] || []))].filter(file => file.endsWith('.js'));
  routes[route] = { files: files.length, raw: 0, gzip: 0 };
  for (const file of files) {
    const bytes = fs.readFileSync(path.join('.next', file));
    routes[route].raw += bytes.length;
    routes[route].gzip += zlib.gzipSync(bytes).length;
  }
}
const chunks = fs.readdirSync('.next/static/chunks').filter(file => file.endsWith('.js')).map(file => {
  const bytes = fs.readFileSync(path.join('.next/static/chunks', file));
  return { file, raw: bytes.length, gzip: zlib.gzipSync(bytes).length };
}).sort((a, b) => b.gzip - a.gzip);
const json = JSON.stringify({ routes, chunks }, null, 2) + '\n';
if (process.argv[2]) fs.writeFileSync(process.argv[2], json);
else console.log(json);
