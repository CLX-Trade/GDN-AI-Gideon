// Turns Gideon's "gideon-file" output into a real download, all in the browser.
// The PDF and Excel libraries are large, so they load only when someone asks for one,
// and from our own domain, so a corporate firewall blocking a CDN cannot break this.
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('The file library could not load. Please check your connection and try again.'));
    document.head.appendChild(s);
  });
}
function getHtml2Pdf() { return window.html2pdf ? Promise.resolve(window.html2pdf) : loadScript('/vendor/html2pdf.bundle.min.js').then(() => window.html2pdf); }
function getXLSX() { return window.XLSX ? Promise.resolve(window.XLSX) : loadScript('/vendor/xlsx.full.min.js').then(() => window.XLSX); }

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
      '.gdn-head{border-bottom:2px solid #2f7bff;padding-bottom:9pt;margin-bottom:16pt;}' +
      '.gdn-head .e{font-size:8.5pt;letter-spacing:2px;color:#2f7bff;text-transform:uppercase;font-weight:bold;}' +
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
    return getHtml2Pdf().then(function (h2p) {
      function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
      function inl(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');}
      function md(src){
        var lines=String(src).replace(/\r/g,'').split('\n'),out=[],list=null,i;
        function cl(){if(list){out.push('</'+list+'>');list=null;}}
        for(i=0;i<lines.length;i++){
          var t=lines[i].replace(/\s+$/,''),tt=t.trim();
          if(!tt){cl();continue;}
          if(/^[=#*_%~\-]{5,}$/.test(tt)){cl();continue;}
          if(/^>\s?/.test(tt)){cl();out.push('<div class="cal">'+inl(tt.replace(/^>\s?/,''))+'</div>');continue;}
          if(tt.indexOf('|')>-1 && i+1<lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i+1])){
            cl();var tb=['<table>'],r0=true,j=i;
            while(j<lines.length && lines[j].indexOf('|')>-1){
              if(/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[j])){j++;continue;}
              var cells=lines[j].replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|');
              tb.push('<tr>');
              for(var c=0;c<cells.length;c++){var tag=r0?'th':'td';tb.push('<'+tag+'>'+inl(cells[c].trim())+'</'+tag+'>');}
              tb.push('</tr>');r0=false;j++;
            }
            tb.push('</table>');out.push(tb.join(''));i=j-1;continue;
          }
          var h=tt.match(/^(#{1,4})\s+(.*)$/);
          if(h){cl();out.push('<h'+h[1].length+'>'+inl(h[2])+'</h'+h[1].length+'>');continue;}
          if(/^\d+[.)]\s+/.test(tt)){if(list!=='ol'){cl();list='ol';out.push('<ol>');}out.push('<li>'+inl(tt.replace(/^\d+[.)]\s+/,''))+'</li>');continue;}
          if(/^[-*\u2022\u25B8\u2713\u2714\u2611\u26A0]\s+/.test(tt)){if(list!=='ul'){cl();list='ul';out.push('<ul>');}out.push('<li>'+inl(tt.replace(/^[-*\u2022\u25B8]\s+/,''))+'</li>');continue;}
          cl();out.push('<p>'+inl(tt)+'</p>');
        }
        cl();return out.join('\n');
      }
      function badges(html){return html.replace(/<td>\s*(HIGH|MEDIUM\s*[\u2013-]\s*HIGH|MEDIUM|LOW)\s*<\/td>/g,function(m,w){var u=w.toUpperCase();var k=(u==='LOW')?'low':(u.indexOf('HIGH')>-1&&u.indexOf('MEDIUM')<0)?'high':'med';return '<td><span class="bdg '+k+'">'+w+'</span></td>';});}
      var m1=String(text).match(/^#\s+(.+)$/m);
      var bandTitle=m1?m1[1]:String(filename).replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ');
      var bodyText=m1?text.replace(m1[0],''):text;
      var css='<style>#gf-doc{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#22272e;font-size:13px;line-height:1.55;background:#fff;width:794px;}#gf-doc .band{background:#0b0e14;color:#fff;padding:26px 40px;}#gf-doc .ey{font-size:10px;letter-spacing:3px;color:#C7A86B;text-transform:uppercase;font-weight:700;}#gf-doc .ttl{margin:8px 0 0;font-size:24px;font-weight:700;}#gf-doc .sub{margin-top:4px;color:#b9c2d6;font-size:12px;}#gf-doc .bd{padding:16px 40px 40px;}#gf-doc h1{font-size:21px;color:#0b0e14;margin:22px 0 8px;}#gf-doc h2{font-size:16px;color:#0b0e14;margin:24px 0 6px;padding-bottom:6px;border-bottom:2px solid #C7A86B;page-break-after:avoid;}#gf-doc h3{font-size:13px;color:#0b0e14;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.5px;}#gf-doc h4{font-size:12px;color:#0b0e14;margin:14px 0 5px;}#gf-doc p{margin:0 0 10px;}#gf-doc ul,#gf-doc ol{margin:0 0 12px;padding-left:0;list-style:none;}#gf-doc li{margin:0 0 6px;padding-left:20px;position:relative;}#gf-doc li:before{content:"\u25B8";color:#C7A86B;position:absolute;left:2px;}#gf-doc ol{counter-reset:gfo;}#gf-doc ol li:before{content:counter(gfo)".";counter-increment:gfo;font-weight:700;}#gf-doc strong{color:#16203a;}#gf-doc table{border-collapse:collapse;width:100%;margin:8px 0 14px;font-size:12px;page-break-inside:auto;}#gf-doc th{background:#0b0e14;color:#fff;text-align:left;padding:9px 12px;font-size:11px;}#gf-doc td{padding:8px 12px;border-bottom:1px solid #e6e9f0;vertical-align:top;}#gf-doc tr{page-break-inside:avoid;}#gf-doc tr:nth-child(even) td{background:#f6f8fb;}#gf-doc .cal{background:#f4f1e9;border-left:3px solid #C7A86B;padding:10px 14px;margin:0 0 14px;font-size:12px;color:#4a4536;}#gf-doc .bdg{display:inline-block;padding:2px 9px;border-radius:10px;font-size:10.5px;font-weight:700;color:#fff;}#gf-doc .bdg.high{background:#C0392B;}#gf-doc .bdg.med{background:#D89A2E;}#gf-doc .bdg.low{background:#3C8C5A;}#gf-doc .ft{margin-top:24px;border-top:1px solid #ddd;padding-top:8px;font-size:9.5px;color:#9aa1ad;}</style>';
      var overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;background:#fff;overflow:auto;';
      var docEl=document.createElement('div');docEl.id='gf-doc';
      docEl.innerHTML=css+'<div class="band"><div class="ey">GDN \u00B7 GIDEON</div><div class="ttl">'+esc(bandTitle)+'</div><div class="sub">Confidential \u00B7 '+esc(stamp())+'</div></div><div class="bd">'+badges(md(bodyText))+'<div class="ft">Prepared by Gideon \u00B7 GDN. Review before relying on this document for commercial, legal or financial decisions.</div></div>';
      overlay.appendChild(docEl);document.body.appendChild(overlay);
      return new Promise(function(res){setTimeout(res,180);}).then(function(){
        return h2p().set({margin:[0,0,0,0],image:{type:'jpeg',quality:0.96},html2canvas:{scale:2,backgroundColor:'#ffffff'},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy'],avoid:['tr']}}).from(docEl).save(filename);
      }).then(function(){overlay.remove();},function(e){overlay.remove();throw e;});
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

  
export function generateFile(name, content) { return generate(name, content); }

const FILE_BLOCK = /```gideon-file(?:\s+name="([^"]+)")?\s*\n([\s\S]*?)```/g;

// Splits an answer into its readable text and any finished file blocks. While an
// answer is still streaming, an unterminated block is hidden and reported as pending.
export function extractFiles(text) {
  const files = [];
  let clean = String(text).replace(FILE_BLOCK, (_, name, content) => {
    files.push({ name: (name || 'gideon-document.txt').trim(), content: content.replace(/\s+$/, '') });
    return '';
  });
  const open = clean.indexOf('```gideon-file');
  const pending = open >= 0;
  if (pending) clean = clean.slice(0, open);
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();
  if (!clean && files.length) clean = `Your file${files.length > 1 ? 's are' : ' is'} ready.`;
  return { clean, files, pending };
}
