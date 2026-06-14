/* Gideon file delivery + voice mode.
   - Turns a "gideon-file" tag in Gideon's answer into a real, nicely designed
     downloadable file (PDF, Word, HTML, CSV, Excel, code, etc.).
   - Adds a Voice / Text-only mode toggle. In Voice mode Gideon speaks and the mic
     listens hands-free so you can talk back; any new command stops Gideon talking.
   All in the browser. */
(function () {
  if (window.__gideonFiles) return;
  window.__gideonFiles = true;

  /* ---------- shared styling ---------- */
  try {
    var st = document.createElement('style');
    st.textContent =
      '.doc-actions{display:none !important;}' +
      '#tts-btn{display:none !important;}' +
      '.gf-files{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}' +
      '.gf-btn{font:600 13px/1 inherit;cursor:pointer;border:1px solid #2D5BD6;background:#2D5BD6;color:#fff;border-radius:8px;padding:9px 14px;transition:opacity .15s;}' +
      '.gf-btn:hover{opacity:.88;}.gf-btn[disabled]{opacity:.6;cursor:default;}' +
      '.gf-mode-row{display:flex;justify-content:flex-end;margin:0 0 8px;}' +
      '.gf-mode{display:inline-flex;align-items:center;gap:8px;cursor:pointer;border:1px solid #d6deea;background:#fff;color:#1f2a44;border-radius:999px;padding:8px 15px;font:600 13px/1 inherit;user-select:none;}' +
      '.gf-mode.voice{background:#2D5BD6;border-color:#2D5BD6;color:#fff;}' +
      '.gf-mode .gf-dot{width:8px;height:8px;border-radius:50%;background:#9aa7bd;transition:background .2s;}' +
      '.gf-mode.voice .gf-dot{background:#7CFFB2;}' +
      '.gf-mode.listening .gf-dot{animation:gfpulse 1.1s ease-in-out infinite;}' +
      '@keyframes gfpulse{0%,100%{opacity:1;}50%{opacity:.35;}}';
    document.head.appendChild(st);
  } catch (e) {}
  try { window.__gdnAddDocControls = function () { var d = document.createElement('span'); d.style.display = 'none'; return d; }; } catch (e) {}

  /* ---------- track audio so we can stop Gideon talking ---------- */
  var audios = [];
  try {
    var NA = window.Audio;
    if (NA && !NA.__gfWrapped) {
      var W = function (s) { var a = new NA(s); try { audios.push(a); } catch (e) {} try { a.addEventListener('playing', function () { speaking = true; if (rec && recOn) { try { rec.stop(); } catch (e) {} recOn = false; } }); var endh = function () { if (!speaking) return; speaking = false; if (wantListen) setTimeout(function () { if (speaking) return; try { if (rec) { rec.start(); recOn = true; } } catch (e) {} }, 250); }; a.addEventListener('ended', endh); a.addEventListener('pause', endh); a.addEventListener('error', endh); } catch (e) {} return a; };
      W.prototype = NA.prototype; W.__gfWrapped = true; window.Audio = W;
    }
  } catch (e) {}
  function stopVoice() {
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    for (var i = 0; i < audios.length; i++) { try { audios[i].pause(); audios[i].currentTime = 0; } catch (e) {} }
    audios.length = 0;
    try { if (typeof __gideonAudio !== 'undefined' && __gideonAudio) { __gideonAudio.pause(); } } catch (e) {}
    try { if (window.__gideonAudio) { window.__gideonAudio.pause(); } } catch (e) {}
    try { var aa = document.getElementsByTagName('audio'); for (var k = 0; k < aa.length; k++) { aa[k].pause(); } } catch (e) {}
  }
  window.__gideonStopVoice = stopVoice;

  /* ---------- CDN loaders ---------- */
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load failed: ' + src)); }; document.head.appendChild(s); }); }
  function getJsPDF() { if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF); return loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').then(function () { return window.jspdf.jsPDF; }); }
  function getXLSX() { if (window.XLSX) return Promise.resolve(window.XLSX); return loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(function () { return window.XLSX; }); }

  /* ---------- helpers ---------- */
  function extOf(name) { var m = String(name).match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : 'txt'; }
  function dl(blob, filename) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function stamp() { return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
  var MIME = { txt: 'text/plain', text: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', html: 'text/html', htm: 'text/html', csv: 'text/csv', json: 'application/json', xml: 'application/xml', css: 'text/css', js: 'application/javascript', mjs: 'application/javascript', ts: 'application/typescript', jsx: 'text/plain', tsx: 'text/plain', py: 'text/x-python', java: 'text/x-java', c: 'text/x-c', h: 'text/x-c', cpp: 'text/x-c', cs: 'text/plain', php: 'application/x-httpd-php', rb: 'text/x-ruby', go: 'text/x-go', rs: 'text/x-rust', sql: 'application/sql', sh: 'application/x-sh', yaml: 'text/yaml', yml: 'text/yaml', svg: 'image/svg+xml', doc: 'application/msword', rtf: 'application/rtf' };

  /* ---------- Word (.doc), designed ---------- */
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function inlineMd(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>'); }
  function mdToHtml(text) {
    var lines = String(text).replace(/\r/g, '').split('\n'), out = [], list = null, i;
    function cl() { if (list) { out.push('</' + list + '>'); list = null; } }
    for (i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) { cl(); continue; }
      if (t.indexOf('|') > -1 && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
        cl(); var tb = ['<table style="border-collapse:collapse;width:100%;margin:6pt 0 12pt;">'], r0 = true, j = i;
        while (j < lines.length && lines[j].indexOf('|') > -1) {
          if (/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[j])) { j++; continue; }
          var cells = lines[j].replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
          tb.push('<tr>');
          for (var c = 0; c < cells.length; c++) {
            var tag = r0 ? 'th' : 'td';
            var sty = r0 ? 'background:#1f2a44;color:#fff;text-align:left;' : 'color:#1a1a1a;';
            tb.push('<' + tag + ' style="border:1px solid #c9d2e0;padding:6pt 9pt;font-size:10pt;' + sty + '">' + inlineMd(cells[c].trim()) + '</' + tag + '>');
          }
          tb.push('</tr>'); r0 = false; j++;
        }
        tb.push('</table>'); out.push(tb.join('')); i = j - 1; continue;
      }
      var h = t.match(/^(#{1,4})\s+(.*)$/);
      if (h) { cl(); var lv = Math.min(4, h[1].length + 1); out.push('<h' + lv + '>' + inlineMd(h[2]) + '</h' + lv + '>'); continue; }
      if (/^[-*\u2022]\s+/.test(t)) { if (list !== 'ul') { cl(); list = 'ul'; out.push('<ul>'); } out.push('<li>' + inlineMd(t.replace(/^[-*\u2022]\s+/, '')) + '</li>'); continue; }
      if (/^\d+[.)]\s+/.test(t)) { if (list !== 'ol') { cl(); list = 'ol'; out.push('<ol>'); } out.push('<li>' + inlineMd(t.replace(/^\d+[.)]\s+/, '')) + '</li>'); continue; }
      cl(); out.push('<p>' + inlineMd(t) + '</p>');
    }
    cl(); return out.join('\n');
  }
  function makeWord(text) {
    var html = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><style>' +
      'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#222;line-height:1.5;}' +
      'h1,h2{font-size:19pt;color:#1f2a44;margin:0 0 4pt;}h3{font-size:14pt;color:#1f2a44;margin:14pt 0 5pt;}h4{font-size:12pt;color:#1f2a44;margin:12pt 0 4pt;}' +
      'p{margin:0 0 9pt;}ul,ol{margin:0 0 9pt 22pt;}li{margin:0 0 4pt;}strong{color:#16203a;}' +
      'table{border-collapse:collapse;}' +
      '.gdn-head{border-bottom:2px solid #b8954a;padding-bottom:9pt;margin-bottom:16pt;}' +
      '.gdn-head .e{font-size:8.5pt;letter-spacing:2px;color:#b8954a;text-transform:uppercase;font-weight:bold;}' +
      '.gdn-head .d{font-size:8.5pt;color:#999;float:right;letter-spacing:1px;}' +
      '.gdn-foot{margin-top:22pt;border-top:1px solid #ddd;padding-top:8pt;font-size:8pt;color:#999;}' +
      '</style></head><body>' +
      '<div class="gdn-head"><span class="e">GDN &middot; Gideon</span><span class="d">' + esc(stamp()).toUpperCase() + '</span></div>' +
      mdToHtml(text) +
      '<div class="gdn-foot">Prepared by Gideon, your AI business assistant. Review before relying on this document for commercial, legal or financial decisions.</div>' +
      '</body></html>';
    return new Blob(['\ufeff' + html], { type: 'application/msword' });
  }

  /* ---------- PDF, designed (headings, bold, lists, tables, header & footer) ---------- */
  function makePdf(text, filename) {
    return getJsPDF().then(function (JsPDF) {
      var doc = new JsPDF({ unit: 'pt', format: 'a4' });
      var pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      var mx = 64, my = 74, availR = pw - mx, y = my;
      var NAVY = [31, 42, 68], GOLD = [184, 149, 74], INK = [44, 44, 44];
      function ensure(h) { if (y + h > ph - my) { doc.addPage(); y = my; } }

      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.text('GDN \u00B7 GIDEON', mx, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
      doc.text(stamp().toUpperCase(), availR, y, { align: 'right' });
      y += 9; doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]); doc.setLineWidth(1.3); doc.line(mx, y, availR, y); y += 26;

      function runs(s) { var out = [], re = /\*\*([^*]+)\*\*/g, last = 0, m; while ((m = re.exec(s))) { if (m.index > last) out.push({ t: s.slice(last, m.index), b: false }); out.push({ t: m[1], b: true }); last = re.lastIndex; } if (last < s.length) out.push({ t: s.slice(last), b: false }); if (!out.length) out.push({ t: s, b: false }); return out; }
      function words(s) { var w = []; runs(s).forEach(function (r) { r.t.split(/\s+/).forEach(function (p) { if (p !== '') w.push({ t: p, b: r.b }); }); }); return w; }
      function layout(s, x0, size, color, lineH) {
        doc.setFontSize(size); var cx = x0, lineStart = true, ws = words(s);
        for (var i = 0; i < ws.length; i++) {
          var tk = ws[i]; doc.setFont('helvetica', tk.b ? 'bold' : 'normal'); doc.setTextColor(color[0], color[1], color[2]);
          var sw = lineStart ? 0 : doc.getTextWidth(' '), wW = doc.getTextWidth(tk.t);
          if (!lineStart && cx + sw + wW > availR) { y += lineH; ensure(lineH); cx = x0; lineStart = true; sw = 0; }
          ensure(lineH); doc.text(tk.t, cx + sw, y); cx += sw + wW; lineStart = false;
        }
        y += lineH;
      }
      function table(rows) {
        if (!rows.length) return; var cols = 0; rows.forEach(function (r) { if (r.length > cols) cols = r.length; });
        var colW = (availR - mx) / cols, pad = 5, rowH = 19;
        for (var r = 0; r < rows.length; r++) {
          ensure(rowH); var head = r === 0;
          if (head) { doc.setFillColor(31, 42, 68); doc.rect(mx, y - 13, availR - mx, rowH, 'F'); }
          else if (r % 2 === 0) { doc.setFillColor(245, 247, 250); doc.rect(mx, y - 13, availR - mx, rowH, 'F'); }
          doc.setFont('helvetica', head ? 'bold' : 'normal'); doc.setFontSize(9.5);
          if (head) doc.setTextColor(255, 255, 255); else doc.setTextColor(INK[0], INK[1], INK[2]);
          for (var c = 0; c < cols; c++) { var cell = (rows[r][c] || '').replace(/\*\*/g, ''); var cl = doc.splitTextToSize(cell, colW - pad * 2); doc.text(cl[0] || '', mx + c * colW + pad, y); }
          y += rowH;
        }
        y += 8;
      }

      var lines = String(text).replace(/\r/g, '').split('\n');
      for (var i = 0; i < lines.length; i++) {
        var t = lines[i].replace(/\s+$/, '');
        if (!t.trim()) { y += 6; continue; }
        if (t.indexOf('|') > -1 && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
          var rows = [], j = i;
          while (j < lines.length && lines[j].indexOf('|') > -1) { if (/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[j])) { j++; continue; } rows.push(lines[j].replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (x) { return x.trim(); })); j++; }
          table(rows); i = j - 1; continue;
        }
        var h = t.match(/^(#{1,4})\s+(.*)$/);
        if (h) { var lv = h[1].length, size = lv === 1 ? 17 : lv === 2 ? 13.5 : lv === 3 ? 11.5 : 10.5; y += lv <= 2 ? 12 : 9; ensure(size * 1.4); layout(h[2], mx, size, NAVY, size * 1.3); y += 5; continue; }
        if (/^[-*\u2022]\s+/.test(t)) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]); ensure(15); doc.text('\u2022', mx + 4, y); layout(t.replace(/^[-*\u2022]\s+/, ''), mx + 20, 10.5, INK, 15); continue; }
        var nm = t.match(/^(\d+)[.)]\s+(.*)$/);
        if (nm) { doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]); ensure(15); doc.text(nm[1] + '.', mx + 2, y); layout(nm[2], mx + 22, 10.5, INK, 15); continue; }
        layout(t, mx, 10.5, INK, 15); y += 4;
      }

      var pages = doc.internal.getNumberOfPages();
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(160, 160, 160);
        doc.text('Prepared by Gideon \u00B7 GDN', mx, ph - 30);
        doc.text(p + ' / ' + pages, availR, ph - 30, { align: 'right' });
      }
      doc.save(filename);
    });
  }

  /* ---------- spreadsheet ---------- */
  function parseTable(text) {
    var rows = String(text).replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (rows.length && rows[0].indexOf('|') > -1) { rows = rows.filter(function (l) { return !/^\s*\|?[\s:|-]+\|?\s*$/.test(l); }); return rows.map(function (l) { return l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); }); }); }
    return rows.map(function (l) { return l.split(',').map(function (c) { return c.replace(/^"|"$/g, '').trim(); }); });
  }
  function makeXlsx(text, filename) { return getXLSX().then(function (XLSX) { var ws = XLSX.utils.aoa_to_sheet(parseTable(text)); var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1'); XLSX.writeFile(wb, filename); }); }

  function generate(name, content) {
    var ext = extOf(name);
    if (ext === 'pdf') return makePdf(content, name);
    if (ext === 'doc' || ext === 'docx') { dl(makeWord(content), name.replace(/\.docx$/i, '.doc')); return Promise.resolve(); }
    if (ext === 'xlsx' || ext === 'xls') return makeXlsx(content, name.replace(/\.xls$/i, '.xlsx'));
    var mime = MIME[ext] || 'application/octet-stream';
    dl(new Blob([content], { type: mime + (/charset/.test(mime) ? '' : ';charset=utf-8') }), name);
    return Promise.resolve();
  }

  /* ---------- catch the file tag, show a Download link ---------- */
  var RE = /```gideon-file(?:\s+name="([^"]+)")?\s*\n([\s\S]*?)```/g;
  function processBubble(bub) {
    if (!bub || bub.__gfDone) return;
    var raw = bub.textContent || '';
    if (raw.indexOf('gideon-file') < 0) return;
    var m, files = []; RE.lastIndex = 0;
    while ((m = RE.exec(raw))) { files.push({ name: (m[1] || 'gideon-document.txt').trim(), content: m[2].replace(/\s+$/, '') }); }
    if (!files.length) return;
    bub.__gfDone = true;
    var cleaned = raw.replace(RE, '').replace(/\n{3,}/g, '\n\n').trim();
    bub.textContent = cleaned || ('Your file is ready: ' + files.map(function (f) { return f.name; }).join(', '));
    var wrap = document.createElement('div'); wrap.className = 'gf-files';
    files.forEach(function (f) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'gf-btn'; b.textContent = '\u2B07  Download ' + f.name;
      b.onclick = function () { b.disabled = true; var orig = b.textContent; b.textContent = 'Preparing ' + f.name + '\u2026'; Promise.resolve(generate(f.name, f.content)).then(function () { b.disabled = false; b.textContent = orig; }).catch(function (e) { b.disabled = false; b.textContent = 'Retry ' + f.name; console.error('gideon-file', e); }); };
      wrap.appendChild(b);
    });
    if (bub.parentNode) bub.parentNode.appendChild(wrap);
  }
  function scan(root) { try { var b = (root && root.querySelectorAll) ? root.querySelectorAll('.bubble') : []; for (var i = 0; i < b.length; i++) processBubble(b[i]); } catch (e) {} }

  /* ======================= VOICE / TEXT MODE ======================= */
  function el(id) { return document.getElementById(id); }
  function ttsIsOn() { var b = el('tts-btn'); return b ? b.classList.contains('on') : false; }
  function setTts(on) { if (ttsIsOn() !== on) { try { if (typeof toggleTTS === 'function') toggleTTS(); } catch (e) {} } }

  var mode = 'text', pill = null;
  var SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, recOn = false, wantListen = false, speaking = false;

  function buildRec() {
    if (!SRC) return null;
    var r = new SRC(); r.lang = 'en-AU'; r.continuous = true; r.interimResults = false; r.maxAlternatives = 1; r.onspeechstart = function () { stopVoice(); };
    r.onresult = function (e) {
      if (speaking || (window.speechSynthesis && speechSynthesis.speaking)) return;
      var txt = '';
      for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) txt += e.results[i][0].transcript; }
      txt = txt.trim();
      if (txt.length < 2) return;
      var inp = el('input'); stopVoice();
      if (inp) { inp.value = txt; }
      if (typeof handleSend === 'function') { try { handleSend(); return; } catch (e2) {} }
      var snd = el('send'); if (snd) snd.click();
    };
    r.onerror = function () {};
    r.onend = function () { recOn = false; if (wantListen && !speaking) { setTimeout(function () { try { if (wantListen && !speaking) { r.start(); recOn = true; } } catch (e) {} }, 350); } };
    return r;
  }
  function startListen() { if (!SRC) return; wantListen = true; if (!rec) rec = buildRec(); if (rec && !recOn) { try { rec.start(); recOn = true; } catch (e) {} } if (pill) pill.classList.add('listening'); }
  function stopListen() { wantListen = false; if (rec && recOn) { try { rec.stop(); } catch (e) {} } recOn = false; if (pill) pill.classList.remove('listening'); }

  function renderPill() { if (!pill) return; pill.className = 'gf-mode' + (mode === 'voice' ? ' voice' : '') + (mode === 'voice' && wantListen ? ' listening' : ''); pill.innerHTML = '<span class="gf-dot"></span>' + (mode === 'voice' ? 'Voice' : 'Text only'); }
  function setMode(m) {
    mode = m;
    if (m === 'voice') {
      setTts(true);
      if (SRC) startListen();
      else { try { if (typeof addMessage === 'function') addMessage('assistant', 'Hands-free voice needs Chrome or Edge. I will still speak my replies; type to me here.'); } catch (e) {} }
    } else { setTts(false); stopListen(); stopVoice(); }
    renderPill();
  }
  function toggleMode() { setMode(mode === 'voice' ? 'text' : 'voice'); }

  function placePill() {
    if (pill || !el('input')) return;
    var inp = el('input');
    var bar = (inp.closest && (inp.closest('.composer-wrap') || inp.closest('.composer'))) || inp.parentNode;
    pill = document.createElement('button'); pill.type = 'button'; pill.title = 'Switch between hands-free Voice and Text only'; pill.onclick = toggleMode;
    var row = document.createElement('div'); row.className = 'gf-mode-row'; row.appendChild(pill);
    if (bar && bar.parentNode) bar.parentNode.insertBefore(row, bar); else document.body.appendChild(row);
    renderPill();
  }
  function hookStops() {
    var inp = el('input'), snd = el('send'), mic = el('mic-btn');
    if (inp && !inp.__gfStop) { inp.__gfStop = 1; inp.addEventListener('keydown', function () { stopVoice(); }, true); }
    if (snd && !snd.__gfStop) { snd.__gfStop = 1; snd.addEventListener('click', function () { stopVoice(); }, true); }
    if (mic && !mic.__gfStop) { mic.__gfStop = 1; mic.addEventListener('click', function () { stopVoice(); }, true); }
  }

  /* ---------- watch for new messages ---------- */
  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) { var ad = muts[i].addedNodes; for (var j = 0; j < ad.length; j++) { var n = ad[j]; if (n.nodeType !== 1) continue; if (n.classList && n.classList.contains('bubble')) processBubble(n); else scan(n); } }
  });
  function start() {
    scan(document);
    try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    placePill(); hookStops();
    setMode('text'); /* default: quiet, text only until the user chooses Voice */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 200);
})();
