/* ==========================================================================
   PMBANHANG - POS & INVOICE MODULE (pos.js)
   Bán hàng (POS), giỏ hàng, chiết khấu, in ấn, thu nợ, hủy/hoàn hàng
   ========================================================================== */

let cart = [];
let viewingInvoiceId = null;
let printPaper = 'A4';

const PAPER_SIZES = {
  A4: { page: 'A4', preview: '500px' },
  A5: { page: 'A5', preview: '380px' },
  A3: { page: 'A3', preview: '580px' },
  K80: { page: '80mm auto', preview: '320px', isThermal: true },
};

/* ===== Thoát ký tự HTML an toàn ===== */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ===== Highlight số điện thoại trùng khớp khi tìm kiếm ===== */
function highlightPhoneMatch(phoneStr, qDigits) {
  if (!qDigits || !phoneStr) return escapeHtml(phoneStr || '');
  const cleanPhone = phoneStr.replace(/\D/g, '');
  const matchIdx = cleanPhone.indexOf(qDigits);
  if (matchIdx === -1) return escapeHtml(phoneStr);

  let digitCount = 0, startChar = -1, endChar = -1;
  for (let i = 0; i < phoneStr.length; i++) {
    if (/\d/.test(phoneStr[i])) {
      if (digitCount === matchIdx && startChar === -1) startChar = i;
      digitCount++;
      if (digitCount === matchIdx + qDigits.length) { endChar = i + 1; break; }
    }
  }

  if (startChar !== -1 && endChar !== -1) {
    const before = escapeHtml(phoneStr.slice(0, startChar));
    const matched = escapeHtml(phoneStr.slice(startChar, endChar));
    const after = escapeHtml(phoneStr.slice(endChar));
    return `${before}<b style="color:var(--brand);font-weight:700;text-decoration:underline">${matched}</b>${after}`;
  }
  return escapeHtml(phoneStr);
}

/* ===== Kiểm tra khách hàng hiện tại có phải là đại lý ===== */
function posCustomerIsAgent() {
  const custInput = document.getElementById('posCustomer');
  if (!custInput) return false;
  const c = findCustomer(custInput.value);
  return !!(c && c.type === 'agent');
}

/* ===== Tính tổng tiền hàng trước chiết khấu trong giỏ ===== */
function posRevenueAmount() {
  return cart.reduce((s, c) => {
    const p = findP(c.id);
    return s + (p ? p.price * c.qty : 0);
  }, 0);
}

/* ===== Chiết khấu theo TỪNG MÓN HÀNG (chỉ dành cho đại lý) ===== */
/* Mỗi dòng trong giỏ có `discPct` riêng. Tiền chiết khấu = giá trị dòng × % của dòng. */
function cartLineDiscAmt(c) {
  const p = findP(c.id);
  if (!p) return 0;
  const pct = Number(c.discPct) || 0;
  return Math.round((p.price * c.qty * pct) / 100);
}

function getDiscountAmt() {
  return cart.reduce((s, c) => s + cartLineDiscAmt(c), 0);
}

/* Giá trị sau chiết khấu của một dòng (dùng để hiển thị) */
function cartLineNet(c) {
  const p = findP(c.id);
  if (!p) return 0;
  return Math.max(0, p.price * c.qty - cartLineDiscAmt(c));
}

function isFullPhoneNumber(str) {
  if (!str) return false;
  return /^0\d{9}$/.test(String(str).trim());
}

function formatPhone(digits) {
  const d = (digits || '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return d;
}

/* ==========================================================================
   Ô TÌM KIẾM KHÁCH HÀNG TRONG POS
   ========================================================================== */

let activeCustomerMenuIdx = -1;

function customerMenuItem(it, idx) {
  if (it.isQuickAction) {
    return `<div class="cust-item quick-add-item ${idx === 0 ? 'selected-item' : ''}" style="background:var(--brand-soft);border:1px dashed var(--brand);margin-bottom:4px" onmousedown="focusQuickCustomer()">
      <div style="flex:1;min-width:0">
        <div class="ci-name" style="color:var(--brand);font-weight:600">${escapeHtml(it.name)}</div>
        <div class="ci-sub" style="color:var(--txt)">${it.sub}</div>
      </div>
      <span class="type-pill purple">Tạo mới</span>
    </div>`;
  }

  const isRetail = it.name === 'Khách lẻ';
  return `<div class="cust-item ${idx === 0 ? 'selected-item' : ''}" data-name="${escapeHtml(it.name)}" onmousedown="selectCustomer(this.getAttribute('data-name'))">
    <div style="flex:1;min-width:0">
      <div class="ci-name">${escapeHtml(it.name)}</div>
      <div class="ci-sub">${it.sub}</div>
    </div>
    <span class="type-pill ${it.type}">${it.type === 'agent' ? 'Đại lý' : isRetail ? 'Mặc định' : 'Khách lẻ'}</span>
  </div>`;
}

function renderCustomerMenu(q) {
  q = (q == null ? '' : q).trim();
  const qLower = q.toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const menu = document.getElementById('customerMenu');
  if (!menu) return;

  activeCustomerMenuIdx = -1;
  const showAll = !q || qLower === 'khách lẻ';
  const items = [];

  if (showAll || 'khách lẻ'.includes(qLower) || 'khach le'.includes(qLower)) {
    items.push({ name: 'Khách lẻ', phone: '', type: 'retail', sub: 'Khách mua lẻ vãng lai (không lưu hồ sơ)' });
  }

  const customers = (DB && Array.isArray(DB.customers)) ? DB.customers : [];

  if (isFullPhoneNumber(q)) {
    const existing = customers.find(c => (c.phone || '').replace(/\D/g, '') === q);
    if (!existing) {
      items.unshift({
        name: `➕ Thêm khách mới với SĐT ${formatPhone(q)}`,
        isQuickAction: true,
        type: 'retail',
        sub: 'SĐT chưa có trong hệ thống — Bấm vào để nhập tên'
      });
    }
  }

  let matched = [];
  if (showAll) {
    matched = customers.slice();
  } else {
    const startsWithPhone = [], includesPhone = [], startsWithName = [], includesName = [];
    const qNoTone = removeVietnameseTones(qLower);

    customers.forEach(c => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      const nameL = (c.name || '').toLowerCase();

      if (qDigits.length > 0) {
        if (cleanPhone.startsWith(qDigits)) { startsWithPhone.push(c); return; }
        if (cleanPhone.includes(qDigits)) { includesPhone.push(c); return; }
      }

      const nameNoTone = removeVietnameseTones(nameL);
      if (nameL.startsWith(qLower) || nameNoTone.startsWith(qNoTone)) startsWithName.push(c);
      else if (nameL.includes(qLower) || nameNoTone.includes(qNoTone)) includesName.push(c);
    });

    matched = [...startsWithPhone, ...includesPhone, ...startsWithName, ...includesName];
  }

  matched.forEach(c => {
    const phoneDisplay = c.phone ? `📞 ${highlightPhoneMatch(c.phone, qDigits)}` : '<span style="color:var(--dim)">Chưa có SĐT</span>';
    const debtNote = (c.debt > 0) ? ` <span style="color:var(--red);font-weight:600">· Nợ ${fmtShort(c.debt)}</span>` : '';
    items.push({ name: c.name, phone: c.phone || '', type: c.type, sub: phoneDisplay + debtNote });
  });

  if (items.length) {
    menu.innerHTML = items.map((it, idx) => customerMenuItem(it, idx)).join('');
  } else {
    menu.innerHTML = `<div class="cust-empty">
      Không tìm thấy khách hàng khớp với "<b>${escapeHtml(q)}</b>"<br>
      <small style="color:var(--muted);display:block;margin-top:4px">Bấm ra ngoài hoặc Enter để dùng "${escapeHtml(q)}" cho hóa đơn</small>
    </div>`;
  }
  menu.style.display = 'block';
}

function openCustomerMenu() {
  const input = document.getElementById('posCustomer');
  const val = input ? input.value : '';
  renderCustomerMenu(val === 'Khách lẻ' ? '' : val);
}

function onCustomerInput() {
  const input = document.getElementById('posCustomer');
  const errEl = document.getElementById('posCustError');
  const quickBox = document.getElementById('quickAddCustBox');
  const quickPhoneDisplay = document.getElementById('quickCustPhoneDisplay');
  const badge = document.getElementById('custBadge');
  const menu = document.getElementById('customerMenu');

  if (!input) return;
  const val = (input.value || '').trim();

  if (!val) {
    input.classList.remove('is-invalid');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if (quickBox) quickBox.style.display = 'none';
    renderCustomerMenu('');
    return;
  }

  // Người dùng đang gõ số điện thoại
  if (/^\d/.test(val)) {
    const pCheck = validatePhoneNumber(val, true);
    if (!pCheck.valid) {
      input.classList.add('is-invalid');
      if (errEl) { errEl.textContent = pCheck.error; errEl.style.display = 'block'; }
      if (pCheck.code !== 'INCOMPLETE') toast(pCheck.error);
      if (quickBox) quickBox.style.display = 'none';
      if (menu) menu.style.display = 'none';
      return;
    }
  }

  input.classList.remove('is-invalid');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  const customers = (DB && Array.isArray(DB.customers)) ? DB.customers : [];
  const existing = isFullPhoneNumber(val)
    ? customers.find(c => (c.phone || '').replace(/\D/g, '') === val)
    : null;

  if (existing) {
    if (quickBox) quickBox.style.display = 'none';
    const badgeEl = document.getElementById('custBadge');
    if (badgeEl) {
      badgeEl.style.display = 'block';
      badgeEl.innerHTML = `<span class="type-pill ${existing.type}">${existing.type === 'agent' ? 'Đại lý' : 'Khách quen'}</span>
        <span style="font-size:12px;color:var(--txt);font-weight:600">📞 ${escapeHtml(existing.phone || 'Chưa có SĐT')}</span>` +
        ((existing.debt > 0) ? ` <span class="pill red" style="font-size:11px">⚠️ Dư nợ: ${fmt(existing.debt)}</span>` : '');
    }
  } else if (isFullPhoneNumber(val)) {
    // SĐT đủ 10 số nhưng chưa có trong hệ thống -> hiện hộp tạo nhanh
    if (quickBox) {
      quickBox.style.display = 'block';
      quickBox.dataset.phone = val;
      if (quickPhoneDisplay) quickPhoneDisplay.textContent = formatPhone(val);
    }
    if (badge) badge.style.display = 'none';
  } else {
    if (quickBox) quickBox.style.display = 'none';
    if (badge) badge.style.display = 'none';
  }

  renderCustomerMenu(val);
}

function closeQuickAddBox() {
  const quickBox = document.getElementById('quickAddCustBox');
  if (quickBox) quickBox.style.display = 'none';
  const nameInput = document.getElementById('quickCustName');
  if (nameInput) nameInput.value = '';
}

function focusQuickCustomer() {
  const quickBox = document.getElementById('quickAddCustBox');
  if (quickBox) quickBox.style.display = 'block';
  const nameInput = document.getElementById('quickCustName');
  if (nameInput) { nameInput.focus(); nameInput.select(); }
  const menu = document.getElementById('customerMenu');
  if (menu) menu.style.display = 'none';
}

/* ===== Lưu nhanh khách hàng mới ngay tại màn hình Bán hàng ===== */
function saveQuickCustomer() {
  const nameInput = document.getElementById('quickCustName');
  const posInput = document.getElementById('posCustomer');
  const quickBox = document.getElementById('quickAddCustBox');
  const name = (nameInput ? nameInput.value : '').trim();
  const phoneDigits = ((quickBox && quickBox.dataset.phone) || (posInput ? posInput.value : '') || '').trim();

  const pCheck = validatePhoneNumber(phoneDigits, false);
  if (!pCheck.valid) {
    toast(pCheck.error);
    if (posInput) markInvalid(posInput, pCheck.error);
    return;
  }
  if (!name) { markInvalid(nameInput, 'Vui lòng nhập tên khách hàng mới!'); return; }
  if (name.length < 2) { markInvalid(nameInput, 'Tên khách hàng phải có ít nhất 2 ký tự!'); return; }

  const customers = (DB.customers = DB.customers || []);
  const existing = customers.find(c => (c.phone || '').replace(/\D/g, '') === phoneDigits);
  if (existing) {
    toast(`Số điện thoại này đã thuộc về khách hàng "${existing.name}"!`);
    return;
  }

  const newCust = {
    id: nextId('KH', DB.customers, 'nextCustomerId', 2),
    name,
    phone: formatPhone(phoneDigits),
    type: 'retail',
    debt: 0
  };
  DB.customers.push(newCust);
  saveDB();

  if (posInput) {
    posInput.value = newCust.name;
    posInput.classList.remove('is-invalid');
    const errEl = document.getElementById('posCustError');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  }
  if (nameInput) nameInput.value = '';
  if (quickBox) quickBox.style.display = 'none';
  const menu = document.getElementById('customerMenu');
  if (menu) menu.style.display = 'none';

  onPosCustomerChange();
  toast(`Đã tạo và chọn khách hàng: ${newCust.name} (${newCust.phone})`);
}

/* ===== Sinh mã tự tăng dùng chung cho mọi danh mục ===== */
function nextId(prefix, list, counterKey, pad) {
  let max = 0;
  (list || []).forEach(item => {
    if (item.id && String(item.id).startsWith(prefix + '-')) {
      const n = parseInt(String(item.id).replace(prefix + '-', ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  const next = Math.max(max + 1, DB[counterKey] || 1);
  DB[counterKey] = next + 1;
  return prefix + '-' + String(next).padStart(pad || 2, '0');
}

function closeCustomerMenu() {
  setTimeout(() => {
    const m = document.getElementById('customerMenu');
    if (m) m.style.display = 'none';
  }, 200);
}

function selectCustomer(name) {
  const el = document.getElementById('posCustomer');
  if (el) { el.value = name; el.classList.remove('is-invalid'); }
  const errEl = document.getElementById('posCustError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  const m = document.getElementById('customerMenu');
  if (m) m.style.display = 'none';
  const quickBox = document.getElementById('quickAddCustBox');
  if (quickBox) quickBox.style.display = 'none';

  onPosCustomerChange();
}

function onCustomerKeyDown(e) {
  const menu = document.getElementById('customerMenu');
  const quickBox = document.getElementById('quickAddCustBox');

  if (e.key === 'Enter' && quickBox && quickBox.style.display !== 'none') {
    e.preventDefault();
    focusQuickCustomer();
    return;
  }

  if (!menu || menu.style.display === 'none') {
    if (e.key === 'ArrowDown') { openCustomerMenu(); e.preventDefault(); }
    return;
  }

  const items = menu.querySelectorAll('.cust-item');
  if (!items.length) {
    if (e.key === 'Escape') closeCustomerMenu();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeCustomerMenuIdx = (activeCustomerMenuIdx + 1) % items.length;
    updateActiveCustomerMenuItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeCustomerMenuIdx = (activeCustomerMenuIdx - 1 + items.length) % items.length;
    updateActiveCustomerMenuItem(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const target = (activeCustomerMenuIdx >= 0 && activeCustomerMenuIdx < items.length) ? items[activeCustomerMenuIdx] : items[0];
    if (target.classList.contains('quick-add-item')) { focusQuickCustomer(); return; }
    selectCustomer(target.getAttribute('data-name'));
    closeCustomerMenu();
  } else if (e.key === 'Escape') {
    closeCustomerMenu();
    if (quickBox) quickBox.style.display = 'none';
  }
}

function updateActiveCustomerMenuItem(items) {
  items.forEach((item, idx) => {
    item.classList.toggle('active', idx === activeCustomerMenuIdx);
    if (idx === activeCustomerMenuIdx) item.scrollIntoView({ block: 'nearest' });
  });
}

function onPosCustomerChange() {
  const custInput = document.getElementById('posCustomer');
  if (!custInput) return;
  const val = (custInput.value || '').trim();
  const errEl = document.getElementById('posCustError');
  const badge = document.getElementById('custBadge');

  if (/^\d/.test(val)) {
    const pCheck = validatePhoneNumber(val, false);
    if (!pCheck.valid) {
      custInput.classList.add('is-invalid');
      if (errEl) { errEl.textContent = pCheck.error; errEl.style.display = 'block'; }
      toast(pCheck.error);
      if (badge) badge.style.display = 'none';
      return;
    }
  }

  custInput.classList.remove('is-invalid');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  const c = findCustomer(val);

  if (c) {
    if (custInput.value !== c.name) custInput.value = c.name;
    const quickBox = document.getElementById('quickAddCustBox');
    if (quickBox) quickBox.style.display = 'none';
    if (badge) {
      badge.style.display = 'block';
      badge.innerHTML = `<span class="type-pill ${c.type}">${c.type === 'agent' ? 'Đại lý' : 'Khách quen'}</span>
        <span style="font-size:12px;color:var(--txt);font-weight:600">📞 ${escapeHtml(c.phone || 'Chưa có SĐT')}</span>` +
        ((c.debt > 0) ? ` <span class="pill red" style="font-size:11px">⚠️ Dư nợ: ${fmt(c.debt)}</span>` : '');
    }
  } else if (badge) {
    badge.style.display = 'none';
  }

  renderPosCart();
  calculateChange();
}

/* ==========================================================================
   CHIẾT KHẤU TỪNG MÓN & THANH TOÁN
   ========================================================================== */

/* Đặt % chiết khấu cho một dòng hàng trong giỏ (gọi từ code/nút) */
function setLineDiscount(id, value) {
  const idx = cart.findIndex(c => c.id === id);
  if (idx < 0) return;
  let pct = parseFloat(String(value).replace(',', '.'));
  if (isNaN(pct) || pct < 0) pct = 0;
  if (pct > 100) {
    pct = 100;
    const el = document.querySelector(`.line-disc-input[data-id="${id}"]`);
    if (el) el.value = 100;
    toast('Chiết khấu tối đa 100%');
  }
  cart[idx].discPct = pct;

  const el = document.querySelector(`.line-disc-input[data-id="${id}"]`);
  if (el && document.activeElement !== el) el.value = pct || '';

  const amtEl = document.querySelector(`.ld-amt[data-ld-amt="${id}"]`);
  if (amtEl) {
    const lineDisc = cartLineDiscAmt(cart[idx]);
    amtEl.textContent = lineDisc > 0 ? '−' + fmt(lineDisc) : '—';
  }

  refreshPosTotals();
}

/* Hiện/ẩn khối chiết khấu đại lý theo loại khách đang chọn */
function syncAgentDiscountBox() {
  const isAgent = posCustomerIsAgent();
  const discountBox = document.getElementById('discountBox');
  if (discountBox) discountBox.style.display = isAgent ? '' : 'none';
}

/* Đặt nhanh % chiết khấu cho mọi dòng hàng (tiện cho đại lý lấy nhiều món cùng mức) */
function applyDiscountToAll(value) {
  let pct = parseFloat(String(value).replace(',', '.'));
  if (isNaN(pct) || pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  cart.forEach(c => { c.discPct = pct; });
  // Điền giá trị vào từng ô nhập và cập nhật số tiền từng dòng
  cart.forEach(c => {
    const el = document.querySelector(`.line-disc-input[data-id="${c.id}"]`);
    if (el) el.value = pct || '';
    const amtEl = document.querySelector(`.ld-amt[data-ld-amt="${c.id}"]`);
    if (amtEl) {
      const lineDisc = cartLineDiscAmt(c);
      amtEl.textContent = lineDisc > 0 ? '−' + fmt(lineDisc) : '—';
    }
  });
  refreshPosTotals();
}

function onPaymentMethodChange() {
  const method = document.getElementById('posPaymentMethod').value || 'cash';
  const cashBox = document.getElementById('posCashBox');
  const qrBox = document.getElementById('posQrBox');
  if (method === 'cash') {
    if (cashBox) cashBox.style.display = 'block';
    if (qrBox) qrBox.style.display = 'none';
    calculateChange();
  } else {
    if (cashBox) cashBox.style.display = 'none';
    if (qrBox) qrBox.style.display = 'block';
    updatePosQrCode();
  }
}

function onPosStatusChange() {
  const status = document.getElementById('posStatus').value || 'paid';
  const paidInput = document.getElementById('posCustomerPaid');
  const method = document.getElementById('posPaymentMethod').value || 'cash';
  const net = posNetPay();

  if (method === 'cash') {
    if (status === 'pending') {
      if (paidInput && parseFloat(paidInput.value || 0) >= net) paidInput.value = '0';
      if (cashNoticeVisible()) {
        showPosNotice('Khách mua nợ: điền số tiền khách trả trước (có thể để 0 nếu nợ toàn bộ).', 'warn');
      }
    } else if (paidInput && (parseFloat(paidInput.value || 0) === 0 || parseFloat(paidInput.value || 0) > net)) {
      paidInput.value = net;
    }
  }
  calculateChange();
}

function cashNoticeVisible() {
  const el = document.getElementById('posDebtNotice');
  return el && el.style.display !== 'none';
}

function showPosNotice(html, kind) {
  const el = document.getElementById('posDebtNotice');
  if (!el) return;
  const colors = kind === 'ok'
    ? { bg: 'var(--teal-soft)', bd: 'var(--teal)', fg: 'var(--teal)' }
    : kind === 'warn'
      ? { bg: 'var(--amber-soft)', bd: 'var(--amber)', fg: 'var(--amber)' }
      : { bg: 'var(--red-soft)', bd: 'var(--red)', fg: 'var(--red)' };
  el.style.display = 'block';
  el.style.background = colors.bg;
  el.style.border = '1px solid ' + colors.bd;
  el.style.color = colors.fg;
  el.innerHTML = html;
}

function posNetPay() {
  return Math.max(0, posRevenueAmount() - getDiscountAmt());
}

function calculateChange() {
  const changeEl = document.getElementById('posChangeText');
  if (!changeEl) return;

  const net = posNetPay();
  const paidInput = document.getElementById('posCustomerPaid');
  const paid = parseFloat(paidInput ? paidInput.value : 0) || 0;
  const labelEl = document.getElementById('posChangeLabel');
  const noticeEl = document.getElementById('posDebtNotice');
  const status = document.getElementById('posStatus').value || 'paid';
  const custVal = (document.getElementById('posCustomer').value || '').trim() || 'Khách lẻ';
  const c = findCustomer(custVal);
  const curDebt = c ? (c.debt || 0) : 0;

  if (net === 0) {
    if (labelEl) labelEl.textContent = 'Tiền thừa trả khách:';
    changeEl.textContent = '0₫';
    changeEl.style.color = 'var(--muted)';
    if (noticeEl) noticeEl.style.display = 'none';
    return;
  }

  if (status === 'pending' || paid < net) {
    const remain = Math.max(0, net - paid);
    if (labelEl) labelEl.textContent = 'Ghi nợ cho đơn này:';
    changeEl.textContent = fmt(remain);
    changeEl.style.color = 'var(--red)';

    if (c) {
      showPosNotice(`⚠️ Sẽ cộng <b>${fmt(remain)}</b> vào dư nợ của <b>${escapeHtml(c.name)}</b>.<br>Tổng nợ sau đơn này: <b>${fmt(curDebt + remain)}</b>`, 'warn');
    } else {
      showPosNotice(`⚠️ Đơn này ghi nợ <b>${fmt(remain)}</b> nhưng <b>chưa xác định được khách hàng</b>.<br>Vui lòng nhập Tên hoặc SĐT khách để theo dõi được khoản nợ.`, 'error');
    }
  } else {
    const change = paid - net;
    if (labelEl) labelEl.textContent = 'Tiền thừa trả khách:';
    changeEl.textContent = fmt(change);
    changeEl.style.color = 'var(--teal)';
    if (change > 0) {
      showPosNotice(`✓ Khách đưa dư <b>${fmt(change)}</b> — nhớ trả lại tiền thừa cho khách.`, 'ok');
    } else if (noticeEl) {
      noticeEl.style.display = 'none';
    }
  }
}

function setExactCash() {
  const paidInput = document.getElementById('posCustomerPaid');
  if (paidInput) { paidInput.value = posNetPay(); calculateChange(); }
}

function addCash(amt) {
  const paidInput = document.getElementById('posCustomerPaid');
  if (paidInput) {
    paidInput.value = (parseFloat(paidInput.value || 0) || 0) + amt;
    calculateChange();
  }
}

function setCash(amt) {
  const paidInput = document.getElementById('posCustomerPaid');
  if (paidInput) { paidInput.value = amt; calculateChange(); }
}

function updatePosQrCode() {
  const qrWrap = document.getElementById('posQrImageWrap');
  const bankInfo = document.getElementById('posQrBankInfo');
  if (!qrWrap) return;

  const net = posNetPay();
  const s = getStoreSettings();

  if (!s.bankId || !s.accountNo) {
    qrWrap.innerHTML = '<div class="muted" style="padding:16px;font-size:12px;text-align:center">Chưa cài đặt tài khoản ngân hàng trong tab Cài đặt</div>';
    if (bankInfo) bankInfo.innerHTML = '';
    return;
  }
  if (net <= 0) {
    qrWrap.innerHTML = '<div class="muted" style="padding:16px;font-size:12px;text-align:center">Chưa có sản phẩm trong hóa đơn</div>';
    if (bankInfo) bankInfo.innerHTML = '';
    return;
  }

  const nextCode = 'HD-' + (DB.nextInvoiceId || 1015);
  const qrUrl = getVietQrUrl(net, nextCode, s);
  qrWrap.innerHTML = `<img src="${qrUrl}" alt="Mã VietQR" style="max-width:200px;height:auto;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.12)">`;
  if (bankInfo) {
    bankInfo.innerHTML = `<div>Ngân hàng: <b>${escapeHtml(s.bankName || s.bankId)}</b></div>
      <div>Số TK: <b>${escapeHtml(s.accountNo)}</b> (${escapeHtml(s.accountName)})</div>
      <div>Số tiền: <b style="color:var(--brand);font-size:13px">${fmt(net)}</b></div>`;
  }
}

/* ==========================================================================
   LƯỚI SẢN PHẨM & GIỎ HÀNG
   ========================================================================== */

function renderPos() {
  const catSel = document.getElementById('posCat');
  const categories = (DB && Array.isArray(DB.categories)) ? DB.categories : [];
  if (catSel) {
    const cc = catSel.value;
    catSel.innerHTML = '<option value="">Tất cả danh mục</option>' + categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    catSel.value = cc;
  }
  const cust = document.getElementById('posCustomer');
  if (cust && !cust.value) cust.value = 'Khách lẻ';

  renderPosProducts();
  renderPosCart();
  onPaymentMethodChange();
  onPosCustomerChange();
}

function renderPosProducts() {
  const searchInput = document.getElementById('posSearch');
  const q = (searchInput ? searchInput.value : '').trim();
  const qRaw = q.toLowerCase();
  const qNoTone = removeVietnameseTones(qRaw);
  const qClean = qRaw.replace(/[^a-z0-9]/g, '');
  const cat = document.getElementById('posCat').value || '';

  const products = (DB && Array.isArray(DB.products)) ? DB.products : [];
  const list = products.filter(p => {
    if (cat && p.cat !== cat) return false;
    if (!q) return true;
    return getProductSearchRank(p, qRaw, qNoTone, qClean) < 999;
  });

  if (q) {
    list.sort((a, b) => {
      const ra = getProductSearchRank(a, qRaw, qNoTone, qClean);
      const rb = getProductSearchRank(b, qRaw, qNoTone, qClean);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, 'vi');
    });
  }

  const container = document.getElementById('posProducts');
  if (!container) return;

  container.innerHTML = list.length ? list.map(p => {
    const out = p.stock <= 0;
    const inCart = cart.find(c => c.id === p.id);
    return `<div class="prod-card ${out ? 'disabled' : ''}" onclick="${out ? "toast('Sản phẩm đã hết hàng!')" : `addToCart('${p.id}')`}">
      <div class="pname"><span class="muted" style="font-weight:600;font-size:12px;margin-right:4px">[${p.id}]</span>${escapeHtml(p.name)}</div>
      <div class="pcat">${escapeHtml(catName(p.cat))} · ${escapeHtml(p.brand || 'Khác')}</div>
      <div class="prow"><span class="pprice">${fmt(p.price)}</span><span class="punit">/${escapeHtml(catUnit(p.cat))}</span></div>
      <div class="pstock ${out ? 'out' : ''}">${out ? 'Hết hàng' : 'Còn ' + fmtQty(p.stock) + ' ' + escapeHtml(catUnit(p.cat))}${inCart ? ' · <b style="color:var(--brand)">Đã chọn ' + fmtQty(inCart.qty) + '</b>' : ''}</div>
    </div>`;
  }).join('') : '<div class="empty">Không tìm thấy sản phẩm phù hợp</div>';
}

function onPosSearchKeyDown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const container = document.getElementById('posProducts');
    const firstCard = container ? container.querySelector('.prod-card:not(.disabled)') : null;
    if (firstCard) firstCard.click();
  }
}

function addToCart(id) {
  const p = findP(id);
  if (!p) return;
  if (p.stock <= 0) {
    toast(`Sản phẩm "${p.name}" đã hết hàng trong kho!`);
    return;
  }

  const step = catStep(p.cat);
  const idx = cart.findIndex(c => c.id === id);

  if (idx >= 0) {
    if (cart[idx].qty + step <= p.stock + 0.0001) {
      cart[idx].qty = roundQty(cart[idx].qty + step, step);
    } else {
      toast(`Kho chỉ còn ${fmtQty(p.stock)} ${catUnit(p.cat)}`);
      return;
    }
  } else {
    cart.push({ id, qty: step, discPct: 0 });
  }
  renderPosCart();
  renderPosProducts();
}

function setQty(id, v) {
  const p = findP(id);
  if (!p) return;
  const step = catStep(p.cat);
  if (typeof v === 'string') v = v.replace(',', '.');
  v = parseFloat(v);
  if (isNaN(v) || v <= 0) { v = step; toast('Số lượng phải lớn hơn 0'); }
  v = roundQty(v, step);
  if (v > p.stock) { v = p.stock; toast(`Kho chỉ còn tối đa ${fmtQty(p.stock)} ${catUnit(p.cat)}`); }

  const idx = cart.findIndex(c => c.id === id);
  if (idx >= 0) cart[idx].qty = v;
  renderPosCart();
  renderPosProducts();
}

function incQty(id, d) {
  const p = findP(id);
  const idx = cart.findIndex(c => c.id === id);
  if (!p || idx < 0) return;

  const step = catStep(p.cat);
  let v = roundQty(cart[idx].qty + d * step, step);
  if (v < step) v = step;
  if (v > p.stock) { v = p.stock; toast(`Kho chỉ còn ${fmtQty(p.stock)} ${catUnit(p.cat)}`); }

  cart[idx].qty = v;
  renderPosCart();
  renderPosProducts();
}

function removeCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderPosCart();
  renderPosProducts();
}

function clearCart() {
  if (cart.length && !confirm('Xóa toàn bộ sản phẩm trong hóa đơn hiện tại?')) return;
  cart = [];
  renderPosCart();
  renderPosProducts();
}

function renderPosCart() {
  const box = document.getElementById('posCart');
  if (!box) return;

  const isAgent = posCustomerIsAgent();

  if (!cart.length) {
    box.innerHTML = '<div class="empty" style="padding:26px 0">Chọn sản phẩm bên trái để thêm vào giỏ</div>';
  } else {
    box.innerHTML = cart.map(c => {
      const p = findP(c.id);
      if (!p) return '';
      const step = catStep(p.cat);
      const lineTotal = p.price * c.qty;
      const lineDisc = cartLineDiscAmt(c);
      const discPct = Number(c.discPct) || 0;

      // Ô chiết khấu riêng cho từng món — chỉ hiện khi khách là ĐẠI LÝ
      const discRow = isAgent ? `
        <div class="line-disc">
          <span class="ld-lbl">Chiết khấu món:</span>
          <input type="number" min="0" max="100" step="0.5" value="${discPct || ''}" placeholder="0"
            class="line-disc-input" data-id="${c.id}"
            oninput="onLineDiscountInput('${c.id}', this)"
            onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
          <span class="ld-pct">%</span>
          <span class="ld-amt" data-ld-amt="${c.id}">${lineDisc > 0 ? '−' + fmt(lineDisc) : '—'}</span>
        </div>` : '';

      return `<div class="cart-line-wrap" data-line="${c.id}">
        <div class="cart-line">
          <div class="cinfo">
            <b>${escapeHtml(p.name)}</b>
            <span>${fmt(p.price)} / ${escapeHtml(catUnit(p.cat))}</span>
          </div>
          <div class="qty-ctrl">
            <button type="button" onclick="incQty('${c.id}', -1)">−</button>
            <input type="number" min="${step}" max="${p.stock}" step="${step}" value="${qtyInputValue(c.qty)}" onchange="setQty('${c.id}', this.value)">
            <button type="button" onclick="incQty('${c.id}', 1)">＋</button>
          </div>
          <div style="width:90px;text-align:right" class="money">${fmt(lineTotal)}</div>
          <span class="close-x" style="font-size:15px" onclick="removeCart('${c.id}')" title="Xóa món">✕</span>
        </div>
        ${discRow}
      </div>`;
    }).join('');
  }

  refreshPosTotals();
}

/* Chỉ cập nhật lại các con số tổng — KHÔNG render lại DOM giỏ hàng.
   Dùng khi người dùng đang gõ % chiết khấu để tránh giật/lag và mất con trỏ. */
function refreshPosTotals() {
  let rev = 0, cost = 0;
  cart.forEach(c => {
    const p = findP(c.id);
    if (!p) return;
    rev += p.price * c.qty;
    cost += p.cost * c.qty;
  });

  const disc = getDiscountAmt();
  const pay = Math.max(0, rev - disc);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('posRevenue', fmt(rev));
  set('posCost', fmt(cost));

  const drow = document.getElementById('discountRow');
  if (drow) {
    if (disc > 0) {
      drow.style.display = '';
      set('posDiscount', '−' + fmt(disc));
    } else {
      drow.style.display = 'none';
    }
  }

  set('posPay', fmt(pay));
  set('posProfit', fmt(rev - cost - disc));
  syncAgentDiscountBox();

  calculateChange();
  if (document.getElementById('posPaymentMethod') &&
    document.getElementById('posPaymentMethod').value === 'transfer') updatePosQrCode();
}

/* Nhập % chiết khấu từng dòng: cập nhật số tiền dòng đó + tổng, không render lại giỏ */
function onLineDiscountInput(id, el) {
  const idx = cart.findIndex(c => c.id === id);
  if (idx < 0) return;
  let pct = parseFloat(String(el.value).replace(',', '.'));
  if (isNaN(pct) || pct < 0) pct = 0;
  if (pct > 100) {
    pct = 100;
    el.value = 100;
    toast('Chiết khấu tối đa 100%');
  }
  cart[idx].discPct = pct;

  // Cập nhật số tiền chiết khấu ngay trên dòng đang gõ
  const amtEl = document.querySelector(`.ld-amt[data-ld-amt="${id}"]`);
  if (amtEl) {
    const lineDisc = cartLineDiscAmt(cart[idx]);
    amtEl.textContent = lineDisc > 0 ? '−' + fmt(lineDisc) : '—';
  }

  refreshPosTotals();
}

/* ==========================================================================
   LƯU HÓA ĐƠN
   ========================================================================== */

function savePosInvoice() {
  if (!cart.length) {
    toast('Vui lòng chọn ít nhất 1 sản phẩm vào giỏ hàng!');
    return;
  }

  const custInput = document.getElementById('posCustomer');
  const customer = (custInput.value || '').trim() || 'Khách lẻ';
  let status = document.getElementById('posStatus').value || 'paid';
  const paymentMethod = document.getElementById('posPaymentMethod').value || 'cash';
  const customerPaid = parseFloat(document.getElementById('posCustomerPaid').value || 0) || 0;

  // Nếu người dùng gõ số điện thoại thay vì tên khách
  if (/^\d/.test(customer)) {
    const pCheck = validatePhoneNumber(customer, false);
    if (!pCheck.valid) {
      markInvalid(custInput, pCheck.error);
      const errEl = document.getElementById('posCustError');
      if (errEl) { errEl.textContent = pCheck.error; errEl.style.display = 'block'; }
      return;
    }
  }

  // 1. Kiểm tra tồn kho thực tế
  for (const c of cart) {
    const p = findP(c.id);
    if (!p) { toast(`Lỗi: Không tìm thấy sản phẩm ${c.id}`); return; }
    if (c.qty <= 0) { toast(`Số lượng mua của "${p.name}" phải lớn hơn 0!`); return; }
    if (c.qty > p.stock) {
      toast(`Sản phẩm "${p.name}" chỉ còn ${fmtQty(p.stock)} ${catUnit(p.cat)}, không đủ để bán!`);
      return;
    }
  }

  // 2. Chiết khấu từng món (chỉ áp dụng khi khách là đại lý) & số tiền cần thanh toán
  const isAgent = posCustomerIsAgent();
  const discAmt = isAgent ? getDiscountAmt() : 0;
  const netPay = Math.max(0, posRevenueAmount() - discAmt);

  // 3. Số tiền khách trả thực tế & dư nợ phát sinh
  let actualPaid = 0;
  let orderDebt = 0;
  let changeAmt = 0;

  if (paymentMethod === 'cash') {
    if (status === 'pending') {
      actualPaid = Math.min(netPay, Math.max(0, customerPaid));
      orderDebt = Math.max(0, netPay - actualPaid);
      changeAmt = customerPaid > netPay ? customerPaid - netPay : 0;
    } else if (customerPaid > 0 && customerPaid < netPay) {
      // Khách đưa thiếu -> tự động ghi nợ phần còn lại
      actualPaid = customerPaid;
      orderDebt = netPay - actualPaid;
      status = 'pending';
    } else if (customerPaid >= netPay) {
      actualPaid = netPay;
      changeAmt = customerPaid - netPay;
    } else {
      // Chọn "đã thanh toán" nhưng không nhập tiền khách đưa -> thu đủ tại quầy
      actualPaid = netPay;
    }
  } else {
    if (status === 'pending') {
      actualPaid = 0;
      orderDebt = netPay;
    } else {
      actualPaid = netPay;
    }
  }

  // 4. Xác định khách hàng & cộng dư nợ
  let custObj = findCustomer(customer);
  const oldDebt = custObj ? (custObj.debt || 0) : 0;

  if (orderDebt > 0) {
    // Khách vãng lai muốn ghi nợ -> bắt buộc phải có tên hoặc SĐT để theo dõi
    if (!custObj && (!customer || customer.toLowerCase() === 'khách lẻ')) {
      toast('Đơn ghi nợ cần có Tên hoặc SĐT khách hàng. Vui lòng nhập tên/SĐT khách rồi lưu lại!');
      custInput.focus();
      custInput.classList.add('is-invalid');
      const errEl = document.getElementById('posCustError');
      if (errEl) {
        errEl.textContent = 'Chưa có thông tin khách hàng để ghi nợ.';
        errEl.style.display = 'block';
      }
      return;
    }
    if (!custObj) {
      custObj = {
        id: nextId('KH', DB.customers, 'nextCustomerId', 2),
        name: customer,
        phone: /^\d{10}$/.test(customer.replace(/\D/g, '')) ? formatPhone(customer) : '',
        type: 'retail',
        debt: 0
      };
      DB.customers.push(custObj);
    }
    custObj.debt = (custObj.debt || 0) + orderDebt;
  }

  const totalDebtAfter = custObj ? (custObj.debt || 0) : 0;
  const id = 'HD-' + (DB.nextInvoiceId++);

  const invoiceData = {
    id,
    customer: custObj ? custObj.name : customer,
    note: '',
    paymentMethod,
    totalAmount: netPay,
    customerPaid: actualPaid,
    debtAmount: orderDebt,
    changeAmt,
    customerOldDebt: oldDebt,
    customerTotalDebt: totalDebtAfter,
    date: todayIso(),
    items: cart.map(c => [c.id, c.qty, isAgent ? (Number(c.discPct) || 0) : 0]),
    status: orderDebt > 0 ? 'pending' : 'paid',
    exportCount: 0,
    discountAmt: 0,
    discountPct: 0
  };

  if (!Array.isArray(DB.invoices)) DB.invoices = [];
  DB.invoices.unshift(invoiceData);

  // 5. Ghi sổ kho (xuất bán) — tồn kho được trừ và lưu vết đầy đủ
  const soldName = invoiceData.customer;
  cart.forEach(c => {
    recordStockMove(c.id, -c.qty, 'sale', {
      reason: 'Xuất bán theo hóa đơn',
      refId: id,
      refName: soldName,
    });
  });

  // 6. Reset POS
  cart = [];

  const paidEl = document.getElementById('posCustomerPaid');
  if (paidEl) paidEl.value = '';
  const statusEl = document.getElementById('posStatus');
  if (statusEl) statusEl.value = 'paid';
  const changeEl = document.getElementById('posChangeText');
  if (changeEl) changeEl.textContent = '0₫';
  const noticeEl = document.getElementById('posDebtNotice');
  if (noticeEl) noticeEl.style.display = 'none';

  saveDB(true);

  // 7. Mở luôn phiếu để in hoặc chuyển sang danh sách hóa đơn
  const wantPrint = confirm(`✓ Đã lưu hóa đơn ${id} (${fmt(netPay)}).\n\nBạn có muốn MỞ PHIẾU ĐỂ IN ngay bây giờ không?`);
  if (wantPrint) {
    renderPos();
    viewInvoice(id);
  } else {
    switchView('hoadon');
  }

  if (orderDebt > 0) {
    toast(`Đã lưu ${id}. Ghi nợ ${fmt(orderDebt)} cho "${invoiceData.customer}" (Tổng nợ: ${fmt(totalDebtAfter)})`);
  } else {
    toast('Đã lưu thành công hóa đơn ' + id);
  }
}

/* ==========================================================================
   CHI TIẾT, IN ẤN VÀ XUẤT HÓA ĐƠN
   ========================================================================== */

function setPrintPaper(size) {
  printPaper = PAPER_SIZES[size] ? size : 'A4';
  const cfg = PAPER_SIZES[printPaper];
  const paper = document.querySelector('.inv-paper');
  if (paper) {
    paper.style.maxWidth = cfg.preview;
    paper.classList.toggle('k80', !!cfg.isThermal);
  }

  let st = document.getElementById('printPageStyle');
  if (!st) {
    st = document.createElement('style');
    st.id = 'printPageStyle';
    document.head.appendChild(st);
  }
  st.textContent = cfg.isThermal
    ? `@media print{ @page{ size: 80mm auto; margin: 3mm 2mm } body{ margin:0 } .inv-paper{ width:76mm !important; max-width:76mm !important; padding:4px !important; } }`
    : `@media print{ @page{ size: ${cfg.page} portrait; margin: 10mm } }`;
}

function renderInvoicePaper(i) {
  const total = invoiceTotal(i.items);
  const itemDisc = invoiceItemsDiscount(i.items);
  const billDisc = Number(i.discountAmt) || 0;
  const disc = itemDisc + billDisc;
  const net = total - disc;
  const store = getStoreSettings();
  const isCancelled = i.status === 'cancel';

  const rows = i.items.map((row, idx) => {
    const p = findP(row[0]);
    if (!p) return `<tr>
      <td style="width:26px;text-align:center">${idx + 1}</td>
      <td class="l"><b style="color:#999">[Sản phẩm đã xóa khỏi danh mục]</b><br><span style="font-size:11px;color:#999">Mã: ${escapeHtml(row[0])}</span></td>
      <td style="text-align:center">—</td>
      <td style="text-align:center">${fmtQty(row[1])}</td>
      <td class="r">—</td>
      <td class="r">—</td>
      <td class="r">—</td>
    </tr>`;
    const pct = itemDiscPct(row);
    const lineDisc = itemDiscAmount(row);
    const lineNet = p.price * row[1] - lineDisc;
    const discCell = pct > 0
      ? `${pct}%<br><span style="font-size:10.5px;color:#c0392b">−${lineDisc.toLocaleString('vi-VN')}</span>`
      : '—';
    return `<tr>
      <td style="width:26px;text-align:center">${idx + 1}</td>
      <td class="l"><b>${escapeHtml(p.name)}</b>${p.spec ? '<br><span style="font-size:11px;color:#555">' + escapeHtml(p.spec) + '</span>' : ''}</td>
      <td style="text-align:center">${escapeHtml(catUnit(p.cat))}</td>
      <td style="text-align:center">${fmtQty(row[1])}</td>
      <td class="r">${p.price.toLocaleString('vi-VN')}</td>
      <td class="r">${discCell}</td>
      <td class="r">${lineNet.toLocaleString('vi-VN')}</td>
    </tr>`;
  }).join('');

  const c = findCustomer(i.customer);
  const isAgent = c && c.type === 'agent';
  const info = customerInfo(i.customer);

  let discountHtml = `<div class="inv-total" style="font-weight:400">Cộng tiền hàng: ${total.toLocaleString('vi-VN')} đồng</div>`;
  if (itemDisc > 0) {
    discountHtml += `<div class="inv-total" style="font-weight:400">Chiết khấu đại lý (theo từng món): − ${itemDisc.toLocaleString('vi-VN')} đồng</div>`;
  }
  if (billDisc > 0) {
    discountHtml += `<div class="inv-total" style="font-weight:400">Chiết khấu${i.discountPct ? ` (${i.discountPct}%)` : ''}: − ${billDisc.toLocaleString('vi-VN')} đồng</div>`;
  }
  discountHtml += `<div class="inv-total" style="font-size:15px;color:#000">Cần thanh toán: <b>${net.toLocaleString('vi-VN')} đồng</b></div>`;

  const paidAmt = isCancelled ? 0 : invTotalPaid(i);
  const orderDebt = isCancelled ? 0 : (typeof i.debtAmount === 'number' ? i.debtAmount : Math.max(0, net - paidAmt));
  const custTotalDebt = c ? (c.debt || 0) : 0;

  const debtSectionHtml = isCancelled ? `
    <div class="inv-total" style="font-size:13.5px;color:#e11d48;font-weight:700">HÓA ĐƠN ĐÃ HỦY — hàng đã được hoàn trả về kho</div>` : `
    <div class="inv-total" style="font-size:13px;color:#0d9488">Đã thanh toán: <b>${paidAmt.toLocaleString('vi-VN')} đồng</b></div>
    ${orderDebt > 0
      ? `<div class="inv-total" style="font-size:13.5px;color:#e11d48;font-weight:700">Còn nợ đơn này: <b>${orderDebt.toLocaleString('vi-VN')} đồng</b></div>`
      : `<div class="inv-total" style="font-size:12.5px;color:#666">Còn nợ đơn này: <b>0 đồng</b></div>`}
    ${custTotalDebt > 0
      ? `<div class="inv-total" style="font-size:13px;color:#9333ea;font-weight:600;border-top:1px dashed #bbb;padding-top:3px;margin-top:3px">Tổng dư nợ khách hàng đến nay: <b>${custTotalDebt.toLocaleString('vi-VN')} đồng</b></div>`
      : ''}`;

  const payMethodText = i.paymentMethod === 'transfer' ? 'Chuyển khoản (VietQR)' : 'Tiền mặt';
  const cashPayInfo = (i.paymentMethod === 'cash' && i.customerPaid > 0 && i.changeAmt > 0)
    ? `<div style="font-size:12px;color:#444;margin-top:2px">Tiền thừa trả khách: ${fmt(i.changeAmt)}</div>` : '';

  let qrHtml = '';
  if (!isCancelled && store.qrEnabled && store.bankId && store.accountNo && net > 0) {
    const qrAmount = orderDebt > 0 ? orderDebt : net;
    const qrUrl = getVietQrUrl(qrAmount, i.id, store);
    qrHtml = `
      <div class="inv-qr-block" style="text-align:center;margin-top:14px;padding-top:12px;border-top:1px dashed #bbb">
        <div style="font-size:11.5px;font-weight:700;letter-spacing:0.5px;margin-bottom:4px">MÃ VIETQR THANH TOÁN ${orderDebt > 0 ? '(CÒN NỢ)' : ''}</div>
        <img src="${qrUrl}" alt="VietQR" style="width:130px;height:130px;display:inline-block;border:1px solid #ddd;border-radius:6px;padding:2px">
        <div style="font-size:11px;color:#333;margin-top:3px">${escapeHtml(store.bankName || store.bankId)}: <b>${escapeHtml(store.accountNo)}</b></div>
        <div style="font-size:11px;color:#555">Chủ TK: <b>${escapeHtml(store.accountName)}</b></div>
      </div>`;
  }

  const isThermal = printPaper === 'K80';
  const d = toIsoDate(i.date).split('-');

  document.getElementById('printArea').innerHTML = `<div class="inv-paper ${isThermal ? 'k80' : ''}">
    <div class="inv-shop">${escapeHtml(store.storeName)}</div>
    <div class="inv-sub">Địa chỉ: ${escapeHtml(store.address)}</div>
    <div class="inv-sub">Hotline: ${escapeHtml(store.phone)}</div>
    <div class="inv-sub2">${escapeHtml(store.desc)}</div>
    <div class="inv-title">HÓA ĐƠN BÁN HÀNG</div>
    <div class="inv-meta">
      <span>Ngày ${d[2] || ''} tháng ${d[1] || ''} năm ${d[0] || ''}</span>
      <span>Số: <b>${escapeHtml(String(i.id).replace('HD-', ''))}</b></span>
    </div>
    <div class="inv-cust">Khách hàng: <b>${escapeHtml(i.customer)}</b>${isAgent ? ' <span style="font-style:italic;color:#6b21a8">(Đại lý)</span>' : ''}</div>
    <div class="inv-cust">Điện thoại: ${escapeHtml(info.phone || '—')}</div>
    <table class="inv-tbl">
      <thead><tr>
        <th>STT</th><th>Tên hàng &amp; quy cách</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>CK</th><th>Thành tiền</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${discountHtml}
    ${debtSectionHtml}
    <div class="inv-words">Bằng chữ: <em>${capFirst(numberToWords(net))}</em></div>
    <div class="inv-note" style="margin-top:6px">
      HT thanh toán: <b>${payMethodText}</b> · Trạng thái: <b style="color:${i.status === 'paid' ? '#0d9488' : i.status === 'pending' ? '#d97706' : '#e11d48'}">${i.status === 'paid' ? 'ĐÃ THANH TOÁN' : i.status === 'pending' ? 'CHƯA THANH TOÁN' : 'ĐÃ HỦY'}</b>
      ${cashPayInfo}
    </div>
    ${qrHtml}
    <div class="inv-footer-note" style="text-align:center;font-size:11px;font-style:italic;margin-top:10px;color:#555">
      ${escapeHtml(store.footerNote || 'Cảm ơn Quý khách! Hẹn gặp lại!')}
    </div>
    <div class="inv-sign">
      <div class="col"><div class="line">Người mua hàng</div><div style="font-size:11px;color:#666">(Ký, ghi rõ họ tên)</div></div>
      <div class="col"><div class="line">Người bán hàng</div><div style="font-size:11px;color:#666">(Ký, ghi rõ họ tên)</div></div>
    </div>
  </div>`;
}

/* ==========================================================================
   THU NỢ / XÁC NHẬN THANH TOÁN / HỦY HÓA ĐƠN
   ========================================================================== */

function openSettleDebtModal(id) {
  const c = (DB.customers || []).find(x => x.id === id);
  if (!c) return;
  activeSettleCustId = id;
  const nameEl = document.getElementById('settleCustName');
  const debtEl = document.getElementById('settleCustCurrentDebt');
  const amountInput = document.getElementById('settleAmount');
  const noteInput = document.getElementById('settleNote');

  if (nameEl) nameEl.textContent = `${c.name} (${c.id})${c.phone ? ' - 📞 ' + c.phone : ''}`;
  if (debtEl) debtEl.textContent = fmt(c.debt || 0);
  if (amountInput) { amountInput.value = c.debt || 0; amountInput.classList.remove('is-invalid'); }
  if (noteInput) noteInput.value = '';

  openModal('settleDebtModal');
}

let activeSettleCustId = null;

function setFullSettleAmount() {
  if (!activeSettleCustId) return;
  const c = (DB.customers || []).find(x => x.id === activeSettleCustId);
  const amountInput = document.getElementById('settleAmount');
  if (c && amountInput) amountInput.value = c.debt || 0;
}

/* Thu nợ: trừ dư nợ khách ĐÚNG 1 LẦN và phân bổ vào các hóa đơn còn nợ.
   Dư nợ khách được giữ là "nguồn sự thật", không trừ trùng lặp. */
function confirmSettleDebt() {
  if (!activeSettleCustId) return;
  const c = (DB.customers || []).find(x => x.id === activeSettleCustId);
  if (!c) return;

  const amountInput = document.getElementById('settleAmount');
  const payAmt = parseFloat(amountInput ? amountInput.value : 0) || 0;
  const curDebt = c.debt || 0;

  if (payAmt <= 0) {
    toast('Số tiền thu phải lớn hơn 0!');
    if (amountInput) { amountInput.classList.add('is-invalid'); amountInput.focus(); }
    return;
  }
  if (payAmt > curDebt) {
    toast(`Số tiền thu (${fmt(payAmt)}) lớn hơn dư nợ hiện tại (${fmt(curDebt)}). Vui lòng nhập lại!`);
    if (amountInput) { amountInput.classList.add('is-invalid'); amountInput.focus(); }
    return;
  }

  if (!confirm(`Xác nhận thu ${fmt(payAmt)} từ khách "${c.name}"?\nDư nợ còn lại sau khi thu: ${fmt(curDebt - payAmt)}`)) return;

  // Phân bổ số tiền thu vào các hóa đơn còn nợ (từ cũ nhất đến mới nhất)
  let remain = payAmt;
  const pendingInvs = (DB.invoices || [])
    .filter(i => i.status === 'pending' && i.customer === c.name && (i.debtAmount || 0) > 0)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.id).localeCompare(String(b.id)));

  pendingInvs.forEach(inv => {
    if (remain <= 0) return;
    const invDebt = inv.debtAmount || 0;
    const deduct = Math.min(remain, invDebt);
    inv.customerPaid = (inv.customerPaid || 0) + deduct;
    inv.debtAmount = Math.max(0, invDebt - deduct);
    if (inv.debtAmount === 0) inv.status = 'paid';
    remain -= deduct;
  });

  // Trừ dư nợ khách MỘT LẦN duy nhất bằng đúng số tiền đã thu
  c.debt = Math.max(0, curDebt - payAmt);

  // Trường hợp dư nợ khách lớn hơn tổng nợ các hóa đơn (nợ tồn từ dữ liệu cũ):
  // phần chênh lệch vẫn được trừ vào dư nợ khách, không cần hóa đơn tương ứng.
  saveDB(true);

  closeModal('settleDebtModal');
  if (typeof refreshAllViews === 'function') refreshAllViews();
  toast(`✓ Đã thu ${fmt(payAmt)} từ "${c.name}". Dư nợ còn lại: ${fmt(c.debt)}`);
}

function toggleCustomerType(id) {
  const c = (DB.customers || []).find(x => x.id === id);
  if (!c) return;

  if (c.type === 'agent') {
    if (!confirm(`Chuyển "${c.name}" về KHÁCH LẺ (thôi làm đại lý)?`)) return;
    c.type = 'retail';
  } else {
    if (!confirm(`Nâng "${c.name}" lên ĐẠI LÝ?\n\nĐại lý mua nhiều và sẽ được áp dụng chiết khấu khi tạo hóa đơn.`)) return;
    c.type = 'agent';
  }

  saveDB();
  renderCustomers();
  toast(c.type === 'agent' ? `Đã nâng "${c.name}" lên Đại lý` : `Đã chuyển "${c.name}" về Khách lẻ`);
}

/* ===== Xác nhận thanh toán đủ cho hóa đơn ===== */
function confirmPaymentInvoice(id) {
  const i = (DB.invoices || []).find(x => x.id === id);
  if (!i) return;
  if (i.status === 'paid') { toast('Hóa đơn này đã ở trạng thái ĐÃ THANH TOÁN!'); return; }
  if (i.status === 'cancel') { toast('Hóa đơn đã bị hủy, không thể thanh toán!'); return; }

  const net = invNet(i);
  const remainingDebt = typeof i.debtAmount === 'number' ? i.debtAmount : Math.max(0, net - (i.customerPaid || 0));
  const collect = remainingDebt > 0 ? remainingDebt : net;

  if (!confirm(`Xác nhận hóa đơn "${i.id}" của "${i.customer}" đã thu đủ ${fmt(collect)}?`)) return;

  const cust = findCustomer(i.customer);
  if (cust && remainingDebt > 0) {
    cust.debt = Math.max(0, (cust.debt || 0) - remainingDebt);
  }

  i.customerPaid = net;
  i.debtAmount = 0;
  i.status = 'paid';
  saveDB(true);

  if (typeof refreshAllViews === 'function') refreshAllViews();
  if (viewingInvoiceId === id) viewInvoice(id);
  toast(`✓ Đã xác nhận thanh toán cho ${i.id}`);
}

/* ===== Hủy hóa đơn: hoàn kho + trả lại khoản nợ của chính hóa đơn đó ===== */
function cancelInvoice(id) {
  const i = (DB.invoices || []).find(x => x.id === id);
  if (!i) return;
  if (i.status === 'cancel') { toast('Hóa đơn này đã ở trạng thái ĐÃ HỦY!'); return; }

  const debtOfInvoice = typeof i.debtAmount === 'number' ? i.debtAmount : (i.status === 'pending' ? Math.max(0, invNet(i) - (i.customerPaid || 0)) : 0);

  const msg = `⚠️ HỦY HÓA ĐƠN "${i.id}"?\n\n` +
    `• Hoàn trả lại tồn kho cho ${i.items.length} mặt hàng\n` +
    (debtOfInvoice > 0 ? `• Xóa khoản nợ ${fmt(debtOfInvoice)} của hóa đơn này khỏi hồ sơ khách\n` : '') +
    (i.customerPaid > 0 && i.status === 'paid' ? `• Đơn đã thu ${fmt(i.customerPaid)}: bạn cần TỰ HOÀN TIỀN cho khách\n` : '') +
    `\nThao tác này không thể hoàn tác. Tiếp tục?`;
  if (!confirm(msg)) return;

  // 1. Hoàn kho + ghi vết vào sổ kho
  i.items.forEach(row => {
    recordStockMove(row[0], row[1], 'return', {
      reason: 'Hoàn kho do hủy hóa đơn',
      refId: i.id,
      refName: i.customer,
    });
  });

  // 2. Trả lại đúng khoản nợ mà hóa đơn này đã cộng vào dư nợ khách
  if (debtOfInvoice > 0) {
    const cust = findCustomer(i.customer);
    if (cust) cust.debt = Math.max(0, (cust.debt || 0) - debtOfInvoice);
  }

  i.debtAmount = 0;
  i.status = 'cancel';
  saveDB(true);

  if (typeof refreshAllViews === 'function') refreshAllViews();
  if (viewingInvoiceId === id) viewInvoice(id);
  toast(`✕ Đã hủy hóa đơn ${i.id} và hoàn trả tồn kho.`);
}

function confirmPaymentFromModal() {
  if (viewingInvoiceId) confirmPaymentInvoice(viewingInvoiceId);
}

function cancelInvoiceFromModal() {
  if (viewingInvoiceId) cancelInvoice(viewingInvoiceId);
}

function viewInvoice(id) {
  const i = (DB.invoices || []).find(x => x.id === id);
  if (!i) return;
  viewingInvoiceId = id;
  renderInvoicePaper(i);

  const sel = document.getElementById('printPaper');
  if (sel) sel.value = printPaper;
  setPrintPaper(printPaper);

  const actionsEl = document.getElementById('invStatusActions');
  if (actionsEl) {
    if (i.status === 'pending') {
      actionsEl.innerHTML = `
        <button type="button" class="btn green sm" onclick="confirmPaymentFromModal()">✓ Xác nhận đã thu đủ</button>
        <button type="button" class="btn red sm ghost" onclick="cancelInvoiceFromModal()">✕ Hủy hóa đơn (Hoàn kho)</button>`;
    } else if (i.status === 'paid') {
      actionsEl.innerHTML = `
        <span class="pill ok" style="padding:6px 12px;font-size:12px;font-weight:600">✓ Đã thanh toán</span>
        <button type="button" class="btn red sm ghost" onclick="cancelInvoiceFromModal()">✕ Khách trả hàng (Hoàn kho)</button>`;
    } else {
      actionsEl.innerHTML = `<span class="pill out" style="padding:6px 12px;font-size:12px;font-weight:600">✕ Hóa đơn đã hủy (Đã hoàn kho)</span>`;
    }
  }

  openModal('invViewModal');
}

function printInvoice() {
  window.print();
}

function exportOneInvoice() {
  const i = (DB.invoices || []).find(x => x.id === viewingInvoiceId);
  if (!i) return;

  const rows = [['Mã HĐ', 'Khách hàng', 'Ngày', 'STT', 'Tên hàng', 'ĐVT', 'Số lượng', 'Đơn giá', 'CK %', 'Chiết khấu', 'Thành tiền']];
  i.items.forEach((row, idx) => {
    const p = findP(row[0]);
    const pct = itemDiscPct(row);
    const lineDisc = itemDiscAmount(row);
    const lineNet = p ? p.price * row[1] - lineDisc : '';
    rows.push([
      i.id, i.customer, isoToDisplay(i.date), idx + 1,
      p ? p.name : '[Đã xóa: ' + row[0] + ']', p ? catUnit(p.cat) : '',
      row[1], p ? p.price : '', pct > 0 ? pct : '', lineDisc > 0 ? -lineDisc : '', lineNet
    ]);
  });

  rows.push([]);
  rows.push(['', '', '', '', '', '', '', '', '', 'Tổng tiền hàng', invoiceTotal(i.items)]);
  const itemDiscSum = invoiceItemsDiscount(i.items);
  if (itemDiscSum > 0) {
    rows.push(['', '', '', '', '', '', '', '', '', 'Chiết khấu từng món', -itemDiscSum]);
  }
  if (invDisc(i) - itemDiscSum > 0) {
    rows.push(['', '', '', '', '', '', '', '', '', 'Chiết khấu' + (i.discountPct ? ` (${i.discountPct}%)` : ''), -(invDisc(i) - itemDiscSum)]);
  }
  rows.push(['', '', '', '', '', '', '', '', '', 'Cần thanh toán', invNet(i)]);
  rows.push(['', '', '', '', '', '', '', '', '', 'Đã thanh toán', invTotalPaid(i)]);
  rows.push(['', '', '', '', '', '', '', '', '', 'Còn nợ', i.status === 'cancel' ? 0 : (i.debtAmount || 0)]);

  exportCSV(`hoa-don-${i.id}.csv`, rows);
}
