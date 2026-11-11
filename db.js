'use strict';
/* ===== Data layer: Supabase (real database + email/password login) =====
   Who can see what is enforced by the database itself (row level security, see schema.sql):
   - owner (listed in the `admins` table): everything
   - a freelancer: the team's work (client, type, subject, status, dates, link) PLUS their OWN rates,
     amounts, payment status and notes. Other people's money is never sent to their browser.
   The UI reads a synchronous in-memory cache; changes update the cache at once and are saved in
   the background in batches. Only one freelancer + one period (max 1000 rows) is loaded at a time. */

const DEFAULT_TYPES = ['Short Format Reel', 'Long Format Video', 'Static Creative', 'Carousel', 'Banner', 'Other'];
const STATUSES = ['Allotted', 'In Review', 'In Changes', 'Approved', 'Rejected'];
const PAY_STATUSES = ['Unpaid', 'Paid'];

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
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
const chunks = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
const one = x => (Array.isArray(x) ? x[0] : x) || null;
const isoTs = n => new Date(n || Date.now()).toISOString();
const okEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function defaultSettings() {
  return { currency: '₹', totalRule: 'approved', types: [...DEFAULT_TYPES], clients: [], defaultRates: {} };
}

const DB = {
  d: { settings: defaultSettings(), freelancers: [], deliverables: [], team: [], work: [] },
  sb: null, user: null, state: 'loading', loaded: false, readOnly: false, role: null, myId: null,
  MAX_ROWS: 1000, dLoading: new Set(), capped: new Set(), workLoading: false,
  onChange: () => {}, onStatus: () => {},
  _dirtyD: new Map(), _dirtyF: new Map(), _delD: new Set(), _delF: new Set(), _flightD: new Set(), _setDirty: false,
  _flushing: false, _again: false, _t: null, _subKey: null, _wk: null, _lastLoad: 0, _booting: false,

  get S() { return this.d.settings; },
  types() { return this.S.types?.length ? this.S.types : DEFAULT_TYPES; },
  clients() { return [...(this.S.clients || [])].sort((a, b) => a.localeCompare(b)); },

  /* ---------- login ---------- */
  async connect() {
    const cfg = window.GFC_CONFIG || {};
    if (!cfg.url || !cfg.anonKey || /YOUR[-_]/i.test(cfg.url + cfg.anonKey) || !window.supabase) { this.state = 'setup'; this.onStatus(); return; }
    const hp = new URLSearchParams(location.hash.slice(1)); this._linkType = hp.get('type') || '';
    if (hp.get('error')) { this.authNotice = hp.get('error_code') === 'otp_expired' ? 'This invitation link has expired or was already used. Ask your GFC admin to send a new invitation.' : 'This link isn’t valid. Ask your GFC admin to send a new invitation.'; history.replaceState(null, '', location.pathname + location.search); }
    this.sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    this.sb.auth.onAuthStateChange((ev, session) => {
      setTimeout(() => {
        if (/[#&](access_token|error|type|code)=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);   // the link has been used up
        if (ev === 'PASSWORD_RECOVERY') { this.state = 'recovery'; this.onStatus(); return; }
        if (!session) { this._reset(); this.state = 'login'; this.onStatus(); return; }
        if (this.state === 'recovery' || this.state === 'activate') return;
        if (this._linkType === 'invite' && (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION')) { this.user = session.user; this.state = 'activate'; this.onStatus(); return; }
        if (!this.user || this.user.id !== session.user.id) { this.user = session.user; this._boot(); }
      }, 0);
    });
    window.addEventListener('focus', () => this.refresh());
    setInterval(() => this.refresh(), 60000);   // keep invitation statuses fresh
    // Self-check: tell the user at once if the address or key in config.js is wrong.
    if (typeof fetch === 'function') fetch(String(cfg.url).replace(/\/+$/, '') + '/auth/v1/health', { headers: { apikey: cfg.anonKey } })
      .then(r => { this.cfgIssue = r.status === 401 || r.status === 403 ? 'key' : ''; })
      .catch(() => { this.cfgIssue = 'url'; })
      .finally(() => { if (this.cfgIssue) this.onChange(true); });
  },
  cfgIssue: '', lastError: '', authNotice: '', _linkType: '',
  _reset() { this.user = null; this.role = null; this.myId = null; this.loaded = false; this.readOnly = false; this._subKey = null; this._wk = null; this.d = { settings: defaultSettings(), freelancers: [], deliverables: [], team: [], work: [] }; },
  _niceAuth(m) {
    m = String(m || '');
    if (/banned|disabled/i.test(m)) return 'This account has been disabled. Contact your GFC admin.';
    if (/not confirmed/i.test(m)) return 'Your email isn’t confirmed yet. Open the confirmation email, click the link, then sign in.';
    if (/invalid login/i.test(m)) return 'Wrong email or password. If you haven’t created an account yet, click “First time? Create account”.';
    if (/rate limit/i.test(m)) return 'Supabase’s free email limit is used up for now (wait about an hour). To skip email: in Supabase go to Authentication > Users > Add user > Create new user, tick Auto Confirm, then sign in here with that email and password.';
    if (/already registered/i.test(m)) return 'This email already has an account. Sign in, or use “Forgot password?”.';
    if (/api key|apikey|jwt/i.test(m)) return 'The Supabase key in config.js looks wrong. Copy the anon/publishable key again.';
    if (/fetch|network|timeout|load failed/i.test(m)) return 'Can’t reach Supabase. Check your internet and the URL in config.js. If your internet provider blocks supabase.co, try a mobile hotspot or change DNS to 1.1.1.1.';
    return m || 'Something went wrong. Try again.';
  },
  async signIn(email, password) {
    if (!email.trim() || !password) throw new Error('Enter your email and password.');
    try { const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; this.authNotice = ''; this.sb.rpc('mark_activated').then(() => {}, () => {}); }
    catch (e) { throw new Error(this._niceAuth(e.message)); }
  },
  async signUp(email, password) {
    if (!okEmail(email.trim())) throw new Error('Enter a valid email.');
    if ((password || '').length < 8) throw new Error('Use a password of at least 8 characters.');
    try {
      const { data, error } = await this.sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      return data.session ? 'in' : 'confirm';
    } catch (e) { throw new Error(this._niceAuth(e.message)); }
  },
  async resetPassword(email) { if (!okEmail(email.trim())) throw new Error('Type your email above first.'); try { const { error } = await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname }); if (error) throw error; } catch (e) { throw new Error(this._niceAuth(e.message)); } },
  async setPassword(pw) {
    if ((pw || '').length < 8) throw new Error('Use a password of at least 8 characters.');
    const { error } = await this.sb.auth.updateUser({ password: pw }); if (error) throw new Error(this._niceAuth(error.message));
    try { await this.sb.rpc('mark_activated'); } catch (e) { /* the next login marks it */ }
    this._linkType = ''; this.authNotice = ''; history.replaceState(null, '', location.pathname + location.search);
    this.state = 'loading'; this.user = null; this.onStatus();
    const { data } = await this.sb.auth.getSession();
    if (data.session) { this.user = data.session.user; this._boot(); } else { this.state = 'login'; this.onStatus(); }
  },
  async changePassword(pw) {
    if ((pw || '').length < 8) throw new Error('Use a password of at least 8 characters.');
    try { const { error } = await this.sb.auth.updateUser({ password: pw }); if (error) throw error; } catch (e) { throw new Error(this._niceAuth(e.message)); }
  },
  async signOut() { await this.idle(); await this.sb.auth.signOut(); },

  /* ---------- loading ---------- */
  _fRow(r) { const p = one(r.freelancer_private); return { id: r.id, name: r.name, description: r.description || '', avatar: r.avatar || '', userId: r.user_id, linked: !!r.user_id, email: p?.email || '', rates: p?.rates || {}, invitedAt: p?.invited_at || null, inviteExpiresAt: p?.invite_expires_at || null, activatedAt: p?.activated_at || null, disabledAt: p?.disabled_at || null, inviteCount: p?.invite_count || 0, createdAt: Date.parse(r.created_at) || 0 }; },
  _dRow(r) { const m = one(r.deliverable_money); return { id: r.id, freelancerId: r.freelancer_id, assignDate: r.assign_date, deliveryDate: r.delivery_date || '', client: r.client || '', type: r.type || '', subject: r.subject || '', status: r.status, link: r.link || '', importBatch: r.import_batch || null, createdAt: Date.parse(r.created_at) || 0, updatedAt: Date.parse(r.updated_at) || 0, paymentStatus: m?.payment_status || 'Unpaid', notes: m?.notes || '', rate: +(m?.rate ?? 0), rateSource: m?.rate_source || 'card' }; },
  ACCESS_LABEL: { none: 'Not Invited', pending: 'Invitation Pending', expired: 'Invitation Expired', active: 'Active', disabled: 'Disabled' },
  accessStatus(f) {
    if (f.disabledAt) return 'disabled';
    if (f.activatedAt) return 'active';
    if (f.invitedAt) return Date.parse(f.inviteExpiresAt) > Date.now() ? 'pending' : 'expired';
    return 'none';
  },
  /** invite | disable | enable: handled on the server (admin check, email, login), never in the browser. */
  async accessAction(fid, action) {
    const f = this.freelancer(fid); if (!f) throw new Error('Freelancer not found.');
    await this.idle();                                   // save the profile (and its email) first
    let res; try { res = await this.sb.functions.invoke('invite-freelancer', { body: { freelancerId: fid, action } }); } catch (e) { res = { error: e }; }
    if (res.error) {
      let msg = ''; try { msg = (await res.error.context.json()).error; } catch (e) { /* no body */ }
      throw new Error(msg || (/fetch|network|failed to send/i.test(res.error.message || '') ? 'Can’t reach the server. Check your internet and try again.' : 'The invitation service didn’t respond. Ask the admin to check that the invite function is deployed.'));
    }
    const a = res.data?.access; if (!a) throw new Error(res.data?.error || 'Unexpected answer from the server.');
    Object.assign(f, { userId: a.userId, linked: !!a.userId, invitedAt: a.invitedAt, inviteExpiresAt: a.inviteExpiresAt, activatedAt: a.activatedAt, disabledAt: a.disabledAt, inviteCount: a.inviteCount });
    this.onChange(); return f;
  },
  async _boot(quiet) {
    if (this._booting) return; this._booting = true;
    if (!quiet) { this.state = 'loading'; this.loaded = false; this.onStatus(); }
    try {
      await this.sb.rpc('claim_profile');
      const adm = await this.sb.from('admins').select('email').limit(1); if (adm.error) throw adm.error;
      this.role = adm.data.length ? 'owner' : 'freelancer';
      const [st, fl] = await Promise.all([
        this.sb.from('settings').select('data').eq('id', 1).maybeSingle(),
        this.sb.from('freelancers').select('id,name,description,avatar,user_id,created_at,freelancer_private(email,rates,invited_at,invite_expires_at,activated_at,disabled_at,invite_count)').order('name'),
      ]);
      if (st.error) throw st.error; if (fl.error) throw fl.error;
      if (!this._setDirty) this.d.settings = { ...defaultSettings(), ...(st.data?.data || {}) };
      const all = fl.data.map(r => this._fRow(r));
      if (this.role === 'owner') { this.readOnly = false; this.d.freelancers = all; this.d.team = []; }
      else {
        this.readOnly = true; const me = all.find(f => f.userId === this.user.id); this.myId = me?.id || null;
        this.d.freelancers = me ? [me] : []; this.d.team = all.map(f => ({ id: f.id, name: f.name, description: f.description, avatar: f.avatar }));
      }
      this._lastLoad = Date.now(); this._subKey = null; this._wk = null;
      const first = !this.loaded; this.loaded = true; this.state = 'ok'; this.onStatus(); this.onChange(first);
    } catch (e) {
      this.lastError = (e && (e.message || e.details)) ? String(e.message || e.details) : String(e); console.error('GFC load error:', e);
      if (!quiet) { this.state = 'error'; this.onStatus(); } else (window.toast || console.error)('Couldn’t refresh. Check your connection.', 'error');
    } finally { this._booting = false; }
  },
  async refresh() { if (!this.loaded || this.saving() || Date.now() - this._lastLoad < 20000) return; await this._boot(true); },

  _range(ym) {
    if (!ym) return null;
    if (ym.length === 4) return [ym + '-01-01', ym + '-12-31'];
    const [y, m] = ym.split('-'); return [`${ym}-01`, `${ym}-${pad(new Date(+y, +m, 0).getDate())}`];
  },
  async _fetchD(fid, ym, from, to, money) {
    let q = this.sb.from('deliverables').select(money ? '*, deliverable_money(rate,rate_source,payment_status,notes)' : '*').eq('freelancer_id', fid);
    const r = this._range(ym); if (r) q = q.gte('assign_date', r[0]).lte('assign_date', r[1]);
    const { data, error } = await q.order('assign_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to);
    if (error) throw error; return data.map(x => this._dRow(x));
  },
  isCapped(fid) { return this.capped.has(fid); },
  _isDirtyD(id) { return this._dirtyD.has(id) || this._flightD.has(id); },
  /** Keep ONE freelancer's deliverables for ONE period (max 1000 rows) in memory. */
  async watch(fid, ym) {
    if (!this.sb || !fid) return;
    const key = fid + '|' + (ym || ''); if (this._subKey === key) return; this._subKey = key;
    this.dLoading.add(fid); this.capped.delete(fid);
    this.d.deliverables = this.d.deliverables.filter(d => d.freelancerId === fid || this._isDirtyD(d.id));
    try {
      const own = this.role === 'owner' || fid === this.myId;
      const rows = await this._fetchD(fid, ym, 0, this.MAX_ROWS - 1, own);
      if (this._subKey !== key) return;
      const keep = this.d.deliverables.filter(d => d.freelancerId !== fid || this._isDirtyD(d.id)), have = new Set(keep.map(d => d.id));
      this.d.deliverables = [...keep, ...rows.filter(r => !have.has(r.id))];
      if (rows.length >= this.MAX_ROWS) this.capped.add(fid);
    } catch (e) { this._subKey = null; (window.toast || console.error)('Couldn’t load deliverables. Check your connection.', 'error'); }
    this.dLoading.delete(fid); this.onChange();
  },
  /** Another freelancer's work (no money) for the Team view. */
  async watchWork(fid, ym) {
    if (!this.sb || !fid) return;
    const key = fid + '|' + (ym || ''); if (this._wk === key) return; this._wk = key;
    this.workLoading = true; this.d.work = [];
    try { const rows = await this._fetchD(fid, ym, 0, this.MAX_ROWS - 1, false); if (this._wk !== key) return; this.d.work = rows; }
    catch (e) { this._wk = null; (window.toast || console.error)('Couldn’t load the team’s work. Check your connection.', 'error'); }
    this.workLoading = false; this.onChange();
  },
  /** One-off read of a whole period (used by downloads), any number of rows. */
  async loadPeriod(fid, ym) {
    if (!this.sb) return;
    const have = new Set(this.d.deliverables.map(d => d.id)), own = this.role === 'owner' || fid === this.myId;
    for (let from = 0; ; from += 1000) {
      const rows = await this._fetchD(fid, ym, from, from + 999, own);
      rows.forEach(r => { if (!have.has(r.id)) { have.add(r.id); this.d.deliverables.push(r); } });
      if (rows.length < 1000) break;
    }
  },

  /* ---------- background saving (batched) ---------- */
  saving() { return this._dirtyD.size + this._dirtyF.size + this._delD.size + this._delF.size + (this._setDirty ? 1 : 0) + (this._flushing ? 1 : 0); },
  idle() { return new Promise(res => { const t = () => (this.saving() ? setTimeout(t, 80) : res()); t(); }); },
  _schedule() { clearTimeout(this._t); this._t = setTimeout(() => this._flush(), 80); this.onStatus(); },
  async _flush() {
    if (this._flushing) { this._again = true; return; }
    this._flushing = true;
    try {
      do {
        this._again = false;
        const F = [...this._dirtyF.values()]; this._dirtyF.clear();
        const D = [...this._dirtyD.values()]; this._dirtyD.clear(); D.forEach(d => this._flightD.add(d.id));
        const delD = [...this._delD]; this._delD.clear();
        const delF = [...this._delF]; this._delF.clear();
        const st = this._setDirty; this._setDirty = false;
        try {
          for (const c of chunks(F, 200)) {
            let r = await this.sb.from('freelancers').upsert(c.map(f => ({ id: f.id, name: f.name, description: f.description || '', avatar: f.avatar || '', created_at: isoTs(f.createdAt) }))); if (r.error) throw r.error;
            r = await this.sb.from('freelancer_private').upsert(c.map(f => ({ freelancer_id: f.id, email: f.email ? String(f.email).trim().toLowerCase() : null, rates: f.rates || {} })), { onConflict: 'freelancer_id' }); if (r.error) throw r.error;
          }
          if (st) { const r = await this.sb.from('settings').upsert({ id: 1, data: this.d.settings }); if (r.error) throw r.error; }
          for (const c of chunks(D, 200)) {
            let r = await this.sb.from('deliverables').upsert(c.map(d => ({ id: d.id, freelancer_id: d.freelancerId, assign_date: d.assignDate, delivery_date: d.deliveryDate || null, client: d.client || '', type: d.type || '', subject: d.subject || '', status: d.status, link: d.link || '', import_batch: d.importBatch || null, created_at: isoTs(d.createdAt), updated_at: isoTs(d.updatedAt) }))); if (r.error) throw r.error;
            r = await this.sb.from('deliverable_money').upsert(c.map(d => ({ deliverable_id: d.id, freelancer_id: d.freelancerId, rate: +d.rate || 0, rate_source: d.rateSource || 'card', payment_status: d.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid', notes: d.notes || '' })), { onConflict: 'deliverable_id' }); if (r.error) throw r.error;
          }
          for (const c of chunks(delD, 100)) { const r = await this.sb.from('deliverables').delete().in('id', c); if (r.error) throw r.error; }
          for (const c of chunks(delF, 100)) { const r = await this.sb.from('freelancers').delete().in('id', c); if (r.error) throw r.error; }
        } catch (e) { this._writeFailed(e); }
        finally { D.forEach(d => this._flightD.delete(d.id)); }
      } while (this._again || this._dirtyD.size || this._dirtyF.size || this._delD.size || this._delF.size || this._setDirty);
    } finally { this._flushing = false; this.onStatus(); }
  },
  _writeFailed(e) {
    const code = e?.code || '', msg = /row-level security|permission denied/i.test(e?.message || '') || code === '42501' ? 'You don’t have permission to change this.'
      : code === '23505' ? 'That email is already used by another freelancer.'
      : 'A change couldn’t be saved. Check your connection and try again.';
    (window.toast || console.error)(msg, 'error');
    this._dirtyD.clear(); this._dirtyF.clear(); this._delD.clear(); this._delF.clear(); this._setDirty = false;
    this._boot(true);   // put the screen back to what is really stored
  },
  saveSettings() { this._setDirty = true; this._schedule(); },
  _saveF(f) { this._dirtyF.set(f.id, clone(f)); this._schedule(); },
  _saveD(d) { this._dirtyD.set(d.id, clone(d)); this._delD.delete(d.id); this._schedule(); },

  /* ---------- lookups ---------- */
  freelancer(id) { return this.d.freelancers.find(f => f.id === id); },
  deliverable(id) { return this.d.deliverables.find(d => d.id === id); },
  rateFor(fid, type) { const f = this.freelancer(fid); return +(f?.rates?.[type] ?? 0) || 0; },
  hasRate(fid, type) { const v = this.freelancer(fid)?.rates?.[type]; return v !== undefined && v !== null && v !== ''; },
  counts(d) { return this.S.totalRule === 'all' ? d.status !== 'Rejected' : d.status === 'Approved'; },
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
  async renameClient(oldName, name) {
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('Client name can’t be empty.');
    if (name === oldName) return;
    if (this.S.clients.some(x => x !== oldName && normKey(x) === normKey(name))) throw new Error(`“${name}” already exists.`);
    await this.idle();
    const { error } = await this.sb.from('deliverables').update({ client: name }).eq('client', oldName); if (error) throw new Error('Couldn’t rename. Try again.');
    this.S.clients = this.S.clients.map(x => x === oldName ? name : x); this.saveSettings();
    this.d.deliverables.forEach(d => { if (d.client === oldName) d.client = name; });
  },
  async renameType(oldName, name) {
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('Type name can’t be empty.');
    if (name === oldName) return;
    if (this.types().some(x => x !== oldName && normKey(x) === normKey(name))) throw new Error(`“${name}” already exists.`);
    await this.idle();
    const { error } = await this.sb.from('deliverables').update({ type: name }).eq('type', oldName); if (error) throw new Error('Couldn’t rename. Try again.');
    this.S.types = this.types().map(x => x === oldName ? name : x); this.saveSettings();
    this.d.freelancers.forEach(f => { if (f.rates && oldName in f.rates) { f.rates[name] = f.rates[oldName]; delete f.rates[oldName]; this._saveF(f); } });
    this.d.deliverables.forEach(d => { if (d.type === oldName) d.type = name; });
  },
  usage() { return 0; },
  async assertUnused(kind, name) {
    await this.idle();
    const { count, error } = await this.sb.from('deliverables').select('id', { count: 'exact', head: true }).eq(kind === 'type' ? 'type' : 'client', name);
    if (error) throw new Error('Couldn’t check. Try again.');
    if (count) throw new Error(`“${name}” is used by ${count} deliverable${count > 1 ? 's' : ''}. Change those first, or rename it instead.`);
  },
  removeClient(name) { this.S.clients = this.S.clients.filter(x => x !== name); this.saveSettings(); },
  removeType(name) {
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
  deleteDeliverable(id) { this.d.deliverables = this.d.deliverables.filter(d => d.id !== id); this._dirtyD.delete(id); this._delD.add(id); this._schedule(); },
  async undoImport(batchId, fid) {
    await this.idle();
    const { data, error } = await this.sb.from('deliverables').delete().eq('import_batch', batchId).eq('freelancer_id', fid).select('id');
    if (error) throw new Error('Couldn’t undo. Try again.');
    const ids = new Set((data || []).map(x => x.id)); this.d.deliverables = this.d.deliverables.filter(d => !ids.has(d.id) && d.importBatch !== batchId);
    return ids.size;
  },

  /** Everything the owner can see, all freelancers and all months (for backups). */
  async exportAll() {
    await this.idle();
    const out = { exportedAt: new Date().toISOString(), settings: this.S, freelancers: this.d.freelancers.map(f => ({ ...f, avatar: undefined })), deliverables: [] };
    for (const f of this.d.freelancers) for (let from = 0; ; from += 1000) { const rows = await this._fetchD(f.id, '', from, from + 999, true); out.deliverables.push(...rows); if (rows.length < 1000) break; }
    return out;
  },

  /* ---------- admins ---------- */
  admins: null, _adminsAt: 0,
  async loadAdmins() { const { data, error } = await this.sb.from('admins').select('email').order('email'); if (error) throw error; this.admins = data.map(x => x.email); this._adminsAt = Date.now(); return this.admins; },
  async addAdmin(email) {
    email = String(email || '').trim().toLowerCase(); if (!okEmail(email)) throw new Error('Enter a valid email.');
    const { error } = await this.sb.from('admins').insert({ email });
    if (error) throw new Error(error.code === '23505' ? 'That email is already an admin.' : 'Couldn’t add the admin. Try again.');
  },
  async removeAdmin(email) {
    if (String(email).toLowerCase() === String(this.user?.email || '').toLowerCase()) throw new Error('You can’t remove yourself. Ask another admin to do it.');
    const { error } = await this.sb.from('admins').delete().eq('email', email);
    if (error) throw new Error(/at least one admin/i.test(error.message) ? 'There must always be at least one admin.' : 'Couldn’t remove the admin. Try again.');
  },

  /* ---------- freelancers ---------- */
  _cleanRates(r) { const o = {}; for (const t of this.types()) { const v = r?.[t]; if (v !== undefined && v !== null && String(v).trim() !== '' && !isNaN(+v)) o[t] = Math.max(0, +v); } return o; },
  _email(v) { const e = String(v || '').trim().toLowerCase(); if (e && !okEmail(e)) throw new Error('That email doesn’t look right.'); if (e && this.d.freelancers.some(f => f.email === e)) throw new Error('That email is already used by another freelancer.'); return e; },
  addFreelancer(input) {
    if (!input.name?.trim()) throw new Error('Name is required.');
    const f = { id: uid(), name: input.name.trim(), description: (input.description || '').trim(), avatar: input.avatar || '', email: this._email(input.email), linked: false, rates: this._cleanRates(input.rates), createdAt: Date.now() };
    this.d.freelancers.push(f); this._saveF(f); return f;
  },
  updateFreelancer(id, patch) {
    const f = this.freelancer(id); if (!f) throw new Error('Freelancer not found.');
    if ('name' in patch && !String(patch.name).trim()) throw new Error('Name is required.');
    if ('email' in patch) {
      const e = String(patch.email || '').trim().toLowerCase();
      if (e !== f.email) {
        if (f.activatedAt) throw new Error('This freelancer already has an active account, so their email can’t be changed here.');
        if (e && !okEmail(e)) throw new Error('That email doesn’t look right.');
        if (e && this.d.freelancers.some(x => x.id !== id && x.email === e)) throw new Error('That email is already used by another freelancer.');
      }
      patch = { ...patch, email: e };
    }
    Object.assign(f, patch); this._saveF(f); return f;
  },
  setRates(id, rates) {
    const f = this.freelancer(id); const before = stable(f.rates || {});
    f.rates = this._cleanRates(rates);
    this._saveF(f); return before === stable(f.rates) ? 0 : 1;
  },
  deleteFreelancer(id) {
    this.d.deliverables = this.d.deliverables.filter(d => d.freelancerId !== id);
    this.d.freelancers = this.d.freelancers.filter(f => f.id !== id);
    this._dirtyF.delete(id); [...this._dirtyD.values()].filter(d => d.freelancerId === id).forEach(d => this._dirtyD.delete(d.id));
    this._delF.add(id); this._schedule();
  },
};
