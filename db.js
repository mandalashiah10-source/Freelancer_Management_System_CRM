'use strict';
/* ===== Data layer: shared online store (the artifact's `db` capability) =====
   Collections: freelancers/{id}, deliverables/{id}; settings live in settings/app
   (currency, total rule, default rates, the editable Types and Clients lists).
   The UI reads a synchronous in-memory cache; every change updates the cache at
   once and is written to the store in the background (max 4 writes in flight,
   latest version per document wins). Live snapshots from other people refresh
   the cache; documents with unsaved local edits keep the local copy. */

const DEFAULT_TYPES = ['Short Format Reel', 'Long Format Video', 'Static Creative', 'Carousel', 'Banner', 'Other'];
const STATUSES = ['Allotted', 'In Review', 'In Changes', 'Approved', 'Rejected'];
const PAY_STATUSES = ['Unpaid', 'Paid'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const ymOf = iso => (iso ? String(iso).slice(0, 7) : '');
const normKey = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const monthLabel = ym => { if (!ym) return 'All months'; const [y, m] = ym.split('-'); if (!m) return y; return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); };
const sumRate = arr => arr.reduce((s, d) => s + (+d.rate || 0), 0);
const clone = o => JSON.parse(JSON.stringify(o));
const stable = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);

function defaultSettings() {
  return {
    currency: '₹', totalRule: 'approved', types: [...DEFAULT_TYPES], clients: [],
    defaultRates: { 'Short Format Reel': 300, 'Long Format Video': 800, 'Static Creative': 150, 'Carousel': 250, 'Banner': 150, 'Other': 100 },
  };
}

const DB = {
  d: { settings: defaultSettings(), freelancers: [], deliverables: [] },
  store: null, state: 'loading', loaded: false, readOnly: false,
  onChange: () => {}, onStatus: () => {},
  _ready: { freelancers: false, deliverables: false, settings: false },
  _server: { freelancers: new Map(), deliverables: new Map(), settings: null },
  _pending: new Map(), _inflight: new Set(), _active: 0,

  get S() { return this.d.settings; },
  types() { return this.S.types?.length ? this.S.types : DEFAULT_TYPES; },
  clients() { return [...(this.S.clients || [])].sort((a, b) => a.localeCompare(b)); },

  /* ---------- connection ---------- */
  async connect() {
    const db = window.claude?.use ? await window.claude.use('db') : null;
    if (!db) { this.state = 'offline'; this.onStatus(); return; }
    this.store = db;
    try { const user = await window.claude.use('user'); const w = user ? await user.can('data.write') : null; this.readOnly = w === false; } catch (e) { /* unknown: let writes decide */ }
    const timer = setTimeout(() => { if (!this.loaded) { this.state = 'slow'; this.onStatus(); } }, 10000);
    const done = () => { if (!this.loaded && this._ready.freelancers && this._ready.deliverables && this._ready.settings) { this.loaded = true; this.state = 'ok'; clearTimeout(timer); this.onStatus(); this.onChange(true); } };
    const fail = e => { clearTimeout(timer); this.state = e?.code === 'revoked' ? 'offline' : 'error'; this.onStatus(); };
    for (const col of ['freelancers', 'deliverables']) {
      db.collection(col).onSnapshot(snap => {
        const server = new Map(snap.docs.map(x => [x.id, { ...clone(x.data()), id: x.id }]));
        this._server[col] = server;
        const local = new Map(this.d[col].map(x => [x.id, x]));
        const next = [];
        for (const [id, doc] of server) { const k = col + '/' + id; if (this._dirty(k)) { if (local.has(id)) next.push(local.get(id)); } else next.push(doc); }
        for (const [id, doc] of local) if (!server.has(id) && this._dirty(col + '/' + id) && this._pending.get(col + '/' + id) !== null) next.push(doc);
        const changed = next.length !== this.d[col].length || next.some(x => { const o = local.get(x.id); return !o || stable(o) !== stable(x); });
        if (changed) { this.d[col] = next; this.onChange(); }
        if (!snap.metadata.fromCache) { this._ready[col] = true; done(); }
      }, fail);
    }
    db.doc('settings/app').onSnapshot(snap => {
      const s = snap.exists ? { ...defaultSettings(), ...clone(snap.data()) } : defaultSettings();
      this._server.settings = s;
      if (!this._dirty('settings/app') && stable(s) !== stable(this.d.settings)) { this.d.settings = s; this.onChange(); }
      if (!snap.metadata.fromCache) { this._ready.settings = true; done(); }
    }, fail);
  },

  /* ---------- background writes ---------- */
  _dirty(k) { return this._pending.has(k) || this._inflight.has(k); },
  saving() { return this._pending.size + this._inflight.size; },
  persist(key, body) { // body === null deletes
    if (!this.store) { this.onStatus(); return; }
    this._pending.delete(key); this._pending.set(key, body === null ? null : clone(body));
    this._pump(); this.onStatus();
  },
  _pump() {
    while (this._active < 4) {
      let key = null; for (const k of this._pending.keys()) if (!this._inflight.has(k)) { key = k; break; }
      if (key === null) return;
      const body = this._pending.get(key); this._pending.delete(key);
      this._active++; this._inflight.add(key);
      const ref = this.store.doc(key);
      const run = (retry) => (body === null ? ref.delete() : ref.set(body)).catch(e => {
        if (e?.code === 'unavailable' && retry) return new Promise(r => setTimeout(r, 600 + Math.random() * 900)).then(() => run(false));
        throw e;
      });
      run(true).catch(e => this._writeFailed(key, e)).finally(() => { this._active--; this._inflight.delete(key); this.onStatus(); this._pump(); });
    }
  },
  _writeFailed(key, e) {
    const msg = e?.code === 'invalid_argument' ? 'You have view-only access, so changes aren’t saved. Ask the owner to invite you as an Editor.'
      : e?.code === 'quota_exceeded' ? 'The database is full. Delete old deliverables to make room.'
      : 'A change couldn’t be saved. Check your connection and try again.';
    if (e?.code === 'invalid_argument') this.readOnly = true;
    // Put the last server copy back so the screen matches what's really stored.
    const [col, id] = key.split('/');
    if (!this._dirty(key)) {
      if (col === 'settings') this.d.settings = this._server.settings || defaultSettings();
      else { const srv = this._server[col].get(id); this.d[col] = this.d[col].filter(x => x.id !== id); if (srv) this.d[col].push(srv); }
      this.onChange();
    }
    (window.toast || console.error)(msg, 'error');
  },
  saveSettings() { this.persist('settings/app', this.d.settings); },
  _saveF(f) { this.persist('freelancers/' + f.id, f); },
  _saveD(d) { this.persist('deliverables/' + d.id, d); },

  /* ---------- lookups ---------- */
  freelancer(id) { return this.d.freelancers.find(f => f.id === id); },
  deliverable(id) { return this.d.deliverables.find(d => d.id === id); },
  rateFor(fid, type) { const f = this.freelancer(fid); return +(f?.rates?.[type] ?? this.S.defaultRates?.[type] ?? 0) || 0; },
  /** Whether a deliverable counts toward the monthly total (Settings → monthly total rule). */
  counts(d) { return this.S.totalRule === 'all' ? d.status !== 'Rejected' : d.status === 'Approved'; },
  /** ym: 'YYYY-MM', 'YYYY' or '' for everything */
  inPeriod(d, ym) { return !ym || String(d.assignDate).startsWith(ym); },
  summary(fid, ym) {
    const items = this.d.deliverables.filter(d => d.freelancerId === fid && this.inPeriod(d, ym));
    const counted = items.filter(d => this.counts(d));
    const total = sumRate(counted), paid = sumRate(counted.filter(d => d.paymentStatus === 'Paid'));
    return { items, count: items.length, counted: counted.length, total, paid, unpaid: total - paid };
  },

  /* ---------- lists: clients & types ---------- */
  _listAdd(kind, name, opts = {}) {
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!name) throw new Error(`Enter a ${kind} name.`);
    const list = kind === 'type' ? (this.S.types = [...this.types()]) : (this.S.clients = [...(this.S.clients || [])]);
    const hit = list.find(x => normKey(x) === normKey(name));
    if (hit) { if (opts.quiet) return hit; throw new Error(`“${hit}” already exists.`); }
    list.push(name);
    if (!opts.noSave) this.saveSettings();
    return name;
  },
  addClient(name, opts) { return this._listAdd('client', name, opts); },
  addType(name, opts) { return this._listAdd('type', name, opts); },
  renameClient(oldName, name) {
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('Client name can’t be empty.');
    if (name === oldName) return;
    if (this.S.clients.some(x => x !== oldName && normKey(x) === normKey(name))) throw new Error(`“${name}” already exists.`);
    this.S.clients = this.S.clients.map(x => x === oldName ? name : x);
    this.saveSettings();
    this.d.deliverables.filter(d => d.client === oldName).forEach(d => { d.client = name; d.updatedAt = Date.now(); this._saveD(d); });
  },
  renameType(oldName, name) {
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('Type name can’t be empty.');
    if (name === oldName) return;
    if (this.types().some(x => x !== oldName && normKey(x) === normKey(name))) throw new Error(`“${name}” already exists.`);
    this.S.types = this.types().map(x => x === oldName ? name : x);
    if (this.S.defaultRates && oldName in this.S.defaultRates) { this.S.defaultRates[name] = this.S.defaultRates[oldName]; delete this.S.defaultRates[oldName]; }
    this.saveSettings();
    this.d.freelancers.forEach(f => { if (f.rates && oldName in f.rates) { f.rates[name] = f.rates[oldName]; delete f.rates[oldName]; this._saveF(f); } });
    this.d.deliverables.filter(d => d.type === oldName).forEach(d => { d.type = name; d.updatedAt = Date.now(); this._saveD(d); });
  },
  usage(kind, name) { return this.d.deliverables.filter(d => (kind === 'type' ? d.type : d.client) === name).length; },
  removeClient(name) {
    const n = this.usage('client', name); if (n) throw new Error(`“${name}” is used by ${n} deliverable${n > 1 ? 's' : ''}. Change those first, or rename the client instead.`);
    this.S.clients = this.S.clients.filter(x => x !== name); this.saveSettings();
  },
  removeType(name) {
    const n = this.usage('type', name); if (n) throw new Error(`“${name}” is used by ${n} deliverable${n > 1 ? 's' : ''}. Change those first, or rename the type instead.`);
    if (this.types().length <= 1) throw new Error('Keep at least one type.');
    this.S.types = this.types().filter(x => x !== name); this.saveSettings();
  },

  /* ---------- deliverables ---------- */
  addDeliverable(input) {
    if (!this.freelancer(input.freelancerId)) throw new Error('Freelancer not found.');
    const types = this.types(), now = Date.now();
    const d = {
      id: uid(), freelancerId: input.freelancerId,
      assignDate: input.assignDate || todayISO(), deliveryDate: input.deliveryDate || '',
      client: (input.client || '').trim(), type: types.includes(input.type) ? input.type : (types.includes('Other') ? 'Other' : types[0]),
      subject: (input.subject || '').trim(), status: STATUSES.includes(input.status) ? input.status : 'Allotted',
      paymentStatus: input.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
      link: (input.link || '').trim(), notes: (input.notes || '').trim(),
      rate: 0, rateSource: 'card', createdAt: now, updatedAt: now, importBatch: input.importBatch || null,
    };
    // Amount is a snapshot: an explicit amount wins, otherwise copy the freelancer's current rate.
    if (input.rate !== null && input.rate !== undefined && input.rate !== '' && !isNaN(+input.rate)) { d.rate = Math.max(0, +input.rate); d.rateSource = input.rateSource || 'manual'; }
    else d.rate = this.rateFor(d.freelancerId, d.type);
    this.d.deliverables.push(d);
    this._saveD(d);
    return d;
  },
  updateDeliverable(id, patch) {
    const d = this.deliverable(id);
    if (!d) throw new Error('Deliverable not found.');
    const keys = Object.keys(patch).filter(k => String(patch[k] ?? '') !== String(d[k] ?? ''));
    if (!keys.length) return d;
    const next = { ...d };
    for (const k of keys) next[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
    if (!next.assignDate) throw new Error('Assignment date is required.');
    if (next.deliveryDate && next.deliveryDate < next.assignDate) throw new Error('Delivery date can’t be before the assignment date.');
    if (keys.includes('type') && !keys.includes('rate')) { next.rate = this.rateFor(next.freelancerId, next.type); next.rateSource = 'card'; }
    if (keys.includes('rate')) { next.rate = Math.max(0, +patch.rate || 0); next.rateSource = 'manual'; }
    Object.assign(d, next, { updatedAt: Date.now() });
    this._saveD(d);
    return d;
  },
  deleteDeliverable(id) { this.d.deliverables = this.d.deliverables.filter(d => d.id !== id); this.persist('deliverables/' + id, null); },
  undoImport(batchId) {
    const gone = this.d.deliverables.filter(d => d.importBatch === batchId);
    gone.forEach(d => this.deleteDeliverable(d.id));
    return gone.length;
  },

  /* ---------- freelancers ---------- */
  addFreelancer(input) {
    if (!input.name?.trim()) throw new Error('Name is required.');
    const f = { id: uid(), name: input.name.trim(), description: (input.description || '').trim(), avatar: input.avatar || '', rates: { ...this.S.defaultRates }, createdAt: Date.now() };
    this.d.freelancers.push(f); this._saveF(f); return f;
  },
  updateFreelancer(id, patch) {
    const f = this.freelancer(id); if (!f) throw new Error('Freelancer not found.');
    if ('name' in patch && !String(patch.name).trim()) throw new Error('Name is required.');
    Object.assign(f, patch); this._saveF(f); return f;
  },
  setRates(id, rates) {
    const f = this.freelancer(id); let n = 0; f.rates = { ...(f.rates || {}) };
    for (const t of this.types()) { const v = Math.max(0, +rates[t] || 0); if (f.rates[t] === undefined ? v !== this.rateFor(id, t) : +f.rates[t] !== v) n++; f.rates[t] = v; }
    this._saveF(f); return n;
  },
  deleteFreelancer(id) {
    this.d.deliverables.filter(d => d.freelancerId === id).forEach(d => this.deleteDeliverable(d.id));
    this.d.freelancers = this.d.freelancers.filter(f => f.id !== id);
    this.persist('freelancers/' + id, null);
  },
};
