'use strict';

/* ═══════════════════════════════════════════════ STORAGE KEYS ══ */
const K = {
  CREDS: 'be_creds',
  INV:   'be_inv',
  SALES: 'be_sales',
  SHOP:  'be_shop',
};

/* ═══════════════════════════════════════════════════════ STATE ══ */
let cart          = [];
let editingItemId = null;
let currentBill   = null;

/* ═══════════════════════════════════════════════════ STORAGE ══ */
function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; }
  catch { return def; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

const getCreds   = () => load(K.CREDS, { username: 'admin', password: 'admin123' });
const saveCreds  = (c) => save(K.CREDS, c);
const getInv     = () => load(K.INV,   []);
const saveInv    = (d) => save(K.INV,  d);
const getSales   = () => load(K.SALES, []);
const saveSales  = (d) => save(K.SALES, d);
const getShop    = () => load(K.SHOP,  { name: 'My Shop', address: '', phone: '', gst: '' });
const saveShop   = (d) => save(K.SHOP,  d);

/* ════════════════════════════════════════════════════ HELPERS ══ */
const fmt  = (n) => '₹' + parseFloat(n || 0).toFixed(2);
const esc  = (s) => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}
function nextBillNo() {
  return 'BILL-' + String(getSales().length + 1).padStart(4, '0');
}

let toastTimer = null;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast hidden'; }, 3200);
}

/* ══════════════════════════════════════════════ NAVIGATION ══ */
function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => {
    const active = p.id === `${page}-page`;
    p.classList.toggle('active', active);
    p.classList.toggle('hidden', !active);
    p.style.display = active ? 'block' : 'none';
  });
  if (page === 'inventory') renderInv();
  if (page === 'sales')     renderSaleItems();
  if (page === 'report')    renderReport();
  if (page === 'settings')  loadSettings();
}

/* ═══════════════════════════════════════════ AUTH ══ */
function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const creds = getCreds();

  if (user === creds.username && pass === creds.password) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('current-user').textContent = '👤 ' + user;
    navigateTo('inventory');
  } else {
    const err = document.getElementById('login-error');
    err.classList.remove('hidden');
    setTimeout(() => err.classList.add('hidden'), 3500);
  }
}

function handleLogout() {
  if (!confirm('Log out?')) return;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
}

/* ═══════════════════════════════════════════ INVENTORY ══ */
function renderInv(q = '') {
  let items = getInv();
  if (q) {
    const lq = q.toLowerCase();
    items = items.filter(i =>
      i.name.toLowerCase().includes(lq) ||
      (i.category || '').toLowerCase().includes(lq)
    );
  }

  const tbody = document.getElementById('inv-tbody');
  const empty = document.getElementById('inv-empty');
  const table = document.getElementById('inv-table');

  if (items.length === 0) {
    tbody.innerHTML = '';
    table.style.display = 'none';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  table.style.display = 'table';

  tbody.innerHTML = items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${esc(it.name)}</strong></td>
      <td>${esc(it.category || '—')}</td>
      <td>${esc(it.unit || 'pcs')}</td>
      <td>${fmt(it.price)}</td>
      <td>
        <div class="qty-ctrl">
          <button class="qty-btn" data-id="${it.id}" data-d="-1">−</button>
          <span class="qty-display">${it.quantity}</span>
          <button class="qty-btn" data-id="${it.id}" data-d="1">+</button>
        </div>
      </td>
      <td>${stockBadge(it.quantity)}</td>
      <td>
        <button class="btn-icon" title="Edit" data-edit="${it.id}">✏️</button>
        <button class="btn-icon" title="Delete" data-del="${it.id}">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function stockBadge(q) {
  if (q === 0) return '<span class="badge badge-out">Out of Stock</span>';
  if (q < 10)  return '<span class="badge badge-low">Low Stock</span>';
  return '<span class="badge badge-ok">In Stock</span>';
}

// Delegated clicks on inventory tbody
document.addEventListener('click', (e) => {
  const qBtn  = e.target.closest('[data-d]');
  const editBtn = e.target.closest('[data-edit]');
  const delBtn  = e.target.closest('[data-del]');

  if (qBtn) {
    const id = Number(qBtn.dataset.id);
    const d  = Number(qBtn.dataset.d);
    adjQty(id, d);
  }
  if (editBtn) openEditModal(Number(editBtn.dataset.edit));
  if (delBtn)  deleteItem(Number(delBtn.dataset.del));
});

function adjQty(id, delta) {
  const items = getInv();
  const it = items.find(i => i.id === id);
  if (!it) return;
  it.quantity = Math.max(0, it.quantity + delta);
  saveInv(items);
  renderInv(document.getElementById('inv-search').value);
}

/* Item Modal */
function openAddModal() {
  editingItemId = null;
  document.getElementById('item-modal-title').textContent = 'Add New Item';
  document.getElementById('item-submit-btn').textContent  = 'Add Item';
  document.getElementById('item-form').reset();
  document.getElementById('item-form-err').classList.add('hidden');
  document.getElementById('item-modal').classList.remove('hidden');
  document.getElementById('f-name').focus();
}

function openEditModal(id) {
  const it = getInv().find(i => i.id === id);
  if (!it) return;
  editingItemId = id;
  document.getElementById('item-modal-title').textContent = 'Edit Item';
  document.getElementById('item-submit-btn').textContent  = 'Save Changes';
  document.getElementById('f-name').value  = it.name;
  document.getElementById('f-cat').value   = it.category || '';
  document.getElementById('f-price').value = it.price;
  document.getElementById('f-qty').value   = it.quantity;
  document.getElementById('f-unit').value  = it.unit || 'pcs';
  document.getElementById('item-form-err').classList.add('hidden');
  document.getElementById('item-modal').classList.remove('hidden');
  document.getElementById('f-name').focus();
}

function closeItemModal() {
  document.getElementById('item-modal').classList.add('hidden');
  editingItemId = null;
}

function handleItemForm(e) {
  e.preventDefault();
  const name  = document.getElementById('f-name').value.trim();
  const cat   = document.getElementById('f-cat').value.trim();
  const price = parseFloat(document.getElementById('f-price').value);
  const qty   = parseInt(document.getElementById('f-qty').value, 10);
  const unit  = document.getElementById('f-unit').value;
  const err   = document.getElementById('item-form-err');

  if (!name) { showErr(err, 'Item name is required.'); return; }
  if (isNaN(price) || price < 0) { showErr(err, 'Enter a valid price.'); return; }
  if (isNaN(qty)   || qty   < 0) { showErr(err, 'Enter a valid quantity.'); return; }

  const items = getInv();
  if (editingItemId !== null) {
    const idx = items.findIndex(i => i.id === editingItemId);
    if (idx !== -1) { items[idx] = { ...items[idx], name, category: cat, price, quantity: qty, unit }; }
    saveInv(items);
    toast('Item updated.');
  } else {
    items.push({ id: Date.now(), name, category: cat, price, quantity: qty, unit });
    saveInv(items);
    toast('Item added.');
  }
  closeItemModal();
  renderInv(document.getElementById('inv-search').value);
}

function deleteItem(id) {
  if (!confirm('Delete this item permanently?')) return;
  saveInv(getInv().filter(i => i.id !== id));
  renderInv(document.getElementById('inv-search').value);
  toast('Item deleted.', 'warning');
}

function showErr(el, msg) {
  el.textContent = msg;
  el.className   = 'alert alert-error';
  el.classList.remove('hidden');
}

/* ═══════════════════════════════════════════ SALES / CART ══ */
function renderSaleItems(q = '') {
  let items = getInv();
  if (q) {
    const lq = q.toLowerCase();
    items = items.filter(i => i.name.toLowerCase().includes(lq) || (i.category || '').toLowerCase().includes(lq));
  }

  document.getElementById('items-grid').innerHTML = items.map(it => `
    <div class="item-card${it.quantity === 0 ? ' item-oos' : ''}"
         ${it.quantity > 0 ? `data-add="${it.id}"` : ''}>
      <div class="item-card-name">${esc(it.name)}</div>
      <div class="item-card-price">${fmt(it.price)}</div>
      <div class="item-card-stock${it.quantity === 0 ? ' oos' : ''}">
        ${it.quantity === 0 ? 'Out of Stock' : `Stock: ${it.quantity} ${esc(it.unit || 'pcs')}`}
      </div>
    </div>
  `).join('');

  renderCart();
}

// Click to add to cart
document.addEventListener('click', (e) => {
  const card = e.target.closest('[data-add]');
  if (card) addToCart(Number(card.dataset.add));
});

function addToCart(id) {
  const inv = getInv();
  const it  = inv.find(i => i.id === id);
  if (!it || it.quantity === 0) return;

  const existing = cart.find(c => c.id === id);
  if (existing) {
    if (existing.quantity >= it.quantity) { toast('Not enough stock!', 'warning'); return; }
    existing.quantity++;
  } else {
    cart.push({ id: it.id, name: it.name, price: it.price, unit: it.unit || 'pcs', quantity: 1 });
  }
  renderCart();
}

function renderCart() {
  const tbody = document.getElementById('cart-tbody');
  const table = document.getElementById('cart-table');
  const empty = document.getElementById('cart-empty');

  if (cart.length === 0) {
    tbody.innerHTML = '';
    table.classList.add('hidden');
    empty.style.display = '';
    recalc();
    return;
  }
  empty.style.display = 'none';
  table.classList.remove('hidden');

  tbody.innerHTML = cart.map(it => `
    <tr>
      <td>${esc(it.name)}</td>
      <td>
        <input type="number" class="qty-input" min="1"
               value="${it.quantity}" data-cqty="${it.id}" />
      </td>
      <td>${fmt(it.price)}</td>
      <td>${fmt(it.price * it.quantity)}</td>
      <td><button class="btn-icon" data-crem="${it.id}">✕</button></td>
    </tr>
  `).join('');

  recalc();
}

// Delegated cart events
document.addEventListener('change', (e) => {
  if (e.target.dataset.cqty) {
    updateCartQty(Number(e.target.dataset.cqty), parseInt(e.target.value, 10));
  }
});
document.addEventListener('click', (e) => {
  const rem = e.target.closest('[data-crem]');
  if (rem) removeFromCart(Number(rem.dataset.crem));
});

function updateCartQty(id, qty) {
  const maxStock = (getInv().find(i => i.id === id) || {}).quantity ?? 999;
  if (isNaN(qty) || qty < 1) { removeFromCart(id); return; }
  if (qty > maxStock) { toast('Exceeds available stock!', 'warning'); qty = maxStock; }
  const c = cart.find(i => i.id === id);
  if (c) c.quantity = qty;
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

function recalc() {
  const sub  = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const disc = Math.min(100, Math.max(0, parseFloat(document.getElementById('discount-pct').value) || 0));
  const tax  = Math.min(100, Math.max(0, parseFloat(document.getElementById('tax-pct').value)      || 0));
  const discAmt = sub * disc / 100;
  const taxAmt  = (sub - discAmt) * tax / 100;
  const total   = sub - discAmt + taxAmt;
  document.getElementById('subtotal-val').textContent = fmt(sub);
  document.getElementById('grand-val').textContent    = fmt(total);
}

function clearCart() {
  if (!cart.length) return;
  if (!confirm('Clear all items?')) return;
  cart = [];
  document.getElementById('cust-name').value    = '';
  document.getElementById('discount-pct').value  = '0';
  document.getElementById('tax-pct').value       = '0';
  renderCart();
}

function generateBill() {
  if (cart.length === 0) { toast('Add items to the bill first!', 'warning'); return; }

  const cust = document.getElementById('cust-name').value.trim() || 'Walk-in Customer';
  const sub  = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const dp   = Math.min(100, Math.max(0, parseFloat(document.getElementById('discount-pct').value) || 0));
  const tp   = Math.min(100, Math.max(0, parseFloat(document.getElementById('tax-pct').value) || 0));
  const dAmt = sub * dp / 100;
  const tAmt = (sub - dAmt) * tp / 100;
  const tot  = sub - dAmt + tAmt;

  const bill = {
    id: Date.now(), billNo: nextBillNo(), customer: cust,
    items: cart.map(c => ({ ...c })),
    sub, dp, dAmt, tp, tAmt, tot,
    ts: new Date().toISOString()
  };

  /* Save sale */
  const sales = getSales();
  sales.push(bill);
  saveSales(sales);

  /* Deduct inventory */
  const inv = getInv();
  cart.forEach(c => {
    const it = inv.find(i => i.id === c.id);
    if (it) it.quantity = Math.max(0, it.quantity - c.quantity);
  });
  saveInv(inv);

  currentBill = bill;
  showBillModal(bill);

  /* Reset */
  cart = [];
  document.getElementById('cust-name').value   = '';
  document.getElementById('discount-pct').value = '0';
  document.getElementById('tax-pct').value      = '0';
  renderCart();
  renderSaleItems(document.getElementById('sale-search').value);
}

/* ═══════════════════════════════════════════ BILL MODAL ══ */
function showBillModal(bill) {
  document.getElementById('bill-preview').innerHTML = buildReceiptHTML(bill);
  document.getElementById('bill-modal').classList.remove('hidden');
}

function closeBillModal() {
  document.getElementById('bill-modal').classList.add('hidden');
}

function buildReceiptHTML(bill) {
  const shop = getShop();
  const itemRows = bill.items.map(it => `
    <tr>
      <td>${esc(it.name)}</td>
      <td class="col-r">${it.quantity} ${esc(it.unit || 'pcs')}</td>
      <td class="col-r">${fmt(it.price)}</td>
      <td class="col-r">${fmt(it.price * it.quantity)}</td>
    </tr>`).join('');

  return `
  <div class="receipt">
    <div class="receipt-head">
      <h2>${esc(shop.name || 'My Shop')}</h2>
      ${shop.address ? `<p>${esc(shop.address)}</p>` : ''}
      ${shop.phone   ? `<p>Tel: ${esc(shop.phone)}</p>` : ''}
      ${shop.gst     ? `<p>GST No: ${esc(shop.gst)}</p>` : ''}
    </div>
    <hr class="receipt-hr"/>
    <div class="receipt-meta">
      <div class="receipt-meta-row"><span>Bill No</span><span>${esc(bill.billNo)}</span></div>
      <div class="receipt-meta-row"><span>Date</span><span>${fmtDate(bill.ts)}</span></div>
      <div class="receipt-meta-row"><span>Time</span><span>${fmtTime(bill.ts)}</span></div>
      <div class="receipt-meta-row"><span>Customer</span><span>${esc(bill.customer)}</span></div>
    </div>
    <hr class="receipt-hr"/>
    <table class="receipt-items-table">
      <thead>
        <tr><th>Item</th><th class="col-r">Qty</th><th class="col-r">Rate</th><th class="col-r">Amt</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="receipt-hr"/>
    <div class="receipt-totals">
      <div class="receipt-total-row"><span>Subtotal</span><span>${fmt(bill.sub)}</span></div>
      ${bill.dp > 0 ? `<div class="receipt-total-row"><span>Discount (${bill.dp}%)</span><span>− ${fmt(bill.dAmt)}</span></div>` : ''}
      ${bill.tp > 0 ? `<div class="receipt-total-row"><span>GST (${bill.tp}%)</span><span>${fmt(bill.tAmt)}</span></div>` : ''}
      <div class="receipt-total-row receipt-grand"><span>TOTAL</span><span>${fmt(bill.tot)}</span></div>
    </div>
    <hr class="receipt-hr"/>
    <div class="receipt-foot">
      <p>Thank you for your business!</p>
      <p>Please visit again 🙏</p>
    </div>
  </div>`;
}

function printBill() {
  const html = document.getElementById('bill-preview').innerHTML;
  const shop = getShop();
  const win  = window.open('', '_blank', 'width=400,height=600');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Bill</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size:13px; margin:20px; }
      .receipt { max-width:300px; }
      .receipt-head { text-align:center; }
      .receipt-head h2 { font-size:16px; }
      .receipt-head p { font-size:12px; margin:2px 0; }
      .receipt-hr { border:none; border-top:1px dashed #aaa; margin:8px 0; }
      .receipt-meta-row, .receipt-total-row { display:flex; justify-content:space-between; font-size:12px; padding:2px 0; }
      .receipt-items-table { width:100%; border-collapse:collapse; font-size:12px; margin:6px 0; }
      .receipt-items-table th { text-align:left; border-bottom:1px solid #ccc; padding:2px 0; }
      .receipt-items-table td { padding:3px 0; }
      .col-r { text-align:right; }
      .receipt-grand { font-weight:bold; font-size:15px; border-top:1px dashed #aaa; padding-top:6px; margin-top:4px; }
      .receipt-foot { text-align:center; font-size:12px; color:#555; margin-top:10px; }
    </style>
  </head><body>${html}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800);}<\/script></body></html>`);
  win.document.close();
}

/* ═══════════════════════════════════════════ DAILY REPORT ══ */
function renderReport() {
  const dateEl = document.getElementById('report-date');
  const date   = dateEl.value;
  const sales  = getSales().filter(s => s.ts.startsWith(date));

  const rev    = sales.reduce((s, b) => s + b.tot, 0);
  const txns   = sales.length;
  const sold   = sales.reduce((s, b) => s + b.items.reduce((a, i) => a + i.quantity, 0), 0);
  const avg    = txns ? rev / txns : 0;

  document.getElementById('s-revenue').textContent = fmt(rev);
  document.getElementById('s-txns').textContent    = txns;
  document.getElementById('s-items').textContent   = sold;
  document.getElementById('s-avg').textContent     = fmt(avg);

  const tbody = document.getElementById('report-tbody');
  const table = document.getElementById('report-table');
  const empty = document.getElementById('report-empty');

  if (sales.length === 0) {
    tbody.innerHTML = '';
    table.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  table.classList.remove('hidden');

  tbody.innerHTML = sales.map(b => `
    <tr>
      <td>${esc(b.billNo)}</td>
      <td>${fmtTime(b.ts)}</td>
      <td>${esc(b.customer)}</td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${b.items.map(i => `${esc(i.name)} ×${i.quantity}`).join(', ')}
      </td>
      <td>${fmt(b.sub)}</td>
      <td>${b.dp > 0 ? b.dp + '%' : '—'}</td>
      <td>${b.tp > 0 ? b.tp + '%' : '—'}</td>
      <td><strong>${fmt(b.tot)}</strong></td>
      <td><button class="btn-icon" data-viewbill="${b.id}" title="View Bill">👁️</button></td>
    </tr>`).join('');
}

document.addEventListener('click', (e) => {
  const vb = e.target.closest('[data-viewbill]');
  if (vb) {
    const bill = getSales().find(s => s.id === Number(vb.dataset.viewbill));
    if (bill) showBillModal(bill);
  }
});

function printReport() {
  const date   = document.getElementById('report-date').value;
  const sales  = getSales().filter(s => s.ts.startsWith(date));
  const shop   = getShop();
  const rev    = sales.reduce((s,b) => s + b.tot, 0);

  const rows = sales.map(b => `
    <tr>
      <td>${esc(b.billNo)}</td>
      <td>${fmtTime(b.ts)}</td>
      <td>${esc(b.customer)}</td>
      <td>${b.items.map(i => `${esc(i.name)} ×${i.quantity}`).join(', ')}</td>
      <td style="text-align:right">${fmt(b.tot)}</td>
    </tr>`).join('');

  const win = window.open('', '_blank', 'width=800,height=600');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Daily Report – ${date}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; margin: 30px; color: #111; }
      h1 { font-size: 20px; } h2 { font-size: 15px; color: #444; margin: 4px 0 20px; }
      .meta { margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ccc; font-size: 12px; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; }
      .total-row { font-weight: bold; font-size: 14px; }
      .summary { display: flex; gap: 40px; margin-bottom: 20px; }
      .s { border: 1px solid #ddd; border-radius: 8px; padding: 12px 18px; }
      .sl { font-size: 11px; color: #666; }
      .sv { font-size: 18px; font-weight: bold; }
    </style>
  </head><body>
    <h1>${esc(shop.name || 'My Shop')}</h1>
    <h2>Daily Sales Report — ${date}</h2>
    <div class="summary">
      <div class="s"><div class="sl">Total Revenue</div><div class="sv">${fmt(rev)}</div></div>
      <div class="s"><div class="sl">Transactions</div><div class="sv">${sales.length}</div></div>
      <div class="s"><div class="sl">Items Sold</div><div class="sv">${sales.reduce((s,b)=>s+b.items.reduce((a,i)=>a+i.quantity,0),0)}</div></div>
    </div>
    <table>
      <thead><tr><th>Bill #</th><th>Time</th><th>Customer</th><th>Items</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total-row"><td colspan="4">Grand Total</td><td style="text-align:right">${fmt(rev)}</td></tr></tfoot>
    </table>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800);}<\/script>
  </body></html>`);
  win.document.close();
}

/* ═══════════════════════════════════════════════ SETTINGS ══ */
function loadSettings() {
  const s = getShop();
  document.getElementById('shop-name').value  = s.name    || '';
  document.getElementById('shop-addr').value  = s.address || '';
  document.getElementById('shop-phone').value = s.phone   || '';
  document.getElementById('shop-gst').value   = s.gst     || '';
}

function handleShopForm(e) {
  e.preventDefault();
  saveShop({
    name:    document.getElementById('shop-name').value.trim(),
    address: document.getElementById('shop-addr').value.trim(),
    phone:   document.getElementById('shop-phone').value.trim(),
    gst:     document.getElementById('shop-gst').value.trim(),
  });
  toast('Shop info saved!');
}

function handlePwdForm(e) {
  e.preventDefault();
  const cur  = document.getElementById('pwd-current').value;
  const nw   = document.getElementById('pwd-new').value;
  const conf = document.getElementById('pwd-confirm').value;
  const msg  = document.getElementById('pwd-msg');
  const creds = getCreds();

  if (cur !== creds.password) { flashMsg(msg, 'Current password is incorrect.', 'error'); return; }
  if (nw.length < 6)          { flashMsg(msg, 'New password must be at least 6 characters.', 'error'); return; }
  if (nw !== conf)            { flashMsg(msg, 'Passwords do not match.', 'error'); return; }

  saveCreds({ ...creds, password: nw });
  flashMsg(msg, 'Password changed successfully!', 'success');
  document.getElementById('pwd-form').reset();
}

function flashMsg(el, text, type) {
  el.textContent = text;
  el.className   = `alert alert-${type}`;
  setTimeout(() => { el.className = 'alert hidden'; }, 4000);
}

/* ═══════════════════════════════════════════ SAMPLE DATA ══ */
function loadSampleData() {
  if (getInv().length > 0) return;
  saveInv([
    { id: 1001, name: 'Basmati Rice', category: 'Groceries', price: 85,   quantity: 50,  unit: 'kg'   },
    { id: 1002, name: 'Toor Dal',     category: 'Groceries', price: 110,  quantity: 30,  unit: 'kg'   },
    { id: 1003, name: 'Sunflower Oil',category: 'Groceries', price: 130,  quantity: 20,  unit: 'L'    },
    { id: 1004, name: 'Milk',         category: 'Dairy',     price: 28,   quantity: 100, unit: 'L'    },
    { id: 1005, name: 'Butter',       category: 'Dairy',     price: 55,   quantity: 40,  unit: 'pcs'  },
    { id: 1006, name: 'Bread',        category: 'Bakery',    price: 40,   quantity: 25,  unit: 'pack' },
    { id: 1007, name: 'Sugar',        category: 'Groceries', price: 42,   quantity: 60,  unit: 'kg'   },
    { id: 1008, name: 'Tea Powder',   category: 'Beverages', price: 220,  quantity: 15,  unit: 'pack' },
    { id: 1009, name: 'Biscuits',     category: 'Snacks',    price: 30,   quantity: 80,  unit: 'pack' },
    { id: 1010, name: 'Eggs',         category: 'Dairy',     price: 7,    quantity: 200, unit: 'pcs'  },
  ]);
}

/* ══════════════════════════════════════════════ INIT / WIRE UP ══ */
function init() {
  /* Bootstrap defaults */
  if (!localStorage.getItem(K.CREDS)) saveCreds({ username: 'admin', password: 'admin123' });
  loadSampleData();

  /* Set today's date in report */
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('report-date').value = today;

  /* Show all pages (they use display:none via JS) */
  document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; });

  /* ── Auth ── */
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click',  handleLogout);

  /* ── Navigation ── */
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); navigateTo(link.dataset.page); });
  });

  /* ── Inventory ── */
  document.getElementById('add-item-btn').addEventListener('click', openAddModal);
  document.getElementById('item-form').addEventListener('submit', handleItemForm);
  document.getElementById('inv-search').addEventListener('input', (e) => renderInv(e.target.value));
  document.getElementById('item-modal-close').addEventListener('click', closeItemModal);
  document.getElementById('item-cancel-btn').addEventListener('click', closeItemModal);
  document.getElementById('item-modal-backdrop').addEventListener('click', closeItemModal);

  /* ── Sales ── */
  document.getElementById('sale-search').addEventListener('input', (e) => renderSaleItems(e.target.value));
  document.getElementById('discount-pct').addEventListener('input', recalc);
  document.getElementById('tax-pct').addEventListener('input', recalc);
  document.getElementById('clear-cart-btn').addEventListener('click', clearCart);
  document.getElementById('gen-bill-btn').addEventListener('click', generateBill);

  /* ── Bill Modal ── */
  document.getElementById('bill-modal-close').addEventListener('click', closeBillModal);
  document.getElementById('bill-close-btn').addEventListener('click',   closeBillModal);
  document.getElementById('bill-print-btn').addEventListener('click',   printBill);
  document.getElementById('bill-modal-backdrop').addEventListener('click', closeBillModal);

  /* ── Report ── */
  document.getElementById('report-date').addEventListener('change', renderReport);
  document.getElementById('print-report-btn').addEventListener('click', printReport);

  /* ── Settings ── */
  document.getElementById('shop-form').addEventListener('submit', handleShopForm);
  document.getElementById('pwd-form').addEventListener('submit',  handlePwdForm);

  /* Keyboard: Esc closes modals */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeItemModal();
      closeBillModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
