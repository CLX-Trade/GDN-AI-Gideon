// Tells IndexNow search engines (Bing, Yandex and others) that pages have changed.
// Run by hand after a production deploy:
//   node scripts/indexnow.mjs                  every URL in the live sitemap
//   node scripts/indexnow.mjs /guides/foo ...  only these paths
// The key is public by design: it is the name and content of a .txt file in static/.
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'www.gdn-ai.com';
const staticDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'static');
const keyFile = (await readdir(staticDir)).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file in static/');
const key = keyFile.slice(0, -4);
const keyLocation = `https://${HOST}/${keyFile}`;

const live = await fetch(keyLocation);
if (!live.ok || (await live.text()).trim() !== key) throw new Error(`The key file is not live at ${keyLocation}. Deploy first.`);

let urlList = process.argv.slice(2).map((arg) => {
  const url = new URL(arg, `https://${HOST}`);
  if (url.host !== HOST) throw new Error(`${arg} is not on ${HOST}`);
  return url.href;
});
if (!urlList.length) {
  const sitemap = await fetch(`https://${HOST}/sitemap.xml`);
  if (!sitemap.ok) throw new Error(`Sitemap answered ${sitemap.status}`);
  urlList = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!urlList.length) throw new Error('The sitemap lists no URLs');
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation, urlList }),
});
console.log(`IndexNow answered ${res.status} ${res.statusText} for ${urlList.length} URLs`);
if (res.status >= 300) {
  console.log(await res.text());
  process.exitCode = 1;
}
