// The Gideon workspace: pack checks and chat for trial visitors and members alike.
// The server decides who gets what. This file only reflects what it is told, so
// nothing here can grant access by being edited in the browser.
import { readDocument, documentBlocks, ACCEPT, ReadError } from './doc-reader.js';
import { generateFile, extractFiles } from './files.js';
import { Speaker, Talk, TalkError, audio, talkSupported } from './voice.js';
import { displayText, windowMessages, annotateInterrupted, wantsPackCheck, wordCount, headline } from './speech.js';

const $ = (id) => document.getElementById(id);
const IS_APP_ROUTE = location.pathname === '/app';
const HISTORY_KEY = 'gideon.history.v2';
const MAX_BODY_CHARS = 4_200_000;
const FILE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.5 12.6 21a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15.6 9"/></svg>';

const state = {
  status: null,
  conv: null,
  staged: [],
  attachments: [],
  running: false,
  packRunning: false,
  queue: [],
  heldTurn: '',
  fillerTurn: false,
  dictation: false,
  voice: false,
};

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- history, kept only in this browser ---------- */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}
function saveHistory(list) {
  let items = list;
  while (items.length) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); return; } catch { items = items.slice(0, -1); }
  }
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* storage unavailable */ }
}
// Page images are dropped from saved history: they are large, and localStorage is small.
function storable(conv) {
  return {
    ...conv,
    messages: (conv.messages || []).map((m) => (Array.isArray(m.api) ? { ...m, api: m.api.filter((b) => b.type !== 'image') } : m)),
  };
}
function persist(conv) {
  conv.updated = Date.now();
  const list = loadHistory().filter((c) => c.id !== conv.id);
  list.unshift(storable(conv));
  saveHistory(list.slice(0, 60));
  renderHistory();
}
function renderHistory() {
  const box = $('history');
  const term = $('rail-search').value.trim().toLowerCase();
  const list = loadHistory().filter((c) => !term || c.title.toLowerCase().includes(term));
  if (!list.length) {
    box.innerHTML = `<div class="hist-empty">${term ? 'Nothing found.' : 'Your checks and chats appear here. They stay in this browser.'}</div>`;
    return;
  }
  box.innerHTML = '<h5>Recent</h5>';
  for (const conv of list) {
    const b = document.createElement('button');
    b.className = `hist${state.conv && state.conv.id === conv.id ? ' on' : ''}`;
    b.innerHTML = `<i class="${conv.kind === 'pack' ? 'pack' : ''}"></i><span></span>`;
    b.lastChild.textContent = conv.title;
    b.addEventListener('click', () => openConversation(conv.id));
    box.append(b);
  }
}
function openConversation(id) {
  const conv = loadHistory().find((c) => c.id === id);
  if (!conv || state.running) return;
  speaker.discard();
  state.conv = conv;
  closeRail();
  if (conv.kind === 'pack') showReport(conv.report);
  else showChat();
  renderHistory();
}

/* ---------- status and account ---------- */
async function refreshStatus() {
  try {
    const res = await fetch('/api/status');
    state.status = await res.json();
  } catch {
    state.status = state.status || { signedIn: false, member: false, used: null, limit: 3, maxDocsPerPack: 3 };
  }
  renderAccount();
  return state.status;
}
function renderAccount() {
  const s = state.status;
  const box = $('account');
  if (!s) return;
  const used = s.used ?? 0;
  const pct = s.limit ? Math.min(100, (used / s.limit) * 100) : 0;
  const low = pct >= 80;
  const meter = s.used === null ? '' : `<div class="meter${low ? ' low' : ''}"><i style="width:${pct}%"></i></div>`;
  if (s.member) {
    box.innerHTML = `<div class="account-email" title="${escapeHtml(s.email)}">${escapeHtml(s.email)}</div><div class="account-plan">${escapeHtml(s.tierLabel)} plan</div>${meter}<div class="account-plan">${s.used === null ? '' : `${used.toLocaleString()} of ${s.limit.toLocaleString()} queries this month`}</div><div class="account-links"><button class="linkish" id="billing">Manage billing</button><button class="linkish" id="signout">Sign out</button></div>`;
  } else {
    const left = Math.max(0, (s.limit ?? 3) - used);
    box.innerHTML = `<div class="account-email">${s.signedIn ? escapeHtml(s.email) : 'Free trial'}</div><div class="account-plan">${left} of ${s.limit ?? 3} free ${s.limit === 1 ? 'query' : 'queries'} left</div>${meter}<div class="account-links"><a class="linkish" href="/pricing">See plans</a>${s.signedIn ? '<button class="linkish" id="signout">Sign out</button>' : '<a class="linkish" href="/signin">Sign in</a>'}</div>`;
  }
  const out = $('signout');
  if (out) out.addEventListener('click', async () => { await fetch('/api/auth?action=logout', { method: 'POST' }); location.href = '/'; });
  const billing = $('billing');
  if (billing) billing.addEventListener('click', openBilling);
}
async function openBilling() {
  const btn = $('billing');
  btn.textContent = 'Opening…';
  try {
    const res = await fetch('/api/checkout?action=portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) { location.href = data.url; return; }
    showBanner(data.error || 'The billing page is unavailable.', true);
  } catch {
    showBanner('The billing page is unavailable. Email gnardo@gdngroup.com.au and we will change or cancel your plan.', true);
  }
  btn.textContent = 'Manage billing';
}
function showBanner(text, warn = false) {
  const b = $('banner');
  b.textContent = text;
  b.className = `banner${warn ? ' warn' : ''}`;
  b.hidden = false;
}

/* ---------- views ---------- */
function setTitle(text) { $('ws-title').textContent = text; }
function view() { return $('view'); }
function scrollDown() { const v = view(); v.scrollTop = v.scrollHeight; }

function showStart() {
  state.conv = null;
  state.staged = [];
  setTitle(state.status && state.status.member ? 'New check' : 'Free trial');
  const docs = state.status ? state.status.maxDocsPerPack : 3;
  view().innerHTML = `<div class="ws-inner start">
    <h1>Drop in the pack.</h1>
    <p>Gideon compares every field across every document and shows you what doesn't reconcile.</p>
    <label class="drop" id="drop"><input type="file" id="drop-input" multiple accept="${ACCEPT}" aria-label="Choose documents">
      <b>Choose documents, or drop them here</b>
      <small>PDF, scans, photos, Word, Excel or text. Two to ${docs} documents on your plan. Your files are not stored.</small>
    </label>
    <p class="drop-demo">No documents to hand? <button class="linkish" id="use-samples">Try it on a fictional sample pack</button></p>
    <div class="suggest">
      <button data-q="What should match between a commercial invoice, a packing list and a bill of lading? Give me a checklist I can use today.">What must match between an invoice, packing list and B/L?</button>
      <button data-q="I have been sent an offer for EN590 with a very low price and a request for a deposit before inspection. What are the red flags, and what should I ask for next?">What are the red flags in this kind of commodity offer?</button>
      <button data-q="What are the most common discrepancies that get documents refused under a letter of credit, and how do I avoid them?">Why do banks refuse documents under a letter of credit?</button>
      <button data-q="How do I verify that a vessel, its IMO number and its current position match what a seller is telling me?">How do I check a vessel is real?</button>
    </div>
  </div>`;
  const input = $('drop-input');
  input.addEventListener('change', () => { stageFiles([...input.files]); input.value = ''; });
  view().querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { $('input').value = b.getAttribute('data-q'); sendFromComposer(); }));
  $('use-samples').addEventListener('click', (e) => { e.preventDefault(); useSamplePack(); });
  renderHistory();
}

function fileLabel(name) {
  const m = String(name).match(/\.([a-z0-9]{1,4})$/i);
  return m ? m[1] : 'doc';
}

function stageFiles(files) {
  if (!files.length) return;
  closeRail();
  state.conv = null;
  const fresh = files.map((file) => ({ file, name: file.name, state: 'reading', note: 'Opening in your browser…', doc: null }));
  state.staged.push(...fresh);
  renderStage();
  if (talk.active && !speaker.active) speaker.clip('got-it');
  for (const item of fresh) {
    readDocument(item.file, (note) => { item.note = note; updateStagedRow(item); })
      .then((doc) => {
        item.doc = doc;
        item.state = 'ready';
        item.note = describeRead(doc);
      })
      .catch((e) => {
        item.state = 'error';
        item.note = e instanceof ReadError ? e.message : 'This file could not be read.';
        console.error('read failed', e);
      })
      .finally(renderStage);
  }
}

function describeRead(doc) {
  const parts = [];
  if (doc.pages) parts.push(`${doc.pages} page${doc.pages === 1 ? '' : 's'}`);
  if (doc.notes && doc.notes.length) parts.push(doc.notes.join(' '));
  else parts.push('ready');
  return parts.join(', ');
}

function stagedRowHtml(item, index, removable) {
  const cls = item.state === 'error' ? 'err' : item.state === 'done' ? 'ok' : (item.state === 'reading' || item.state === 'working') ? 'busy' : '';
  return `<div class="pdoc ${cls}" data-i="${index}"><div class="pdoc-icon">${item.state === 'done' ? '✓' : escapeHtml(fileLabel(item.name))}</div><div><div class="pdoc-name">${escapeHtml(item.name)}</div><div class="pdoc-state">${escapeHtml(item.note)}</div></div>${removable ? `<button class="pdoc-x" data-remove="${index}" aria-label="Remove ${escapeHtml(item.name)}">×</button>` : '<span></span>'}</div>`;
}
function updateStagedRow(item) {
  const i = state.staged.indexOf(item);
  const row = view().querySelector(`.pdoc[data-i="${i}"] .pdoc-state`);
  if (row) row.textContent = item.note;
}

function renderStage() {
  setTitle('New check');
  const items = state.staged;
  if (!items.length) { showStart(); return; }
  const ready = items.filter((i) => i.state === 'ready');
  const reading = items.some((i) => i.state === 'reading');
  const max = state.status ? state.status.maxDocsPerPack : 3;
  let hint = '';
  if (reading) hint = 'Reading your files in the browser…';
  else if (ready.length < 2) hint = 'A pack check compares at least two documents. Add another, or ask a question about this one.';
  else if (ready.length > max) hint = `Your plan checks up to ${max} documents at a time. Remove ${ready.length - max}, or upgrade.`;
  else hint = state.status && !state.status.member ? `Uses ${ready.length} of your free queries.` : `Uses ${ready.length} queries.`;

  view().innerHTML = `<div class="ws-inner">
    <h1 style="font-size:26px">Your pack</h1>
    <div class="pack-list">${items.map((it, i) => stagedRowHtml(it, i, true)).join('')}</div>
    <div class="pack-actions">
      <button class="btn btn-primary" id="run-pack" ${reading || ready.length < 2 || ready.length > max ? 'disabled' : ''}>Check ${ready.length || ''} document${ready.length === 1 ? '' : 's'}</button>
      <label class="btn btn-ghost" style="position:relative;overflow:hidden">Add more<input type="file" multiple accept="${ACCEPT}" id="add-more" style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Add more documents"></label>
      ${ready.length ? '<button class="btn btn-ghost" id="ask-instead">Ask a question instead</button>' : ''}
      <span class="pack-hint">${escapeHtml(hint)}</span>
    </div>
  </div>`;
  view().querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
    state.staged.splice(Number(b.getAttribute('data-remove')), 1);
    renderStage();
  }));
  $('add-more').addEventListener('change', (e) => { stageFiles([...e.target.files]); });
  $('run-pack').addEventListener('click', runPack);
  const ask = $('ask-instead');
  if (ask) ask.addEventListener('click', () => {
    state.attachments = ready.map((i) => i.doc);
    state.staged = [];
    renderAttachments();
    showChat(true);
    $('input').focus();
  });
}

/* ---------- pack check ---------- */
const SAMPLE_PACK = [
  { name: 'Sample commercial invoice.txt', text: 'COMMERCIAL INVOICE\nInvoice No: MC-2026-1001   Date: 12 September 2026\nContract: SPA-4471\nSeller: Meridian Commodities Pte Ltd, Singapore\nBuyer: Harbourline Imports Pty Ltd, Brisbane\nGoods: Refined white sugar ICUMSA 45, HS 1701.99\nQuantity: 500.000 MT   Unit price: USD 612.00/MT   Total: USD 306,000.00\nTerms: CIF Brisbane\nPort of loading: Santos   Port of discharge: Brisbane\nShipment date: 11 September 2026\nPay to: Meridian Commodities Pte Ltd, SWIFT OCBCSGSG' },
  { name: 'Sample packing list.txt', text: 'PACKING LIST\nReference invoice MC-2026-1001\nSeller: Meridian Commodities Pte Ltd\nBuyer: Harbourline Imports Pty Ltd\nNet weight: 480.000 MT\nContainers: CSQU3054383, MSKU1234565' },
  { name: 'Sample bill of lading.txt', text: 'BILL OF LADING No. SNTBNE260911\nShipper: Meridian Commodity Trading Pte Ltd\nConsignee: To order of Harbourline Imports Pty Ltd\nVessel: MV Southern Cross   IMO 9074728\nPort of loading: Santos   Port of discharge: Brisbane\nNet weight: 500.000 MT\nContainers: CSQU3054383, MSKU1234565\nShipped on board: 9 September 2026\nDate of issue: 9 September 2026' },
];

function useSamplePack() {
  const max = state.status ? state.status.maxDocsPerPack : 3;
  state.staged = SAMPLE_PACK.slice(0, Math.max(2, max)).map((s) => ({
    name: s.name, state: 'ready', note: 'fictional sample', file: null,
    doc: { name: s.name, text: s.text, images: [], pages: 1, notes: [] },
  }));
  renderStage();
}

async function postPack(action, body) {
  const res = await fetch(`/api/pack?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function renderProgress(items, heading) {
  view().innerHTML = `<div class="ws-inner"><h1 style="font-size:26px">${escapeHtml(heading)}</h1><div class="pack-list">${items.map((it, i) => stagedRowHtml(it, i, false)).join('')}</div></div>`;
}

async function extractOne(item, run, retry = false) {
  item.state = 'working';
  item.note = retry ? 'Trying again…' : 'Extracting every field…';
  renderProgress(state.staged, 'Reading your documents');
  const payload = { run, retry, doc: { name: item.name, text: item.doc.text, images: item.doc.images } };
  if (JSON.stringify(payload).length > MAX_BODY_CHARS) {
    item.state = 'error';
    item.note = 'This document is too large to send in one go. Split it into smaller files and try again.';
    renderProgress(state.staged, 'Reading your documents');
    return false;
  }
  const { ok, data } = await postPack('extract', payload);
  if (ok) {
    item.state = 'done';
    item.result = data;
    item.note = `${data.fields.length} field${data.fields.length === 1 ? '' : 's'} extracted${data.readability !== 'clear' ? `, ${data.readability === 'poor' ? 'poor' : 'partly'} legible` : ''}`;
    renderProgress(state.staged, 'Reading your documents');
    return true;
  }
  if (!retry && data.code === 'upstream') return extractOne(item, run, true);
  item.state = 'error';
  item.note = data.error || 'This document could not be read.';
  renderProgress(state.staged, 'Reading your documents');
  return false;
}

async function runPack() {
  if (state.running) return;
  const items = state.staged.filter((i) => i.state === 'ready');
  state.staged = items;
  state.running = true;
  state.packRunning = true;
  setComposerEnabled(false);
  try {
    const started = await postPack('start', { documents: items.length });
    if (!started.ok) {
      if (started.status === 402) { await refreshStatus(); renderStage(); showPaywall(started.data.error); return; }
      if (started.data.code === 'quota') { renderStage(); showBanner(started.data.error, true); return; }
      renderStage();
      showBanner(started.data.error || 'The check could not start. Please try again.', true);
      return;
    }
    const { run } = started.data;
    window.Gideon.track('pack_check', { documents: items.length });
    await refreshStatus();

    // Three at a time keeps it quick without tripping rate limits.
    const queue = [...items];
    await Promise.all([0, 1, 2].map(async () => {
      while (queue.length) await extractOne(queue.shift(), run).catch((e) => { console.error(e); });
    }));

    const read = items.filter((i) => i.state === 'done');
    if (read.length < 2) {
      await postPack('cancel', { run });
      await refreshStatus();
      showBanner('Too few documents could be read to compare. You were not charged for the ones that failed.', true);
      state.staged = items.map((i) => ({ ...i, state: 'ready', note: 'ready' }));
      renderStage();
      return;
    }

    renderProgress(items, `Comparing ${read.length} documents`);
    view().querySelector('.ws-inner').insertAdjacentHTML('beforeend', '<p class="thinking"><i></i>Checking every field, then a senior review. This takes about half a minute.</p>');
    const failed = items.length - read.length;
    const finished = await postPack('reconcile', { run, docs: read.map((i) => i.result) });
    if (!finished.ok) {
      showBanner(finished.data.error || 'The comparison failed. Please try again.', true);
      state.staged = items.map((i) => ({ ...i, state: 'ready', note: 'ready' }));
      renderStage();
      return;
    }
    const report = { ...finished.data, unread: failed ? items.filter((i) => i.state === 'error').map((i) => i.name) : [] };
    const title = `${read.length} docs: ${report.rules.documents.map((d) => d.name.replace(/\.[a-z0-9]+$/i, '')).join(', ')}`.slice(0, 80);
    state.conv = { id: crypto.randomUUID(), kind: 'pack', title, report, messages: [] };
    persist(state.conv);
    state.staged = [];
    showReport(report);
    await refreshStatus();
    // On a call, Gideon reports back in his own voice, unless he was asked something meanwhile.
    if (talk.active && !state.heldTurn) speaker.say(`${headline(report.summary || (VERDICTS[report.verdict] || VERDICTS.review)[1])} The full report is on your screen.`);
  } catch (e) {
    console.error('pack failed', e);
    showBanner('Something interrupted the check. Please try again.', true);
    renderStage();
  } finally {
    state.running = false;
    state.packRunning = false;
    setComposerEnabled(true);
    if (state.heldTurn) {
      const held = state.heldTurn;
      state.heldTurn = '';
      chain(() => spokenTurn(held));
    }
  }
}

const VERDICTS = {
  stop: ['stop', 'Stop and verify before any funds move.'],
  review: ['review', 'Review these points before you proceed.'],
  no_conflicts: ['clear', 'No conflicts found across these documents.'],
};

function evidenceTable(evidence) {
  if (!evidence || !evidence.length) return '';
  return `<table class="evidence">${evidence.map((e) => `<tr><td>${escapeHtml(e.document)}${e.page ? ` <span class="muted">p.${escapeHtml(e.page)}</span>` : ''}</td><td>${escapeHtml(e.value)}</td></tr>`).join('')}</table>`;
}

function reportDocument(report) {
  const { rules } = report;
  const headline = (VERDICTS[report.verdict] || VERDICTS.review)[1];
  const brief = `Here is the pack report you produced.\n\nVerdict: ${headline}\nSummary: ${report.summary || 'n/a'}\n\nFindings:\n${[...rules.findings, ...report.aiFindings].map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`).join('\n')}\n\nExtracted values:\n${rules.matrix.map((m) => `${m.label}: ${m.cells.map((cell, i) => (cell.length ? `${rules.documents[i].name} = ${cell.map((c) => c.value).join(', ')}` : null)).filter(Boolean).join('; ')}`).join('\n')}`;
  return { name: 'Pack report', text: brief, images: [], pages: null, notes: [] };
}

function showReport(report) {
  setTitle('Pack report');
  const { rules } = report;
  const [cls, headline] = VERDICTS[report.verdict] || VERDICTS.review;
  const ruleCards = rules.findings.map((f) => `<div class="finding"><div class="finding-head"><span class="chip chip-${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span><span class="chip chip-rule">Rule check</span><h4>${escapeHtml(f.title)}</h4></div><p>${escapeHtml(f.detail)}</p>${evidenceTable(f.evidence)}</div>`).join('');
  const aiCards = report.aiFindings.map((f) => `<div class="finding"><div class="finding-head"><span class="chip chip-${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span><span class="chip">AI review</span><h4>${escapeHtml(f.title)}</h4></div><p>${escapeHtml(f.detail)}</p>${f.next_step ? `<p><strong>Next:</strong> ${escapeHtml(f.next_step)}</p>` : ''}</div>`).join('');
  const headers = rules.documents.map((d) => `<th title="${escapeHtml(d.name)}">${escapeHtml(d.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 26))}</th>`).join('');
  const rows = rules.matrix.filter((m) => m.cells.flat().length).map((m) => `<tr class="m-${escapeHtml(m.status)}"><th>${escapeHtml(m.label)}</th>${m.cells.map((cell) => (cell.length ? `<td class="filled">${cell.map((c) => escapeHtml(c.value)).join('<br>')}</td>` : '<td class="muted">—</td>')).join('')}</tr>`).join('');

  view().innerHTML = `<div class="ws-inner">
    <div class="verdict ${cls}"><h2>${escapeHtml(headline)}</h2><p>${escapeHtml(report.summary || 'The rule checks below are complete. The AI review was unavailable for this run.')}</p></div>
    <div class="stat-row">
      <div class="stat"><b>${rules.counts.high + report.aiFindings.filter((f) => f.severity === 'high').length}</b><span>high severity</span></div>
      <div class="stat"><b>${rules.stats.fieldsRead}</b><span>fields read</span></div>
      <div class="stat"><b>${rules.stats.comparisons}</b><span>comparisons</span></div>
      <div class="stat"><b>${rules.stats.identifierChecks}</b><span>identifier checks</span></div>
    </div>
    ${report.unread && report.unread.length ? `<div class="banner warn" style="border-radius:8px;margin-bottom:14px">Not included, could not be read: ${escapeHtml(report.unread.join(', '))}. You were not charged for ${report.unread.length === 1 ? 'it' : 'them'}.</div>` : ''}
    ${ruleCards ? `<h3 class="report-h">What doesn't reconcile</h3>${ruleCards}` : '<h3 class="report-h">Rule checks</h3><p class="muted">Every field that appears in more than one document agrees, and every identifier passes its check.</p>'}
    ${aiCards ? `<h3 class="report-h">AI review</h3>${aiCards}` : ''}
    ${report.questions && report.questions.length ? `<h3 class="report-h">Questions to ask</h3><ol class="q-list">${report.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol>` : ''}
    ${report.missingDocuments && report.missingDocuments.length ? `<h3 class="report-h">Documents you might expect to see</h3><ul class="q-list">${report.missingDocuments.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ul>` : ''}
    <h3 class="report-h">Side by side</h3>
    <div class="matrix-wrap"><table class="matrix"><thead><tr><th>Field</th>${headers}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="limits">Gideon compares what the documents say. A clean result means they agree, not that they are genuine. It has not checked any registry, bank, carrier or inspection company, and a passing check digit means a number is well formed, not that it exists. Verify anything marked high with the issuing body, using contact details you find independently, before funds move. Checked ${escapeHtml(new Date(report.checkedAt).toLocaleString())}.</div>
    <div class="report-actions">
      <button class="btn btn-primary" id="report-ask">Ask Gideon about this report</button>
      <button class="btn btn-ghost" id="report-print">Print or save as PDF</button>
      <button class="btn btn-ghost" id="report-new">Check another pack</button>
    </div>
  </div>`;
  view().scrollTop = 0;
  $('report-print').addEventListener('click', () => window.print());
  $('report-new').addEventListener('click', showStart);
  $('report-ask').addEventListener('click', () => {
    state.attachments = [reportDocument(report)];
    renderAttachments();
    state.conv = null;
    showChat(true);
    $('input').focus();
  });
  renderHistory();
}

/* ---------- chat ---------- */
function inlineMd(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>');
}

// Everything is HTML-escaped first, so model output can never inject markup.
function renderMarkdown(source) {
  const lines = escapeHtml(source).split('\n');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      closeList();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      out.push(`<pre><code>${code.join('\n')}</code></pre>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      closeList();
      const cells = (l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => inlineMd(c.trim()));
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) rows.push(cells(lines[i++]));
      i--;
      out.push(`<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) { closeList(); out.push(`<h${heading[1].length + 1}>${inlineMd(heading[2])}</h${heading[1].length + 1}>`); continue; }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inlineMd(ol[1])}</li>`); continue; }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ul) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inlineMd(ul[1])}</li>`); continue; }
    const quote = line.match(/^&gt;\s?(.*)$/);
    if (quote) { closeList(); out.push(`<blockquote>${inlineMd(quote[1])}</blockquote>`); continue; }
    if (!line.trim()) { closeList(); continue; }
    closeList();
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  closeList();
  return out.join('');
}

function userBubble(text, names = []) {
  const wrap = document.createElement('div');
  wrap.className = 'msg msg-user';
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = (names.length ? `${names.map((n) => `📎 ${n}`).join('\n')}${text ? '\n\n' : ''}` : '') + text;
  wrap.append(b);
  return wrap;
}
function aiBubble() {
  const wrap = document.createElement('div');
  wrap.className = 'msg msg-ai';
  wrap.innerHTML = '<img src="/media/mark-96.png" alt="" width="30" height="30"><div class="answer-col"><div class="answer"></div></div>';
  return wrap;
}

function fillAnswer(node, text, { sources = [], truncated = false, finished = true } = {}) {
  const answer = node.querySelector('.answer');
  const { clean, files, pending } = extractFiles(displayText(text));
  answer.innerHTML = renderMarkdown(clean) + (pending ? '<p class="thinking"><i></i>Preparing your file…</p>' : '');
  const col = node.querySelector('.answer-col');
  col.querySelectorAll('.files,.sources,.msg-actions,.truncated').forEach((n) => n.remove());
  if (!finished) return;
  if (truncated) {
    const t = document.createElement('p');
    t.className = 'truncated msg-err';
    t.textContent = 'This answer hit its length limit and stopped early. Ask Gideon to continue.';
    col.append(t);
  }
  if (files.length) {
    const box = document.createElement('div');
    box.className = 'files';
    for (const file of files) {
      const b = document.createElement('button');
      b.className = 'btn btn-sm btn-primary';
      b.textContent = `Download ${file.name}`;
      b.addEventListener('click', async () => {
        const label = b.textContent;
        b.disabled = true;
        b.textContent = `Preparing ${file.name}…`;
        try {
          await generateFile(file.name, file.content);
        } catch (e) {
          const err = document.createElement('div');
          err.className = 'file-err';
          err.textContent = e.message || 'That file could not be prepared.';
          box.append(err);
        }
        b.disabled = false;
        b.textContent = label;
      });
      box.append(b);
    }
    col.append(box);
  }
  if (sources.length) {
    const s = document.createElement('div');
    s.className = 'sources';
    s.append('Sources: ');
    for (const src of sources.slice(0, 8)) {
      if (!/^https?:\/\//.test(src.url)) continue;
      const a = document.createElement('a');
      a.href = src.url; a.target = '_blank'; a.rel = 'noopener nofollow';
      a.textContent = (src.title || src.url).slice(0, 48);
      s.append(a);
    }
    col.append(s);
  }
  const actions = document.createElement('div');
  actions.className = 'msg-actions';
  const copy = document.createElement('button');
  copy.className = 'linkish';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(clean); copy.textContent = 'Copied'; } catch { copy.textContent = 'Copy failed'; }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1400);
  });
  actions.append(copy);
  col.append(actions);
}

function showChat(fresh = false) {
  if (fresh || !state.conv) state.conv = null;
  setTitle(state.conv ? state.conv.title : 'New chat');
  const inner = document.createElement('div');
  inner.className = 'ws-inner';
  inner.id = 'thread';
  for (const m of (state.conv && state.conv.messages) || []) {
    if (m.role === 'user') inner.append(userBubble(m.text, m.names));
    else {
      const node = aiBubble();
      fillAnswer(node, m.text, { sources: m.sources || [], truncated: m.truncated });
      inner.append(node);
    }
  }
  view().innerHTML = '';
  view().append(inner);
  scrollDown();
  renderHistory();
}

async function readStream(res, on) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = (frame.match(/^event: (.+)$/m) || [])[1];
      const data = (frame.match(/^data: (.+)$/m) || [])[1];
      if (event && data) on(event, JSON.parse(data));
    }
  }
}

// The answer being written right now, if any. Only one runs at a time, and everything
// that wants to start another goes through userTurn or the queue below.
let activeRun = null;
let turnChain = Promise.resolve();
const READ_ALOUD_CHARS = 1400;
const FILLER_AFTER_MS = 700;

function chain(job) {
  turnChain = turnChain.then(job).catch((e) => console.error('turn failed', e));
  return turnChain;
}
function launch(turn) {
  sendMessage(turn).catch((e) => console.error('message failed', e));
}

// The composer is never locked. Typing or pasting while Gideon writes is fine, and
// sending waits for him to finish, unless he is on a call, where people just cut in.
function sendFromComposer() {
  const input = $('input');
  const text = input.value.trim();
  const docs = state.attachments;
  if ((!text && !docs.length) || state.packRunning) return;
  input.value = '';
  input.style.height = 'auto';
  state.attachments = [];
  renderAttachments();
  if (talk.active) {
    talk.touch();
    chain(() => userTurn({ text, docs }));
  } else if (activeRun) {
    const userNode = userBubble(text, docs.map((d) => d.name));
    userNode.classList.add('queued');
    $('thread').append(userNode);
    scrollDown();
    state.queue.push({ text, docs, userNode });
  } else {
    if (speaker.active) speaker.discard();
    launch({ text, docs });
  }
}

function stopRun(mode) {
  const run = activeRun;
  if (!run) return Promise.resolve();
  run.stopMode = mode;
  speaker.discard();
  run.controller.abort();
  return run.finished;
}

// Records how much of the last answer was actually heard, so the model does not carry
// on as if the person sat through all of it.
function markInterrupted() {
  const messages = (state.conv && state.conv.messages) || [];
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return;
  last.api = annotateInterrupted(last.text, speaker.heardText());
  persist(state.conv);
}

async function userTurn({ text, docs = [], spoken = false }) {
  let message = text;
  let attached = docs;
  if (activeRun && activeRun.completed) {
    // The answer is written and saved, and its first sentence may not have played yet.
    // That is an interruption, not an unfinished thought.
    speaker.discard();
    markInterrupted();
    await activeRun.finished;
  } else if (activeRun) {
    // If Gideon has not said a word yet, the person had simply not finished their
    // thought. Take it all back and answer the whole thing, at no extra charge.
    const stillThinking = spoken && !speaker.playedThisTurn;
    if (stillThinking) {
      message = `${activeRun.userText} ${text}`.trim();
      attached = [...activeRun.docs, ...docs];
    }
    await stopRun(stillThinking ? 'merge' : 'interrupt');
  } else if (speaker.active) {
    speaker.discard();
    markInterrupted();
  }
  launch({ text: message, docs: attached });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A turn that arrives by voice picks up whatever is on the desk: documents waiting to
// be checked, the report on screen, anything pasted into the box.
async function spokenTurn(spoken) {
  if (state.packRunning) {
    state.heldTurn = `${state.heldTurn} ${spoken}`.trim();
    speaker.clip('busy');
    return;
  }
  if (state.staged.length) {
    for (let i = 0; i < 40 && state.staged.some((s) => s.state === 'reading'); i++) await sleep(250);
    const ready = state.staged.filter((s) => s.state === 'ready');
    const max = state.status ? state.status.maxDocsPerPack : 3;
    if (ready.length >= 2 && ready.length <= max && wantsPackCheck(spoken)) {
      speaker.clip('okay');
      runPack();
      return;
    }
    state.attachments = [...state.attachments, ...ready.map((s) => s.doc)];
    state.staged = [];
    renderAttachments();
  }
  if (state.conv && state.conv.kind === 'pack') {
    state.attachments = [reportDocument(state.conv.report), ...state.attachments];
    state.conv = null;
    renderAttachments();
  }
  const input = $('input');
  const typed = input.value.trim();
  let text = spoken;
  if (typed && wordCount(spoken) >= 2) {
    text = `${spoken}\n\n${typed}`;
    input.value = '';
    input.style.height = 'auto';
  }
  const docs = state.attachments;
  state.attachments = [];
  renderAttachments();
  window.Gideon.track('talk_turn');
  await userTurn({ text, docs, spoken: true });
}

async function sendMessage({ text, docs = [], userNode = null }) {
  const inTalk = talk.active;
  if (!state.conv || state.conv.kind !== 'chat') {
    const seed = text || docs[0].name;
    state.conv = { id: crypto.randomUUID(), kind: 'chat', title: seed.slice(0, 64), messages: [] };
    showChat();
  } else if (!$('thread')) {
    showChat();
  }
  const thread = $('thread');
  const input = $('input');
  const names = docs.map((d) => d.name);
  const api = docs.length
    ? [...docs.flatMap(documentBlocks), { type: 'text', text: text || 'Please review the attached document and tell me what stands out.' }]
    : text;
  state.conv.messages.push({ role: 'user', text, names, api });
  if (userNode) {
    userNode.classList.remove('queued');
  } else {
    userNode = userBubble(text, names);
    thread.append(userNode);
  }

  const node = aiBubble();
  node.querySelector('.answer').innerHTML = '<span class="thinking"><i></i>Thinking…</span>';
  thread.append(node);
  scrollDown();

  let requestMessages = state.conv.messages.map((m) => ({ role: m.role, content: m.api || m.text }));
  if (inTalk) requestMessages = windowMessages(requestMessages);
  const body = JSON.stringify(inTalk ? { messages: requestMessages, voice: true } : { messages: requestMessages });
  if (body.length > MAX_BODY_CHARS) {
    state.conv.messages.pop();
    node.querySelector('.answer').innerHTML = '<p class="msg-err">This is too much to send at once. Please start a new chat, or attach fewer or smaller documents.</p>';
    return;
  }

  const run = { controller: new AbortController(), text: '', userText: text, docs, stopMode: null };
  let settled;
  run.finished = new Promise((resolve) => { settled = resolve; });
  activeRun = run;
  state.running = true;

  const speaking = inTalk || state.voice;
  if (inTalk) speaker.begin();
  else if (state.voice) speaker.begin({ maxChars: READ_ALOUD_CHARS });
  let filler = null;
  if (inTalk) {
    talk.setBusy('thinking');
    // A person answering takes a beat and makes a sound. Silence reads as a dropped call.
    filler = setTimeout(() => {
      if (!talk.active || speaker.playedThisTurn || speaker.playing || speaker.held) return;
      state.fillerTurn = !state.fillerTurn;
      if (state.fillerTurn) speaker.clip(['right', 'okay', 'mhm', 'moment'][Math.floor(Math.random() * 4)]);
    }, FILLER_AFTER_MS);
  }

  let text2 = '';
  let meta = { sources: [], truncated: false };
  try {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: run.controller.signal });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      state.conv.messages.pop();
      speaker.discard();
      if (res.status === 402) {
        node.remove();
        userNode.remove();
        if (!input.value) input.value = text;
        state.attachments = [...docs, ...state.attachments];
        renderAttachments();
        await refreshStatus();
        if (talk.active) endTalk();
        showPaywall();
        return;
      }
      node.querySelector('.answer').innerHTML = `<p class="msg-err">${escapeHtml(data.error || 'Gideon could not answer just now. Please try again.')}</p>`;
      if (talk.active) speaker.clip('sorry');
      return;
    }
    let errored = null;
    await readStream(res, (event, data) => {
      if (event === 'delta') {
        text2 += data.text;
        run.text = text2;
        fillAnswer(node, text2, { finished: false });
        const v = view();
        if (v.scrollHeight - v.scrollTop - v.clientHeight < 160) scrollDown();
        if (speaking) speaker.feed(data.text);
        if (inTalk) talk.setBusy('thinking');
      } else if (event === 'status') {
        if (!text2) node.querySelector('.answer').innerHTML = '<span class="thinking"><i></i>Searching the web…</span>';
        if (inTalk && talk.active) {
          talk.setBusy('searching');
          if (!speaker.playedThisTurn && !speaker.playing && !text2) speaker.clip('checking');
        }
      } else if (event === 'done') {
        meta = data;
      } else if (event === 'error') {
        errored = data.message;
      }
    });
    if (errored && !text2) {
      state.conv.messages.pop();
      node.querySelector('.answer').innerHTML = `<p class="msg-err">${escapeHtml(errored)}</p>`;
      speaker.discard();
      if (talk.active) speaker.clip('sorry');
      return;
    }
    if (!text2) {
      state.conv.messages.pop();
      node.querySelector('.answer').innerHTML = '<p class="msg-err">The answer came back empty. Please try again.</p>';
      speaker.discard();
      if (talk.active) speaker.clip('sorry');
      return;
    }
    fillAnswer(node, text2, { sources: meta.sources, truncated: meta.truncated });
    if (errored) {
      const note = document.createElement('p');
      note.className = 'msg-err';
      note.textContent = errored;
      node.querySelector('.answer-col').append(note);
    }
    state.conv.messages.push({ role: 'assistant', text: displayText(text2), sources: meta.sources, truncated: meta.truncated });
    run.completed = true;
    persist(state.conv);
    setTitle(state.conv.title);
    window.Gideon.track('chat_query', { member: Boolean(state.status && state.status.member), voice: inTalk });
    if (speaking) speaker.finish();
    await refreshStatus();
  } catch (e) {
    if (run.stopMode === 'merge') {
      state.conv.messages.pop();
      node.remove();
      userNode.remove();
    } else if (run.stopMode === 'interrupt') {
      if (run.text) {
        const full = displayText(run.text);
        fillAnswer(node, run.text, {});
        state.conv.messages.push({ role: 'assistant', text: full, api: annotateInterrupted(full, speaker.heardText()) });
        persist(state.conv);
      } else {
        node.remove();
      }
    } else {
      console.error('chat failed', e);
      state.conv.messages.pop();
      node.querySelector('.answer').innerHTML = '<p class="msg-err">The connection dropped. Please try again.</p>';
      speaker.discard();
      if (talk.active) speaker.clip('sorry');
    }
  } finally {
    clearTimeout(filler);
    activeRun = null;
    state.running = false;
    talk.setBusy(null);
    settled();
    const next = state.queue.shift();
    if (next) launch(next);
  }
}

function setComposerEnabled(on) {
  $('send').disabled = !on;
}

function renderAttachments() {
  const box = $('chips');
  box.innerHTML = '';
  box.hidden = !state.attachments.length;
  state.attachments.forEach((doc, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip-file';
    const label = document.createElement('span');
    label.textContent = doc.name;
    const x = document.createElement('button');
    x.textContent = '×';
    x.setAttribute('aria-label', `Remove ${doc.name}`);
    x.addEventListener('click', () => { state.attachments.splice(i, 1); renderAttachments(); });
    chip.append(label, x);
    box.append(chip);
  });
}

async function attachFiles(files) {
  for (const file of files) {
    try {
      state.attachments.push(await readDocument(file));
    } catch (e) {
      showBanner(e instanceof ReadError ? `${file.name}: ${e.message}` : `${file.name} could not be read.`, true);
    }
  }
  renderAttachments();
  if (talk.active && state.attachments.length && !speaker.active) speaker.clip('got-it');
}

/* ---------- voice ---------- */
const speaker = new Speaker({ onChange: () => talk.refresh() });
const talk = new Talk({
  speaker,
  onState: renderTalk,
  onLive: (text) => { $('talk-live').textContent = text.length > 110 ? `…${text.slice(-110)}` : text; },
  onTurn: (text) => { chain(() => spokenTurn(text)); },
  onLost: (e) => {
    endTalk();
    showBanner(`${e.message} You can start again, or keep typing.`, true);
  },
  onIdle: () => { speaker.clip('paused'); },
});

const TALK_LABELS = {
  connecting: 'Connecting…',
  listening: 'Listening',
  hearing: 'Listening',
  thinking: 'Thinking',
  searching: 'Searching the web',
  speaking: 'Speaking',
  muted: 'Muted. Gideon can still talk to you',
  paused: 'Microphone paused',
};

let talkFrame = 0;
function animateTalk() {
  if (!talk.active) { talkFrame = 0; return; }
  const level = speaker.playing ? speaker.level() * 3.5 : talk.micLevel * 6;
  document.querySelector('.talk-orb').style.setProperty('--lvl', Math.min(1, level).toFixed(3));
  talkFrame = requestAnimationFrame(animateTalk);
}

function renderTalk(s) {
  const on = s !== 'off';
  const bar = $('talk');
  if (bar.dataset.state === s && bar.hidden === !on && $('talk-mute').getAttribute('aria-pressed') === String(talk.muted)) return;
  bar.hidden = !on;
  bar.dataset.state = s;
  $('talk-state').textContent = TALK_LABELS[s] || '';
  $('talk-start').hidden = on || !talkSupported();
  $('voice').hidden = on;
  $('mic').hidden = on || !state.dictation;
  const mute = $('talk-mute');
  mute.textContent = s === 'paused' ? 'Resume' : talk.muted ? 'Unmute' : 'Mute';
  mute.setAttribute('aria-pressed', String(talk.muted));
  if (on && !talkFrame) talkFrame = requestAnimationFrame(animateTalk);
}

let wakeLock = null;
async function holdScreenOn() {
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* not available here */ }
}

async function startTalk() {
  const s = state.status;
  if (s && !s.member && s.used !== null && s.used >= (s.limit ?? 3)) { showPaywall(); return; }
  audio();
  speaker.discard();
  const clips = speaker.loadClips();
  try {
    await talk.start();
  } catch (e) {
    if (e instanceof TalkError && e.kind === 'paywall') {
      await refreshStatus();
      showPaywall();
    } else {
      showBanner(`${e instanceof TalkError ? e.message : 'Live conversation could not start.'} You can still type to Gideon.`, true);
    }
    return;
  }
  $('banner').hidden = true;
  window.Gideon.track('talk_start', { member: Boolean(s && s.member) });
  holdScreenOn();
  await Promise.race([clips, sleep(1200)]);
  const midChat = state.conv && state.conv.messages && state.conv.messages.length;
  speaker.clip(midChat ? 'okay' : Math.random() < 0.5 ? 'greet-1' : 'greet-2');
}

function endTalk() {
  speaker.discard();
  talk.stop();
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

function setupTalk() {
  if (talkSupported()) $('talk-start').hidden = false;
  $('talk-start').addEventListener('click', startTalk);
  $('talk-end').addEventListener('click', endTalk);
  $('talk-mute').addEventListener('click', async () => {
    if (!talk.paused) { talk.setMuted(!talk.muted); return; }
    try {
      await talk.resume();
    } catch (e) {
      showBanner(`${e.message || 'The microphone could not restart.'} You can still type to Gideon.`, true);
    }
  });
  addEventListener('pagehide', () => { if (talk.active) endTalk(); });
}

function setupMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('mic');
  state.dictation = Boolean(SR);
  if (!SR) { btn.hidden = true; return; }
  let rec = null;
  btn.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    speaker.discard();
    rec = new SR();
    rec.lang = 'en-AU';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const input = $('input');
      input.value = `${input.value ? `${input.value} ` : ''}${e.results[0][0].transcript}`;
      input.dispatchEvent(new Event('input'));
    };
    rec.onend = () => { rec = null; btn.classList.remove('rec'); };
    btn.classList.add('rec');
    rec.start();
  });
}

/* ---------- paywall ---------- */
function showPaywall(message) {
  window.Gideon.track('paywall_view');
  $('pw-text').textContent = message || 'You have used your free queries. Join to keep checking packs and asking Gideon, from about A$2 a day.';
  $('paywall').showModal();
}

function setupPaywall() {
  $('pw-close').addEventListener('click', () => $('paywall').close());
  $('pw-code-toggle').addEventListener('click', () => $('pw-code').classList.toggle('show'));
  $('pw-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('pw-code-msg');
    msg.className = 'form-msg';
    msg.textContent = 'Checking…';
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await fetch('/api/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That code could not be applied.');
      if (data.emailed) {
        msg.className = 'form-msg ok';
        msg.textContent = 'This email already has a plan. We have sent it a sign-in link.';
        return;
      }
      $('paywall').close();
      await refreshStatus();
      showBanner(`Access code applied. You have ${data.days} days of access.`);
    } catch (err) {
      msg.className = 'form-msg bad';
      msg.textContent = err.message;
    }
  });
}

/* ---------- start ---------- */
function closeRail() { $('ws').classList.remove('rail-open'); }

function showGate(signedIn, email) {
  setTitle('Membership needed');
  $('composer-wrap').hidden = true;
  view().innerHTML = `<div class="gate"><h1>${signedIn ? 'No active plan on this account' : 'Sign in to your workspace'}</h1><p>${signedIn ? `${escapeHtml(email)} does not have an active plan. Join, or try Gideon free.` : 'Use the email address you joined with and we will send you a sign-in link.'}</p><div class="cta-row">${signedIn ? '<a class="btn btn-primary" href="/pricing">See plans</a>' : '<a class="btn btn-primary" href="/signin">Sign in</a>'}<a class="btn btn-ghost" href="/try">Try it free</a></div></div>`;
}

async function boot() {
  const params = new URLSearchParams(location.search);
  $('rail-search').addEventListener('input', renderHistory);
  $('clear-history').addEventListener('click', () => {
    if (state.running || !confirm('Remove all saved checks and chats from this browser? This cannot be undone.')) return;
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* storage unavailable */ }
    showStart();
  });
  $('new-check').addEventListener('click', () => { if (!state.running) { speaker.discard(); closeRail(); showStart(); } });
  $('new-chat').addEventListener('click', () => { if (!state.running) { speaker.discard(); closeRail(); showChat(true); $('input').focus(); } });
  $('burger').addEventListener('click', () => $('ws').classList.toggle('rail-open'));
  $('voice').addEventListener('click', (e) => {
    audio();
    state.voice = !state.voice;
    e.currentTarget.classList.toggle('on', state.voice);
    e.currentTarget.setAttribute('aria-pressed', String(state.voice));
    if (!state.voice) speaker.discard();
  });
  const input = $('input');
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 180)}px`; if (talk.active) talk.touch(); });
  input.addEventListener('paste', (e) => {
    const files = [...((e.clipboardData && e.clipboardData.files) || [])];
    if (files.length) { e.preventDefault(); attachFiles(files); return; }
    const pasted = e.clipboardData ? e.clipboardData.getData('text') : '';
    if (talk.active && pasted.length > 200 && !speaker.active) speaker.clip('got-it');
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFromComposer(); } });
  $('composer').addEventListener('submit', (e) => { e.preventDefault(); sendFromComposer(); });
  const attach = $('attach');
  attach.accept = ACCEPT;
  attach.addEventListener('change', () => { attachFiles([...attach.files]); attach.value = ''; });
  setupMic();
  setupTalk();
  setupPaywall();

  // Dropping files anywhere in the app starts a pack, or attaches them mid-chat.
  addEventListener('dragover', (e) => { e.preventDefault(); const d = $('drop'); if (d) d.classList.add('over'); });
  addEventListener('dragleave', () => { const d = $('drop'); if (d) d.classList.remove('over'); });
  addEventListener('drop', (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer ? e.dataTransfer.files : [])];
    if (!files.length) return;
    if (state.conv && state.conv.kind === 'chat') attachFiles(files);
    else if (!state.running) stageFiles(files);
  });

  const status = await refreshStatus();
  renderHistory();

  const welcome = params.get('welcome');
  if (welcome) {
    window.Gideon.reportPurchase(params);
    history.replaceState(null, '', location.pathname);
    let s = status;
    for (let i = 0; i < 6 && !s.member; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      s = await refreshStatus();
    }
    if (s.member) showBanner('Welcome to Gideon. Your plan is active, and a confirmation is on its way to your inbox.');
    else showBanner('Your payment went through, and access is still being set up. Refresh in a minute, or reply to your confirmation email if it does not appear.', true);
  }

  if (IS_APP_ROUTE && !state.status.member) { showGate(state.status.signedIn, state.status.email); return; }
  showStart();
}

boot();
