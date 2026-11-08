'use strict';


const IMPORT_FIELDS = [
  { k: 'assignDate', label: 'Assignment Date', req: true }, { k: 'deliveryDate', label: 'Delivery Date' },
  { k: 'client', label: 'Client' }, { k: 'type', label: 'Type' }, { k: 'subject', label: 'Subject' },
  { k: 'status', label: 'Status' }, { k: 'paymentStatus', label: 'Payment Status' },
  { k: 'link', label: 'Posting Link' }, { k: 'notes', label: 'Notes' }, { k: 'rate', label: 'Amount / Rate' },
];
const ALIASES = {
  assignDate: ['assignment date', 'assigned date', 'assign date', 'date assigned', 'allotted date', 'allotment date', 'allotted on', 'assigned on', 'date of assignment', 'start date', 'brief date', 'date'],
  deliveryDate: ['delivery date', 'deadline', 'due date', 'due', 'delivered on', 'delivery', 'submission date', 'eta', 'expected delivery', 'tat'],
  client: ['client', 'client name', 'brand', 'brand name', 'account', 'customer', 'project'],
  type: ['type', 'deliverable type', 'format', 'content type', 'category', 'deliverable', 'work type', 'creative type'],
  subject: ['subject', 'topic', 'title', 'description', 'task', 'brief', 'content', 'concept', 'details', 'work'],
  status: ['status', 'task status', 'approval status', 'stage', 'progress', 'approval'],
  paymentStatus: ['payment status', 'payment', 'paid', 'paid unpaid', 'payment state', 'payout', 'payout status'],
  link: ['posting link', 'link', 'url', 'post link', 'published link', 'live link', 'drive link', 'final link', 'posted link'],
  notes: ['notes', 'note', 'remarks', 'comments', 'instructions', 'remark', 'feedback', 'comment'],
  rate: ['rate', 'amount', 'cost', 'price', 'fee', 'charges', 'payment amount', 'rs', 'inr'],
};
const PASS2_ORDER = ['paymentStatus', 'deliveryDate', 'assignDate', 'client', 'type', 'subject', 'link', 'notes', 'rate', 'status'];

/* ---------- parsing helpers ---------- */
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12, january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
function validYMD(y, m, d) { if (y < 100) y += 2000; const dt = new Date(y, m - 1, d); return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? isoOf(dt) : null; }
/** returns {iso, warn} or {err} or null for blank */
function parseDateVal(v, fmt) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  if (v instanceof Date && !isNaN(v)) return { iso: isoOf(v) };
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
    const n = +v;
    if (n > 20000 && n < 80000) { // Excel serial date
      if (window.XLSX?.SSF) { const p = XLSX.SSF.parse_date_code(n); return { iso: validYMD(p.y, p.m, p.d) }; }
      const d = new Date(Math.round((n - 25569) * 864e5)); return { iso: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` };
    }
    return { err: `“${v}” isn’t a date` };
  }
  const s = String(v).trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ');
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) { const r = validYMD(+m[1], +m[2], +m[3]); return r ? { iso: r } : { err: `Invalid date “${v}”` }; }
  if ((m = s.match(/^(\d{1,2})[-/. ]([a-z]{3,9})[-/. ]?(\d{2,4})?$/i)) && MON[m[2].toLowerCase()]) { const r = validYMD(m[3] ? +m[3] : new Date().getFullYear(), MON[m[2].toLowerCase()], +m[1]); return r ? { iso: r, warn: m[3] ? '' : 'year assumed' } : { err: `Invalid date “${v}”` }; }
  if ((m = s.match(/^([a-z]{3,9})[-/. ](\d{1,2})[-/. ]?(\d{2,4})?$/i)) && MON[m[1].toLowerCase()]) { const r = validYMD(m[3] ? +m[3] : new Date().getFullYear(), MON[m[1].toLowerCase()], +m[2]); return r ? { iso: r, warn: m[3] ? '' : 'year assumed' } : { err: `Invalid date “${v}”` }; }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?/))) {
    const a = +m[1], b = +m[2], y = m[3] ? +m[3] : new Date().getFullYear();
    let d, mo, warn = m[3] ? '' : 'year assumed';
    if (fmt === 'mdy') { mo = a; d = b; } else if (fmt === 'dmy') { d = a; mo = b; }
    else if (a > 12) { d = a; mo = b; } else if (b > 12) { mo = a; d = b; }
    else { d = a; mo = b; if (a !== b) warn = (warn ? warn + '; ' : '') + 'read as DD/MM'; }
    const r = validYMD(y, mo, d); return r ? { iso: r, warn } : { err: `Invalid date “${v}”` };
  }
  const t = Date.parse(s); if (!isNaN(t)) return { iso: isoOf(new Date(t)) };
  return { err: `Can’t read date “${v}”` };
}
function normType(v) {
  const raw = String(v ?? '').trim().replace(/\s+/g, ' '), n = normKey(raw); if (!n) return { val: null };
  const types = DB.types();
  const exact = types.find(t => normKey(t) === n); if (exact) return { val: exact };
  const guess = (/long|youtube|\byt\b|podcast|full video|vlog|webinar|explainer/.test(n) && 'Long Format Video')
    || (/reel|short|story|stories|tiktok|\bvideo\b/.test(n) && 'Short Format Reel')
    || (/carousel|carousal|slides|swipe/.test(n) && 'Carousel')
    || (/banner|cover|hoarding|header|standee|flyer/.test(n) && 'Banner')
    || (/static|post|creative|image|single|graphic|poster/.test(n) && 'Static Creative');
  if (guess && types.includes(guess)) return { val: guess };
  return { val: raw, isNew: true, warn: `New type “${raw}” will be added` };
}
function normStatus(v) {
  const n = normKey(v); if (!n) return { val: null };
  const exact = STATUSES.find(t => normKey(t) === n); if (exact) return { val: exact };
  if (/reject|cancel|scrap|drop|declin/.test(n)) return { val: 'Rejected' };
  if (/change|revision|rework|correction|redo|modif/.test(n)) return { val: 'In Changes' };
  if (/review|submitted|sent|feedback|awaiting|pending approval/.test(n)) return { val: 'In Review' };
  if (/approv|done|complete|final|posted|published|live|delivered|ok/.test(n)) return { val: 'Approved' };
  if (/allot|assign|new|todo|to do|wip|progress|working|pending|not started|open/.test(n)) return { val: 'Allotted' };
  return { val: 'Allotted', warn: `Unrecognised status “${v}” → Allotted` };
}
function normPay(v) {
  const n = normKey(v); if (!n) return { val: null };
  if (/unpaid|not paid|due|pending|no|false|outstanding/.test(n)) return { val: 'Unpaid' };
  if (/paid|yes|done|cleared|settled|true|^y$|transferred/.test(n)) return { val: 'Paid' };
  return { val: 'Unpaid', warn: `Unrecognised payment “${v}” → Unpaid` };
}
function parseRate(v) { if (v === '' || v == null) return null; if (typeof v === 'number') return v; const n = String(v).replace(/(rs\.?|inr|₹|,|\/-)/gi, '').trim(); return n && !isNaN(+n) ? +n : NaN; }
function fieldForHeader(h) { const n = normKey(h); if (!n) return null; for (const f of IMPORT_FIELDS) if (ALIASES[f.k].includes(n)) return f.k; return null; }
const dupKey = (assignDate, client, type, subject) => [assignDate, normKey(client), type, normKey(subject)].join('|');
const UPDATABLE = ['deliveryDate', 'status', 'paymentStatus', 'link', 'notes', 'rate'];

const Importer = {
  s: null,
  open(fid) {
    this.s = { step: 1, fid, fileName: '', sheets: [], cur: 0, filter: 'all', opts: { dateFmt: 'auto', dup: 'skip' }, records: null, result: null, error: '' };
    openModal('', { size: 'wide' });
    this.render();
  },
  render() {
    const m = $('.modal-bg .modal'); if (!m) return;
    const st = this.s.step;
    const steps = ['Upload', 'Map columns', 'Preview', 'Done'].map((l, i) => `<span class="${i + 1 === st ? 'on' : i + 1 < st ? 'done' : ''}"><b>${i + 1 < st ? '✓' : i + 1}</b>${l}</span>`).join('');
    const body = st === 1 ? this.step1() : st === 2 ? this.step2() : st === 3 ? this.step3() : this.step4();
    m.innerHTML = `${mHead(`Import into ${esc(DB.freelancer(this.s.fid).name)}’s deliverables`)}<div class="steps">${steps}</div>${body}`;
    this.bind(m);
  },

  /* ---------- step 1: upload ---------- */
  step1() {
    return `<div class="m-body">
      <label class="drop" id="impDrop">${ic('upload', 34)}<div class="big">Drop a spreadsheet here or click to browse</div>
        <div class="muted">Excel (.xlsx, .xls) or CSV · Google Sheets: File → Download → Microsoft Excel or CSV</div>
        <input type="file" id="impFile" accept=".xlsx,.xls,.csv" hidden></label>
      <div class="grid g2" style="margin-top:16px">
        <div class="note" style="align-items:flex-start">${ic('calendar', 18)}<span>Dates like 05/11/2026, 5-Nov-26, 2026-11-05 and Excel dates are understood.</span></div>
        <div class="note warn" style="align-items:flex-start">${ic('lock', 18)}<span>Existing records are never changed unless you choose to update them and confirm.</span></div>
      </div>
      ${this.s.error ? `<div class="note err" style="margin-top:14px">${esc(this.s.error)}</div>` : ''}
    </div><div class="m-foot"><button class="btn left" id="impTpl">${ic('download', 16)} Download template</button><button class="btn" data-act="modal-close">Cancel</button></div>`;
  },
  async readFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    this.s.error = '';
    try {
      if (!['xlsx', 'xls', 'csv'].includes(ext)) throw new Error('Unsupported file type. Upload .xlsx, .xls or .csv.');
      if (file.size > 15 * 1024 * 1024) throw new Error('File is larger than 15 MB.');
      let raw;
      if (ext === 'csv') raw = [{ name: file.name.replace(/\.csv$/i, ''), rows: parseCSV(await file.text()) }];
      else {
        if (!window.XLSX) throw new Error('The Excel reader couldn’t load (it needs an internet connection). Save the sheet as CSV and import that instead.');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        raw = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: true });
          // Swap hyperlink display text ("Link") for the real URL
          if (ws['!ref']) { const rg = XLSX.utils.decode_range(ws['!ref']); for (const addr in ws) { if (addr[0] === '!' || !ws[addr]?.l?.Target) continue; const c = XLSX.utils.decode_cell(addr); if (rows[c.r - rg.s.r]) rows[c.r - rg.s.r][c.c - rg.s.c] = ws[addr].l.Target; } }
          return { name, rows };
        });
      }
      this.s.fileName = file.name;
      this.s.sheets = raw.map(r => this.prepSheet(r.name, r.rows));
      if (!this.s.sheets.some(x => x.include)) throw new Error('No data rows were found in this file.');
      // Multi-tab workbooks: pre-select only the first tab with data; the user can add others.
      const first = this.s.sheets.findIndex(x => x.include);
      this.s.sheets.forEach((x, i) => { if (i !== first) x.include = false; });
      this.s.cur = first;
      this.s.step = 2;
    } catch (e) { this.s.error = e.message || String(e); }
    this.render();
  },
  prepSheet(name, rows) {
    rows = rows.map(r => r.map(c => typeof c === 'string' ? c.trim() : c));
    let best = -1, bestScore = 0;
    for (let i = 0; i < Math.min(20, rows.length); i++) { const sc = new Set(rows[i].map(fieldForHeader).filter(Boolean)).size; if (sc > bestScore) { best = i; bestScore = sc; } }
    if (bestScore < 2) best = rows.findIndex(r => r.some(c => String(c).trim() !== ''));
    const sh = { name, rows, headerIdx: Math.max(0, best), headers: [], map: {}, dataCount: 0 };
    if (best >= 0) this.applyHeader(sh);
    sh.include = sh.dataCount > 0;
    return sh;
  },
  applyHeader(sh) {
    sh.headers = (sh.rows[sh.headerIdx] || []).map((h, i) => String(h ?? '').trim() || `Column ${i + 1}`);
    const width = Math.max(sh.headers.length, ...sh.rows.slice(sh.headerIdx + 1, sh.headerIdx + 50).map(r => r.length));
    while (sh.headers.length < width) sh.headers.push(`Column ${sh.headers.length + 1}`);
    sh.dataCount = sh.rows.slice(sh.headerIdx + 1).filter(r => r.some(c => String(c).trim() !== '')).length;
    const map = {}; IMPORT_FIELDS.forEach(f => map[f.k] = -1); const used = new Set();
    sh.headers.forEach((h, i) => { const n = normKey(h); for (const f of IMPORT_FIELDS) if (map[f.k] < 0 && !used.has(i) && ALIASES[f.k].includes(n)) { map[f.k] = i; used.add(i); } });
    for (const k of PASS2_ORDER) {
      if (map[k] >= 0) continue;
      const aliases = ALIASES[k].filter(a => a.length >= 3).sort((a, b) => b.length - a.length);
      const i = sh.headers.findIndex((h, idx) => !used.has(idx) && aliases.some(a => (' ' + normKey(h) + ' ').includes(' ' + a + ' ')));
      if (i >= 0) { map[k] = i; used.add(i); }
    }
    sh.map = map;
  },

  /* ---------- step 2: mapping ---------- */
  step2() {
    const S = this.s, sh = S.sheets[S.cur], o = S.opts;
    const data = sh.rows.slice(sh.headerIdx + 1).filter(r => r.some(c => String(c).trim() !== ''));
    const sample = i => i < 0 ? '' : data.slice(0, 3).map(r => r[i]).filter(v => String(v).trim() !== '').map(v => String(v).slice(0, 30)).join(' · ');
    const total = S.sheets.filter(x => x.include).reduce((a, x) => a + x.dataCount, 0);
    const mapped = IMPORT_FIELDS.filter(f => sh.map[f.k] >= 0);
    return `<div class="m-body">
      <div class="note" style="margin-bottom:14px">${ic('sheet', 18)}<span class="grow"><b>${esc(S.fileName)}</b> · ${total} data row${total === 1 ? '' : 's'} selected</span><button class="btn sm" id="impRestart">Choose another file</button></div>
      ${S.sheets.length > 1 ? `<div style="margin-bottom:12px"><div class="hint" style="margin-bottom:6px">This workbook has ${S.sheets.length} tabs. Tick the ones to import and check each tab’s mapping.</div><div class="btn-row">${S.sheets.map((x, i) => `<span class="tag" style="padding-right:12px;${i === S.cur ? 'background:var(--cream);outline:2px solid var(--brown)' : ''}"><input type="checkbox" data-inc="${i}" ${x.include ? 'checked' : ''} ${x.dataCount ? '' : 'disabled'} style="accent-color:var(--brown)"><button type="button" data-sheet="${i}" style="border:0;background:none;width:auto;height:auto;cursor:pointer;font:inherit">${esc(x.name)} <span class="muted">(${x.dataCount})</span></button></span>`).join('')}</div></div>` : ''}
      <div class="toolbar" style="margin-bottom:12px">
        <label class="fld" style="flex-direction:row;align-items:center;gap:8px">Header row <select class="fsel" id="impHdr">${sh.rows.slice(0, 20).map((r, i) => opt(i, `Row ${i + 1}: ${r.filter(c => String(c).trim()).slice(0, 3).join(', ').slice(0, 40)}`, sh.headerIdx)).join('')}</select></label>
      </div>
      <h4 style="font-size:14px;margin:6px 0 10px">Column mapping <span class="muted" style="font-weight:400;font-size:12px">— detected automatically; change anything that’s wrong</span></h4>
      <div class="map-grid">${IMPORT_FIELDS.map(f => {
        const i = sh.map[f.k];
        return `<div class="map-item ${i >= 0 ? 'ok' : f.req ? 'req' : ''}"><div class="lbl">${f.label}${f.req ? ' *' : ''}${f.k === 'rate' ? '<span class="muted" style="font-weight:400">optional — else from rates</span>' : ''}</div>
          <select data-map="${f.k}">${opt(-1, '— Not in file —', i)}${sh.headers.map((h, hi) => opt(hi, h, i)).join('')}</select><div class="sample">${esc(sample(i))}</div></div>`;
      }).join('')}</div>
      <div class="opt-grid">
        <label class="fld">Date format in file<select class="inp" data-opt="dateFmt">${opt('auto', 'Auto-detect (DD/MM when unclear)', o.dateFmt)}${opt('dmy', 'DD/MM/YYYY', o.dateFmt)}${opt('mdy', 'MM/DD/YYYY', o.dateFmt)}</select></label>
        <label class="fld">Rows that already exist<select class="inp" data-opt="dup">${opt('skip', 'Skip them (recommended)', o.dup)}${opt('update', 'Update them with the sheet’s values', o.dup)}${opt('import', 'Add them again as new rows', o.dup)}</select></label>
      </div>
      <h4 style="font-size:14px;margin:18px 0 8px">Preview <span class="muted" style="font-weight:400;font-size:12px">— first rows of “${esc(sh.name)}” as mapped</span></h4>
      <div class="preview-wrap"><table><thead><tr>${mapped.map(f => `<th>${f.label}<br><span style="font-weight:400;color:#999">${esc(sh.headers[sh.map[f.k]])}</span></th>`).join('') || '<th>Nothing mapped yet</th>'}</tr></thead>
      <tbody>${data.slice(0, 8).map(r => `<tr>${mapped.map(f => `<td>${esc(r[sh.map[f.k]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    </div><div class="m-foot"><button class="btn left" id="impBack">Back</button><button class="btn" data-act="modal-close">Cancel</button><button class="btn dark" id="impValidate">Check ${total} rows →</button></div>`;
  },

  /* ---------- validation ---------- */
  validate() {
    const S = this.s, o = S.opts, recs = [], f = DB.freelancer(S.fid);
    const existing = new Map();
    DB.d.deliverables.filter(d => d.freelancerId === S.fid).forEach(d => existing.set(dupKey(d.assignDate, d.client, d.type, d.subject), d));
    const seen = new Map();
    for (const sh of S.sheets) {
      if (!sh.include) continue;
      sh.rows.forEach((r, ri) => {
        if (ri <= sh.headerIdx || !r.some(c => String(c).trim() !== '')) return;
        const get = k => sh.map[k] >= 0 ? r[sh.map[k]] : '';
        const rec = { sheet: sh.name, row: ri + 1, errors: [], warnings: [], data: {}, include: true, kind: 'new' };
        const D = rec.data;
        const ad = parseDateVal(get('assignDate'), o.dateFmt);
        if (!ad) rec.errors.push('Missing assignment date'); else if (ad.err || !ad.iso) rec.errors.push(ad.err || 'Invalid assignment date'); else { D.assignDate = ad.iso; if (ad.warn) rec.warnings.push('Assignment date ' + ad.warn); }
        const dd = parseDateVal(get('deliveryDate'), o.dateFmt);
        if (dd?.err || (dd && !dd.iso)) rec.warnings.push((dd.err || 'Invalid delivery date') + ' — left blank');
        else if (dd) { D.deliveryDate = dd.iso; if (dd.warn) rec.warnings.push('Delivery date ' + dd.warn); if (D.assignDate && dd.iso < D.assignDate) { rec.warnings.push('Delivery before assignment date — left blank'); D.deliveryDate = ''; } }
        D.client = String(get('client') ?? '').trim().replace(/\s+/g, ' ');
        if (D.client) { const known = DB.clients().find(c => normKey(c) === normKey(D.client)); if (known) D.client = known; else { D.newClient = true; rec.warnings.push(`New client “${D.client}” will be added`); } }
        const t = normType(get('type')), types = DB.types();
        D.type = t.val || [/design/i.test(f.description) ? 'Static Creative' : 'Short Format Reel', types[0]].find(x => types.includes(x));
        D.newType = !!t.isNew;
        if (!t.val) rec.warnings.push(`No type — set to ${D.type}`); else if (t.warn) rec.warnings.push(t.warn);
        D.subject = String(get('subject') ?? '').trim(); if (!D.subject) rec.warnings.push('Missing subject');
        const s = normStatus(get('status')); D.status = s.val || 'Allotted'; if (s.warn) rec.warnings.push(s.warn);
        const p = normPay(get('paymentStatus')); D.paymentStatus = p.val || 'Unpaid'; if (p.warn) rec.warnings.push(p.warn);
        D.link = String(get('link') ?? '').trim(); D.notes = String(get('notes') ?? '').trim();
        const rate = parseRate(get('rate'));
        if (rate !== null && isNaN(rate)) rec.warnings.push(`Amount “${get('rate')}” isn’t a number — rate used`); else if (rate !== null) D.rate = rate;
        D.amount = D.rate ?? DB.rateFor(S.fid, D.type);
        if (D.assignDate) {
          const k = dupKey(D.assignDate, D.client, D.type, D.subject);
          const ex = existing.get(k);
          if (ex) {
            rec.match = ex.id;
            rec.changes = UPDATABLE.filter(c => sh.map[c === 'rate' ? 'rate' : c] >= 0 && (c !== 'rate' || D.rate != null) && (c === 'deliveryDate' ? D.deliveryDate !== undefined : true) && String(D[c] ?? '') !== String(ex[c] ?? ''));
            rec.kind = o.dup === 'update' ? (rec.changes.length ? 'update' : 'same') : o.dup === 'import' ? 'new' : 'dup';
          } else if (seen.has(k)) { rec.kind = o.dup === 'import' ? 'new' : 'dup'; rec.dupOf = seen.get(k); }
          else seen.set(k, `${sh.name} row ${ri + 1}`);
        }
        if (rec.errors.length) rec.kind = 'err';
        rec.include = rec.kind === 'new' || rec.kind === 'update';
        recs.push(rec);
      });
    }
    S.records = recs; S.filter = 'all';
  },

  /* ---------- step 3: preview ---------- */
  step3() {
    const S = this.s, R = S.records;
    const by = k => R.filter(r => r.kind === k).length;
    const cnt = { all: R.length, new: R.filter(r => r.kind === 'new' && r.include).length, update: R.filter(r => r.kind === 'update' && r.include).length, dup: by('dup') + by('same'), err: by('err') };
    const pass = r => S.filter === 'all' || r.kind === S.filter || (S.filter === 'dup' && r.kind === 'same');
    const shown = R.filter(pass);
    const chip = (k, l, tone) => `<button class="sum-chip tone-${tone} ${S.filter === k ? 'on' : ''}" data-f="${k}"><b>${cnt[k]}</b><span>${l}</span></button>`;
    const multi = S.sheets.filter(x => x.include).length > 1;
    const statusText = r => r.kind === 'err' ? '' : r.kind === 'update' ? `<span class="w">↻ Will update: ${r.changes.join(', ').replace('rate', 'amount')}</span>` : r.kind === 'same' ? '<span class="muted">Already up to date</span>' : r.kind === 'dup' ? `<span class="w">⧉ Duplicate${r.dupOf ? ' of ' + esc(r.dupOf) : ' — already in table'}</span>` : '';
    const n = cnt.new + cnt.update;
    return `<div class="m-body">
      <div class="sum-chips">${chip('all', 'Rows found', 'white')}${chip('new', 'New rows to add', 'mint')}${S.opts.dup === 'update' ? chip('update', 'Existing rows to update', 'cream') : ''}${chip('dup', 'Duplicates skipped', 'yellow')}${chip('err', 'Errors', 'pink')}</div>
      ${cnt.err ? `<div class="note err" style="margin-bottom:8px">${cnt.err} row${cnt.err > 1 ? 's have' : ' has'} errors and won’t be imported. Go back to fix the mapping, or fix the sheet and upload again.</div>` : ''}
      ${cnt.update ? `<div class="note warn" style="margin-bottom:8px">${cnt.update} existing row${cnt.update > 1 ? 's' : ''} will be overwritten with the sheet’s values. Untick any you want to keep as they are.</div>` : ''}
      <div class="preview-wrap" style="max-height:46vh"><table><thead><tr><th></th><th>${multi ? 'Tab · ' : ''}Row</th><th>Assigned</th><th>Delivery</th><th>Client</th><th>Type</th><th>Subject</th><th>Status</th><th>Payment</th><th>Amount</th><th>Notes / issues</th></tr></thead><tbody>
      ${shown.slice(0, 400).map(r => { const i = R.indexOf(r), D = r.data; return `<tr class="${r.kind === 'err' ? 'err' : r.kind === 'dup' || r.kind === 'same' ? 'dup' : ''} ${r.include ? '' : 'off'}">
        <td><input type="checkbox" data-rec="${i}" ${r.include ? 'checked' : ''} ${r.kind === 'err' || r.kind === 'same' ? 'disabled' : ''} aria-label="Include row"></td><td>${multi ? esc(r.sheet) + ' · ' : ''}${r.row}</td>
        <td>${D.assignDate ? fmtDateY(D.assignDate) : '—'}</td><td>${D.deliveryDate ? fmtDateY(D.deliveryDate) : '—'}</td><td>${esc(D.client || '—')}</td><td>${esc(D.type)}</td><td>${esc(D.subject || '—')}</td>
        <td>${pill(D.status)}</td><td>${esc(D.paymentStatus)}</td><td>${money(D.amount)}</td>
        <td class="issues">${r.errors.map(e => `<span class="e">✕ ${esc(e)}</span>`).join('')}${statusText(r)}${r.warnings.map(w => `<span class="w">! ${esc(w)}</span>`).join('')}${r.kind === 'new' && !r.warnings.length ? '<span style="color:var(--mint-x)">✓ New</span>' : ''}</td></tr>`; }).join('') || '<tr><td colspan="11" class="muted">No rows in this view.</td></tr>'}
      </tbody></table></div>${shown.length > 400 ? `<p class="hint">Showing first 400 of ${shown.length} rows.</p>` : ''}
    </div><div class="m-foot"><button class="btn left" id="impBack">← Back to mapping</button><button class="btn dark" id="impGo" ${n ? '' : 'disabled'}>Import${cnt.new ? ` ${cnt.new} new` : ''}${cnt.update ? `${cnt.new ? ' +' : ''} update ${cnt.update}` : ''}${n ? '' : ' nothing'}</button></div>`;
  },

  commit() {
    const S = this.s, batch = uid();
    let added = 0, updated = 0, failed = 0;
    // Add any new clients and types first so the rows can use them.
    let listChanged = false;
    for (const r of S.records) {
      if (!r.include) continue;
      if (r.data.newClient) { DB.addClient(r.data.client, { quiet: true, noSave: true }); listChanged = true; }
      if (r.data.newType) { DB.addType(r.data.type, { quiet: true, noSave: true }); listChanged = true; }
    }
    if (listChanged) DB.saveSettings();
    for (const r of S.records) {
      if (!r.include) continue;
      const D = r.data;
      try {
        if (r.kind === 'update') {
          const patch = {}; r.changes.forEach(c => patch[c] = D[c]);
          DB.updateDeliverable(r.match, patch, { noSave: true }); updated++;
        } else {
          DB.addDeliverable({ freelancerId: S.fid, assignDate: D.assignDate, deliveryDate: D.deliveryDate, client: D.client, type: D.type, subject: D.subject, status: D.status, paymentStatus: D.paymentStatus, link: D.link, notes: D.notes, rate: D.rate ?? null, rateSource: 'import', importBatch: batch }, { noSave: true });
          added++;
        }
      } catch (e) { failed++; r.errors.push(e.message); }
    }
    const months = [...new Set(S.records.filter(r => r.include && r.data.assignDate).map(r => ymOf(r.data.assignDate)))].sort();
    S.result = { batch, added, updated, failed, skipped: S.records.filter(r => r.kind === 'dup' || r.kind === 'same').length, errors: S.records.filter(r => r.kind === 'err').length, months };
    // Show the imported period in the table so the new rows are visible straight away.
    if (months.length === 1) wsState(S.fid).ym = months[0]; else if (months.length > 1) wsState(S.fid).ym = '';
    S.step = 4; this.render(); rerender();
  },

  /* ---------- step 4: done ---------- */
  step4() {
    const r = this.s.result, ok = r.added + r.updated > 0;
    return `<div class="m-body">
      <div class="note ${ok ? 'ok' : 'err'}" style="padding:18px;font-size:14px">${ic(ok ? 'check' : 'x', 22)}<span class="grow"><b>${r.added} added${r.updated ? `, ${r.updated} updated` : ''}</b> from ${esc(this.s.fileName)}.${r.updated ? '' : ' Existing records were left untouched.'}</span></div>
      <div class="kpi-row" style="margin-top:14px">
        <div class="tile tone-mint" style="min-height:80px"><span class="t-label">Added</span><div class="t-val">${r.added}</div></div>
        <div class="tile tone-cream" style="min-height:80px"><span class="t-label">Updated</span><div class="t-val">${r.updated}</div></div>
        <div class="tile tone-yellow" style="min-height:80px"><span class="t-label">Duplicates skipped</span><div class="t-val">${r.skipped}</div></div>
        <div class="tile tone-pink" style="min-height:80px"><span class="t-label">Errors</span><div class="t-val">${r.errors + r.failed}</div></div>
      </div>
      ${r.months.length ? `<p class="hint" style="margin-top:14px">Rows cover ${r.months.map(monthLabel).join(', ')}. The table now shows ${r.months.length === 1 ? monthLabel(r.months[0]) : 'all months'}.</p>` : ''}
    </div><div class="m-foot">${r.added ? `<button class="btn danger left" id="impUndo">${ic('undo', 15)} Undo added rows</button>` : ''}<button class="btn" id="impAgain">Import another file</button><button class="btn dark" data-act="modal-close">Done</button></div>`;
  },

  /* ---------- wiring ---------- */
  bind(m) {
    const S = this.s, on = (sel, ev, fn) => { const el = $(sel, m); if (el) el.addEventListener(ev, fn); };
    if (S.step === 1) {
      const drop = $('#impDrop', m);
      on('#impFile', 'change', e => e.target.files[0] && this.readFile(e.target.files[0]));
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => e.dataTransfer.files[0] && this.readFile(e.dataTransfer.files[0]));
      on('#impTpl', 'click', () => this.template());
    }
    if (S.step === 2) {
      const sh = S.sheets[S.cur];
      $$('[data-sheet]', m).forEach(b => b.onclick = () => { S.cur = +b.dataset.sheet; this.render(); });
      $$('[data-inc]', m).forEach(c => c.onchange = () => { S.sheets[+c.dataset.inc].include = c.checked; S.cur = +c.dataset.inc; this.render(); });
      $$('[data-map]', m).forEach(s => s.onchange = () => {
        const k = s.dataset.map, v = +s.value;
        if (v >= 0) for (const f in sh.map) if (f !== k && sh.map[f] === v) sh.map[f] = -1;
        sh.map[k] = v; this.render();
      });
      $$('[data-opt]', m).forEach(s => s.onchange = () => { S.opts[s.dataset.opt] = s.value; });
      on('#impHdr', 'change', e => { sh.headerIdx = +e.target.value; this.applyHeader(sh); this.render(); });
      on('#impRestart', 'click', () => { S.step = 1; S.sheets = []; this.render(); });
      on('#impBack', 'click', () => { S.step = 1; this.render(); });
      on('#impValidate', 'click', () => {
        const inc = S.sheets.filter(x => x.include);
        if (!inc.length) return toast('Select at least one tab to import', 'error');
        const bad = inc.find(x => x.map.assignDate < 0);
        if (bad) { S.cur = S.sheets.indexOf(bad); this.render(); return toast(`Choose the Assignment Date column${inc.length > 1 ? ` for “${bad.name}”` : ''}`, 'error'); }
        this.validate(); S.step = 3; this.render();
      });
    }
    if (S.step === 3) {
      $$('[data-f]', m).forEach(b => b.onclick = () => { S.filter = b.dataset.f; this.render(); });
      $$('[data-rec]', m).forEach(c => c.onchange = () => {
        const r = S.records[+c.dataset.rec];
        r.include = c.checked;
        if (c.checked && r.kind === 'dup') r.kind = 'new'; // user chose to add this duplicate anyway
        this.render();
      });
      on('#impBack', 'click', () => { S.step = 2; this.render(); });
      on('#impGo', 'click', async () => {
        const add = S.records.filter(r => r.include && r.kind === 'new').length, upd = S.records.filter(r => r.include && r.kind === 'update').length;
        const keep = this.s;
        const ok = await confirmDialog({
          title: 'Confirm import', confirmText: upd ? 'Import & overwrite' : 'Import', danger: !!upd,
          body: `${add ? `<b>${add}</b> new deliverable${add > 1 ? 's' : ''} will be added to ${esc(DB.freelancer(keep.fid).name)}’s table.` : ''}${upd ? `<br><br><b>${upd}</b> existing deliverable${upd > 1 ? 's' : ''} will be overwritten with values from the sheet. This can’t be undone.` : ''}`,
        });
        openModal('', { size: 'wide' }); this.s = keep;
        if (ok) this.commit(); else this.render();
      });
    }
    if (S.step === 4) {
      on('#impAgain', 'click', () => this.open(S.fid));
      on('#impUndo', 'click', async () => {
        const keep = this.s;
        if (!await confirmDialog({ title: 'Undo added rows?', body: `Removes the ${keep.result.added} deliverables just added. ${keep.result.updated ? 'Updated rows keep their new values.' : ''}`, confirmText: 'Undo', danger: true })) { openModal('', { size: 'wide' }); this.s = keep; this.render(); return; }
        const n = DB.undoImport(keep.result.batch); toast(`${n} imported rows removed`); rerender();
      });
    }
  },
  template() {
    const head = ['Assignment Date', 'Delivery Date', 'Client', 'Type', 'Subject', 'Status', 'Payment Status', 'Posting Link', 'Notes', 'Amount'];
    const rows = [head, ['05/11/2026', '08/11/2026', 'Bloom Organics', 'Short Format Reel', 'Diwali offer teaser', 'Allotted', 'Unpaid', '', 'Use brand fonts', ''], ['06/11/2026', '09/11/2026', 'Nimbus Fintech', 'Long Format Video', 'Founder interview', 'In Review', 'Unpaid', '', '', '900']];
    if (window.XLSX) { const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = head.map(() => ({ wch: 18 })); XLSX.utils.book_append_sheet(wb, ws, 'Deliverables'); saveFile('gfc-import-template.xlsx', XLSX.write(wb, { bookType: 'xlsx', type: 'array' })); }
    else download('gfc-import-template.csv', '﻿' + toCSV(rows), 'text/csv');
  },
};
