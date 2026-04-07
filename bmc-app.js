// BM&C Enterprise LLC - Firebase App Logic
const firebaseConfig = {
  apiKey: "AIzaSyAx9BD75nVE2G4G6249eU5945QUPv3xMms",
  authDomain: "bmc-enterprise.firebaseapp.com",
  projectId: "bmc-enterprise",
  storageBucket: "bmc-enterprise.firebasestorage.app",
  messagingSenderId: "672071936385",
  appId: "1:672071936385:web:aac13c716f4d9fb7442080"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let loads = [], receipts = [], maints = [], invoices = [];
let editingLoadId = null;
let currentUser = null;
let activeFilter = 'all';
let editingReceiptId = null, pendingReceiptImage = null;
let pendingBolImage = null, pendingRateImage = null;
let editingMaintId = null, pendingMaintPhoto = null;
let unsubLoads, unsubReceipts, unsubMaints, unsubInvoices;

firebase.auth().getRedirectResult().catch(e => console.error('Redirect error:', e.code));

firebase.auth().onAuthStateChanged(user => {
  document.getElementById('loading-overlay').style.display = 'none';
  if (user) {
    currentUser = user;
    showApp(user);
    subscribeToData();
  } else {
    currentUser = null;
    showLogin();
    [unsubLoads, unsubReceipts, unsubMaints, unsubInvoices].forEach(u => u && u());
  }
});

window.signInWithGoogle = function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: 'bmcenterprise73@gmail.com' });
  firebase.auth().signInWithPopup(provider).catch(e => {
    if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) {
      const btn = document.querySelector('.btn-google');
      if (btn) {
        btn.innerHTML = '<span>Redirecting to Google…</span>';
        btn.style.opacity = '0.7';
      }
      firebase.auth().signInWithRedirect(provider);
    } else {
      showToast('Sign in failed: ' + e.code, '#D62828');
    }
  });
};

window.signOut = function() {
  firebase.auth().signOut();
  document.getElementById('signout-menu').classList.remove('open');
};

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  ['app-header', 'scroll-area', 'fab', 'bottom-nav'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

function showApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('scroll-area').style.display = 'block';
  document.getElementById('fab').style.display = 'flex';
  document.getElementById('bottom-nav').style.display = 'flex';

  const av = document.getElementById('user-avatar');
  if (user.photoURL) {
    av.outerHTML = `<img src="${user.photoURL}" class="user-avatar" id="user-avatar" onclick="toggleSignoutMenu()" alt="avatar">`;
  } else {
    av.textContent = (user.displayName || user.email || 'C')[0].toUpperCase();
  }

  document.getElementById('signout-user-email').textContent = user.email || '';
  document.getElementById('f-date').value = toISO(new Date());
  document.getElementById('m-date').value = toISO(new Date());
  document.getElementById('r-date').value = toISO(new Date());
  document.getElementById('inv-date').value = toISO(new Date());

  renderDash();
  renderLoads();
  renderReceipts();
  renderMaintenance();
}

function userColl(name) {
  return db.collection('users').doc(currentUser.uid).collection(name);
}

function subscribeToData() {
  unsubLoads = userColl('loads').orderBy('createdAt', 'desc').onSnapshot(snap => {
    loads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDash();
    renderLoads();
    document.getElementById('inv-num').value = 'BM&C-' + String(loads.length + 1).padStart(3, '0');
  });

  unsubReceipts = userColl('receipts').orderBy('createdAt', 'desc').onSnapshot(snap => {
    receipts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderReceipts();
  });

  unsubMaints = userColl('maints').orderBy('createdAt', 'desc').onSnapshot(snap => {
    maints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMaintenance();
  });

  unsubInvoices = userColl('invoices').orderBy('createdAt', 'desc').onSnapshot(snap => {
    invoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderInvoiceHistory();
    renderDash();
  });
}

function toISO(d) { return d.toISOString().split('T')[0]; }
function today() { return toISO(new Date()); }
function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${m}/${d}/${y}`;
}
function fmtMoney(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function showToast(msg, bg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = bg || '#2ECC71';
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2500);
}
function openDocViewer(src){
  const viewer = document.getElementById('doc-fullscreen');
  const img = document.getElementById('doc-fullscreen-img');
  img.src = src;
  viewer.style.display = 'flex';
}

function closeDocViewer(){
  document.getElementById('doc-fullscreen').style.display = 'none';
  document.getElementById('doc-fullscreen-img').src = '';
}
window.toggleSignoutMenu = () => document.getElementById('signout-menu').classList.toggle('open');
document.addEventListener('click', e => {
  if (!e.target.closest('#signout-menu') && !e.target.closest('#user-avatar')) {
    document.getElementById('signout-menu').classList.remove('open');
  }
});

window.switchTab = function(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  document.getElementById('fab').style.display = ['invoice', 'receipts', 'maintenance'].includes(id) ? 'none' : 'flex';
  document.getElementById('scroll-area').scrollTop = 0;
};

window.openSheet = function(id = null) {
  editingLoadId = id;

  const titleEl = document.getElementById('load-sheet-title');
  const saveBtn = document.getElementById('load-save-btn');
  const deleteBtn = document.getElementById('delete-load-btn');

  if (id) {
    const load = loads.find(l => l.id === id);
    if (!load) return;

    titleEl.textContent = 'Edit Load';
    saveBtn.textContent = 'Save Changes';
    deleteBtn.style.display = 'block';

    document.getElementById('f-date').value = load.date || today();
    document.getElementById('f-type').value = load.type || 'one-way';
    document.getElementById('f-from').value = load.from || '';
    document.getElementById('f-to').value = load.to || '';
    document.getElementById('f-miles').value = load.miles || '';
    document.getElementById('f-amount').value = load.amount || '';
    document.getElementById('f-client').value = load.client || '';
    document.getElementById('f-bol').value = load.bol || '';
    document.getElementById('f-notes').value = load.notes || '';

    pendingBolImage = null;
    pendingRateImage = null;

    const hasBol = !!load.bolImageData;
    const hasRate = !!load.rateImageData;

    document.getElementById('doc-view-row').style.display = (hasBol || hasRate) ? 'block' : 'none';
    document.getElementById('view-bol-btn').style.display = hasBol ? 'inline-flex' : 'none';
    document.getElementById('view-rate-btn').style.display = hasRate ? 'inline-flex' : 'none';

    document.getElementById('view-bol-btn').onclick = () => openDocViewer(load.bolImageData);
document.getElementById('view-rate-btn').onclick = () => openDocViewer(load.rateImageData);
  } else {
    titleEl.textContent = 'Log Load';
    saveBtn.textContent = 'Save Load';
    deleteBtn.style.display = 'none';

    ['f-from', 'f-to', 'f-miles', 'f-amount', 'f-client', 'f-bol', 'f-notes'].forEach(i => {
      document.getElementById(i).value = '';
    });
    document.getElementById('f-date').value = today();
    document.getElementById('f-type').value = 'one-way';

    pendingBolImage = null;
    pendingRateImage = null;

    document.getElementById('doc-view-row').style.display = 'none';
    document.getElementById('view-bol-btn').style.display = 'none';
    document.getElementById('view-rate-btn').style.display = 'none';
  }

  document.getElementById('sheet-backdrop').classList.add('open');
};

window.closeSheet = () => {
  document.getElementById('sheet-backdrop').classList.remove('open');
  editingLoadId = null;
  pendingBolImage = null;
  pendingRateImage = null;
  document.getElementById('doc-view-row').style.display = 'none';
  document.getElementById('view-bol-btn').style.display = 'none';
  document.getElementById('view-rate-btn').style.display = 'none';
};

window.closeSheetIfBackdrop = e => {
  if (e.target === document.getElementById('sheet-backdrop')) window.closeSheet();
};

window.addLoad = function() {
  const loadData = {
    date: document.getElementById('f-date').value,
    type: document.getElementById('f-type').value,
    from: document.getElementById('f-from').value.trim(),
    to: document.getElementById('f-to').value.trim(),
    miles: parseFloat(document.getElementById('f-miles').value) || 0,
    amount: parseFloat(document.getElementById('f-amount').value) || 0,
    client: document.getElementById('f-client').value.trim(),
    bol: document.getElementById('f-bol').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    bolImageData: pendingBolImage || null,
    rateImageData: pendingRateImage || null
  };

  if (!loadData.date || !loadData.from || !loadData.to || !loadData.amount) {
    showToast('Fill in Date, From, To & Amount', '#D62828');
    return;
  }

  if (editingLoadId) {
    const existing = loads.find(l => l.id === editingLoadId);
    loadData.bolImageData = pendingBolImage || existing?.bolImageData || null;
    loadData.rateImageData = pendingRateImage || existing?.rateImageData || null;
  }

  const approxSize =
    JSON.stringify({
      ...loadData,
      bolImageData: null,
      rateImageData: null
    }).length +
    (loadData.bolImageData ? loadData.bolImageData.length : 0) +
    (loadData.rateImageData ? loadData.rateImageData.length : 0);

  if (approxSize > 850000) {
    showToast('Photos are too large. Use smaller images.', '#D62828');
    return;
  }

  const promise = editingLoadId
    ? userColl('loads').doc(editingLoadId).update(loadData)
    : userColl('loads').add({
        ...loadData,
        invoiced: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

  promise
    .then(() => {
      pendingBolImage = null;
      pendingRateImage = null;
      window.closeSheet();
      showToast(editingLoadId ? '✔ Load updated!' : '✔ Load saved!');
    })
    .catch((err) => {
      console.error('Load save error:', err);
      showToast('Error saving load/photos', '#D62828');
    });
};

window.deleteLoad = function(id = editingLoadId) {
  if (!id) return;
  if (!confirm('Delete this load?')) return;

  userColl('loads').doc(id).delete()
    .then(() => {
      window.closeSheet();
      showToast('Load deleted', '#6B6B80');
    });
};

function renderDash() {
  const totalMiles = loads.reduce((s, l) => s + (l.miles || 0), 0);

  const collected = invoices
    .filter(i => i.paid)
    .reduce((s, i) => s + (i.total || 0), 0);

  const outstanding = invoices
    .filter(i => !i.paid)
    .reduce((s, i) => s + (i.total || 0), 0);

  const unbilledLoads = loads.filter(l => !l.invoiced);
  const unbilledCount = unbilledLoads.length;
  const unbilledAmount = unbilledLoads.reduce((s, l) => s + (l.amount || 0), 0);

  document.getElementById('stat-strip').innerHTML = `
    <div class="stat-card gold">
      <div class="stat-label">Collected</div>
      <div class="stat-value money">${fmtMoney(collected)}</div>
      <div class="stat-sub">paid invoices</div>
    </div>

    <div class="stat-card accent">
      <div class="stat-label">Outstanding</div>
      <div class="stat-value money">${fmtMoney(outstanding)}</div>
      <div class="stat-sub">invoiced, unpaid</div>
    </div>

    <div class="stat-card wide">
      <div class="stat-label">Unbilled</div>
      <div class="stat-value money">${fmtMoney(unbilledAmount)}</div>
      <div class="stat-sub">${unbilledCount} load${unbilledCount !== 1 ? 's' : ''} not yet invoiced</div>
    </div>

    <div class="stat-card wide">
      <div class="stat-label">Total Miles</div>
      <div class="stat-value">${totalMiles.toLocaleString()}<span style="font-size:16px;font-weight:400;color:var(--gray)"> mi</span></div>
    </div>
  `;

  const el = document.getElementById('dash-loads');
  const recent = loads.slice(0, 8);
  el.innerHTML = recent.length
    ? recent.map(l => loadCard(l)).join('')
    : `<div class="empty-state"><div class="empty-icon">🚛</div><div class="empty-title">No loads yet</div><div class="empty-sub">Tap + to log your first run</div></div>`;
}

window.setFilter = function(val, el) {
  activeFilter = val;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderLoads();
};

function renderLoads() {
  const search = (document.getElementById('search-input').value || '').toLowerCase();
  const monthF = document.getElementById('filter-month').value;

  let filtered = loads.filter(l => {
    const ms = !search || [l.from, l.to, l.client, l.bol, l.notes].join(' ').toLowerCase().includes(search);
    const mt = activeFilter === 'all' || l.type === activeFilter;
    const mm = !monthF || (l.date && l.date.startsWith(monthF));
    return ms && mt && mm;
  });

  document.getElementById('loads-count').textContent = `${filtered.length} Load${filtered.length !== 1 ? 's' : ''}`;
  const el = document.getElementById('all-loads');
  el.innerHTML = filtered.length
    ? filtered.map(l => loadCard(l)).join('')
    : `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No loads found</div><div class="empty-sub">Try changing your filters</div></div>`;
}
window.renderLoads = renderLoads;

function loadCard(l) {
  return `<div class="load-card" onclick="openSheet('${l.id}')">
    <div class="load-card-top">
      <div class="load-route">${l.from}<span class="arrow">→</span>${l.to}</div>
      <div class="load-amount">${fmtMoney(l.amount)}</div>
    </div>
    <div class="load-meta">
      <span class="load-date">${fmtDate(l.date)}</span>
      ${l.miles ? `<span class="load-miles">${l.miles.toLocaleString()} mi</span>` : ''}
      <span class="badge ${l.type === 'round-trip' ? 'badge-round' : 'badge-one'}">${l.type}</span>
      ${l.invoiced ? `<span class="badge" style="background:rgba(46,204,113,0.15);color:#2ECC71;border:1px solid rgba(46,204,113,0.3)">billed</span>` : ''}
      ${l.client ? `<span class="load-client">${l.client}</span>` : ''}
      ${l.bolImageData ? `<span class="badge" style="background:rgba(233,185,48,0.12);color:var(--gold);border:1px solid rgba(233,185,48,0.35)">BOL</span>` : ''}
      ${l.rateImageData ? `<span class="badge" style="background:rgba(2,62,138,0.20);color:#7AB3FF;border:1px solid rgba(2,62,138,0.5)">RATE</span>` : ''}
    </div>
  </div>`;
}

window.exportCSV = function() {
  const headers = ['Date', 'From', 'To', 'Client', 'BOL', 'Miles', 'Amount', 'Type', 'Invoiced', 'Notes'];
  const rows = loads.map(l => [l.date, l.from, l.to, l.client, l.bol, l.miles, l.amount, l.type, l.invoiced ? 'Yes' : 'No', l.notes].map(v => `"${v || ''}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'BMC_Loads_' + today() + '.csv';
  a.click();
};

// ── INVOICE GENERATOR
window.generateInvoice = function() {
  const client = document.getElementById('inv-client').value.trim() || 'Client';
  const invNum = document.getElementById('inv-num').value.trim() || 'BM&C-001';
  const invDate = document.getElementById('inv-date').value;
  const start = document.getElementById('inv-start').value;
  const end = document.getElementById('inv-end').value;

  let sel = [...loads];
  if (start) sel = sel.filter(l => l.date >= start);
  if (end) sel = sel.filter(l => l.date <= end);
  if (client !== 'Client') sel = sel.filter(l => l.client && l.client.toLowerCase().includes(client.toLowerCase()));

  const out = document.getElementById('invoice-out');
  if (!sel.length) {
    out.innerHTML = `<p style="color:var(--gray);font-family:'Share Tech Mono',monospace;font-size:12px;padding:16px 0">No loads match — check filters.</p>`;
    return;
  }

  const total = sel.reduce((s, l) => s + l.amount, 0);
  const rows = sel.map(l => `
    <div class="inv-row">
      <div class="inv-row-left">
        <div class="inv-row-route">${l.from} → ${l.to}</div>
        <div class="inv-row-date">${fmtDate(l.date)}${l.bol ? ' · BOL ' + l.bol : ''}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
          ${l.bolImageData ? `<button type="button" onclick="openDocViewer('${l.bolImageData}')" style="padding:4px 8px;font-size:10px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer">BOL</button>` : ''}
${l.rateImageData ? `<button type="button" onclick="openDocViewer('${l.rateImageData}')" style="padding:4px 8px;font-size:10px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer">RATE</button>` : ''}
        </div>
      </div>
      <div class="inv-row-amt">${fmtMoney(l.amount)}</div>
    </div>
  `).join('');

  const period = start && end ? `${fmtDate(start)} – ${fmtDate(end)}` : 'All Dates';
  const loadIds = sel.map(l => l.id);
  window._pendingInvoice = { invNum, client, invDate, total, period, loadIds };

  out.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn-outline" onclick="printInvoice()" style="flex:1">🖨 Print / Save PDF</button>
      <button class="btn-outline" onclick="downloadInvoiceDocs()" style="flex:1">📎 Download Docs</button>
      <button class="btn-outline" onclick="openFullInvoicePacket()" style="flex:1">📦 Full Packet</button>
      <button class="btn-outline" onclick="saveInvoiceToHistory()" style="flex:1;color:var(--green);border-color:var(--green)">💾 Save Invoice</button>
    </div>
    <div class="invoice-preview" id="invoice-preview-content">
      <div class="inv-top">
        <div class="inv-top-logo">BM&amp;C Enterprise LLC</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;opacity:0.6;margin-top:4px">GENERAL FREIGHT CARRIER</div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-family:'Share Tech Mono',monospace;font-size:9px;opacity:0.5;letter-spacing:1px">INVOICE</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800">${invNum}</div>
          </div>
          <div style="text-align:right;font-family:'Share Tech Mono',monospace;font-size:10px;opacity:0.6">
            ${fmtDate(invDate)}<br>Bill To: ${client}<br>${period}
          </div>
        </div>
      </div>
      <div class="inv-stripe"></div>
      <div class="inv-body">
        ${rows}
        <div class="inv-total-row">
          <div class="inv-total-lbl">TOTAL DUE · ${sel.length} LOADS</div>
          <div class="inv-total-amt">${fmtMoney(total)}</div>
        </div>
      </div>
    </div>
  `;
};

window.downloadInvoiceDocs = function() {
  const p = window._pendingInvoice;
  if (!p || !p.loadIds || !p.loadIds.length) {
    showToast('Generate an invoice first', '#D62828');
    return;
  }

  const selectedLoads = loads.filter(l => p.loadIds.includes(l.id));
  const docUrls = [];

  selectedLoads.forEach(l => {
    if (l.bolImageData) docUrls.push(l.bolImageData);
    if (l.rateImageData) docUrls.push(l.rateImageData);
  });

  if (!docUrls.length) {
    showToast('No BOL or Rate docs on these loads', '#D62828');
    return;
  }

  openDocViewer(docUrls[0]);
  showToast(`Opened ${docUrls.length} document${docUrls.length !== 1 ? 's' : ''}`);
};

window.openFullInvoicePacket = function() {
  const p = window._pendingInvoice;
  if (!p || !p.loadIds || !p.loadIds.length) {
    showToast('Generate an invoice first', '#D62828');
    return;
  }

  printInvoice();
  setTimeout(() => {
    downloadInvoiceDocs();
  }, 500);
};

window.saveInvoiceToHistory = function() {
  const p = window._pendingInvoice;
  if (!p) {
    showToast('Generate an invoice first', '#D62828');
    return;
  }

  const invoice = { ...p, paid: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
  userColl('invoices').add(invoice).then(() => {
    const batch = db.batch();
    p.loadIds.forEach(id => {
      batch.update(db.collection('users').doc(currentUser.uid).collection('loads').doc(id), { invoiced: true });
    });
    return batch.commit();
  }).then(() => showToast('✔ Invoice saved!')).catch(() => showToast('Error saving invoice', '#D62828'));
};

// ── INVOICE HISTORY SHEET
window.openInvoiceHistory = function() {
  renderInvoiceHistory();
  document.getElementById('invoice-history-backdrop').classList.add('open');
};
window.closeInvoiceHistory = function() {
  document.getElementById('invoice-history-backdrop').classList.remove('open');
};
window.closeInvoiceHistoryIfBackdrop = function(e) {
  if (e.target === document.getElementById('invoice-history-backdrop')) window.closeInvoiceHistory();
};

window.togglePaid = function(id, currentPaid) {
  const wasPaid = currentPaid === true || currentPaid === 'true';
  userColl('invoices').doc(id).update({ paid: !wasPaid })
    .then(() => showToast(wasPaid ? 'Marked unpaid' : '✔ Marked as paid!'));
};

window.deleteInvoice = function(id) {
  if (!confirm('Delete this invoice record?')) return;
  userColl('invoices').doc(id).delete().then(() => showToast('Invoice deleted', '#6B6B80'));
};

// ── VIEW SAVED INVOICE (reconstruct from stored loadIds)
window.viewInvoiceFromHistory = function(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;

  const invLoads = loads.filter(l => (inv.loadIds || []).includes(l.id));

  const rows = invLoads.map(l => `
    <div class="inv-row">
      <div class="inv-row-left">
        <div class="inv-row-route">${l.from} → ${l.to}</div>
        <div class="inv-row-date">${fmtDate(l.date)}${l.bol ? ' · BOL ' + l.bol : ''}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
          ${l.bolImageData ? `<button type="button" onclick="openDocViewer('${l.bolImageData}')" style="padding:4px 8px;font-size:10px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer">BOL</button>` : ''}
          ${l.rateImageData ? `<button type="button" onclick="openDocViewer('${l.rateImageData}')" style="padding:4px 8px;font-size:10px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer">RATE</button>` : ''}
        </div>
      </div>
      <div class="inv-row-amt">${fmtMoney(l.amount)}</div>
    </div>
  `).join('');

  const previewHTML = `
    <div class="invoice-preview" id="hist-invoice-preview-content">
      <div class="inv-top">
        <div class="inv-top-logo">BM&amp;C Enterprise LLC</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;opacity:0.6;margin-top:4px">GENERAL FREIGHT CARRIER</div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-family:'Share Tech Mono',monospace;font-size:9px;opacity:0.5;letter-spacing:1px">INVOICE</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800">${inv.invNum}</div>
          </div>
          <div style="text-align:right;font-family:'Share Tech Mono',monospace;font-size:10px;opacity:0.6">
            ${fmtDate(inv.invDate)}<br>Bill To: ${inv.client}<br>${inv.period || ''}
          </div>
        </div>
      </div>
      <div class="inv-stripe"></div>
      <div class="inv-body">
        ${rows || `<div style="padding:20px 0;text-align:center;font-family:'Share Tech Mono',monospace;font-size:11px;color:#888">Load details not available</div>`}
        <div class="inv-total-row">
          <div class="inv-total-lbl">TOTAL DUE · ${invLoads.length || '?'} LOADS</div>
          <div class="inv-total-amt">${fmtMoney(inv.total)}</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('hist-inv-preview-body').innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn-full btn-blue" onclick="printInvoiceFromHistory()" style="flex:1">🖨 Print / Save PDF</button>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center">
      <button onclick="togglePaid('${inv.id}', ${inv.paid}); closeHistInvSheet();"
        style="flex:1;padding:13px;border-radius:10px;border:1px solid ${inv.paid ? 'var(--border)' : 'var(--green)'};background:${inv.paid ? 'transparent' : 'rgba(46,204,113,0.1)'};color:${inv.paid ? 'var(--gray)' : 'var(--green)'};font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;cursor:pointer;letter-spacing:0.5px">
        ${inv.paid ? 'Mark as Unpaid' : '✔ Mark as Paid'}
      </button>
      <div style="font-family:'Share Tech Mono',monospace;font-size:10px;text-align:right;color:${inv.paid ? 'var(--green)' : 'var(--red)'};white-space:nowrap">
        ${inv.paid ? '✔ PAID' : 'UNPAID'}
      </div>
    </div>
    ${previewHTML}
  `;

  document.getElementById('hist-inv-sheet-backdrop').classList.add('open');
};

window.printInvoiceFromHistory = function() {
  const inv = document.getElementById('hist-invoice-preview-content');
  if (!inv) return;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BM&C Invoice</title>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@400;600&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Barlow',sans-serif;background:white;padding:40px;max-width:760px;margin:0 auto}
    .inv-top{background:#023E8A;color:white;padding:32px;border-radius:8px 8px 0 0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .inv-top-logo{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:32px;margin-bottom:4px}
    .inv-stripe{height:5px;background:linear-gradient(90deg,#D62828 50%,#E9B930 50%);-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .inv-body{border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;padding:0 32px}
    .inv-row{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 0;border-bottom:1px solid #eee}
    .inv-row-route{font-weight:600;font-size:16px;color:#000;margin-bottom:4px}
    .inv-row-date{font-family:'Share Tech Mono',monospace;font-size:11px;color:#666}
    .inv-row-amt{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:24px;color:#023E8A}
    .inv-total-row{background:#023E8A;color:white;margin:0 -32px;padding:20px 32px;display:flex;justify-content:space-between;align-items:center;border-radius:0 0 8px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .inv-total-lbl{font-family:'Share Tech Mono',monospace;font-size:12px;opacity:0.7;letter-spacing:1px}
    .inv-total-amt{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:40px;color:#E9B930}
    .footer{margin-top:32px;text-align:center;font-size:12px;color:#aaa;font-family:'Share Tech Mono',monospace}
    button{display:none}
    @page{margin:0.5in;size:letter}
  </style></head><body>
  ${inv.outerHTML}
  <div class="footer">BM&C Enterprise LLC · General Freight Carrier · bmcenterprise73@gmail.com</div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
};

window.closeHistInvSheet = function() {
  document.getElementById('hist-inv-sheet-backdrop').classList.remove('open');
};
window.closeHistInvSheetIfBackdrop = function(e) {
  if (e.target === document.getElementById('hist-inv-sheet-backdrop')) window.closeHistInvSheet();
};

function renderInvoiceHistory() {
  const el = document.getElementById('invoice-history-list');
  if (!el) return;

  const totalOutstanding = invoices.filter(i => !i.paid).reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid = invoices.filter(i => i.paid).reduce((s, i) => s + (i.total || 0), 0);

  const summary = `<div class="receipt-summary-strip" style="margin-bottom:16px">
    <div class="stat-card gold"><div class="stat-label">Outstanding</div><div class="stat-value money" style="font-size:20px">${fmtMoney(totalOutstanding)}</div><div class="stat-sub">unpaid</div></div>
    <div class="stat-card"><div class="stat-label">Collected</div><div class="stat-value money" style="font-size:20px;color:var(--green)">${fmtMoney(totalPaid)}</div><div class="stat-sub">paid</div></div>
  </div>`;

  if (!invoices.length) {
    el.innerHTML = summary + `<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-title">No saved invoices</div><div class="empty-sub">Generate an invoice and tap Save Invoice to keep a record</div></div>`;
    return;
  }

  el.innerHTML = summary + invoices.map(inv => `
    <div class="load-card" style="border-left:4px solid ${inv.paid ? 'var(--green)' : 'var(--gold)'}">
      <div class="load-card-top" onclick="viewInvoiceFromHistory('${inv.id}')" style="cursor:pointer">
        <div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:20px">${inv.invNum}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--gray)">${inv.client} · ${fmtDate(inv.invDate)}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--gray)">${inv.period || ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:var(--gold)">${fmtMoney(inv.total)}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:${inv.paid ? 'var(--green)' : 'var(--red)'}">${inv.paid ? '✔ PAID' : 'UNPAID'}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--blue-mid);margin-top:4px;letter-spacing:0.5px">TAP TO VIEW ›</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button onclick="viewInvoiceFromHistory('${inv.id}')" style="flex:1;padding:11px;border-radius:8px;border:1px solid var(--blue-mid);background:transparent;color:#7AB3FF;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;cursor:pointer">🖨 View & Print</button>
        <button onclick="togglePaid('${inv.id}',${inv.paid})" style="flex:1;padding:11px;border-radius:8px;border:1px solid ${inv.paid ? 'var(--border)' : 'var(--green)'};background:transparent;color:${inv.paid ? 'var(--gray)' : 'var(--green)'};font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;cursor:pointer">
          ${inv.paid ? 'Mark Unpaid' : '✔ Mark Paid'}
        </button>
        <button onclick="deleteInvoice('${inv.id}')" style="padding:11px 16px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--red);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;cursor:pointer">✕</button>
      </div>
    </div>
  `).join('');
}

// ── PRINT
window.printInvoice = function() {
  const inv = document.getElementById('invoice-preview-content');
  if (!inv) return;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BM&C Invoice</title>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@400;600&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Barlow',sans-serif;background:white;padding:40px;max-width:760px;margin:0 auto}
    .inv-top{background:#023E8A;color:white;padding:32px;border-radius:8px 8px 0 0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .inv-top-logo{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:32px;margin-bottom:4px}
    .inv-stripe{height:5px;background:linear-gradient(90deg,#D62828 50%,#E9B930 50%);-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .inv-body{border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;padding:0 32px}
    .inv-row{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 0;border-bottom:1px solid #eee}
    .inv-row-route{font-weight:600;font-size:16px;color:#000;margin-bottom:4px}
    .inv-row-date{font-family:'Share Tech Mono',monospace;font-size:11px;color:#666}
    .inv-row-amt{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:24px;color:#023E8A}
    .inv-total-row{background:#023E8A;color:white;margin:0 -32px;padding:20px 32px;display:flex;justify-content:space-between;align-items:center;border-radius:0 0 8px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .inv-total-lbl{font-family:'Share Tech Mono',monospace;font-size:12px;opacity:0.7;letter-spacing:1px}
    .inv-total-amt{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:40px;color:#E9B930}
    .footer{margin-top:32px;text-align:center;font-size:12px;color:#aaa;font-family:'Share Tech Mono',monospace}
    @page{margin:0.5in;size:letter}
  </style></head><body>
  ${inv.outerHTML}
  <div class="footer">BM&C Enterprise LLC · General Freight Carrier · bmcenterprise73@gmail.com</div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
};

// ── RECEIPTS
window.handleReceiptUpload = async function(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    pendingReceiptImage = await compressImage(file, 900, 0.45);
    editingReceiptId = null;
    document.getElementById('r-date').value = today();
    ['r-amount', 'r-location', 'r-gallons', 'r-notes'].forEach(i => document.getElementById(i).value = '');

    const img = document.getElementById('receipt-preview-img');
    img.src = pendingReceiptImage;
    img.style.display = 'block';

    document.getElementById('delete-receipt-btn').style.display = 'none';
    document.getElementById('receipt-sheet-backdrop').classList.add('open');
  } catch (err) {
    console.error('Receipt image error:', err);
    showToast('Error reading receipt image', '#D62828');
  }

  e.target.value = '';
};

function compressImage(file, maxWidth = 1000, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };

      img.onerror = reject;
      img.src = e.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.handleBolUpload = async function(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    pendingBolImage = await compressImage(file, 1000, 0.55);
    showToast('BOL image ready');
  } catch (err) {
    console.error('BOL image error:', err);
    showToast('Error reading BOL image', '#D62828');
  }

  e.target.value = '';
};

window.handleRateUpload = async function(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    pendingRateImage = await compressImage(file, 1000, 0.55);
    showToast('Rate confirmation ready');
  } catch (err) {
    console.error('Rate image error:', err);
    showToast('Error reading rate image', '#D62828');
  }

  e.target.value = '';
};

window.openReceiptForEdit = function(id) {
  const r = receipts.find(r => r.id === id);
  if (!r) return;

  editingReceiptId = id;
  pendingReceiptImage = null;
  const img = document.getElementById('receipt-preview-img');

  if (r.imageData) {
    img.src = r.imageData;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }

  document.getElementById('r-date').value = r.date || today();
  document.getElementById('r-amount').value = r.amount || '';
  document.getElementById('r-location').value = r.location || '';
  document.getElementById('r-gallons').value = r.gallons || '';
  document.getElementById('r-notes').value = r.notes || '';
  document.getElementById('delete-receipt-btn').style.display = 'block';
  document.getElementById('receipt-sheet-backdrop').classList.add('open');
};

window.saveReceipt = function() {
  const data = {
    date: document.getElementById('r-date').value,
    amount: parseFloat(document.getElementById('r-amount').value) || 0,
    location: document.getElementById('r-location').value.trim(),
    gallons: parseFloat(document.getElementById('r-gallons').value) || 0,
    notes: document.getElementById('r-notes').value.trim(),
  };

  if (pendingReceiptImage) data.imageData = pendingReceiptImage;

  const p = editingReceiptId
    ? userColl('receipts').doc(editingReceiptId).update(data)
    : userColl('receipts').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

  p.then(() => {
    closeReceiptSheet();
    showToast('✔ Receipt saved!');
  }).catch((err) => {
    console.error('Receipt save error:', err);
    showToast('Error saving receipt', '#D62828');
  });
};

window.deleteReceipt = function() {
  if (!editingReceiptId || !confirm('Delete this receipt?')) return;
  userColl('receipts').doc(editingReceiptId).delete().then(() => {
    closeReceiptSheet();
    showToast('Receipt deleted', '#6B6B80');
  });
};

function closeReceiptSheet() {
  document.getElementById('receipt-sheet-backdrop').classList.remove('open');
  editingReceiptId = null;
  pendingReceiptImage = null;
}
window.closeReceiptSheet = closeReceiptSheet;
window.closeReceiptSheetIfBackdrop = e => {
  if (e.target === document.getElementById('receipt-sheet-backdrop')) closeReceiptSheet();
};
window.openFullscreen = src => {
  document.getElementById('receipt-fullscreen-img').src = src;
  document.getElementById('receipt-fullscreen').style.display = 'flex';
};
window.closeFullscreen = () => document.getElementById('receipt-fullscreen').style.display = 'none';

function renderReceipts() {
  const totalSpent = receipts.reduce((s, r) => s + (r.amount || 0), 0);
  const mo = new Date().toISOString().slice(0, 7);
  const monthSpent = receipts.filter(r => r.date && r.date.startsWith(mo)).reduce((s, r) => s + (r.amount || 0), 0);

  document.getElementById('receipt-total-label').textContent = receipts.length
    ? `${receipts.length} receipts · ${fmtMoney(totalSpent)}`
    : '';

  const gallery = document.getElementById('receipts-gallery');
  if (!receipts.length) {
    gallery.innerHTML = `<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-title">No receipts yet</div><div class="empty-sub">Tap above to photograph your first receipt</div></div>`;
    return;
  }

  gallery.innerHTML = `<div class="receipt-summary-strip">
    <div class="stat-card gold"><div class="stat-label">This Month</div><div class="stat-value money" style="font-size:22px">${fmtMoney(monthSpent)}</div><div class="stat-sub">gas expenses</div></div>
    <div class="stat-card"><div class="stat-label">All Time</div><div class="stat-value money" style="font-size:22px">${fmtMoney(totalSpent)}</div><div class="stat-sub">${receipts.length} receipt${receipts.length !== 1 ? 's' : ''}</div></div>
  </div>` + receipts.map(r => `
    <div class="receipt-card" onclick="openReceiptForEdit('${r.id}')">
      <div class="receipt-thumb">${r.imageData ? `<img src="${r.imageData}" alt="receipt" onclick="event.stopPropagation();openFullscreen('${r.imageData}')">` : '<div class="receipt-thumb-placeholder">⛽</div>'}</div>
      <div class="receipt-info">
        <div class="receipt-location">${r.location || 'Gas Station'}</div>
        <div class="receipt-meta">
          <span class="receipt-date">${fmtDate(r.date)}</span>
          ${r.gallons ? `<span class="receipt-gallons">${r.gallons} gal</span>` : ''}
        </div>
      </div>
      <div class="receipt-amount-badge">${r.amount ? fmtMoney(r.amount) : '—'}</div>
    </div>
  `).join('');
}

// ── MAINTENANCE
window.quickMaint = function(type) {
  openMaintSheet();
  document.getElementById('m-type').value = type;
  document.getElementById('maint-sheet-title').textContent = 'Log ' + type;
};

function openMaintSheet(id) {
  editingMaintId = id || null;
  pendingMaintPhoto = null;
  document.getElementById('maint-sheet-title').textContent = id ? 'Edit Record' : 'Log Service';
  document.getElementById('delete-maint-btn').style.display = id ? 'block' : 'none';
  document.getElementById('m-photo-preview-wrap').innerHTML = '<div class="upload-icon" style="font-size:24px">📸</div><div class="upload-text" style="font-size:14px">Tap to add photo</div>';

  if (id) {
    const r = maints.find(m => m.id === id);
    if (!r) return;
    document.getElementById('m-vehicle').value = r.vehicle || '';
    document.getElementById('m-type').value = r.type || 'Oil Change';
    document.getElementById('m-date').value = r.date || today();
    document.getElementById('m-cost').value = r.cost || '';
    document.getElementById('m-mileage').value = r.mileage || '';
    document.getElementById('m-shop').value = r.shop || '';
    document.getElementById('m-next').value = r.next || '';
    document.getElementById('m-notes').value = r.notes || '';
    if (r.photo) {
      document.getElementById('m-photo-preview-wrap').innerHTML = `<img src="${r.photo}" style="width:100%;border-radius:8px;max-height:160px;object-fit:cover">`;
      pendingMaintPhoto = r.photo;
    }
  } else {
    ['m-vehicle', 'm-cost', 'm-mileage', 'm-shop', 'm-next', 'm-notes'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('m-type').value = 'Oil Change';
    document.getElementById('m-date').value = today();
  }

  document.getElementById('maint-sheet-backdrop').classList.add('open');
}
window.openMaintSheet = openMaintSheet;

window.handleMaintPhoto = function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    pendingMaintPhoto = ev.target.result;
    document.getElementById('m-photo-preview-wrap').innerHTML = `<img src="${pendingMaintPhoto}" style="width:100%;border-radius:8px;max-height:160px;object-fit:cover">`;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
};

window.saveMaint = function() {
  const rec = {
    vehicle: document.getElementById('m-vehicle').value.trim(),
    type: document.getElementById('m-type').value,
    date: document.getElementById('m-date').value,
    cost: parseFloat(document.getElementById('m-cost').value) || 0,
    mileage: document.getElementById('m-mileage').value.trim(),
    shop: document.getElementById('m-shop').value.trim(),
    next: document.getElementById('m-next').value.trim(),
    notes: document.getElementById('m-notes').value.trim(),
  };

  if (pendingMaintPhoto) rec.photo = pendingMaintPhoto;
  if (!rec.date || !rec.type) {
    showToast('Date and service type required', '#D62828');
    return;
  }

  const p = editingMaintId
    ? userColl('maints').doc(editingMaintId).update(rec)
    : userColl('maints').add({ ...rec, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

  p.then(() => {
    closeMaintSheet();
    showToast('✔ Service record saved!');
  }).catch(() => showToast('Error saving', '#D62828'));
};

window.deleteMaint = function() {
  if (!editingMaintId || !confirm('Delete this record?')) return;
  userColl('maints').doc(editingMaintId).delete().then(() => {
    closeMaintSheet();
    showToast('Record deleted', '#6B6B80');
  });
};

function closeMaintSheet() {
  document.getElementById('maint-sheet-backdrop').classList.remove('open');
  editingMaintId = null;
  pendingMaintPhoto = null;
}
window.closeMaintSheet = closeMaintSheet;
window.closeMaintSheetIfBackdrop = e => {
  if (e.target === document.getElementById('maint-sheet-backdrop')) closeMaintSheet();
};

function renderMaintenance() {
  const totalCost = maints.reduce((s, m) => s + (m.cost || 0), 0);
  const mo = new Date().toISOString().slice(0, 7);
  const monthCost = maints.filter(m => m.date && m.date.startsWith(mo)).reduce((s, m) => s + (m.cost || 0), 0);

  document.getElementById('maint-total-label').textContent = maints.length
    ? `${maints.length} records · ${fmtMoney(totalCost)}`
    : '';

  document.getElementById('maint-stat-strip').innerHTML = `
    <div class="stat-card gold"><div class="stat-label">This Month</div><div class="stat-value money" style="font-size:22px">${fmtMoney(monthCost)}</div><div class="stat-sub">maintenance</div></div>
    <div class="stat-card accent"><div class="stat-label">All Time</div><div class="stat-value money" style="font-size:22px">${fmtMoney(totalCost)}</div><div class="stat-sub">${maints.length} service${maints.length !== 1 ? 's' : ''}</div></div>
  `;

  const list = document.getElementById('maint-list');
  if (!maints.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔧</div><div class="empty-title">No records yet</div><div class="empty-sub">Use Quick Log above to get started</div></div>`;
    return;
  }

  list.innerHTML = maints.map(m => `
    <div class="maint-card" data-type="${m.type}" onclick="openMaintSheet('${m.id}')">
      <div class="maint-vehicle">${m.vehicle || 'Vehicle'}</div>
      <div class="maint-card-top"><div class="maint-type">${m.type}</div><div class="maint-cost">${m.cost ? fmtMoney(m.cost) : '—'}</div></div>
      <div class="maint-meta">
        <span class="maint-date">${fmtDate(m.date)}</span>
        ${m.mileage ? `<span class="maint-mileage">📍 ${Number(m.mileage).toLocaleString()} mi</span>` : ''}
        ${m.shop ? `<span class="maint-shop">${m.shop}</span>` : ''}
        ${m.photo ? `<span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--gray)">📷 photo</span>` : ''}
      </div>
      ${m.next ? `<div class="maint-next-due">⏰ Next: ${m.next}</div>` : ''}
    </div>
  `).join('');
}
