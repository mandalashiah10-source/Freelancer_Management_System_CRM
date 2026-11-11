'use strict';
/* ===== GFC CRM V1 — UI layer (Freelancers + Settings) ===== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (DB.S.currency || '₹') + Math.round(+n || 0).toLocaleString('en-IN');
const fmtDateY = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const safeUrl = u => { u = String(u || '').trim(); if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; return 'https://' + u; };
const TONES = ['mint', 'pink', 'yellow', 'lav', 'cream'];
const hashStr = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------- icons ---------- */
const ICONS = {
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  arrow: '<path d="M7 17L17 7M8 7h9v9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  left: '<path d="M15 6l-6 6 6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  sheet: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 9.5h17M3.5 15h17M9.5 9.5v11"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
};
const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const typeIcon = t => t === 'Short Format Reel' || t === 'Long Format Video' ? 'film' : t === 'Other' ? 'file' : 'image';

const AV_BG = ['#f6c9b8', '#c9e2d9', '#d9ccf3', '#fbe2a0', '#f7cfe1', '#f3dcae'];
function avatar(f, size = 40) {
  if (f?.avatar) return `<img class="av" src="${esc(f.avatar)}" style="width:${size}px;height:${size}px" alt="">`;
  const ini = String(f?.name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="av" style="width:${size}px;height:${size}px;background:${AV_BG[hashStr(f?.id || f?.name) % AV_BG.length]};font-size:${Math.round(size * .36)}px">${esc(ini)}</span>`;
}
const pill = (v, kind = 'st') => `<span class="pill ${kind}-${slug(v)}">${esc(v)}</span>`;
const ADD = '__add';
const listOptions = (list, cur, blank, addLabel) => (blank ? opt('', blank, cur) : '') + [...list, ...(cur && !list.includes(cur) ? [cur] : [])].map(x => opt(x, x, cur)).join('') + `<option value="${ADD}">${addLabel}</option>`;
const clientOptions = cur => listOptions(DB.clients(), cur, '—', '＋ Add client…');
const typeOptions = cur => listOptions(DB.types(), cur, '', '＋ Add type…');
const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;

/* ---------- feedback ---------- */
function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3200);
}
window.toast = toast;

function openModal(html, { size = '' } = {}) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(bg);
  bg.addEventListener('mousedown', e => { if (e.target === bg) closeModal(); });
  setTimeout(() => bg.querySelector('input:not([type=hidden]):not([disabled]):not([type=file]),select,textarea')?.focus(), 30);
  return bg.querySelector('.modal');
}
function closeModal() {
  if (!$('.modal-bg')) return;
  $('.modal-bg').remove();
  const cb = ui.onModalClose; ui.onModalClose = null; cb?.();
  if (ui.pending) flushPending();
}
const mHead = t => `<div class="m-head"><h3>${t}</h3><button class="icon-btn plain sm" data-act="modal-close" aria-label="Close">${ic('x', 18)}</button></div>`;

function confirmDialog({ title, body = '', confirmText = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    const m = openModal(`${mHead(esc(title))}<div class="m-body"><div style="font-size:13.5px;line-height:1.6">${body}</div></div>
      <div class="m-foot"><button class="btn" id="cfNo">Cancel</button><button class="btn ${danger ? 'danger solid' : 'dark'}" id="cfYes">${esc(confirmText)}</button></div>`, { size: 'sm' });
    $('#cfYes', m).onclick = () => { closeModal(); resolve(true); };
    $('#cfNo', m).onclick = () => { closeModal(); resolve(false); };
  });
}

async function saveFile(name, data) {
  try {
    const blob = new Blob([data], { type: /\.csv$/i.test(name) ? 'text/csv;charset=utf-8' : 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast(`Downloaded ${name}`);
  } catch (e) { toast(`Couldn’t download the file (${e?.message || 'unknown error'}).`, 'error'); }
}
const download = (name, content) => saveFile(name, content);
const csvCell = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n');

/* ---------- UI state ---------- */
const ui = { flQ: '', teamQ: '', flView: '', accBusy: '', accAct: '', ws: {}, pending: false, onModalClose: null };
const wsState = id => ui.ws[id] || (ui.ws[id] = { tab: 'deliverables', ym: ymOf(todayISO()), q: '', sort: { k: 'assignDate', dir: -1 } });

/* ---------- shell ---------- */
const LOGO = window.GFC_LOGO || 'gfc-logo.png';
const NAV = [['freelancers', 'Freelancer', 'users'], ['settings', 'Settings', 'gear']];
const NAV_F = [['me', 'My work', 'file'], ['team', 'Team', 'users']];
function renderSidebar(page) {
  $('#sidebar').innerHTML = `<a class="logo" href="#/freelancers" title="Goodfellow Consultancy"><img src="${LOGO}" alt="GFC" class="logo-img"></a>
    <nav class="nav">${(DB.role === 'owner' ? NAV : DB.role === 'freelancer' && DB.myId && DB.freelancer(DB.myId) ? NAV_F : []).map(([k, l, i]) => `<a href="#/${k}" class="${page === k ? 'active' : ''}" title="${l}"><span class="ic">${ic(i)}</span><span class="lbl">${l}</span></a>`).join('')}</nav>
    <div class="sync off" id="sync" aria-live="polite">Connecting…</div>${DB.user ? `<button class="signout" data-act="sign-out" title="Signed in as ${esc(DB.user.email || '')}">Sign out</button>` : ''}`;
}
function route() {
  if (DB.role === 'freelancer') {
    const [pg, tid] = location.hash.replace(/^#\/?/, '').split('/'), me = DB.myId && DB.freelancer(DB.myId);
    const page = pg === 'team' && me ? 'team' : 'me'; renderSidebar(page); const main = $('#main');
    if (!DB.loaded) { main.innerHTML = stateScreen(); DB.onStatus(); return; }
    let html, after = null;
    if (!me) html = `<div class="empty card" style="margin:12vh auto 0;max-width:520px"><img src="${LOGO}" alt="" style="width:64px;height:64px;border-radius:18px;margin-bottom:14px"><div class="big">You’re not on the team yet</div>You’re signed in as <b>${esc(DB.user?.email || '')}</b>, but the owner hasn’t added this email to a profile. Ask the GFC owner to add exactly this email, then reload.</div>`;
    else if (page === 'team') { const p = tid && tid !== me.id && DB.d.team.find(x => x.id === tid); html = p ? viewTeamProfile(p) : viewTeam(); if (p) after = () => wsRefresh(p.id); }
    else { html = viewWorkspace(me.id); after = () => wsRefresh(me.id); }
    main.innerHTML = html; DB.onStatus(); if (after) after(); return;
  }
  if (/[#&](access_token|error|type|code)=/.test(location.hash)) { renderSidebar('freelancers'); $('#main').innerHTML = stateScreen(); return; }   // an invitation / reset link is being processed: leave the address alone
  const [page, id] = location.hash.replace(/^#\/?/, '').split('/');
  if (page !== 'freelancers' && page !== 'settings') { location.replace('#/freelancers'); return; }
  renderSidebar(page);
  const main = $('#main');
  if (!DB.loaded) { main.innerHTML = stateScreen(); DB.onStatus(); return; }
  main.innerHTML = page === 'settings' ? viewSettings() : id ? viewWorkspace(id) : viewFreelancers();
  if (page === 'settings') refreshAdmins();
  DB.onStatus();
  main.scrollTop = 0;
  if (id && page === 'freelancers') wsRefresh(id);
}
function stateScreen() {
  const card = inner => `<div class="empty card login" style="margin:10vh auto 0;max-width:420px"><img src="${LOGO}" alt="" style="width:64px;height:64px;border-radius:18px;margin-bottom:14px">${inner}</div>`;
  if (DB.state === 'login') return card(`<div class="big">GFC CRM</div><p class="muted" style="margin:0 0 14px">Sign in with your email</p>
    <input class="inp" id="authEmail" type="email" placeholder="Email" autocomplete="username"><input class="inp" id="authPw" type="password" placeholder="Password" autocomplete="current-password">
    ${DB.authNotice ? `<div class="auth-msg">${esc(DB.authNotice)}</div>` : ''}${DB.cfgIssue === 'url' ? `<div class="auth-msg">Can’t reach <b>${esc(window.GFC_CONFIG?.url || '')}</b>. Check the address in config.js: copy it again from Supabase (Copy > Project URL).</div>` : DB.cfgIssue === 'key' ? '<div class="auth-msg">Supabase rejected the key in config.js. Copy the Publishable key again from Supabase.</div>' : ''}
    <div class="auth-msg" id="authMsg" role="alert"></div><button class="btn dark lg" data-act="auth-in" style="width:100%">Sign in</button>
    <div class="auth-links"><span class="muted">Invited? Use the link in your email.</span><button class="link" data-act="auth-reset">Forgot password?</button></div>`);
  if (DB.state === 'recovery' || DB.state === 'activate') return card(`<div class="big">${DB.state === 'activate' ? 'Welcome to GFC' : 'Set your password'}</div><p class="muted" style="margin:0 0 14px">${DB.state === 'activate' ? 'Choose a password to activate your account.' : 'Choose a new password for your account.'}</p><input class="inp" id="authPw" type="password" placeholder="New password (8+ characters)" autocomplete="new-password"><div class="auth-msg" id="authMsg" role="alert"></div><button class="btn dark lg" data-act="auth-newpw" style="width:100%">${DB.state === 'activate' ? 'Activate account' : 'Save password'}</button>`);
  if (DB.state === 'setup') return card(`<div class="big">Almost ready</div>This site isn’t connected to its database yet. Open <b>config.js</b> and paste your Supabase project URL and anon key (see SETUP.md).`);
  const m = {
    loading: ['Loading your workspace…', 'Fetching freelancers and deliverables.'],
    slow: ['Still connecting…', 'The database can’t be reached yet. Check your internet connection; this page keeps trying on its own.'],
    offline: ['Sign in to use the GFC CRM', 'This CRM keeps its data online. Open this link while signed in to claude.ai with the account it was shared with.'],
    error: ['Couldn’t load the data', 'Something went wrong while connecting. Reload the page to try again.'],
  }[DB.state] || ['Loading…', ''];
  const hint = DB.state !== 'error' || !DB.lastError ? '' : /does not exist|schema cache|column/i.test(DB.lastError) ? 'The database is missing the newest changes. In Supabase, open the SQL Editor and run <b>invite-migration.sql</b> (after schema.sql), then reload this page.'
    : /permission|policy|row-level/i.test(DB.lastError) ? 'The database refused access. Make sure schema.sql was run, and that your email is in the admins table.'
    : /fetch|network/i.test(DB.lastError) ? 'Can’t reach Supabase. Check your internet and the address in config.js.' : '';
  const detail = DB.state === 'error' && DB.lastError ? `<div style="margin-top:14px;font-size:13px;color:#8a7a58">${hint ? `<p style="margin:0 0 8px;color:#2b1710">${hint}</p>` : ''}<span>Details: ${esc(DB.lastError)}</span></div>` : '';
  return `<div class="empty card" style="margin:12vh auto 0;max-width:520px"><img src="${LOGO}" alt="" style="width:64px;height:64px;border-radius:18px;margin-bottom:14px"><div class="big">${m[0]}</div>${m[1]}${detail}</div>`;
}
function rerender() {
  const main = $('#main'), top = main.scrollTop, sc = $('.table-scroll', main), st = sc && [sc.scrollTop, sc.scrollLeft];
  route();
  main.scrollTop = top;
  const sc2 = $('.table-scroll', main); if (sc2 && st) [sc2.scrollTop, sc2.scrollLeft] = st;
}

/* ================= FREELANCERS ================= */
const accTag = f => { const st = DB.accessStatus(f); return `<span class="acc-tag acc-${st}">${DB.ACCESS_LABEL[st]}</span>`; };
const fmtDT = ts => ts ? new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
function accessCardHtml(f) {
  const st = DB.accessStatus(f), busy = ui.accBusy === f.id;
  const msg = { none: 'This freelancer can’t log in yet. Send a secure invitation so they can set a password.', pending: 'The invitation was sent. They have not activated the account yet.', expired: 'The invitation link expired before it was used. Send a new one.', active: 'This freelancer can log in and sees only their own work, rates and payments.', disabled: 'This account is switched off. They can’t log in or see anything until you enable it.' }[st];
  const btn = (act, label, cls = 'dark') => `<button class="btn ${cls}" data-act="${act}" data-id="${f.id}" ${busy ? 'disabled' : ''}>${busy && ui.accAct === act ? 'Working…' : label}</button>`;
  const action = { none: btn('acc-invite', 'Send Invitation'), pending: btn('acc-invite', 'Resend Invitation'), expired: btn('acc-invite', 'Send New Invitation'), active: btn('acc-disable', 'Disable Account', 'danger'), disabled: btn('acc-enable', 'Enable Account') }[st];
  return `<section class="card acc-card"><div class="card-head"><div><h3>Account access</h3><p>${msg}</p></div>${accTag(f)}</div>
    <dl class="acc-grid"><div><dt>Login email</dt><dd>${esc(f.email) || '—'}</dd></div>
      <div><dt>Invitation sent</dt><dd>${fmtDT(f.invitedAt)}${f.inviteCount > 1 ? ` <span class="muted">(${f.inviteCount} times)</span>` : ''}</dd></div>
      ${f.invitedAt && !f.activatedAt ? `<div><dt>Link valid until</dt><dd>${fmtDT(f.inviteExpiresAt)}</dd></div>` : ''}
      <div><dt>Account activated</dt><dd>${fmtDT(f.activatedAt)}</dd></div>
      ${f.disabledAt ? `<div><dt>Disabled on</dt><dd>${fmtDT(f.disabledAt)}</dd></div>` : ''}</dl>
    ${f.email ? '' : '<div class="note warn" style="margin-top:14px">Add this freelancer’s email first (use Edit), then send the invitation.</div>'}
    <div class="btn-row" style="margin-top:18px">${f.email ? action : ''}</div></section>`;
}
async function accRun(fid, action, okMsg) {
  ui.accBusy = fid; ui.accAct = 'acc-' + action; rerender();
  try { await DB.accessAction(fid, action); toast(okMsg); } catch (e) { toast(e.message, 'error'); }
  ui.accBusy = ''; rerender();
}
const flMode = () => ui.flView || (DB.d.freelancers.length > 12 ? 'list' : 'cards');
const modeToggle = m => `<div class="seg" role="group" aria-label="View"><button class="${m === 'cards' ? 'on' : ''}" data-act="fl-view" data-v="cards">Cards</button><button class="${m === 'list' ? 'on' : ''}" data-act="fl-view" data-v="list">List</button></div>`;
function viewFreelancers() {
  const m = flMode();
  return `<header class="topbar"><div><h1>Freelancers</h1><p class="sub">${DB.d.freelancers.length} freelancer${DB.d.freelancers.length === 1 ? '' : 's'}</p></div>
    <div class="top-right"><label class="search">${ic('search', 18)}<input data-on="fl-q" placeholder="Search by name, role or email" value="${esc(ui.flQ)}" aria-label="Search freelancers"></label>${modeToggle(m)}
    <button class="btn dark" data-act="fl-add">${ic('plus', 16)} Add Freelancer</button></div></header>
  <div class="${m === 'list' ? 'fl-list' : 'fl-grid'}" id="flGrid">${flGrid()}</div>`;
}
function flGrid() {
  const q = ui.flQ.trim().toLowerCase(), m = flMode();
  const list = DB.d.freelancers.filter(f => !q || [f.name, f.description, f.email].join(' ').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return `<div class="empty card" style="grid-column:1/-1"><div class="big">${DB.d.freelancers.length ? 'No freelancer matches that search' : 'No freelancers yet'}</div>${DB.d.freelancers.length ? 'Try a different search.' : 'Click “Add Freelancer” to create the first profile.'}</div>`;
  const tag = f => accTag(f);
  const tools = f => `<div class="fl-tools"><button class="icon-btn xs" data-act="fl-edit" data-id="${f.id}" title="Edit">${ic('edit', 15)}</button><button class="icon-btn xs danger" data-act="fl-del" data-id="${f.id}" title="Delete">${ic('trash', 15)}</button></div>`;
  if (m === 'list') return list.map(f => `<article class="fl-row" data-act="fl-open" data-id="${f.id}" tabindex="0" aria-label="Open ${esc(f.name)}">${avatar(f, 40)}<b class="c-name">${esc(f.name)}</b><span class="c-role">${esc(f.description || 'Freelancer')}</span><span class="c-mail">${esc(f.email || '')}</span>${tag(f)}${tools(f)}</article>`).join('');
  return list.map(f => `<article class="fl-card profile tone-${TONES[hashStr(f.id) % TONES.length]}" data-act="fl-open" data-id="${f.id}" tabindex="0" aria-label="Open ${esc(f.name)}">
      ${tools(f)}
      ${avatar(f, 88)}<h3>${esc(f.name)}</h3><p class="role">${esc(f.description || 'Freelancer')}</p>${tag(f)}</article>`).join('');
}

function openFreelancerModal(id) {
  const f = id ? DB.freelancer(id) : null;
  let avatarData = f?.avatar || '';
  const m = openModal(`${mHead(f ? 'Edit freelancer' : 'Add freelancer')}<div class="m-body"><form id="fform" class="form" autocomplete="off">
    <div class="av-edit"><span id="avPrev">${avatar(f || { name: '?' }, 72)}</span><div class="btn-row">
      <label class="btn sm" style="cursor:pointer">${ic('image', 15)} ${f?.avatar ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/*" id="avFile" hidden></label>
      <button type="button" class="btn ghost sm" id="avRm">Remove</button></div></div>
    <label>Name<input name="name" value="${esc(f?.name || '')}" required placeholder="e.g. Rahul Sharma"></label>
    <label>Email address<input name="email" type="email" value="${esc(f?.email || '')}" placeholder="their email, used to log in" ${f?.activatedAt ? 'readonly' : ''}></label>
    <p class="hint" style="margin:-4px 0 6px">${f?.activatedAt ? 'This freelancer has an active account.' : 'We email a secure link to this address so they can set their own password. Leave blank if they won’t log in.'}</p>
    <label>Description / role<input name="description" value="${esc(f?.description || '')}" placeholder="e.g. Video Editor | Freelancer" list="roleList"></label>
    <datalist id="roleList"><option value="Video Editor | Freelancer"><option value="Graphic Designer | Freelancer"></datalist>
    ${f ? '' : `<div class="rate-new"><b>Their rates (${esc(DB.S.currency)} per deliverable)</b><p class="hint" style="margin:2px 0 10px">Optional. You can set or change these later in the Rates tab.</p><div class="rate-grid" id="newRates">${DB.types().map(t => `<label class="rate-item"><span>${esc(t)}</span><div class="money-in"><i>${esc(DB.S.currency)}</i><input type="number" min="0" step="1" data-type="${esc(t)}" placeholder="—" aria-label="${esc(t)} rate"></div></label>`).join('')}</div></div>`}
  </form></div><div class="m-foot"><button class="btn" data-act="modal-close">Cancel</button><button class="btn ${f ? 'dark' : ''}" id="fSave">${f ? 'Save' : 'Save Freelancer'}</button>${f ? '' : '<button class="btn dark" id="fSaveInvite">Save &amp; Send Invitation</button>'}</div>`, { size: 'sm' });
  const form = $('#fform', m);
  const prev = () => { $('#avPrev', m).innerHTML = avatar({ id: f?.id, name: form.elements.name.value || '?', avatar: avatarData }, 72); };
  form.elements.name.addEventListener('input', prev);
  $('#avFile', m).onchange = async e => { const file = e.target.files[0]; if (!file) return; try { avatarData = await fileToAvatar(file); prev(); } catch { toast('Could not read that image', 'error'); } };
  $('#avRm', m).onclick = () => { avatarData = ''; prev(); };
  const save = async invite => {
    const data = { name: form.elements.name.value.trim(), description: form.elements.description.value.trim(), avatar: avatarData, email: form.elements.email.value.trim() };
    if (invite && !data.email) return toast('Add their email address to send an invitation.', 'error');
    let nf; try { nf = f ? DB.updateFreelancer(f.id, data) : DB.addFreelancer({ ...data, rates: Object.fromEntries($$('#newRates input', m).map(i => [i.dataset.type, i.value])) }); } catch (e) { return toast(e.message, 'error'); }
    if (!invite) { closeModal(); toast(f ? 'Saved' : `${data.name} added`); rerender(); return; }
    $$('#fSave, #fSaveInvite', m).forEach(b => b.disabled = true); $('#fSaveInvite', m).textContent = 'Sending invitation…';
    try { await DB.accessAction(nf.id, 'invite'); closeModal(); toast(`Invitation sent to ${data.email}`); }
    catch (e) { closeModal(); toast(`${data.name} was saved, but the invitation was not sent: ${e.message}`, 'error'); }
    rerender();
  };
  $('#fSave', m).onclick = () => save(false);
  if ($('#fSaveInvite', m)) $('#fSaveInvite', m).onclick = () => save(true);
  form.addEventListener('submit', e => { e.preventDefault(); $('#fSave', m).click(); });
}
function fileToAvatar(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const s = 192, c = document.createElement('canvas'); c.width = c.height = s; const m = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); res(c.toDataURL('image/jpeg', .85)); }; img.onerror = rej; img.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
async function deleteFreelancer(id) {
  const f = DB.freelancer(id), n = DB.d.deliverables.filter(d => d.freelancerId === id).length;
  if (!await confirmDialog({ title: `Delete ${f.name}?`, danger: true, confirmText: 'Delete', body: `This permanently removes ${esc(f.name)}${n ? ` and <b>${n} deliverable${n > 1 ? 's' : ''}</b>` : ''}. This can’t be undone.` })) return;
  DB.deleteFreelancer(id); toast(`${f.name} deleted`);
  if (location.hash.includes(id)) location.hash = '#/freelancers'; else rerender();
}

/* ================= WORKSPACE ================= */
function periodSelectors(ym, attrs) {
  const [y, m] = ym ? ym.split('-') : ['', ''];
  const years = new Set(); for (let v = 2025; v <= 2050; v++) years.add(v);
  return `<select class="fsel" ${attrs} data-k="m" aria-label="Month">${opt('', 'All months', m || '')}${MONTHS.map((n, i) => opt(pad(i + 1), n, m || '')).join('')}</select>
    <select class="fsel" ${attrs} data-k="y" aria-label="Year">${opt('', 'All years', y || '')}${[...years].sort((a, b) => a - b).map(v => opt(v, v, y)).join('')}</select>`;
}
const periodFrom = (y, m) => y ? (m ? `${y}-${m}` : `${y}`) : '';
const periodLabel = ym => !ym ? 'All time' : ym.length === 4 ? ym : monthLabel(ym);

function viewWorkspace(id) {
  const f = DB.freelancer(id);
  if (!f) return `<a class="back" href="#/freelancers">${ic('left', 16)} Freelancers</a><div class="empty card"><div class="big">This freelancer doesn’t exist anymore.</div></div>`;
  const s = wsState(id), tone = TONES[hashStr(f.id) % TONES.length];
  const body = s.tab === 'access' && DB.role === 'owner' ? accessCardHtml(f) : s.tab === 'rates' ? rateCardHtml(f) : `
    <div class="toolbar"><span class="chip" style="background:#fff;height:38px;padding:0 12px">${ic('calendar', 15)}</span>${periodSelectors(s.ym, `data-on="ws-period" data-id="${id}"`)}
      <label class="search sm" style="background:#fff">${ic('search', 16)}<input data-on="ws-q" data-id="${id}" placeholder="Search this table" value="${esc(s.q)}" aria-label="Search deliverables"></label></div>
    <div class="kpi-row" id="wsSum" style="margin-bottom:14px"></div>
    <section class="card" id="wsTable"></section>`;
  const ro = DB.role === 'freelancer';
  return `${ro ? '' : `<a class="back" href="#/freelancers">${ic('left', 16)} Freelancers</a>`}
  <section class="ws-head tone-${tone}">${avatar(f, 84)}<div class="ws-id"><h2>${esc(f.name)}</h2><div class="ws-meta">${esc(f.description || 'Freelancer')}</div></div>
    <div class="btn-row">${ro ? '' : `<button class="btn" data-act="fl-edit" data-id="${f.id}">${ic('edit', 16)} Edit</button>
    <button class="btn" data-act="import-open" data-id="${f.id}">${ic('upload', 16)} Import</button>`}<button class="btn" data-act="download-open" data-id="${f.id}">${ic('download', 16)} Download</button>
    ${ro ? '' : `<button class="btn dark lg" data-act="add-deliverable" data-id="${f.id}">${ic('plus', 18)} Add Deliverable</button>`}</div></section>
  <div class="tabs">${[['deliverables', 'Deliverables'], ['rates', 'Rates'], ...(DB.role === 'owner' ? [['access', 'Account access']] : [])].map(([k, l]) => `<button class="${s.tab === k ? 'on' : ''}" data-act="ws-tab" data-id="${id}" data-tab="${k}">${l}</button>`).join('')}</div>
  ${body}`;
}
function teamGrid() {
  const q = ui.teamQ.trim().toLowerCase(), list = DB.d.team.filter(p => p.id !== DB.myId && (!q || [p.name, p.description].join(' ').toLowerCase().includes(q))).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (!list.length) return `<div class="empty card" style="grid-column:1/-1"><div class="big">${q ? 'No one matches that search' : 'No one else yet'}</div></div>`;
  if (DB.d.team.length > 13) return list.map(p => `<article class="fl-row team" data-act="team-open" data-id="${esc(p.id)}" tabindex="0" aria-label="Open ${esc(p.name)}">${avatar(p, 40)}<b class="c-name">${esc(p.name)}</b><span class="c-role">${esc(p.description || 'Freelancer')}</span></article>`).join('');
  return list.map(p => `<article class="fl-card profile tone-${TONES[hashStr(p.id) % TONES.length]}" data-act="team-open" data-id="${esc(p.id)}" tabindex="0" aria-label="Open ${esc(p.name)}">${avatar(p, 88)}<h3>${esc(p.name)}</h3><p class="role">${esc(p.description || 'Freelancer')}</p></article>`).join('');
}
function viewTeam() {
  return `<header class="topbar"><div><h1>Team</h1><p class="sub">See what everyone is working on. Rates and amounts are private.</p></div>
    <div class="top-right"><label class="search">${ic('search', 18)}<input data-on="team-q" placeholder="Search by name or role" value="${esc(ui.teamQ)}" aria-label="Search team"></label></div></header>
  <div class="${DB.d.team.length > 13 ? 'fl-list' : 'fl-grid'}" id="teamGrid">${teamGrid()}</div>`;
}
function viewTeamProfile(p) {
  const s = wsState(p.id), tone = TONES[hashStr(p.id) % TONES.length], id = esc(p.id);
  return `<a class="back" href="#/team">${ic('left', 16)} Team</a>
  <section class="ws-head tone-${tone}">${avatar(p, 84)}<div class="ws-id"><h2>${esc(p.name)}</h2><div class="ws-meta">${esc(p.description || 'Freelancer')}</div></div></section>
  <div class="toolbar"><span class="chip" style="background:#fff;height:38px;padding:0 12px">${ic('calendar', 15)}</span>${periodSelectors(s.ym, `data-on="ws-period" data-id="${id}"`)}
    <label class="search sm" style="background:#fff">${ic('search', 16)}<input data-on="ws-q" data-id="${id}" placeholder="Search" value="${esc(s.q)}" aria-label="Search work"></label></div>
  <section class="card" id="wsTable"></section>`;
}
const teamRow = d => { const url = safeUrl(d.link); return `<tr><td class="c-date">${fmtDateY(d.assignDate)}</td><td class="c-date">${fmtDateY(d.deliveryDate)}</td><td class="c-client">${d.client ? `<span class="pill tint tint-${tintOf('c', d.client)}">${esc(d.client)}</span>` : '—'}</td><td class="c-type"><span class="pill tint tint-${tintOf('t', d.type)}">${esc(d.type)}</span></td><td class="c-subject">${esc(d.subject)}</td><td><span class="pill st-${slug(d.status)}">${esc(d.status)}</span></td><td>${url ? `<a class="open-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open ${ic('arrow', 14)}</a>` : '—'}</td></tr>`; };
function teamRefresh(id) {
  const box = $('#wsTable'); if (!box) return;
  const s = wsState(id), q = s.q.trim().toLowerCase(), dir = s.sort.dir, k = ['assignDate', 'deliveryDate', 'client', 'type', 'subject', 'status'].includes(s.sort.k) ? s.sort.k : 'assignDate';
  DB.watchWork(id, s.ym);
  const val = d => k === 'status' ? STATUSES.indexOf(d.status) : String(d[k] || '').toLowerCase();
  const rows = DB.d.work.filter(d => !q || [d.subject, d.client, d.type, d.status].join(' ').toLowerCase().includes(q)).sort((a, b) => { const x = val(a), y = val(b); return ((x > y) - (x < y)) * dir || b.createdAt - a.createdAt; });
  const th = (key, l) => `<th class="sort" data-act="ws-sort" data-id="${esc(id)}" data-k="${key}">${l}${k === key ? `<span class="arr">${dir > 0 ? '↑' : '↓'}</span>` : ''}</th>`;
  box.innerHTML = rows.length ? `<div class="table-scroll"><table class="sheet"><thead><tr>${th('assignDate', 'Assignment date')}${th('deliveryDate', 'Delivery date')}${th('client', 'Client')}${th('type', 'Type')}${th('subject', 'Subject')}${th('status', 'Status')}<th>Posting link</th></tr></thead><tbody>${rows.slice(0, 300).map(teamRow).join('')}</tbody></table></div><div class="dt-foot"><span class="muted">${rows.length} row${rows.length === 1 ? '' : 's'} · ${periodLabel(s.ym)}</span></div>`
    : `<div class="empty"><div class="big">${DB.workLoading ? 'Loading…' : 'Nothing in ' + periodLabel(s.ym)}</div></div>`;
}
function wsRows(id) {
  const s = wsState(id), q = s.q.trim().toLowerCase();
  const rows = DB.d.deliverables.filter(d => d.freelancerId === id && DB.inPeriod(d, s.ym) && (!q || [d.subject, d.client, d.notes, d.type, d.status, d.paymentStatus, d.link].join(' ').toLowerCase().includes(q)));
  const { k, dir } = s.sort;
  const val = d => k === 'rate' ? (+d.rate || 0) : k === 'status' ? STATUSES.indexOf(d.status) : String(d[k] || '').toLowerCase();
  return rows.sort((a, b) => { const x = val(a), y = val(b); return ((x > y) - (x < y)) * dir || b.createdAt - a.createdAt; });
}
function wsSummaryHtml(id) {
  const s = wsState(id), r = DB.summary(id, s.ym);
  const t = (l, v, tone, sub = '') => `<div class="tile tone-${tone}" style="min-height:86px"><span class="t-label">${l}</span><div><div class="t-val" style="font-size:22px">${v}</div>${sub ? `<div class="t-sub">${sub}</div>` : ''}</div></div>`;
  const rule = DB.S.totalRule === 'all' ? 'All except rejected' : 'Approved deliverables';
  return t('Deliverables', r.count, 'white', periodLabel(s.ym)) + t('Total amount', money(r.total), 'cream', rule) + t('Paid', money(r.paid), 'mint') + t('Unpaid', money(r.unpaid), 'pink');
}
function wsRefresh(id) {
  if (DB.role === 'freelancer' && id !== DB.myId) return teamRefresh(id);
  const box = $('#wsTable'); if (!box) return;
  DB.watch(id, wsState(id).ym);
  $('#wsSum').innerHTML = wsSummaryHtml(id);
  const s = wsState(id), rows = wsRows(id);
  const th = (k, l, cls = '') => `<th class="sort ${cls}" data-act="ws-sort" data-id="${id}" data-k="${k}">${l}${s.sort.k === k ? `<span class="arr">${s.sort.dir > 0 ? '↑' : '↓'}</span>` : ''}</th>`;
  const MAXR = 300, shown = rows.slice(0, MAXR);
  box.innerHTML = (DB.isCapped(id) ? `<div class="note warn" style="margin-bottom:12px">${ic('lock', 16)} Showing the latest ${DB.MAX_ROWS} rows. Pick a month to see the rest.</div>` : '') + (DB.readOnly && DB.role !== 'freelancer' ? `<div class="note warn" style="margin-bottom:12px">${ic('lock', 16)} You have view-only access. Ask the owner to invite you as an Editor to make changes.</div>` : '') + (rows.length ? `<div class="table-scroll"><table class="sheet"><thead><tr>
      ${th('assignDate', 'Assignment date')}${th('deliveryDate', 'Delivery date')}${th('client', 'Client')}${th('type', 'Type')}${th('subject', 'Subject')}${th('status', 'Status')}${th('paymentStatus', 'Payment')}<th>Posting link</th><th>Notes</th>${th('rate', 'Amount', 'num')}<th></th>
    </tr></thead><tbody>${shown.map(rowHtml).join('')}</tbody></table></div>${rows.length > MAXR ? `<div class="note" style="margin-top:10px">Showing the first ${MAXR} of ${rows.length} rows. Use search or the month filter to narrow down.</div>` : ''}`
    : DB.dLoading.has(id) ? `<div class="empty"><div class="big">Loading…</div></div>` : `<div class="empty"><div class="big">No deliverables ${s.q ? 'match your search' : 'in ' + periodLabel(s.ym)}</div>${DB.role === 'freelancer' ? 'Nothing is assigned to you in this period.' : 'Use “Add Deliverable” or import a sheet.'}</div>`)
    + `<div class="dt-foot"><span class="muted">${rows.length} row${rows.length === 1 ? '' : 's'} · ${periodLabel(s.ym)}</span><span class="muted">${DB.role === 'freelancer' ? '' : 'Amounts are filled from the freelancer’s rates and can be edited per row.'}</span></div>`;
}
const TYPE_TINT = { 'Short Format Reel': 0, 'Long Format Video': 1, 'Static Creative': 2, 'Carousel': 3, 'Banner': 4, 'Other': 7 };
const tintOf = (kind, name) => !name ? -1 : kind === 't' && name in TYPE_TINT ? TYPE_TINT[name] : hashStr(kind + name) % 8;
function roRow(d) {
  const url = safeUrl(d.link);
  return `<tr data-id="${d.id}"><td class="c-date">${fmtDateY(d.assignDate)}</td><td class="c-date">${fmtDateY(d.deliveryDate)}</td><td class="c-client">${d.client ? `<span class="pill tint tint-${tintOf('c', d.client)}">${esc(d.client)}</span>` : '—'}</td><td class="c-type"><span class="pill tint tint-${tintOf('t', d.type)}">${esc(d.type)}</span></td><td class="c-subject">${esc(d.subject)}</td>
    <td><span class="pill st-${slug(d.status)}">${esc(d.status)}</span></td><td><span class="pill pay-${slug(d.paymentStatus)}">${esc(d.paymentStatus)}</span></td>
    <td>${url ? `<a class="open-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open ${ic('arrow', 14)}</a>` : '—'}</td><td class="c-notes">${esc(d.notes) || '—'}</td><td class="c-rate num">${money(d.rate)}</td><td></td></tr>`;
}
function rowHtml(d) {
  if (DB.role === 'freelancer') return roRow(d);
  const url = safeUrl(d.link);
  const card = DB.rateFor(d.freelancerId, d.type);
  return `<tr data-id="${d.id}">
    <td class="c-date"><input type="date" class="cell-in" data-f="assignDate" value="${d.assignDate}" aria-label="Assignment date"></td>
    <td class="c-date"><input type="date" class="cell-in" data-f="deliveryDate" value="${d.deliveryDate}" aria-label="Delivery date"></td>
    <td class="c-client"><select class="cell-in tint tint-${tintOf('c', d.client)}" data-f="client" aria-label="Client">${clientOptions(d.client)}</select></td>
    <td class="c-type"><select class="cell-in tint tint-${tintOf('t', d.type)}" data-f="type" aria-label="Type">${typeOptions(d.type)}</select></td>
    <td class="c-subject"><input class="cell-in" data-f="subject" value="${esc(d.subject)}" placeholder="Add subject…" aria-label="Subject"></td>
    <td><select class="cell-in pill st-${slug(d.status)}" data-f="status" aria-label="Status">${STATUSES.map(t => opt(t, t, d.status)).join('')}</select></td>
    <td><select class="cell-in pill pay-${slug(d.paymentStatus)}" data-f="paymentStatus" aria-label="Payment status">${PAY_STATUSES.map(t => opt(t, t, d.paymentStatus)).join('')}</select></td>
    <td><div class="link-cell"><input class="cell-in" data-f="link" value="${esc(d.link)}" placeholder="Paste URL…" aria-label="Posting link">${url ? `<a class="open-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Open link">${ic('arrow', 15)}</a>` : ''}</div></td>
    <td class="c-notes"><input class="cell-in" data-f="notes" value="${esc(d.notes)}" placeholder="—" aria-label="Notes"></td>
    <td class="c-rate"><input type="number" min="0" step="1" class="cell-in num" data-f="rate" value="${d.rate}" title="${card !== d.rate ? `Current rate for ${esc(d.type)} is ${money(card)}` : 'From rate card'}" aria-label="Amount"></td>
    <td class="c-act"><button class="icon-btn xs" data-act="dl-edit" title="Edit">${ic('edit', 15)}</button><button class="icon-btn xs danger" data-act="dl-del" title="Delete">${ic('trash', 15)}</button></td>
  </tr>`;
}
function rateCardHtml(f) {
  return `<section class="card"><div class="card-head"><div><h3>Rates</h3><p>Every freelancer has their own prices. The amount for each new deliverable is filled in from these rates; leave a type blank if you’ll enter the amount yourself. Changing a rate doesn’t alter deliverables already recorded — edit their amount in the table if needed.</p></div></div>
    <div class="rate-grid" id="rateGrid">${DB.types().map((t, i) => `<label class="rate-item tone-${TONES[i % TONES.length]}"><span>${ic(typeIcon(t), 16)} ${esc(t)}</span><div class="money-in"><i>${esc(DB.S.currency)}</i><input type="number" min="0" step="1" data-type="${esc(t)}" value="${DB.hasRate(f.id, t) ? DB.rateFor(f.id, t) : ''}" placeholder="Not set" ${DB.role === 'freelancer' ? 'disabled' : ''} aria-label="${esc(t)} rate"></div></label>`).join('')}</div>
    <p class="hint" style="margin-top:12px">Need another type? Pick “＋ Add type…” in any Type dropdown, or manage types in Settings.</p>
    ${DB.role === 'freelancer' ? '' : `<div class="btn-row" style="justify-content:flex-end;margin-top:16px"><button class="btn dark" data-act="rates-save" data-id="${f.id}">Save rates</button></div>`}</section>`;
}

/* ---------- add / edit deliverable ---------- */
function openDeliverableModal(fid, id) {
  const d = id ? DB.deliverable(id) : null, today = todayISO();
  fid = d?.freelancerId || fid;
  const f = DB.freelancer(fid);
  const types = DB.types();
  const defType = d?.type || [/design/i.test(f.description) ? 'Static Creative' : 'Short Format Reel', types[0]].find(t => types.includes(t));
  const m = openModal(`${mHead(d ? 'Edit deliverable' : `Add deliverable · ${esc(f.name)}`)}<div class="m-body">
    <form id="dform" class="form grid2" autocomplete="off">
      <label>Assignment date<input type="date" name="assignDate" value="${d?.assignDate || today}" required></label>
      <label>Delivery date<input type="date" name="deliveryDate" value="${d ? d.deliveryDate : addDays(today, 3)}"></label>
      <div class="fld">Client<select name="client" class="inp" data-kind="client">${listOptions(DB.clients(), d?.client || '', '— Select client —', '＋ Add client…')}</select>${inlineAdd('client')}</div>
      <div class="fld">Type<select name="type" class="inp" data-kind="type">${typeOptions(defType)}</select>${inlineAdd('type')}</div>
      <label class="span2">Subject<input name="subject" value="${esc(d?.subject || '')}" placeholder="e.g. Diwali offer teaser"></label>
      <label>Status<select name="status">${STATUSES.map(t => opt(t, t, d?.status || 'Allotted')).join('')}</select></label>
      <label>Payment status<select name="paymentStatus">${PAY_STATUSES.map(t => opt(t, t, d?.paymentStatus || 'Unpaid')).join('')}</select></label>
      <label class="span2">Posting link<input name="link" value="${esc(d?.link || '')}" placeholder="https://instagram.com/p/…"></label>
      <label class="span2">Notes<textarea name="notes" rows="3">${esc(d?.notes || '')}</textarea></label>
      <label>Amount (${esc(DB.S.currency)})<input type="number" min="0" step="1" name="rate" value="${d ? d.rate : DB.rateFor(fid, defType)}"></label>
      <div class="hint" id="rateHint" style="align-self:end;padding-bottom:12px"></div>
    </form></div>
    <div class="m-foot">${!d ? '<button class="btn" id="dMore">Save & add another</button>' : ''}<button class="btn dark" id="dSave">${d ? 'Save changes' : 'Add deliverable'}</button></div>`);
  const form = $('#dform', m), el = n => form.elements[n];
  const hint = () => { $('#rateHint', m).innerHTML = `Rate for ${esc(el('type').value)}: <b>${DB.hasRate(fid, el('type').value) ? money(DB.rateFor(fid, el('type').value)) : 'not set, enter the amount'}</b>`; };
  el('rate').addEventListener('input', () => { el('rate').dataset.touched = '1'; });
  el('type').addEventListener('change', () => { if (el('type').value === ADD) return; if (el('rate').dataset.touched !== '1') el('rate').value = DB.rateFor(fid, el('type').value); hint(); });
  wireInlineAdd(m, () => { if (el('rate').dataset.touched !== '1') el('rate').value = DB.rateFor(fid, el('type').value); hint(); });
  hint();
  const save = more => {
    const v = n => el(n).value;
    try {
      if (!v('subject').trim()) throw new Error('Subject is required.');
      if (v('client') === ADD || v('type') === ADD) throw new Error('Finish adding the new client or type first.');
      if (v('deliveryDate') && v('deliveryDate') < v('assignDate')) throw new Error('Delivery date can’t be before the assignment date.');
      const data = { assignDate: v('assignDate'), deliveryDate: v('deliveryDate'), client: v('client'), type: v('type'), subject: v('subject'), status: v('status'), paymentStatus: v('paymentStatus'), link: v('link'), notes: v('notes') };
      if (d) { if (+v('rate') !== d.rate) data.rate = +v('rate'); DB.updateDeliverable(d.id, data); toast('Deliverable updated'); }
      else { DB.addDeliverable({ ...data, freelancerId: fid, rate: v('rate') }); toast('Deliverable added'); }
    } catch (e) { return toast(e.message, 'error'); }
    if (more) { ['subject', 'link', 'notes'].forEach(n => el(n).value = ''); el('subject').focus(); wsRefresh(fid); return; }
    closeModal(); rerender();
  };
  $('#dSave', m).onclick = () => save(false);
  if ($('#dMore', m)) $('#dMore', m).onclick = () => save(true);
  form.addEventListener('submit', e => { e.preventDefault(); save(false); });
}

/* ---------- adding clients & types from a dropdown ---------- */
const inlineAdd = kind => `<div class="inline-add" data-for="${kind}" hidden><input class="inp" placeholder="New ${kind} name" aria-label="New ${kind} name"><button type="button" class="btn sm dark">Add</button><button type="button" class="btn sm ghost">Cancel</button></div>`;
function wireInlineAdd(m, after) {
  $$('select[data-kind]', m).forEach(sel => {
    const box = $(`.inline-add[data-for="${sel.dataset.kind}"]`, m), input = $('input', box);
    let prev = sel.value === ADD ? '' : sel.value;
    const close = () => { box.hidden = true; input.value = ''; };
    sel.addEventListener('change', () => { if (sel.value === ADD) { sel.value = prev; box.hidden = false; input.focus(); } else { prev = sel.value; close(); } });
    const add = () => {
      try {
        const name = sel.dataset.kind === 'type' ? DB.addType(input.value) : DB.addClient(input.value);
        sel.innerHTML = sel.dataset.kind === 'type' ? typeOptions(name) : listOptions(DB.clients(), name, '— Select client —', '＋ Add client…');
        sel.value = prev = name; close(); toast(`${sel.dataset.kind === 'type' ? 'Type' : 'Client'} “${name}” added`); after?.();
      } catch (e) { toast(e.message, 'error'); }
    };
    $('.btn.dark', box).onclick = add;
    $('.btn.ghost', box).onclick = close;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  });
}
function askListName(kind) {
  return new Promise(resolve => {
    const m = openModal(`${mHead(`Add ${kind}`)}<div class="m-body"><label class="fld">${kind === 'type' ? 'Type name' : 'Client name'}<input class="inp" id="lnName" placeholder="${kind === 'type' ? 'e.g. Thumbnail' : 'e.g. Bloom Organics'}"></label>
      <p class="hint">It will appear in every ${kind === 'type' ? 'Type' : 'Client'} dropdown. You can manage the list in Settings.</p></div>
      <div class="m-foot"><button class="btn" id="lnNo">Cancel</button><button class="btn dark" id="lnYes">Add ${kind}</button></div>`, { size: 'sm' });
    let done = false; const finish = v => { if (!done) { done = true; resolve(v); } };
    const yes = () => { try { const n = kind === 'type' ? DB.addType($('#lnName', m).value) : DB.addClient($('#lnName', m).value); finish(n); closeModal(); toast(`${kind === 'type' ? 'Type' : 'Client'} “${n}” added`); } catch (e) { toast(e.message, 'error'); } };
    $('#lnYes', m).onclick = yes;
    $('#lnName', m).addEventListener('keydown', e => { if (e.key === 'Enter') yes(); });
    $('#lnNo', m).onclick = () => { closeModal(); finish(null); };
    ui.onModalClose = () => finish(null);
  });
}

/* ---------- download ---------- */
function openDownload(fid) {
  const f = DB.freelancer(fid), s = wsState(fid);
  const m = openModal(`${mHead('Download deliverables')}<div class="m-body">
    <p class="hint" style="margin-top:0">Exports ${esc(f.name)}’s deliverables with amounts, the monthly total and the rate card.</p>
    <div class="btn-row" style="margin-bottom:16px">${periodSelectors(s.ym, 'data-dl')}</div>
    <div class="list">
      <button class="share-opt" data-fmt="xlsx"><span class="li-icon">${ic('sheet')}</span><span><b>Excel (.xlsx)</b><span>Opens in Excel; upload to Google Drive to open in Google Sheets.</span></span></button>
      <button class="share-opt" data-fmt="csv"><span class="li-icon">${ic('file')}</span><span><b>CSV (.csv)</b><span>Google Sheets: File → Import.</span></span></button>
    </div></div>`, { size: 'sm' });
  $$('[data-fmt]', m).forEach(b => b.onclick = async () => {
    const g = k => $(`[data-dl][data-k="${k}"]`, m).value;
    const per = periodFrom(g('y'), g('m')); toast('Preparing file…'); try { await DB.loadPeriod(fid, per); } catch (e) { /* export what is loaded */ }
    exportFreelancer(fid, per, b.dataset.fmt);
    closeModal();
  });
}
function exportFreelancer(fid, ym, fmt) {
  const f = DB.freelancer(fid), r = DB.summary(fid, ym);
  const items = [...r.items].sort((a, b) => a.assignDate.localeCompare(b.assignDate) || a.createdAt - b.createdAt);
  const cur = DB.S.currency;
  const head = ['Assignment Date', 'Delivery Date', 'Client', 'Type', 'Subject', 'Status', 'Payment Status', 'Posting Link', 'Notes', `Amount (${cur})`];
  const table = items.map(d => [d.assignDate, d.deliveryDate, d.client, d.type, d.subject, d.status, d.paymentStatus, d.link, d.notes, +d.rate || 0]);
  const rule = DB.S.totalRule === 'all' ? 'all deliverables except rejected' : 'approved deliverables';
  const summary = [['Summary'], ['Freelancer', f.name], ['Description', f.description], ['Period', periodLabel(ym)], ['Deliverables', r.count], [`Counted in total (${rule})`, r.counted],
    [`Total amount (${cur})`, r.total], [`Paid (${cur})`, r.paid], [`Unpaid (${cur})`, r.unpaid]];
  const rates = [['Rate card'], ['Type', `Rate (${cur})`], ...DB.types().map(t => [t, DB.rateFor(fid, t)])];
  const name = `${slug(f.name)}-deliverables-${ym || 'all'}`;
  if (fmt === 'csv' || !window.XLSX) {
    if (fmt !== 'csv') toast('Excel library unavailable offline — downloaded CSV instead', 'error');
    download(name + '.csv', '﻿' + toCSV([head, ...table, ['', '', '', '', '', '', '', '', 'Total', r.total], [], ...summary, [], ...rates]), 'text/csv;charset=utf-8');
    return;
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([head, ...table, [], ['', '', '', '', '', '', '', '', 'Total amount', r.total], ['', '', '', '', '', '', '', '', 'Paid', r.paid], ['', '', '', '', '', '', '', '', 'Unpaid', r.unpaid]]);
  ws['!cols'] = [14, 14, 20, 18, 34, 12, 14, 38, 30, 12].map(w => ({ wch: w }));
  ws['!autofilter'] = { ref: `A1:J${Math.max(1, table.length + 1)}` };
  XLSX.utils.book_append_sheet(wb, ws, 'Deliverables');
  const ss = XLSX.utils.aoa_to_sheet([...summary, [], ...rates]); ss['!cols'] = [{ wch: 36 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ss, 'Summary');
  saveFile(name + '.xlsx', XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
}

/* ================= SETTINGS ================= */
function listEditor(kind, list) {
  return `<div class="list-edit">${list.map(x => `<div class="le-row"><input class="inp" data-on="rename-${kind}" data-old="${esc(x)}" value="${esc(x)}" aria-label="${kind} name"><span class="muted le-n" title="Deliverables using it">${DB.usage(kind, x) || ''}</span><button class="icon-btn xs danger" data-act="rm-${kind}" data-name="${esc(x)}" title="Remove">${ic('trash', 15)}</button></div>`).join('') || `<p class="muted" style="font-size:12.5px;margin:4px 0">No ${kind}s yet.</p>`}</div>
    <div class="le-add"><input class="inp" id="new-${kind}" placeholder="New ${kind} name" aria-label="New ${kind} name"><button class="btn sm dark" data-act="add-${kind}">${ic('plus', 14)} Add ${kind}</button></div>`;
}
async function refreshAdmins(force) {
  if (!$('#adminBox')) return;
  const draw = () => {
    const b = $('#adminBox'); if (!b || !DB.admins) return; const me = (DB.user?.email || '').toLowerCase();
    b.innerHTML = `<div class="list-edit">${DB.admins.map(e => `<div class="le-row"><span style="flex:1;word-break:break-all">${esc(e)}${e.toLowerCase() === me ? ' <span class="muted">(you)</span>' : ''}</span>${e.toLowerCase() === me ? '' : `<button class="icon-btn xs danger" data-act="admin-rm" data-email="${esc(e)}" title="Remove admin">${ic('trash', 15)}</button>`}</div>`).join('')}</div>
      <div class="le-add"><input class="inp" id="new-admin" type="email" placeholder="New admin’s email" aria-label="New admin email"><button class="btn sm dark" data-act="add-admin">${ic('plus', 14)} Add admin</button></div>`;
  };
  if (DB.admins) draw();
  if (force || !DB.admins || Date.now() - DB._adminsAt > 10000) { try { await DB.loadAdmins(); draw(); } catch (e) { const b = $('#adminBox'); if (b) b.innerHTML = '<p class="muted">Couldn’t load the admin list.</p>'; } }
}
function viewSettings() {
  const S = DB.S;
  return `<header class="topbar"><div><h1>Settings</h1><p class="sub">Shared by everyone using this CRM</p></div></header>
  <div class="set-grid"><div style="display:grid;gap:16px;align-content:start">
    <section class="card"><div class="card-head"><div><h3>Clients</h3><p>The options in every Client dropdown. Renaming a client updates its deliverables too. The number shows how many deliverables use it.</p></div></div>${listEditor('client', DB.clients())}</section>
    <section class="card"><div class="card-head"><div><h3>Deliverable types</h3><p>The options in every Type dropdown. Renaming a type updates its deliverables and rates.</p></div></div>${listEditor('type', DB.types())}</section>
  </div><div style="display:grid;gap:16px;align-content:start">
    <section class="card"><div class="card-head"><div><h3>My account</h3><p>Signed in as <b>${esc(DB.user?.email || '')}</b></p></div></div>
      <div class="le-add"><input class="inp" id="new-pw" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" aria-label="New password"><button class="btn sm dark" data-act="pw-change">Change password</button></div></section>
    <section class="card"><div class="card-head"><div><h3>Admins</h3><p>Admins see everything, including every freelancer’s rates and payments. Each admin creates an account on the site with their own email.</p></div></div><div id="adminBox"><p class="muted">Loading…</p></div></section>
    <section class="card"><div class="card-head"><div><h3>General</h3></div></div>
      <div class="set-row"><div class="lbl"><b>Currency symbol</b><span>Shown on amounts and downloads</span></div><input class="inp" style="width:90px;text-align:center" data-on="set-currency" value="${esc(S.currency)}" maxlength="4" aria-label="Currency symbol"></div>
      <div class="set-row"><div class="lbl"><b>Monthly total includes</b><span>Which deliverables count toward a freelancer’s total</span></div>
        <select class="fsel" data-on="set-rule" aria-label="Monthly total rule">${opt('approved', 'Approved only', S.totalRule)}${opt('all', 'All except rejected', S.totalRule)}</select></div></section>
    <section class="card"><div class="card-head"><div><h3>Backup</h3><p>Everything is saved online automatically. Download a copy of all records if you want your own backup.</p></div></div>
      <button class="btn" data-act="backup">${ic('download', 16)} Download backup (.json)</button></section>
  </div></div>`;
}

/* ================= EVENTS ================= */
const ACT = {
  'modal-close': () => closeModal(),
  'fl-add': () => openFreelancerModal(),
  'fl-edit': t => openFreelancerModal(t.dataset.id),
  'fl-del': t => deleteFreelancer(t.dataset.id),
  'auth-in': async () => { const m = $('#authMsg'); m.textContent = ''; m.className = 'auth-msg'; try { await DB.signIn($('#authEmail').value, $('#authPw').value); } catch (e) { m.textContent = e.message; } },
  'auth-up': async () => { const m = $('#authMsg'); m.className = 'auth-msg'; try { const r = await DB.signUp($('#authEmail').value, $('#authPw').value); if (r === 'confirm') { m.className = 'auth-msg ok'; m.textContent = 'Account created. Open the confirmation email, click the link, then sign in here.'; } } catch (e) { m.textContent = e.message; } },
  'auth-reset': async () => { const m = $('#authMsg'); m.className = 'auth-msg'; try { await DB.resetPassword($('#authEmail').value); m.className = 'auth-msg ok'; m.textContent = 'Password reset email sent. Check your inbox.'; } catch (e) { m.textContent = e.message; } },
  'auth-newpw': async () => { const m = $('#authMsg'); try { await DB.setPassword($('#authPw').value); } catch (e) { m.textContent = e.message; } },
  'sign-out': async () => { await DB.signOut(); },
  'pw-change': async () => { const i = $('#new-pw'); try { await DB.changePassword(i.value); i.value = ''; toast('Password changed'); } catch (e) { toast(e.message, 'error'); } },
  'add-admin': async () => { const i = $('#new-admin'); try { await DB.addAdmin(i.value); toast('Admin added. They create an account with that email.'); refreshAdmins(true); } catch (e) { toast(e.message, 'error'); } },
  'admin-rm': async t => { const em = t.dataset.email; if (!await confirmDialog({ title: `Remove ${em} as admin?`, body: 'They will no longer see rates, payments or settings.', confirmText: 'Remove', danger: true })) return; try { await DB.removeAdmin(em); toast('Admin removed'); refreshAdmins(true); } catch (e) { toast(e.message, 'error'); } },
  'fl-view': t => { ui.flView = t.dataset.v; rerender(); },
  'acc-invite': t => { const f = DB.freelancer(t.dataset.id); accRun(t.dataset.id, 'invite', `Invitation sent to ${f?.email}`); },
  'acc-disable': async t => { const f = DB.freelancer(t.dataset.id); if (!await confirmDialog({ title: `Disable ${f?.name}’s account?`, body: 'They lose all access straight away and can’t sign in until you enable the account again. Their data is kept.', confirmText: 'Disable', danger: true })) return; accRun(t.dataset.id, 'disable', 'Account disabled'); },
  'acc-enable': t => accRun(t.dataset.id, 'enable', 'Account enabled'),
  'team-open': t => { location.hash = '#/team/' + t.dataset.id; },
  'fl-open': t => { location.hash = '#/freelancers/' + t.dataset.id; },
  'ws-tab': t => { wsState(t.dataset.id).tab = t.dataset.tab; rerender(); },
  'ws-sort': t => { const s = wsState(t.dataset.id); s.sort = { k: t.dataset.k, dir: s.sort.k === t.dataset.k ? -s.sort.dir : 1 }; wsRefresh(t.dataset.id); },
  'add-deliverable': t => openDeliverableModal(t.dataset.id),
  'dl-edit': t => openDeliverableModal(null, t.closest('tr').dataset.id),
  'dl-del': async t => {
    const d = DB.deliverable(t.closest('tr').dataset.id);
    if (!await confirmDialog({ title: 'Delete deliverable?', body: `“${esc(d.subject || d.type)}” will be permanently removed.`, confirmText: 'Delete', danger: true })) return;
    DB.deleteDeliverable(d.id); toast('Deleted'); wsRefresh(d.freelancerId);
  },
  'rates-save': t => { const rates = {}; $$('#rateGrid input').forEach(i => rates[i.dataset.type] = i.value); const n = DB.setRates(t.dataset.id, rates); toast(n ? 'Rates saved — they apply to new deliverables' : 'No changes'); },
  'import-open': t => Importer.open(t.dataset.id),
  'download-open': t => openDownload(t.dataset.id),
  'backup': async () => { toast('Preparing backup…'); try { saveFile(`gfc-crm-backup-${todayISO()}.json`, JSON.stringify(await DB.exportAll(), null, 1)); } catch (e) { toast('Backup failed. Check your connection and try again.', 'error'); } },
  'add-client': () => { try { const n = DB.addClient($('#new-client').value); toast(`Client “${n}” added`); rerender(); setTimeout(() => $('#new-client')?.focus(), 20); } catch (e) { toast(e.message, 'error'); } },
  'add-type': () => { try { const n = DB.addType($('#new-type').value); toast(`Type “${n}” added`); rerender(); setTimeout(() => $('#new-type')?.focus(), 20); } catch (e) { toast(e.message, 'error'); } },
  'rm-client': async t => { const n = t.dataset.name; try { await DB.assertUnused('client', n); if (!await confirmDialog({ title: `Remove “${n}”?`, body: 'It will no longer appear in the Client dropdown.', confirmText: 'Remove', danger: true })) return; DB.removeClient(n); toast('Client removed'); rerender(); } catch (e) { toast(e.message, 'error'); } },
  'rm-type': async t => { const n = t.dataset.name; try { await DB.assertUnused('type', n); if (!await confirmDialog({ title: `Remove “${n}”?`, body: 'It will no longer appear in the Type dropdown. Rates set for it are kept in case you add it back.', confirmText: 'Remove', danger: true })) return; DB.removeType(n); toast('Type removed'); rerender(); } catch (e) { toast(e.message, 'error'); } },
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || !ACT[t.dataset.act]) return;
  if (t.tagName === 'A') e.preventDefault();
  ACT[t.dataset.act](t, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('.modal-bg')) { closeModal(); return; }
  if (e.key === 'Enter' && e.target.matches('[data-act="fl-open"]')) e.target.click();
  if (e.key === 'Enter' && (e.target.id === 'new-client' || e.target.id === 'new-type' || e.target.id === 'new-admin')) ACT[e.target.id.replace('new-', 'add-')]();
  if (e.key === 'Enter' && e.target.matches('.cell-in:not(select)')) e.target.blur();
});
let qTimer;
document.addEventListener('input', e => {
  const t = e.target, on = t.dataset.on;
  if (on === 'fl-q') { ui.flQ = t.value; $('#flGrid').innerHTML = flGrid(); }
  if (on === 'team-q') { ui.teamQ = t.value; $('#teamGrid').innerHTML = teamGrid(); }
  if (on === 'ws-q') { clearTimeout(qTimer); qTimer = setTimeout(() => { wsState(t.dataset.id).q = t.value; wsRefresh(t.dataset.id); }, 160); }
});
document.addEventListener('change', async e => {
  const t = e.target, on = t.dataset.on;
  if (t.classList.contains('cell-in')) {
    const tr = t.closest('tr'), f = t.dataset.f, d = DB.deliverable(tr.dataset.id);
    if (t.value === ADD) {
      const name = await askListName(f === 'type' ? 'type' : 'client');
      if (!name) { const n = document.createElement('tbody'); n.innerHTML = rowHtml(d); tr.replaceWith(n.firstElementChild); return; }
      t.innerHTML = f === 'type' ? typeOptions(name) : clientOptions(name); t.value = name;
    }
    try {
      if (f === 'subject' && !t.value.trim()) throw new Error('Subject can’t be empty.');
      DB.updateDeliverable(d.id, { [f]: f === 'rate' ? (+t.value || 0) : t.value });
      if (t.tagName === 'SELECT' || ['rate', 'link', 'assignDate'].includes(f)) {
        const gone = f === 'assignDate' && !DB.inPeriod(d, wsState(d.freelancerId).ym);
        if (gone) { toast(`Moved to ${monthLabel(ymOf(d.assignDate))} — change the month filter to see it`); tr.remove(); }
        else { const n = document.createElement('tbody'); n.innerHTML = rowHtml(d); const row = n.firstElementChild; tr.replaceWith(row); row.classList.add('flash'); }
      }
      $('#wsSum').innerHTML = wsSummaryHtml(d.freelancerId);
    } catch (err) { toast(err.message, 'error'); const n = document.createElement('tbody'); n.innerHTML = rowHtml(d); tr.replaceWith(n.firstElementChild); }
    return;
  }
  if (on === 'ws-period') {
    const g = k => $(`[data-on="ws-period"][data-k="${k}"]`).value;
    let y = g('y'); const m = g('m');
    if (m && !y) { y = String(new Date().getFullYear()); $(`[data-on="ws-period"][data-k="y"]`).value = y; }
    wsState(t.dataset.id).ym = periodFrom(y, m); wsRefresh(t.dataset.id);
  }
  if (t.dataset.dl !== undefined && t.dataset.k === 'm' && t.value) { const y = $('[data-dl][data-k="y"]'); if (!y.value) y.value = String(new Date().getFullYear()); }
  if (on === 'set-currency') { DB.S.currency = t.value.trim() || '₹'; DB.saveSettings(); toast('Saved'); }
  if (on === 'set-rule') { DB.S.totalRule = t.value; DB.saveSettings(); toast('Saved'); }
  if (on === 'set-rate') { DB.S.defaultRates = { ...DB.S.defaultRates, [t.dataset.type]: Math.max(0, +t.value || 0) }; DB.saveSettings(); toast('Default rate saved'); }
  if (on === 'rename-client' || on === 'rename-type') {
    try { await (on === 'rename-client' ? DB.renameClient(t.dataset.old, t.value) : DB.renameType(t.dataset.old, t.value)); toast('Renamed'); rerender(); }
    catch (err) { toast(err.message, 'error'); t.value = t.dataset.old; }
  }
});
window.addEventListener('hashchange', () => { closeModal(); route(); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest?.('.login')) { e.preventDefault(); ACT[DB.state === 'recovery' || DB.state === 'activate' ? 'auth-newpw' : 'auth-in'](); } });
document.addEventListener('click', e => { if (!e.target.closest('[data-act="copy-id"]')) return; const done = () => toast('ID copied'); (navigator.clipboard?.writeText(DB.myId) || Promise.reject()).then(done, () => { const c = $('.idbox code'); if (c) { const r = document.createRange(); r.selectNodeContents(c); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } toast('Press Ctrl+C to copy the selected ID'); }); });

/* Live updates from other people redraw the page, but never under someone who is typing or has a dialog open. */
const isEditing = () => !!$('.modal-bg') || !!document.activeElement?.matches?.('#main input, #main select, #main textarea');
function flushPending() { setTimeout(() => { if (ui.pending && !isEditing()) { ui.pending = false; rerender(); } }, 60); }
document.addEventListener('focusout', flushPending);
DB.onChange = initial => { if (initial || !isEditing()) { ui.pending = false; rerender(); } else ui.pending = true; };
let lastState = DB.state;
DB.onStatus = () => {
  const el = $('#sync');
  if (el) { const n = DB.saving(); el.className = 'sync ' + (n ? 'busy' : DB.state === 'ok' ? 'ok' : 'off'); el.textContent = n ? 'Saving…' : DB.state === 'ok' ? 'All saved' : DB.state === 'offline' ? 'Offline' : 'Connecting…'; }
  if (DB.state !== lastState) { lastState = DB.state; rerender(); }
};
window.addEventListener('beforeunload', e => { if (DB.saving()) { e.preventDefault(); e.returnValue = ''; } });

route();
DB.connect();
