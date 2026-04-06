// BM&C Enterprise LLC - Firebase App Logic
// Uses Firebase compat SDK (loaded via script tags in HTML)

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

// ── STATE
let loads = [], receipts = [], maints = [];
let currentUser = null;
let activeFilter = 'all';
let editingReceiptId = null, pendingReceiptImage = null;
let editingMaintId = null, pendingMaintPhoto = null;
let unsubLoads, unsubReceipts, unsubMaints;

// ── AUTH
// Handle redirect result on page load
firebase.auth().getRedirectResult().then(result => {
  if (result && result.user) {
    console.log('Redirect success:', result.user.email);
  }
}).catch(e => {
  console.error('Redirect error:', e.code, e.message);
});

// Watch for auth state changes
firebase.auth().onAuthStateChanged(user => {
  document.getElementById('loading-overlay').style.display = 'none';
  if (user) {
    currentUser = user;
    showApp(user);
    subscribeToData();
  } else {
    currentUser = null;
    showLogin();
    [unsubLoads, unsubReceipts, unsubMaints].forEach(u => u && u());
  }
});

window.signInWithGoogle = function() {
  const btn = document.querySelector('.btn-google');
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: 'bmcenterprise73@gmail.com' });

  // Try popup first, fall back to redirect if blocked
  firebase.auth().signInWithPopup(provider).then(result => {
    console.log('Popup sign-in success');
  }).catch(e => {
    console.log('Popup blocked, trying redirect:', e.code);
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      if (btn) { btn.innerHTML = '<span>Redirecting to Google…</span>'; btn.style.opacity = '0.7'; }
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
  document.getElementById('app-header').style.display = 'none';
  document.getElementById('scroll-area').style.display = 'none';
  document.getElementById('fab').style.display = 'none';
  document.getElementById('bottom-nav').style.display = 'none';
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
  document.getElementById('inv-num').value = 'BM&C-001';
  renderDash(); renderLoads(); renderReceipts(); renderMaintenance();
}

// ── FIRESTORE
function userColl(name) { return db.collection('users').doc(currentUser.uid).collection(name); }

function subscribeToData() {
  unsubLoads = userColl('loads').orderBy('createdAt','desc').onSnapshot(snap => {
    loads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDash(); renderLoads();
    document.getElementById('inv-num').value = 'BM&C-' + String(loads.length + 1).padStart(3,'0');
  });
  unsubReceipts = userColl('receipts').orderBy('createdAt','desc').onSnapshot(snap => {
    receipts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderReceipts();
  });
  unsubMaints = userColl('maints').orderBy('createdAt','desc').onSnapshot(snap => {
    maints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMaintenance();
  });
}

// ── HELPERS
function toISO(d) { return d.toISOString().split('T')[0]; }
function today() { return toISO(new Date()); }
function fmtDate(s) { if (!s) return '—'; const [y,m,d] = s.split('-'); return `${m}/${d}/${y}`; }
function fmtMoney(n) { return '$' + Number(n).toLocaleString('en-US',{minimumFractionDigits:2}); }

function showToast(msg, bg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.background = bg || '#2ECC71'; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2500);
}

window.toggleSignoutMenu = () => document.getElementById('signout-menu').classList.toggle('open');
document.addEventListener('click', e => {
  if (!e.target.closest('#signout-menu') && !e.target.closest('#user-avatar'))
    document.getElementById('signout-menu').classList.remove('open');
});

// ── TABS
window.switchTab = function(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-'+id).classList.add('active');
  document.getElementById('nav-'+id).classList.add('active');
  document.getElementById('fab').style.display = ['invoice','receipts','maintenance'].includes(id) ? 'none' : 'flex';
  document.getElementById('scroll-area').scrollTop = 0;
};

// ── SHEET
window.openSheet = function() {
  document.getElementById('f-date').value = today();
  ['f-from','f-to','f-miles','f-amount','f-client','f-bol','f-notes'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('f-type').value = 'one-way';
  document.getElementById('sheet-backdrop').classList.add('open');
};
window.closeSheet = () => document.getElementById('sheet-backdrop').classList.remove('open');
window.closeSheetIfBackdrop = e => { if (e.target === document.getElementById('sheet-backdrop')) window.closeSheet(); };

// ── ADD LOAD
window.addLoad = function() {
  const load = {
    date: document.getElementById('f-date').value,
    type: document.getElementById('f-type').value,
    from: document.getElementById('f-from').value.trim(),
    to: document.getElementById('f-to').value.trim(),
    miles: parseFloat(document.getElementById('f-miles').value) || 0,
    amount: parseFloat(document.getElementById('f-amount').value) || 0,
    client: document.getElementById('f-client').value.trim(),
    bol: document.getElementById('f-bol').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (!load.date || !load.from || !load.to || !load.amount) { showToast('Fill in Date, From, To & Amount','#D62828'); return; }
  userColl('loads').add(load).then(() => { window.closeSheet(); showToast('✔ Load saved!'); }).catch(() => showToast('Error saving','#D62828'));
};

window.deleteLoad = function(id) {
  if (!confirm('Delete this load?')) return;
  userColl('loads').doc(id).delete().then(() => showToast('Load deleted','#6B6B80'));
};

// ── DASHBOARD
function renderDash() {
  const mo = new Date().toISOString().slice(0,7);
  const thisMonth = loads.filter(l => l.date && l.date.startsWith(mo));
  const totalEarned = loads.reduce((s,l) => s+(l.amount||0), 0);
  const monthEarned = thisMonth.reduce((s,l) => s+(l.amount||0), 0);
  const totalMiles  = loads.reduce((s,l) => s+(l.miles||0), 0);
  document.getElementById('stat-strip').innerHTML = `
    <div class="stat-card gold"><div class="stat-label">This Month</div><div class="stat-value money">${fmtMoney(monthEarned)}</div><div class="stat-sub">${thisMonth.length} load${thisMonth.length!==1?'s':''}</div></div>
    <div class="stat-card accent"><div class="stat-label">Total Earned</div><div class="stat-value money">${fmtMoney(totalEarned)}</div><div class="stat-sub">${loads.length} loads total</div></div>
    <div class="stat-card wide"><div class="stat-label">Total Miles</div><div class="stat-value">${totalMiles.toLocaleString()}<span style="font-size:16px;font-weight:400;color:var(--gray)"> mi</span></div></div>`;
  const el = document.getElementById('dash-loads');
  const recent = loads.slice(0,8);
  el.innerHTML = recent.length ? recent.map(l => loadCard(l,false)).join('') :
    `<div class="empty-state"><div class="empty-icon">🚛</div><div class="empty-title">No loads yet</div><div class="empty-sub">Tap + to log your first run</div></div>`;
}

// ── LOADS
window.setFilter = function(val, el) {
  activeFilter = val;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderLoads();
};

function renderLoads() {
  const search = (document.getElementById('search-input').value||'').toLowerCase();
  const monthF = document.getElementById('filter-month').value;
  let filtered = loads.filter(l => {
    const ms = !search || [l.from,l.to,l.client,l.bol,l.notes].join(' ').toLowerCase().includes(search);
    const mt = activeFilter==='all' || l.type===activeFilter;
    const mm = !monthF || (l.date && l.date.startsWith(monthF));
    return ms && mt && mm;
  });
  document.getElementById('loads-count').textContent = `${filtered.length} Load${filtered.length!==1?'s':''}`;
  const el = document.getElementById('all-loads');
  el.innerHTML = filtered.length ? filtered.map(l => loadCard(l,true)).join('') :
    `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No loads found</div><div class="empty-sub">Try changing your filters</div></div>`;
}
window.renderLoads = renderLoads;

function loadCard(l, showDelete) {
  return `<div class="load-card">
    <div class="load-card-top">
      <div class="load-route">${l.from}<span class="arrow">→</span>${l.to}</div>
      <div class="load-amount">${fmtMoney(l.amount)}</div>
    </div>
    <div class="load-meta">
      <span class="load-date">${fmtDate(l.date)}</span>
      ${l.miles?`<span class="load-miles">${l.miles.toLocaleString()} mi</span>`:''}
      <span class="badge ${l.type==='round-trip'?'badge-round':'badge-one'}">${l.type}</span>
      ${l.client?`<span class="load-client">${l.client}</span>`:''}
      ${showDelete?`<button onclick="deleteLoad('${l.id}')" style="margin-left:auto;background:transparent;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:0 4px">✕</button>`:''}
    </div></div>`;
}

window.exportCSV = function() {
  const headers = ['Date','From','To','Client','BOL','Miles','Amount','Type','Notes'];
  const rows = loads.map(l => [l.date,l.from,l.to,l.client,l.bol,l.miles,l.amount,l.type,l.notes].map(v=>`"${v||''}"`).join(','));
  const csv = [headers.join(','),...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download = 'BMC_Loads_'+today()+'.csv'; a.click();
};

// ── INVOICE
window.generateInvoice = function() {
  const client = document.getElementById('inv-client').value.trim()||'Client';
  const invNum = document.getElementById('inv-num').value.trim()||'BM&C-001';
  const invDate = document.getElementById('inv-date').value;
  const start = document.getElementById('inv-start').value;
  const end = document.getElementById('inv-end').value;
  let sel = [...loads];
  if (start) sel = sel.filter(l => l.date >= start);
  if (end)   sel = sel.filter(l => l.date <= end);
  if (client!=='Client') sel = sel.filter(l => l.client&&l.client.toLowerCase().includes(client.toLowerCase()));
  const out = document.getElementById('invoice-out');
  if (!sel.length) { out.innerHTML=`<p style="color:var(--gray);font-family:'Share Tech Mono',monospace;font-size:12px;padding:16px 0">No loads match — check filters.</p>`; return; }
  const total = sel.reduce((s,l) => s+l.amount, 0);
  const rows = sel.map(l=>`<div class="inv-row"><div class="inv-row-left"><div class="inv-row-route">${l.from} → ${l.to}</div><div class="inv-row-date">${fmtDate(l.date)}${l.bol?' · BOL '+l.bol:''}</div></div><div class="inv-row-amt">${fmtMoney(l.amount)}</div></div>`).join('');
  out.innerHTML = `
    <button class="btn-outline" onclick="window.print()" style="margin-bottom:12px;width:100%">🖨 Print / Save PDF</button>
    <div class="invoice-preview">
      <div class="inv-top">
        <div class="inv-top-logo">BM&amp;C Enterprise LLC</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;opacity:0.6;margin-top:4px">GENERAL FREIGHT CARRIER</div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end">
          <div><div style="font-family:'Share Tech Mono',monospace;font-size:9px;opacity:0.5;letter-spacing:1px">INVOICE</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800">${invNum}</div></div>
          <div style="text-align:right;font-family:'Share Tech Mono',monospace;font-size:10px;opacity:0.6">${fmtDate(invDate)}<br>Bill To: ${client}</div>
        </div>
      </div>
      <div class="inv-stripe"></div>
      <div class="inv-body">${rows}
        <div class="inv-total-row"><div class="inv-total-lbl">TOTAL DUE · ${sel.length} LOADS</div><div class="inv-total-amt">${fmtMoney(total)}</div></div>
      </div>
    </div>`;
};

// ── RECEIPTS
window.handleReceiptUpload = function(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    pendingReceiptImage = ev.target.result;
    editingReceiptId = null;
    document.getElementById('r-date').value = today();
    ['r-amount','r-location','r-gallons','r-notes'].forEach(i => document.getElementById(i).value='');
    const img = document.getElementById('receipt-preview-img');
    img.src = pendingReceiptImage; img.style.display = 'block';
    document.getElementById('delete-receipt-btn').style.display = 'none';
    document.getElementById('receipt-sheet-backdrop').classList.add('open');
  };
  reader.readAsDataURL(file); e.target.value='';
};

window.openReceiptForEdit = function(id) {
  const r = receipts.find(r => r.id===id); if (!r) return;
  editingReceiptId = id; pendingReceiptImage = null;
  const img = document.getElementById('receipt-preview-img');
  if (r.imageData) { img.src = r.imageData; img.style.display='block'; } else { img.style.display='none'; }
  document.getElementById('r-date').value = r.date||today();
  document.getElementById('r-amount').value = r.amount||'';
  document.getElementById('r-location').value = r.location||'';
  document.getElementById('r-gallons').value = r.gallons||'';
  document.getElementById('r-notes').value = r.notes||'';
  document.getElementById('delete-receipt-btn').style.display = 'block';
  document.getElementById('receipt-sheet-backdrop').classList.add('open');
};

window.saveReceipt = function() {
  const data = {
    date: document.getElementById('r-date').value,
    amount: parseFloat(document.getElementById('r-amount').value)||0,
    location: document.getElementById('r-location').value.trim(),
    gallons: parseFloat(document.getElementById('r-gallons').value)||0,
    notes: document.getElementById('r-notes').value.trim(),
  };
  if (pendingReceiptImage) data.imageData = pendingReceiptImage;
  const p = editingReceiptId
    ? userColl('receipts').doc(editingReceiptId).update(data)
    : userColl('receipts').add({...data, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
  p.then(() => { closeReceiptSheet(); showToast('✔ Receipt saved!'); }).catch(() => showToast('Error saving','#D62828'));
};

window.deleteReceipt = function() {
  if (!editingReceiptId||!confirm('Delete this receipt?')) return;
  userColl('receipts').doc(editingReceiptId).delete().then(() => { closeReceiptSheet(); showToast('Receipt deleted','#6B6B80'); });
};

function closeReceiptSheet() {
  document.getElementById('receipt-sheet-backdrop').classList.remove('open');
  editingReceiptId = null; pendingReceiptImage = null;
}
window.closeReceiptSheet = closeReceiptSheet;
window.closeReceiptSheetIfBackdrop = e => { if (e.target===document.getElementById('receipt-sheet-backdrop')) closeReceiptSheet(); };
window.openFullscreen = src => { document.getElementById('receipt-fullscreen-img').src=src; document.getElementById('receipt-fullscreen').style.display='flex'; };
window.closeFullscreen = () => document.getElementById('receipt-fullscreen').style.display='none';

function renderReceipts() {
  const totalSpent = receipts.reduce((s,r) => s+(r.amount||0), 0);
  const mo = new Date().toISOString().slice(0,7);
  const monthSpent = receipts.filter(r=>r.date&&r.date.startsWith(mo)).reduce((s,r)=>s+(r.amount||0),0);
  document.getElementById('receipt-total-label').textContent = receipts.length?`${receipts.length} receipts · ${fmtMoney(totalSpent)}`:'';
  const gallery = document.getElementById('receipts-gallery');
  if (!receipts.length) { gallery.innerHTML=`<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-title">No receipts yet</div><div class="empty-sub">Tap above to photograph your first receipt</div></div>`; return; }
  gallery.innerHTML = `<div class="receipt-summary-strip">
    <div class="stat-card gold"><div class="stat-label">This Month</div><div class="stat-value money" style="font-size:22px">${fmtMoney(monthSpent)}</div><div class="stat-sub">gas expenses</div></div>
    <div class="stat-card"><div class="stat-label">All Time</div><div class="stat-value money" style="font-size:22px">${fmtMoney(totalSpent)}</div><div class="stat-sub">${receipts.length} receipt${receipts.length!==1?'s':''}</div></div>
  </div>` + receipts.map(r=>`
    <div class="receipt-card" onclick="openReceiptForEdit('${r.id}')">
      <div class="receipt-thumb">${r.imageData?`<img src="${r.imageData}" alt="receipt" onclick="event.stopPropagation();openFullscreen('${r.imageData}')">` :'<div class="receipt-thumb-placeholder">⛽</div>'}</div>
      <div class="receipt-info"><div class="receipt-location">${r.location||'Gas Station'}</div>
        <div class="receipt-meta"><span class="receipt-date">${fmtDate(r.date)}</span>${r.gallons?`<span class="receipt-gallons">${r.gallons} gal</span>`:''}</div>
      </div><div class="receipt-amount-badge">${r.amount?fmtMoney(r.amount):'—'}</div>
    </div>`).join('');
}

// ── MAINTENANCE
window.quickMaint = function(type) { openMaintSheet(); document.getElementById('m-type').value=type; document.getElementById('maint-sheet-title').textContent='Log '+type; };

function openMaintSheet(id) {
  editingMaintId = id||null; pendingMaintPhoto = null;
  document.getElementById('maint-sheet-title').textContent = id?'Edit Record':'Log Service';
  document.getElementById('delete-maint-btn').style.display = id?'block':'none';
  document.getElementById('m-photo-preview-wrap').innerHTML = '<div class="upload-icon" style="font-size:24px">📸</div><div class="upload-text" style="font-size:14px">Tap to add photo</div>';
  if (id) {
    const r = maints.find(m=>m.id===id); if (!r) return;
    document.getElementById('m-vehicle').value=r.vehicle||'';
    document.getElementById('m-type').value=r.type||'Oil Change';
    document.getElementById('m-date').value=r.date||today();
    document.getElementById('m-cost').value=r.cost||'';
    document.getElementById('m-mileage').value=r.mileage||'';
    document.getElementById('m-shop').value=r.shop||'';
    document.getElementById('m-next').value=r.next||'';
    document.getElementById('m-notes').value=r.notes||'';
    if (r.photo) { document.getElementById('m-photo-preview-wrap').innerHTML=`<img src="${r.photo}" style="width:100%;border-radius:8px;max-height:160px;object-fit:cover">`; pendingMaintPhoto=r.photo; }
  } else {
    ['m-vehicle','m-cost','m-mileage','m-shop','m-next','m-notes'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('m-type').value='Oil Change';
    document.getElementById('m-date').value=today();
  }
  document.getElementById('maint-sheet-backdrop').classList.add('open');
}
window.openMaintSheet = openMaintSheet;

window.handleMaintPhoto = function(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { pendingMaintPhoto=ev.target.result; document.getElementById('m-photo-preview-wrap').innerHTML=`<img src="${pendingMaintPhoto}" style="width:100%;border-radius:8px;max-height:160px;object-fit:cover">`; };
  reader.readAsDataURL(file); e.target.value='';
};

window.saveMaint = function() {
  const rec = {
    vehicle: document.getElementById('m-vehicle').value.trim(),
    type: document.getElementById('m-type').value,
    date: document.getElementById('m-date').value,
    cost: parseFloat(document.getElementById('m-cost').value)||0,
    mileage: document.getElementById('m-mileage').value.trim(),
    shop: document.getElementById('m-shop').value.trim(),
    next: document.getElementById('m-next').value.trim(),
    notes: document.getElementById('m-notes').value.trim(),
  };
  if (pendingMaintPhoto) rec.photo = pendingMaintPhoto;
  if (!rec.date||!rec.type) { showToast('Date and service type required','#D62828'); return; }
  const p = editingMaintId
    ? userColl('maints').doc(editingMaintId).update(rec)
    : userColl('maints').add({...rec, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
  p.then(() => { closeMaintSheet(); showToast('✔ Service record saved!'); }).catch(() => showToast('Error saving','#D62828'));
};

window.deleteMaint = function() {
  if (!editingMaintId||!confirm('Delete this record?')) return;
  userColl('maints').doc(editingMaintId).delete().then(() => { closeMaintSheet(); showToast('Record deleted','#6B6B80'); });
};

function closeMaintSheet() { document.getElementById('maint-sheet-backdrop').classList.remove('open'); editingMaintId=null; pendingMaintPhoto=null; }
window.closeMaintSheet = closeMaintSheet;
window.closeMaintSheetIfBackdrop = e => { if (e.target===document.getElementById('maint-sheet-backdrop')) closeMaintSheet(); };

function renderMaintenance() {
  const totalCost = maints.reduce((s,m)=>s+(m.cost||0),0);
  const mo = new Date().toISOString().slice(0,7);
  const monthCost = maints.filter(m=>m.date&&m.date.startsWith(mo)).reduce((s,m)=>s+(m.cost||0),0);
  document.getElementById('maint-total-label').textContent = maints.length?`${maints.length} records · ${fmtMoney(totalCost)}`:'';
  document.getElementById('maint-stat-strip').innerHTML = `
    <div class="stat-card gold"><div class="stat-label">This Month</div><div class="stat-value money" style="font-size:22px">${fmtMoney(monthCost)}</div><div class="stat-sub">maintenance</div></div>
    <div class="stat-card accent"><div class="stat-label">All Time</div><div class="stat-value money" style="font-size:22px">${fmtMoney(totalCost)}</div><div class="stat-sub">${maints.length} service${maints.length!==1?'s':''}</div></div>`;
  const list = document.getElementById('maint-list');
  if (!maints.length) { list.innerHTML=`<div class="empty-state"><div class="empty-icon">🔧</div><div class="empty-title">No records yet</div><div class="empty-sub">Use Quick Log above to get started</div></div>`; return; }
  list.innerHTML = maints.map(m=>`
    <div class="maint-card" data-type="${m.type}" onclick="openMaintSheet('${m.id}')">
      <div class="maint-vehicle">${m.vehicle||'Vehicle'}</div>
      <div class="maint-card-top"><div class="maint-type">${m.type}</div><div class="maint-cost">${m.cost?fmtMoney(m.cost):'—'}</div></div>
      <div class="maint-meta">
        <span class="maint-date">${fmtDate(m.date)}</span>
        ${m.mileage?`<span class="maint-mileage">📍 ${Number(m.mileage).toLocaleString()} mi</span>`:''}
        ${m.shop?`<span class="maint-shop">${m.shop}</span>`:''}
        ${m.photo?`<span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--gray)">📷 photo</span>`:''}
      </div>
      ${m.next?`<div class="maint-next-due">⏰ Next: ${m.next}</div>`:''}
    </div>`).join('');
}
