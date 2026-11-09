// The homepage demo. This runs Gideon's real rule engine on a fictional pack in the
// visitor's own browser, then animates the result. Nothing on screen is hard-coded:
// change the pack and the matrix, findings and counters all change with it.
import { reconcile } from './reconcile.js';
import { DEMO_PACK, DEMO_NOW } from './demo-pack.js';

const root = document.getElementById('engine');
if (root) start(root);

const SHOWN_ROWS = ['seller_party', 'buyer_party', 'net_quantity', 'total_amount', 'incoterm', 'shipment_date', 'imo_number', 'container_number'];
const CELL_CLASS = { match: 'ok', format: 'ok', mismatch: 'bad', caution: 'warn', single: 'single' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shorten(value, group) {
  const text = String(value)
    .replace(/\s+Pte Ltd$/i, '').replace(/\s+Pty Ltd$/i, '')
    .replace(/^To order of\s+/i, '').replace(/^IMO\s+/i, '')
    .replace(/\s+September\s+/i, ' Sep ');
  return group === 'container_number' ? text.replace(/,\s*\S+$/, ' +1') : text;
}

// A row can disagree in one document only. Colour the outlier red, not all of them.
function outliers(row) {
  const values = row.cells.map((cell) => (cell[0] ? cell[0].value.toUpperCase() : null)).filter(Boolean);
  const tally = values.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
  const top = Math.max(...Object.values(tally));
  return (value) => tally[value.toUpperCase()] < top || top === 1;
}

function buildRow(row, result) {
  const node = el('div', 'mrow');
  node.append(el('div', 'mlabel', row.label.replace('Seller / shipper / beneficiary', 'Seller').replace('Buyer / applicant', 'Buyer')));
  const isOutlier = outliers(row);
  const failedId = result.findings.some((f) => f.code === `identifier.${row.group}`);
  row.cells.forEach((cell) => {
    const entry = cell[0];
    const c = el('div', 'mcell');
    if (!entry) {
      c.classList.add('none');
      c.append(el('span', 'val', '—'), el('span', 'ico', '·'));
    } else {
      const bad = failedId || (row.status === 'mismatch' && isOutlier(entry.value));
      c.classList.add(bad ? 'bad' : (CELL_CLASS[row.status] === 'single' ? 'ok' : (row.status === 'mismatch' ? 'ok' : CELL_CLASS[row.status])));
      c.title = `${entry.field}: ${entry.value}`;
      c.append(el('span', 'val', shorten(entry.value, row.group)), el('span', 'ico', bad ? '✕' : '✓'));
    }
    node.append(c);
  });
  return node;
}

function start(host) {
  const result = reconcile(DEMO_PACK, { now: DEMO_NOW });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timers = [];
  const wait = (ms) => new Promise((resolve) => { timers.push(setTimeout(resolve, reduced ? 0 : ms)); });

  async function run() {
    timers.forEach(clearTimeout);
    timers = [];
    host.innerHTML = '';
    host.classList.remove('done');

    const bar = el('div', 'engine-bar');
    const live = el('span', 'engine-live');
    live.append(el('i'), el('span', null, 'Live demo'));
    const liveText = live.lastChild;
    bar.append(live, el('b', null, 'Fictional pack. Real rule engine, running in your browser.'));

    const docs = el('div', 'engine-docs');
    const docNodes = DEMO_PACK.map((doc) => {
      const node = el('div', 'edoc');
      const sub = el('div', 'edoc-s', 'waiting');
      node.append(el('div', 'edoc-t', doc.short), sub);
      docs.append(node);
      return { node, sub, count: doc.fields.length };
    });

    const matrix = el('div', 'engine-matrix');
    const rows = SHOWN_ROWS.map((group) => result.matrix.find((m) => m.group === group)).filter(Boolean);
    const rowNodes = rows.map((row) => { const n = buildRow(row, result); matrix.append(n); return n; });

    const findings = el('div', 'engine-findings');
    const findingNodes = result.findings.filter((f) => f.severity !== 'low').slice(0, 5).map((f) => {
      const node = el('div', 'ef');
      node.append(el('span', `sev sev-${f.severity}`, f.severity), el('span', null, f.title));
      findings.append(node);
      return node;
    });

    const verdict = el('div', 'engine-verdict');
    const verdictText = el('b', null, 'Reading documents…');
    verdict.append(verdictText);

    host.append(bar, docs, matrix, findings, verdict);

    for (const doc of docNodes) {
      doc.node.classList.add('reading');
      doc.sub.textContent = 'reading';
      await wait(420);
      doc.node.classList.remove('reading');
      doc.sub.textContent = `${doc.count} fields`;
    }

    verdictText.textContent = `Comparing ${result.stats.fieldsRead} fields across ${result.stats.documents} documents…`;
    for (const node of rowNodes) {
      await wait(190);
      node.classList.add('show');
    }
    await wait(250);
    for (const node of findingNodes) {
      await wait(230);
      node.classList.add('show');
    }
    await wait(300);

    const { high, medium } = result.counts;
    verdict.className = 'engine-verdict stop';
    verdictText.textContent = `STOP. ${high} high, ${medium} medium. Do not release funds until these are resolved.`;
    host.classList.add('done');
    liveText.textContent = `${result.stats.comparisons} comparisons, ${result.stats.identifierChecks} identifier checks`;

    const replay = el('button', 'engine-replay', 'Replay');
    replay.type = 'button';
    replay.addEventListener('click', run);
    verdict.append(replay);
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { io.disconnect(); run(); }
    }, { threshold: 0.2 });
    io.observe(host);
  } else {
    run();
  }
}
