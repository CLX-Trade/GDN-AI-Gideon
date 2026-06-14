/* Gideon file delivery.
   Watches each Gideon answer for a fenced block tagged "gideon-file" and turns it
   into a real downloadable file (PDF, Word, HTML, CSV, Excel, Markdown, JSON, code,
   etc.). Shows one clean "Download <name>" link. Also removes the old per-message
   Word/PDF buttons. All generation happens in the browser. */
(function () {
  if (window.__gideonFiles) return;
  window.__gideonFiles = true;

  /* 1. Hide the old automatic Word/PDF buttons. */
  try {
    var st = document.createElement('style');
    st.textContent = '.doc-actions{display:none !important;}'
      + '.gf-files{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}'
      + '.gf-btn{font:600 13px/1 inherit;cursor:pointer;border:1px solid #2D5BD6;'
      + 'background:#2D5BD6;color:#fff;border-radius:8px;padding:9px 14px;transition:opacity .15s;}'
      + '.gf-btn:hover{opacity:.88;}.gf-btn[disabled]{opacity:.6;cursor:default;}';
    document.head.appendChild(st);
  } catch (e) {}
  try { window.__gdnAddDocControls = function () { var d = document.createElement('span'); d.style.display = 'none'; return d; }; } catch (e) {}

  /* 2. Lazy CDN loaders for the two formats that need a library. */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src;
      s.onload = res; s.onerror = function () { rej(new Error('load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function getJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
      .then(function () { return window.jspdf.jsPDF; });
  }
  function getXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')
      .then(function () { return window.XLSX; });
  }

  /* 3. Helpers. */
  function extOf(name) { var m = String(name).match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : 'txt'; }
  function dl(blob, filename) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  var MIME = {
    txt: 'text/plain', text: 'text/plain', md: 'text/markdown', markdown: 'text/markdown',
    html: 'text/html', htm: 'text/html', csv: 'text/csv', json: 'application/json',
    xml: 'application/xml', css: 'text/css', js: 'application/javascript', mjs: 'application/javascript',
    ts: 'application/typescript', jsx: 'text/plain', tsx: 'text/plain', py: 'text/x-python',
    java: 'text/x-java', c: 'text/x-c', h: 'text/x-c', cpp: 'text/x-c', cs: 'text/plain',
    php: 'application/x-httpd-php', rb: 'text/x-ruby', go: 'text/x-go', rs: 'text/x-rust',
    sql: 'application/sql', sh: 'application/x-sh', bat: 'text/plain', ps1: 'text/plain',
    yaml: 'text/yaml', yml: 'text/yaml', toml: 'text/plain', ini: 'text/plain', env: 'text/plain',
    svg: 'image/svg+xml', doc: 'application/msword', rtf: 'application/rtf'
  };

  /* Word (.doc) from lightly marked text. Word opens this cleanly. */
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function inlineMd(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>'); }
  function mdToHtml(text) {
    var lines = String(text).replace(/\r/g, '').split('\n'), out = [], list = null;
    function cl() { if (list) { out.push('</' + list + '>'); list = null; } }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) { cl(); continue; }
      var h = t.match(/^(#{1,4})\s+(.*)$/);
      if (h) { cl(); var lv = Math.min(4, h[1].length + 1); out.push('<h' + lv + '>' + inlineMd(h[2]) + '</h' + lv + '>'); continue; }
      if (/^[-*\u2022]\s+/.test(t)) { if (list !== 'ul') { cl(); list = 'ul'; out.push('<ul>'); } out.push('<li>' + inlineMd(t.replace(/^[-*\u2022]\s+/, '')) + '</li>'); continue; }
      if (/^\d+[.)]\s+/.test(t)) { if (list !== 'ol') { cl(); list = 'ol'; out.push('<ol>'); } out.push('<li>' + inlineMd(t.replace(/^\d+[.)]\s+/, '')) + '</li>'); continue; }
      cl(); out.push('<p>' + inlineMd(t) + '</p>');
    }
    cl(); return out.join('\n');
  }
  function makeWord(text) {
    var html = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" '
      + 'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
      + '<head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;'
      + 'color:#1a1a1a;line-height:1.5;}h2{font-size:18pt;}h3{font-size:14pt;}h4{font-size:12pt;}'
      + 'h2,h3,h4{color:#1f2a44;margin:14pt 0 6pt;}p{margin:0 0 8pt;}ul,ol{margin:0 0 8pt 22pt;}'
      + 'li{margin:0 0 4pt;}</style></head><body>' + mdToHtml(text) + '</body></html>';
    return new Blob(['\ufeff' + html], { type: 'application/msword' });
  }

  /* PDF from text via jsPDF. */
  function makePdf(text, filename) {
    return getJsPDF().then(function (JsPDF) {
      var doc = new JsPDF({ unit: 'pt', format: 'a4' });
      var pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      var mx = 56, my = 64, maxw = pw - mx * 2, y = my;
      function ensure(h) { if (y + h > ph - my) { doc.addPage(); y = my; } }
      var lines = String(text).replace(/\r/g, '').split('\n');
      for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();
        if (!t) { y += 7; continue; }
        var h = t.match(/^(#{1,4})\s+/);
        var plain = t.replace(/^(#{1,4})\s+/, '')
          .replace(/^[-*\u2022]\s+/, '\u2022  ')
          .replace(/^(\d+)[.)]\s+/, '$1.  ')
          .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
        var fs;
        if (h) { fs = h[1].length === 1 ? 15 : h[1].length === 2 ? 13 : 11; doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); doc.setTextColor(31, 42, 68); y += 6; }
        else { doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(34, 34, 34); }
        var wrapped = doc.splitTextToSize(plain, maxw);
        for (var j = 0; j < wrapped.length; j++) { var lh = h ? fs * 1.35 : 14.5; ensure(lh); doc.text(wrapped[j], mx, y); y += lh; }
        if (h) y += 2;
      }
      doc.save(filename);
    });
  }

  /* Spreadsheet (xlsx) from CSV or a markdown table. */
  function parseTable(text) {
    var rows = String(text).replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (rows.length && rows[0].indexOf('|') > -1) {
      rows = rows.filter(function (l) { return !/^\s*\|?[\s:|-]+\|?\s*$/.test(l); });
      return rows.map(function (l) { return l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); }); });
    }
    return rows.map(function (l) { return l.split(',').map(function (c) { return c.replace(/^"|"$/g, '').trim(); }); });
  }
  function makeXlsx(text, filename) {
    return getXLSX().then(function (XLSX) {
      var ws = XLSX.utils.aoa_to_sheet(parseTable(text));
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, filename);
    });
  }

  /* Route by extension. Anything unknown downloads as raw text with the right name. */
  function generate(name, content) {
    var ext = extOf(name);
    if (ext === 'pdf') return makePdf(content, name);
    if (ext === 'doc' || ext === 'docx') { dl(makeWord(content), name.replace(/\.docx$/i, '.doc')); return Promise.resolve(); }
    if (ext === 'xlsx' || ext === 'xls') return makeXlsx(content, name.replace(/\.xls$/i, '.xlsx'));
    var mime = MIME[ext] || 'application/octet-stream';
    dl(new Blob([content], { type: mime + (/charset/.test(mime) ? '' : ';charset=utf-8') }), name);
    return Promise.resolve();
  }

  /* 4. Find file tags in a Gideon answer, clean the text, add download links. */
  var RE = /```gideon-file(?:\s+name="([^"]+)")?\s*\n([\s\S]*?)```/g;
  function processBubble(bub) {
    if (!bub || bub.__gfDone) return;
    var raw = bub.textContent || '';
    if (raw.indexOf('gideon-file') < 0) return;
    var m, files = []; RE.lastIndex = 0;
    while ((m = RE.exec(raw))) {
      var nm = (m[1] || 'gideon-document.txt').trim();
      files.push({ name: nm, content: m[2].replace(/\s+$/, '') });
    }
    if (!files.length) return;
    bub.__gfDone = true;
    var cleaned = raw.replace(RE, '').replace(/\n{3,}/g, '\n\n').trim();
    bub.textContent = cleaned || ('Your file is ready: ' + files.map(function (f) { return f.name; }).join(', '));
    var wrap = document.createElement('div'); wrap.className = 'gf-files';
    files.forEach(function (f) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'gf-btn';
      b.textContent = '\u2B07  Download ' + f.name;
      b.onclick = function () {
        b.disabled = true; var orig = b.textContent; b.textContent = 'Preparing ' + f.name + '\u2026';
        Promise.resolve(generate(f.name, f.content)).then(function () { b.disabled = false; b.textContent = orig; })
          .catch(function (e) { b.disabled = false; b.textContent = 'Retry ' + f.name; console.error('gideon-file', e); });
      };
      wrap.appendChild(b);
    });
    if (bub.parentNode) bub.parentNode.appendChild(wrap);
  }
  function scan(root) {
    try { var b = (root && root.querySelectorAll) ? root.querySelectorAll('.bubble') : []; for (var i = 0; i < b.length; i++) processBubble(b[i]); } catch (e) {}
  }

  /* 5. Watch for new messages. */
  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var ad = muts[i].addedNodes;
      for (var j = 0; j < ad.length; j++) {
        var n = ad[j]; if (n.nodeType !== 1) continue;
        if (n.classList && n.classList.contains('bubble')) processBubble(n); else scan(n);
      }
    }
  });
  function start() { scan(document); obs.observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
