// Builds the site into public/. No bundler: static HTML from small templates, plain
// CSS and JS, and third-party browser libraries copied from npm so they are served
// from our own domain, where corporate networks do not block them.
import { rm, mkdir, cp, writeFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'static'), out, { recursive: true });
await cp(join(root, 'src/assets'), join(out, 'assets'), { recursive: true });
await cp(join(root, 'shared'), join(out, 'assets'), { recursive: true });

const vendor = join(out, 'vendor');
await mkdir(vendor, { recursive: true });
const copies = [
  ['node_modules/pdfjs-dist/legacy/build/pdf.min.mjs', 'pdf.min.mjs'],
  ['node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs'],
  ['node_modules/html2pdf.js/dist/html2pdf.bundle.min.js', 'html2pdf.bundle.min.js'],
  ['node_modules/xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js'],
];
for (const [from, to] of copies) await cp(join(root, from), join(vendor, to));

const pages = (await import('../src/pages/index.js')).default;
const urls = [];
for (const entry of pages) {
  const file = entry.path === '/' ? 'index.html' : `${entry.path.slice(1)}.html`;
  const target = join(out, file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, entry.html);
  if (entry.sitemap !== false) urls.push(entry);
}

// Served through a rewrite or from static/, so these have no generated page of their own.
urls.push({ path: '/try', updated: '2026-11-09' }, { path: '/meeting-room', updated: '2026-11-09' });

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>https://www.gdn-ai.com${u.path}</loc><lastmod>${u.updated}</lastmod></url>`).join('\n')}
</urlset>
`;
await writeFile(join(out, 'sitemap.xml'), sitemap);
await writeFile(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /app\n\nSitemap: https://www.gdn-ai.com/sitemap.xml\n`);

async function size(dir) {
  let total = 0;
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    total += s.isDirectory() ? await size(p) : s.size;
  }
  return total;
}
console.log(`Built ${pages.length} pages, ${(await size(out) / 1048576).toFixed(1)} MB`);
