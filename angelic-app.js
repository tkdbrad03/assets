// Angelic Transportation - Firebase App Logic

const firebaseConfig = {
  apiKey: "AIzaSyBO_Etup_AMotRENFpqcDof1BqWR2hegDM",
  authDomain: "angelic-transportation.firebaseapp.com",
  databaseURL: "https://angelic-transportation-default-rtdb.firebaseio.com",
  projectId: "angelic-transportation",
  storageBucket: "angelic-transportation.firebasestorage.app",
  messagingSenderId: "113102403922",
  appId: "1:113102403922:web:d89e3baa41c0cc7492628b"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ── CONSTANTS
const VEHICLES = ['Honda Mini-Van', 'Ford Transit Bus', 'Ford Transit Wheelchair Van (Cutaway)'];
const DRIVERS = [
  { name: 'Catrina Lynn Smith', status: 'compliant' },
  { name: 'Gregory Lee Ellis', status: 'compliant' },
  { name: 'Robert Lee Davidson', status: 'compliant' },
  { name: 'Samuel Decator Wray', status: 'compliant' },
  { name: 'Sharon Harris', status: 'not-compliant' },
  { name: 'Steven Lamar Palmer', status: 'compliant' },
  { name: 'Tawan Smith-Ellis', status: 'compliant' },
];

// ── STATE
let fuels = [], mileages = [], maints = [], receipts = [];
let currentUser = null;
let editingFuelId = null, editingMileageId = null, editingMaintId = null, editingReceiptId = null;
let pendingReceiptImage = null;
let unsubFuels, unsubMileages, unsubMaints, unsubReceipts;

// ── AUTH
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
    [unsubFuels, unsubMileages, unsubMaints].forEach(u => u && u());
  }
});

window.signInWithGoogle = function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: 'angelictransportation13@gmail.com' });
  firebase.auth().signInWithPopup(provider)
    .catch(e => {
      if (['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(e.code)) {
        const btn = document.querySelector('.btn-google');
        if (btn) { btn.innerHTML = '<span>Redirecting to Google…</span>'; btn.style.opacity = '0.7'; }
        firebase.auth().signInWithRedirect(provider);
      } else showToast('Sign in failed: ' + e.code, '#C0392B');
    });
};

window.signOut = function() {
  firebase.auth().signOut();
  document.getElementById('signout-menu').classList.remove('open');
};

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  ['app-header','scroll-area','bottom-nav'].forEach(id => document.getElementById(id).style.display = 'none');
}

function showApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('scroll-area').style.display = 'block';
  document.getElementById('bottom-nav').style.display = 'flex';
  const av = document.getElementById('user-avatar');
  if (user.photoURL) {
    av.outerHTML = `<img src="${user.photoURL}" class="user-avatar" id="user-avatar" onclick="toggleSignoutMenu()" alt="avatar">`;
  } else {
    av.textContent = (user.displayName || user.email || 'A')[0].toUpperCase();
  }
  document.getElementById('signout-user-email').textContent = user.email || '';
  setTodayDefaults();
  renderDrivers();
}

function setTodayDefaults() {
  ['fuel-date','mi-date','maint-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = toISO(new Date());
  });
}

// ── FIRESTORE
function userColl(name) { return db.collection('angelic').doc(currentUser.uid).collection(name); }

function subscribeToData() {
  unsubFuels = userColl('fuel').orderBy('createdAt','desc').onSnapshot(snap => {
    fuels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDash(); renderFuelLog();
  });
  unsubMileages = userColl('mileage').orderBy('date','desc').onSnapshot(snap => {
    mileages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDash(); renderMileageLog();
  });
  unsubMaints = userColl('maints').orderBy('createdAt','desc').onSnapshot(snap => {
    maints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMaintenance();
  });
  unsubReceipts = userColl('receipts').orderBy('createdAt','desc').onSnapshot(snap => {
    receipts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderReceipts();
  });
}

// ── HELPERS
function toISO(d) { return d.toISOString().split('T')[0]; }
function today() { return toISO(new Date()); }
function fmtDate(s) { if (!s) return '—'; const [y,m,d] = s.split('-'); return `${m}/${d}/${y}`; }
function fmtMoney(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 }); }
function thisWeekStart() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay());
  return toISO(d);
}

function showToast(msg, bg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.background = bg || '#27AE60'; t.style.display = 'block';
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
  document.getElementById('panel-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  document.getElementById('scroll-area').scrollTop = 0;
};

// ── SHEET HELPERS
function openSheet(id) { document.getElementById(id).classList.add('open'); }
function closeSheet(id) { document.getElementById(id).classList.remove('open'); }
function sheetBackdrop(e, id) { if (e.target === document.getElementById(id)) closeSheet(id); }

// ── DASHBOARD
function renderDash() {
  const ws = thisWeekStart();
  const weekFuels = fuels.filter(f => f.date >= ws);
  const weekSpend = weekFuels.reduce((s, f) => s + (f.amount || 0), 0);

  // Per vehicle this week
  const byVehicle = {};
  VEHICLES.forEach(v => byVehicle[v] = { fuel: 0, miles: 0 });
  weekFuels.forEach(f => { if (byVehicle[f.vehicle]) byVehicle[f.vehicle].fuel += f.amount || 0; });
  mileages.filter(m => m.date >= ws).forEach(m => { if (byVehicle[m.vehicle]) byVehicle[m.vehicle].miles += m.total || 0; });

  const totalMilesAllTime = mileages.reduce((s, m) => s + (m.total || 0), 0);
  const totalFuelAllTime = fuels.reduce((s, f) => s + (f.amount || 0), 0);

  document.getElementById('stat-strip').innerHTML = `
    <div class="stat-card gold">
      <div class="stat-label">This Week Fuel</div>
      <div class="stat-value money">${fmtMoney(weekSpend)}</div>
      <div class="stat-sub">${weekFuels.length} fill-up${weekFuels.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-label">Total Fuel Spend</div>
      <div class="stat-value money">${fmtMoney(totalFuelAllTime)}</div>
      <div class="stat-sub">all time</div>
    </div>
    <div class="stat-card wide">
      <div class="stat-label">Total Miles — All Vehicles</div>
      <div class="stat-value">${totalMilesAllTime.toLocaleString()}<span style="font-size:16px;font-weight:400;color:var(--gray)"> mi</span></div>
    </div>`;

  // Vehicle breakdown cards
  const vCards = VEHICLES.map(v => `
    <div class="vehicle-card">
      <div class="vehicle-name">${v}</div>
      <div class="vehicle-stats">
        <div><div class="stat-label">Week Fuel</div><div class="vehicle-stat-val">${fmtMoney(byVehicle[v].fuel)}</div></div>
        <div><div class="stat-label">Week Miles</div><div class="vehicle-stat-val">${byVehicle[v].miles.toLocaleString()}</div></div>
      </div>
    </div>`).join('');

  document.getElementById('vehicle-strip').innerHTML = vCards;

  // Recent fuel
  const recent = fuels.slice(0, 5);
  document.getElementById('dash-recent').innerHTML = recent.length ? recent.map(f => fuelCard(f)).join('') :
    `<div class="empty-state"><div class="empty-icon">⛽</div><div class="empty-title">No fuel logged yet</div><div class="empty-sub">Tap Fuel Log to add your first entry</div></div>`;
}

// ── FUEL LOG
window.openFuelSheet = function(id) {
  editingFuelId = id || null;
  const isEdit = !!id;
  document.getElementById('fuel-sheet-title').textContent = isEdit ? 'Edit Fuel Entry' : 'Log Fuel';
  document.getElementById('delete-fuel-btn').style.display = isEdit ? 'block' : 'none';
  if (isEdit) {
    const f = fuels.find(f => f.id === id); if (!f) return;
    document.getElementById('fuel-date').value = f.date || today();
    document.getElementById('fuel-driver').value = f.driver || '';
    document.getElementById('fuel-vehicle').value = f.vehicle || '';
    document.getElementById('fuel-station').value = f.station || '';
    document.getElementById('fuel-amount').value = f.amount || '';
    document.getElementById('fuel-gallons').value = f.gallons || '';
    document.getElementById('fuel-payment').value = f.payment || 'Card - 6027';
    document.getElementById('fuel-notes').value = f.notes || '';
  } else {
    document.getElementById('fuel-date').value = today();
    ['fuel-station','fuel-amount','fuel-gallons','fuel-notes'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('fuel-driver').value = '';
    document.getElementById('fuel-vehicle').value = '';
    document.getElementById('fuel-payment').value = 'Card - 6027';
  }
  openSheet('fuel-sheet-backdrop');
};

window.saveFuel = function() {
  const rec = {
    date: document.getElementById('fuel-date').value,
    driver: document.getElementById('fuel-driver').value,
    vehicle: document.getElementById('fuel-vehicle').value,
    station: document.getElementById('fuel-station').value.trim(),
    amount: parseFloat(document.getElementById('fuel-amount').value) || 0,
    gallons: parseFloat(document.getElementById('fuel-gallons').value) || 0,
    payment: document.getElementById('fuel-payment').value,
    notes: document.getElementById('fuel-notes').value.trim(),
  };
  if (!rec.date || !rec.vehicle || !rec.amount) { showToast('Date, Vehicle & Amount required', '#C0392B'); return; }
  const p = editingFuelId
    ? userColl('fuel').doc(editingFuelId).update(rec)
    : userColl('fuel').add({ ...rec, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  p.then(() => { closeSheet('fuel-sheet-backdrop'); showToast('✔ Fuel entry saved!'); })
   .catch(() => showToast('Error saving', '#C0392B'));
};

window.deleteFuel = function() {
  if (!editingFuelId || !confirm('Delete this fuel entry?')) return;
  userColl('fuel').doc(editingFuelId).delete().then(() => { closeSheet('fuel-sheet-backdrop'); showToast('Entry deleted', '#888'); });
};

function fuelCard(f) {
  return `<div class="fuel-card" onclick="openFuelSheet('${f.id}')">
    <div class="fuel-card-top">
      <div>
        <div class="fuel-vehicle-name">${f.vehicle || '—'}</div>
        <div class="fuel-meta">
          <span class="fuel-date">${fmtDate(f.date)}</span>
          ${f.driver ? `<span class="fuel-driver">${f.driver.split(' ')[0]}</span>` : ''}
          ${f.station ? `<span class="fuel-station">${f.station}</span>` : ''}
        </div>
        <div class="fuel-meta" style="margin-top:4px">
          ${f.gallons ? `<span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--gray)">${f.gallons} gal</span>` : ''}
          <span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--gray)">${f.payment || ''}</span>
        </div>
      </div>
      <div class="fuel-amount">${fmtMoney(f.amount)}</div>
    </div>
  </div>`;
}

function renderFuelLog() {
  const filterV = document.getElementById('fuel-filter-vehicle') ? document.getElementById('fuel-filter-vehicle').value : '';
  const filterM = document.getElementById('fuel-filter-month') ? document.getElementById('fuel-filter-month').value : '';
  let filtered = fuels.filter(f => {
    const mv = !filterV || f.vehicle === filterV;
    const mm = !filterM || (f.date && f.date.startsWith(filterM));
    return mv && mm;
  });
  const total = filtered.reduce((s, f) => s + (f.amount || 0), 0);
  document.getElementById('fuel-count').textContent = `${filtered.length} entries · ${fmtMoney(total)}`;
  const el = document.getElementById('fuel-list');
  el.innerHTML = filtered.length ? filtered.map(f => fuelCard(f)).join('') :
    `<div class="empty-state"><div class="empty-icon">⛽</div><div class="empty-title">No fuel entries</div><div class="empty-sub">Tap + to log a fill-up</div></div>`;
}
window.renderFuelLog = renderFuelLog;

window.exportFuelCSV = function() {
  if (!fuels.length) { showToast('No fuel entries yet', '#C0392B'); return; }
  const headers = ['Date','Driver','Vehicle','Station','Amount','Gallons','Payment','Notes'];
  const rows = fuels.slice().sort((a,b)=>a.date>b.date?1:-1).map(f =>
    [f.date,f.driver,f.vehicle,f.station,f.amount,f.gallons,f.payment,f.notes].map(v=>`"${v||''}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'Angelic_Fuel_Log_' + today() + '.csv'; a.click();
};

// ── MILEAGE LOG
window.openMileageSheet = function(id) {
  editingMileageId = id || null;
  const isEdit = !!id;
  document.getElementById('mi-sheet-title').textContent = isEdit ? 'Edit Mileage' : 'Log Daily Mileage';
  document.getElementById('delete-mi-btn').style.display = isEdit ? 'block' : 'none';
  if (isEdit) {
    const m = mileages.find(m => m.id === id); if (!m) return;
    document.getElementById('mi-date').value = m.date || today();
    document.getElementById('mi-vehicle').value = m.vehicle || '';
    document.getElementById('mi-driver').value = m.driver || '';
    document.getElementById('mi-start').value = m.start || '';
    document.getElementById('mi-end').value = m.end || '';
    document.getElementById('mi-total').value = m.total || '';
    document.getElementById('mi-notes').value = m.notes || '';
  } else {
    document.getElementById('mi-date').value = today();
    ['mi-start','mi-end','mi-total','mi-notes'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('mi-vehicle').value = '';
    document.getElementById('mi-driver').value = '';
  }
  openSheet('mileage-sheet-backdrop');
};

document.addEventListener('input', e => {
  if (e.target.id === 'mi-start' || e.target.id === 'mi-end') {
    const start = parseFloat(document.getElementById('mi-start').value) || 0;
    const end   = parseFloat(document.getElementById('mi-end').value) || 0;
    document.getElementById('mi-total').value = end > start ? end - start : '';
  }
});

window.saveMileage = function() {
  const start = parseFloat(document.getElementById('mi-start').value) || 0;
  const end   = parseFloat(document.getElementById('mi-end').value) || 0;
  const rec = {
    date: document.getElementById('mi-date').value,
    vehicle: document.getElementById('mi-vehicle').value,
    driver: document.getElementById('mi-driver').value,
    start, end,
    total: end > start ? end - start : 0,
    notes: document.getElementById('mi-notes').value.trim(),
  };
  if (!rec.date || !rec.vehicle || !rec.start || !rec.end) { showToast('Date, Vehicle, Start & End required', '#C0392B'); return; }
  if (end <= start) { showToast('End must be greater than Start', '#C0392B'); return; }
  const p = editingMileageId
    ? userColl('mileage').doc(editingMileageId).update(rec)
    : userColl('mileage').add({ ...rec, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  p.then(() => { closeSheet('mileage-sheet-backdrop'); showToast('✔ Mileage saved!'); })
   .catch(() => showToast('Error saving', '#C0392B'));
};

window.deleteMileage = function() {
  if (!editingMileageId || !confirm('Delete this mileage record?')) return;
  userColl('mileage').doc(editingMileageId).delete().then(() => { closeSheet('mileage-sheet-backdrop'); showToast('Record deleted', '#888'); });
};

function renderMileageLog() {
  const filterV = document.getElementById('mi-filter-vehicle') ? document.getElementById('mi-filter-vehicle').value : '';
  const filterM = document.getElementById('mi-filter-month') ? document.getElementById('mi-filter-month').value : '';
  let filtered = mileages.filter(m => {
    const mv = !filterV || m.vehicle === filterV;
    const mm = !filterM || (m.date && m.date.startsWith(filterM));
    return mv && mm;
  });
  const totalMi = filtered.reduce((s, m) => s + (m.total || 0), 0);
  document.getElementById('mi-count').textContent = `${filtered.length} entries · ${totalMi.toLocaleString()} mi`;
  const el = document.getElementById('mi-list');
  el.innerHTML = filtered.length ? filtered.map(m => `
    <div class="fuel-card" onclick="openMileageSheet('${m.id}')">
      <div class="fuel-card-top">
        <div>
          <div class="fuel-vehicle-name">${m.vehicle || '—'}</div>
          <div class="fuel-meta">
            <span class="fuel-date">${fmtDate(m.date)}</span>
            ${m.driver ? `<span class="fuel-driver">${m.driver.split(' ')[0]}</span>` : ''}
          </div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--gray);margin-top:2px">
            ${m.start ? m.start.toLocaleString() : '—'} → ${m.end ? m.end.toLocaleString() : '—'}
          </div>
          ${m.notes ? `<div style="font-size:11px;color:var(--gray);margin-top:2px">${m.notes}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div class="fuel-amount">${(m.total||0).toLocaleString()}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--gray)">MILES</div>
        </div>
      </div>
    </div>`).join('') :
    `<div class="empty-state"><div class="empty-icon">🛣</div><div class="empty-title">No mileage logged</div><div class="empty-sub">Tap + to log today's mileage</div></div>`;
}
window.renderMileageLog = renderMileageLog;

window.exportMileageCSV = function() {
  if (!mileages.length) { showToast('No mileage records yet', '#C0392B'); return; }
  const headers = ['Date','Vehicle','Driver','Odo Start','Odo End','Total Miles','Notes'];
  const rows = mileages.slice().sort((a,b)=>a.date>b.date?1:-1).map(m =>
    [m.date,m.vehicle,m.driver,m.start,m.end,m.total,m.notes||''].map(v=>`"${v||''}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'Angelic_Mileage_Log_' + today() + '.csv'; a.click();
};

window.printMileageLog = function() {
  const sorted = mileages.slice().sort((a,b)=>a.date>b.date?1:-1);
  const total = sorted.reduce((s,m)=>s+(m.total||0),0);
  const rows = sorted.map(m=>`<tr>
    <td>${fmtDate(m.date)}</td><td>${m.vehicle||'—'}</td><td>${m.driver||'—'}</td>
    <td style="text-align:right">${(m.start||0).toLocaleString()}</td>
    <td style="text-align:right">${(m.end||0).toLocaleString()}</td>
    <td style="text-align:right;font-weight:700;color:#1565C0">${(m.total||0).toLocaleString()}</td>
    <td>${m.notes||''}</td></tr>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Angelic Transportation Mileage Log</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:40px;max-width:900px;margin:0 auto}
  h1{font-size:26px;color:#1565C0;margin-bottom:4px}.sub{font-size:12px;color:#888;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1565C0;color:white;padding:9px 10px;text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase}
  td{padding:9px 10px;border-bottom:1px solid #eee}.total-row td{background:#1565C0;color:white;font-weight:700;padding:11px 10px}
  .footer{margin-top:28px;text-align:center;font-size:11px;color:#aaa}@page{margin:0.5in;size:letter landscape}</style>
  </head><body>
  <h1>Angelic Transportation</h1>
  <div class="sub">MILEAGE LOG · IRS Record · Printed ${fmtDate(today())}</div>
  <table><thead><tr><th>Date</th><th>Vehicle</th><th>Driver</th><th>Odo Start</th><th>Odo End</th><th>Miles</th><th>Notes</th></tr></thead>
  <tbody>${rows}<tr class="total-row"><td>TOTAL — ${sorted.length} days</td><td></td><td></td><td></td><td></td><td>${total.toLocaleString()}</td><td></td></tr></tbody></table>
  <div class="footer">Angelic Transportation · NEMT Provider · catrinasp@gmail.com</div>
  <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close();
};

// ── MAINTENANCE
window.openMaintSheet = function(id) {
  editingMaintId = id || null;
  const isEdit = !!id;
  document.getElementById('maint-sheet-title').textContent = isEdit ? 'Edit Service Record' : 'Log Service';
  document.getElementById('delete-maint-btn').style.display = isEdit ? 'block' : 'none';
  if (isEdit) {
    const m = maints.find(m => m.id === id); if (!m) return;
    document.getElementById('maint-date').value = m.date || today();
    document.getElementById('maint-vehicle').value = m.vehicle || '';
    document.getElementById('maint-type').value = m.type || 'Oil Change';
    document.getElementById('maint-cost').value = m.cost || '';
    document.getElementById('maint-mileage').value = m.mileage || '';
    document.getElementById('maint-shop').value = m.shop || '';
    document.getElementById('maint-next').value = m.next || '';
    document.getElementById('maint-notes').value = m.notes || '';
  } else {
    document.getElementById('maint-date').value = today();
    ['maint-cost','maint-mileage','maint-shop','maint-next','maint-notes'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('maint-vehicle').value = '';
    document.getElementById('maint-type').value = 'Oil Change';
  }
  openSheet('maint-sheet-backdrop');
};

window.saveMaint = function() {
  const rec = {
    date: document.getElementById('maint-date').value,
    vehicle: document.getElementById('maint-vehicle').value,
    type: document.getElementById('maint-type').value,
    cost: parseFloat(document.getElementById('maint-cost').value) || 0,
    mileage: document.getElementById('maint-mileage').value.trim(),
    shop: document.getElementById('maint-shop').value.trim(),
    next: document.getElementById('maint-next').value.trim(),
    notes: document.getElementById('maint-notes').value.trim(),
  };
  if (!rec.date || !rec.vehicle) { showToast('Date and Vehicle required', '#C0392B'); return; }
  const p = editingMaintId
    ? userColl('maints').doc(editingMaintId).update(rec)
    : userColl('maints').add({ ...rec, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  p.then(() => { closeSheet('maint-sheet-backdrop'); showToast('✔ Service record saved!'); })
   .catch(() => showToast('Error saving', '#C0392B'));
};

window.deleteMaint = function() {
  if (!editingMaintId || !confirm('Delete this record?')) return;
  userColl('maints').doc(editingMaintId).delete().then(() => { closeSheet('maint-sheet-backdrop'); showToast('Record deleted', '#888'); });
};

window.quickMaint = function(type) {
  openMaintSheet();
  document.getElementById('maint-type').value = type;
  document.getElementById('maint-sheet-title').textContent = 'Log ' + type;
};

function renderMaintenance() {
  const total = maints.reduce((s,m)=>s+(m.cost||0),0);
  document.getElementById('maint-total-label').textContent = maints.length ? `${maints.length} records · ${fmtMoney(total)}` : '';
  const list = document.getElementById('maint-list');
  if (!maints.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔧</div><div class="empty-title">No records yet</div><div class="empty-sub">Use Quick Log above to get started</div></div>`;
    return;
  }
  list.innerHTML = maints.map(m=>`
    <div class="maint-card" data-type="${m.type}" onclick="openMaintSheet('${m.id}')">
      <div class="maint-vehicle-label">${m.vehicle||'Vehicle'}</div>
      <div class="maint-card-top">
        <div class="maint-type-label">${m.type}</div>
        <div class="maint-cost-label">${m.cost ? fmtMoney(m.cost) : '—'}</div>
      </div>
      <div class="maint-meta">
        <span>${fmtDate(m.date)}</span>
        ${m.mileage ? `<span>📍 ${Number(m.mileage).toLocaleString()} mi</span>` : ''}
        ${m.shop ? `<span>${m.shop}</span>` : ''}
      </div>
      ${m.next ? `<div class="maint-next">⏰ Next: ${m.next}</div>` : ''}
    </div>`).join('');
}

// ── RECEIPTS
window.handleReceiptUpload = function(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    pendingReceiptImage = ev.target.result;
    editingReceiptId = null;
    document.getElementById('r-date').value = today();
    ['r-amount','r-location','r-notes'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('r-vehicle').value = '';
    const img = document.getElementById('receipt-preview-img');
    img.src = pendingReceiptImage; img.style.display = 'block';
    document.getElementById('delete-receipt-btn').style.display = 'none';
    openSheet('receipt-sheet-backdrop');
  };
  reader.readAsDataURL(file); e.target.value = '';
};

window.openReceiptForEdit = function(id) {
  const r = receipts.find(r => r.id === id); if (!r) return;
  editingReceiptId = id; pendingReceiptImage = null;
  const img = document.getElementById('receipt-preview-img');
  if (r.imageData) { img.src = r.imageData; img.style.display = 'block'; } else { img.style.display = 'none'; }
  document.getElementById('r-date').value = r.date || today();
  document.getElementById('r-amount').value = r.amount || '';
  document.getElementById('r-vehicle').value = r.vehicle || '';
  document.getElementById('r-category').value = r.category || '';
  document.getElementById('r-location').value = r.location || '';
  document.getElementById('r-notes').value = r.notes || '';
  document.getElementById('delete-receipt-btn').style.display = 'block';
  openSheet('receipt-sheet-backdrop');
};

window.saveReceipt = function() {
  const data = {
    date: document.getElementById('r-date').value,
    amount: parseFloat(document.getElementById('r-amount').value) || 0,
    vehicle: document.getElementById('r-vehicle').value,
    category: document.getElementById('r-category').value,
    location: document.getElementById('r-location').value.trim(),
    notes: document.getElementById('r-notes').value.trim(),
  };
  if (pendingReceiptImage) data.imageData = pendingReceiptImage;
  const p = editingReceiptId
    ? userColl('receipts').doc(editingReceiptId).update(data)
    : userColl('receipts').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  p.then(() => { closeSheet('receipt-sheet-backdrop'); showToast('✔ Receipt saved!'); pendingReceiptImage = null; })
   .catch(() => showToast('Error saving', '#C0392B'));
};

window.deleteReceipt = function() {
  if (!editingReceiptId || !confirm('Delete this receipt?')) return;
  userColl('receipts').doc(editingReceiptId).delete()
    .then(() => { closeSheet('receipt-sheet-backdrop'); showToast('Receipt deleted', '#888'); });
};

window.openFullscreen = src => {
  document.getElementById('receipt-fullscreen-img').src = src;
  document.getElementById('receipt-fullscreen').style.display = 'flex';
};
window.closeFullscreen = () => document.getElementById('receipt-fullscreen').style.display = 'none';

function renderReceipts() {
  const total = receipts.reduce((s,r) => s + (r.amount||0), 0);
  const mo = new Date().toISOString().slice(0,7);
  const monthTotal = receipts.filter(r => r.date && r.date.startsWith(mo)).reduce((s,r) => s + (r.amount||0), 0);
  document.getElementById('receipt-total-label').textContent = receipts.length ? `${receipts.length} receipts · ${fmtMoney(total)}` : '';
  const gallery = document.getElementById('receipts-gallery');
  if (!receipts.length) {
    gallery.innerHTML = `<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-title">No receipts yet</div><div class="empty-sub">Tap above to photograph your first receipt</div></div>`;
    return;
  }
  gallery.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
    <div class="stat-card gold"><div class="stat-label">This Month</div><div class="stat-value money" style="font-size:22px">${fmtMoney(monthTotal)}</div></div>
    <div class="stat-card blue"><div class="stat-label">All Time</div><div class="stat-value money" style="font-size:22px">${fmtMoney(total)}</div></div>
  </div>` + receipts.map(r => `
    <div class="receipt-card" onclick="openReceiptForEdit('${r.id}')">
      <div class="receipt-thumb">${r.imageData
        ? `<img src="${r.imageData}" alt="receipt" onclick="event.stopPropagation();openFullscreen('${r.imageData}')">`
        : '<div class="receipt-thumb-placeholder">🧾</div>'}</div>
      <div class="receipt-info">
        <div class="receipt-location">${r.location || 'Expense'}</div>
        ${r.category ? `<div style="display:inline-block;font-family:'Share Tech Mono',monospace;font-size:9px;padding:2px 7px;border-radius:3px;background:rgba(21,101,192,0.1);color:var(--blue);border:1px solid rgba(21,101,192,0.2);margin-bottom:4px">${r.category}</div>` : ''}
        <div class="receipt-meta">
          <span class="receipt-date">${fmtDate(r.date)}</span>
          ${r.vehicle ? `<span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--blue)">${r.vehicle.split(' ').slice(0,2).join(' ')}</span>` : ''}
          ${r.notes ? `<span style="font-size:11px;color:var(--gray)">${r.notes}</span>` : ''}
        </div>
      </div>
      <div class="receipt-amount-badge">${r.amount ? fmtMoney(r.amount) : '—'}</div>
    </div>`).join('');
}

// ── MAINTENANCE PRINT
window.printMaintenanceLog = function() {
  if (!maints.length) { showToast('No maintenance records yet', '#C0392B'); return; }
  const sorted = maints.slice().sort((a,b) => a.date > b.date ? 1 : -1);
  const totalCost = sorted.reduce((s,m) => s + (m.cost||0), 0);

  // Group by vehicle
  const byVehicle = {};
  VEHICLES.forEach(v => byVehicle[v] = []);
  sorted.forEach(m => { if (byVehicle[m.vehicle]) byVehicle[m.vehicle].push(m); });

  const vehicleSections = VEHICLES.map(v => {
    const records = byVehicle[v];
    if (!records.length) return '';
    const vTotal = records.reduce((s,m) => s+(m.cost||0), 0);
    const rows = records.map(m => `<tr>
      <td>${fmtDate(m.date)}</td>
      <td>${m.type}</td>
      <td>${m.shop||'—'}</td>
      <td>${m.mileage ? Number(m.mileage).toLocaleString()+' mi' : '—'}</td>
      <td style="text-align:right;font-weight:700;color:#1565C0">${m.cost ? fmtMoney(m.cost) : '—'}</td>
      <td style="color:#888">${m.next||''}</td>
    </tr>`).join('');
    return `
      <div style="margin-bottom:32px">
        <div style="background:#1565C0;color:white;padding:10px 16px;border-radius:6px 6px 0 0;font-weight:700;font-size:16px;display:flex;justify-content:space-between">
          <span>${v}</span><span>${fmtMoney(vTotal)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#E3F0FF">
            <th style="padding:8px 10px;text-align:left">Date</th>
            <th style="padding:8px 10px;text-align:left">Service</th>
            <th style="padding:8px 10px;text-align:left">Shop</th>
            <th style="padding:8px 10px;text-align:left">Mileage</th>
            <th style="padding:8px 10px;text-align:right">Cost</th>
            <th style="padding:8px 10px;text-align:left">Next Due</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Angelic Transportation — Maintenance Log</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;padding:40px;max-width:900px;margin:0 auto}
    h1{font-size:26px;color:#1565C0;margin-bottom:4px}
    .sub{font-size:12px;color:#888;margin-bottom:28px}
    table td{padding:8px 10px;border-bottom:1px solid #eee}
    .total-row{background:#1565C0;color:white;padding:12px 16px;display:flex;justify-content:space-between;font-weight:700;border-radius:0 0 6px 6px;margin-top:-1px}
    .footer{margin-top:32px;text-align:center;font-size:11px;color:#aaa}
    @page{margin:0.5in;size:letter}
  </style></head><body>
  <h1>Angelic Transportation</h1>
  <div class="sub">MAINTENANCE LOG · Printed ${fmtDate(today())} · Total All Vehicles: ${fmtMoney(totalCost)}</div>
  ${vehicleSections}
  <div class="total-row"><span>TOTAL — ALL VEHICLES · ${sorted.length} service records</span><span>${fmtMoney(totalCost)}</span></div>
  <div class="footer">Angelic Transportation · NEMT Provider · angelictransportation13@gmail.com</div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
};
// ── DRIVERS
function renderDrivers() {
  const el = document.getElementById('drivers-list'); if (!el) return;
  el.innerHTML = DRIVERS.map(d => `
    <div class="driver-card ${d.status === 'not-compliant' ? 'not-compliant' : ''}">
      <div class="driver-avatar">${d.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
      <div class="driver-info">
        <div class="driver-name">${d.name}</div>
        <div class="driver-status ${d.status}">${d.status === 'compliant' ? '✔ Compliant' : '⚠ Not Compliant'}</div>
      </div>
    </div>`).join('');
}
