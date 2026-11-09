// A sample report that really is computed: the rule engine runs over the fictional pack
// at build time, so this page cannot drift from what the product does.
import { page, esc, closingCta } from '../layout.js';
import { reconcile } from '../../shared/reconcile.js';
import { DEMO_PACK, DEMO_NOW } from '../../shared/demo-pack.js';

const result = reconcile(DEMO_PACK, { now: DEMO_NOW });

const finding = (f) => `<div class="finding"><div class="finding-head"><span class="chip chip-${f.severity}">${f.severity}</span><span class="chip chip-rule">Rule check</span><h3>${esc(f.title)}</h3></div><p>${esc(f.detail)}</p>${f.evidence.length ? `<table class="evidence">${f.evidence.map((e) => `<tr><td>${esc(e.document)}</td><td>${esc(e.value)}</td></tr>`).join('')}</table>` : ''}</div>`;

export default page({
  path: '/sample-report',
  title: 'Sample Trade Document Reconciliation Report · Gideon',
  description: 'See what Gideon finds when trade documents do not agree: a fictional invoice, packing list, bill of lading and letter of credit, compared field by field.',
  body: `
<section class="page-head"><div class="narrow">
  <div class="eyebrow">Sample report</div>
  <h1>What Gideon finds when documents don't agree</h1>
  <p class="lede">A fictional invoice, packing list, bill of lading and letter of credit, compared field by field. The findings below were produced by Gideon's rule engine.</p>
  <p class="note" style="margin-top:18px;padding:14px 16px;background:var(--panel);border:1px solid var(--line);border-radius:8px;font-size:14.5px;color:var(--ink-2)"><strong style="color:var(--ink)">This pack is invented.</strong> All names and figures are fictional, and the errors were planted to show the format. A real report also has an AI review section, with judgement on procedure, missing documents and what to ask next.</p>
</div></section>
<section style="padding-bottom:64px"><div class="narrow">
  <div class="verdict stop" style="padding:20px 22px;border-radius:12px;border:1px solid rgba(255,96,96,.5);background:var(--bad-bg);margin-bottom:18px">
    <h2 style="font-size:23px">Stop and verify before any funds move.</h2>
    <p style="margin-top:8px">${result.counts.high} high-severity and ${result.counts.medium} medium-severity findings across ${result.stats.documents} documents. ${result.stats.fieldsRead} fields read, ${result.stats.comparisons} comparisons made, ${result.stats.identifierChecks} identifiers checked.</p>
  </div>
  ${result.findings.map(finding).join('')}
  <h2 class="h2" style="font-size:24px;margin-top:40px">What this report does not do</h2>
  <p style="color:var(--ink-2)">Gideon flags what does not reconcile and tells you where to look. It has not checked a company registry, confirmed a certificate with its issuer, or contacted a carrier or bank, and it does not replace a person's sign-off. Check anything marked high yourself, before funds move.</p>
</div></section>
${closingCta('Now run your own.')}`,
});
