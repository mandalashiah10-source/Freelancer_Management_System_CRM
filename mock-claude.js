'use strict';
/* Local-preview stand-in for the claude.ai runtime (db, user, downloads).
   Loaded only by index.html for testing on localhost; never part of the published page. */
(function () {
  if (window.claude) return;
  const KEY = 'gfc-mock-db';
  let docs = {}; try { docs = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { docs = {}; }
  const listeners = new Set();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(docs)); } catch (e) { /* ignore */ } };
  const snapDoc = (path) => ({ id: path.split('/').pop(), exists: path in docs, data: () => docs[path] && JSON.parse(JSON.stringify(docs[path])), metadata: { fromCache: false, hasPendingWrites: false } });
  const notify = () => setTimeout(() => listeners.forEach(l => l()), 30);
  const docRef = path => ({
    id: path.split('/').pop(), path,
    get: async () => snapDoc(path),
    set: async (b) => { await new Promise(r => setTimeout(r, 40)); docs[path] = JSON.parse(JSON.stringify(b)); persist(); notify(); },
    update: async (b) => { docs[path] = { ...docs[path], ...b }; persist(); notify(); },
    delete: async () => { await new Promise(r => setTimeout(r, 40)); delete docs[path]; persist(); notify(); },
    onSnapshot(next) { const l = () => next(snapDoc(path)); listeners.add(l); setTimeout(l, 50); return () => listeners.delete(l); },
  });
  const colRef = path => ({
    path, doc: id => docRef(path + '/' + (id || Math.random().toString(36).slice(2))),
    onSnapshot(next) {
      const l = () => { const ds = Object.keys(docs).filter(k => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1).sort().map(snapDoc); next({ docs: ds, size: ds.length, empty: !ds.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] }); };
      listeners.add(l); setTimeout(l, 50); return () => listeners.delete(l);
    },
  });
  const caps = {
    db: { doc: docRef, collection: colRef },
    user: { can: async () => true, isOwner: async () => true, canEdit: async () => true },
    downloads: { save: async ({ filename, data }) => { window.__lastDownload = { filename, size: data.byteLength ?? data.length }; return { status: 'saved' }; } },
  };
  window.claude = { use: async name => caps[name] || null };
})();
