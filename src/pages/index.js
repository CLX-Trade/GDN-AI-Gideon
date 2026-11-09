// Every generated page. The sitemap is built from this list with each page's real
// last-changed date, instead of stamping today's date on everything.
import home from './home.js';
import { workspace, signin, pricing, notFound } from './app-pages.js';
import tools from './tools.js';
import legal from './legal.js';
import guides from './guides.js';
import sampleReport from './sample-report.js';

const UPDATED = '2026-11-09';

export default [
  { path: '/', html: home, updated: UPDATED },
  { path: '/pricing', html: pricing, updated: UPDATED },
  { path: '/sample-report', html: sampleReport, updated: UPDATED },
  { path: '/workspace', html: workspace, updated: UPDATED, sitemap: false },
  { path: '/signin', html: signin, updated: UPDATED, sitemap: false },
  { path: '/404', html: notFound, updated: UPDATED, sitemap: false },
  ...tools,
  ...guides,
  ...legal,
];
