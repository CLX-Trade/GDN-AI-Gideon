// Renders a video page to numbered JPEG frames.
// Usage: node render.cjs <html> <outDir> <fps> <seconds> [only comma-separated seconds for test frames]
// Needs puppeteer-core on NODE_PATH, and the Chrome headless shell in the Puppeteer cache.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const [, , html, out, FPS, DUR, only] = process.argv;
const fps = Number(FPS);
const dur = Number(DUR);
const CHROME = `${process.env.HOME}/.cache/puppeteer/chrome-headless-shell/mac_arm-153.0.8010.36/chrome-headless-shell-mac-arm64/chrome-headless-shell`;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  await page.goto(`file://${path.resolve(html)}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);

  const shoot = async (t, name) => {
    await page.evaluate((x) => window.render(x), t);
    await page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 92 });
  };

  if (only) {
    for (const t of only.split(',').map(Number)) await shoot(t, `test-${String(t).replace('.', '_')}.jpg`);
  } else {
    const total = Math.round(fps * dur);
    for (let i = 0; i < total; i++) await shoot(i / fps, `f${String(i).padStart(5, '0')}.jpg`);
    console.log('frames', total);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
