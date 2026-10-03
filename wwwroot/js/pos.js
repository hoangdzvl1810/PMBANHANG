/* ==========================================================================
   PMBANHANG - POS & INVOICE MODULE (pos.js)
   Logic bán hàng (POS), giỏ hàng, tính chiết khấu, in ấn & xuất hóa đơn
   ========================================================================== */

let cart = [];
let discountMode = 'pct'; // 'pct' hoặc 'amt'
let discountPct = 0;
let discountAmt = 0;
let viewingInvoiceId = null;
let printPaper = 'A4';

const PAPER_SIZES = {
  A4: { page: 'A4', preview: '500px' },
  A5: { page: 'A5', preview: '380px' },
  A3: { page: 'A3', preview: '580px' },
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

  let digitCount = 0;
  let startChar = -1;
  let endChar = -1;
  for (let i = 0; i < phoneStr.length; i++) {
    if (/\d/.test(phoneStr[i])) {
      if (digitCount === matchIdx && startChar === -1) startChar = i;
      digitCount++;
      if (digitCount === matchIdx + qDigits.length) {
        endChar = i + 1;
        break;
      }
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

/* ===== Tính tiền chiết khấu thực tế ===== */
function getDiscountAmt() {
  const rev = posRevenueAmount();
  let amt = discountMode === 'pct' ? Math.round((rev * discountPct) / 100) : discountAmt;
  if (amt > rev) amt = rev;
  if (amt < 0 || isNaN(amt)) amt = 0;
  discountAmt = amt;
  return amt;
}

/* ===== Kiểm tra xem chuỗi có phải là số điện thoại hợp lệ (chuỗi chỉ gồm các chữ số, độ dài 10 kí tự, bắt đầu bằng 0) ===== */
function isFullPhoneNumber(str) {
  if (!str) return false;
  const trimmed = String(str).trim();
  return /^0\d{9}$/.test(trimmed);
}

function formatPhone(digits) {
  let d = (digits || '').replace(/\D/g, '');
  if (d.length === 10) {
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  return d;
}

/* ===== Xử lý khi thay đổi khách hàng ở ô tìm kiếm ===== */
function onPosCustomerChange() {
  const custInput = document.getElementById('posCustomer');
  if (!custInput) return;
  const val = (custInput.value || '').trim();
  const errEl = document.getElementById('posCustError');
  const badge = document.getElementById('custBadge');
  const quickBox = document.getElementById('quickAddCustBox');

  // Nếu người dùng nhập số (bắt đầu bằng số hoặc chỉ gồm số):
  if (/^\d/.test(val) || /^\d+$/.test(val)) {
    const pCheck = validatePhoneNumber(val, false);
    if (!pCheck.valid) {
      custInput.classList.add('is-invalid');
      if (errEl) {
        errEl.textContent = pCheck.error;
        errEl.style.display = 'block';
      }
      toast(pCheck.error);
      if (quickBox) quickBox.style.display = 'none';
      if (badge) badge.style.display = 'none';
      return;
    }
  }

  // Nếu hợp lệ hoặc không phải SĐT thì xóa trạng thái lỗi
  custInput.classList.remove('is-invalid');
  if (errEl) {
    errEl.textContent = '';
    errEl.style.display = 'none';
  }

  const c = findCustomer(val);

  if (c) {
    // Nếu người dùng nhập số điện thoại hoặc mã, tự động cập nhật tên chuẩn vào ô input
    if (custInput.value !== c.name && val !== 'Khách lẻ') {
      custInput.value = c.name;
    }

    if (quickBox) quickBox.style.display = 'none';

    badge.style.display = 'block';
    const isAgent = c.type === 'agent';
    badge.innerHTML = `<span class="type-pill ${c.type}">${isAgent ? 'Đại lý' : 'Khách quen'}</span> ` +
      `<span style="font-size:12px;color:var(--txt);font-weight:600">📞 ${c.phone || 'Chưa có SĐT'}</span>`;

    if (!isAgent) {
      discountPct = 0;
      discountAmt = 0;
      discountMode = 'pct';
    }
  } else {
    // Nếu khung tạo nhanh đang hiển thị thì không hiển thị đè badge "Khách vãng lai"
    if (quickBox && quickBox.style.display !== 'none') {
      badge.style.display = 'none';
    } else if (val.toLowerCase() === 'khách lẻ' || !val) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'block';
      badge.innerHTML = `<span class="type-pill retail">Khách vãng lai</span> <span style="font-size:12px;color:var(--muted)">Chưa lưu hồ sơ</span>`;
    }
    discountPct = 0;
    discountAmt = 0;
    discountMode = 'pct';
  }
  renderPosCart();
}

/* ===== Menu gợi ý / chọn nhanh khách hàng (Lọc theo SĐT hoặc Tên) ===== */
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
  return `<div class="cust-item ${idx === 0 ? 'selected-item' : ''}" data-name="${escapeHtml(it.name)}" onmousedown="selectCustomer('${escapeHtml(it.name)}')">
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
  const qDigits = q.replace(/\D/g, ''); // Lấy các chữ số khi người dùng gõ SĐT (09...)
  const menu = document.getElementById('customerMenu');
  if (!menu) return;

  activeCustomerMenuIdx = -1;
  const showAll = !q || qLower === 'khách lẻ';
  const items = [];

  // Tùy chọn mặc định "Khách lẻ"
  if (showAll || 'khách lẻ'.includes(qLower) || 'khach le'.includes(qLower)) {
    items.push({
      name: 'Khách lẻ',
      phone: '',
      type: 'retail',
      sub: 'Khách mua lẻ vãng lai (không lưu hồ sơ)'
    });
  }

  // Nếu nhập đúng và đủ SĐT 10 chữ số bắt đầu bằng 0 mà tra trong DB không có -> Hiện nút tạo nhanh ngay đầu dropdown
  if (isFullPhoneNumber(q)) {
    const existing = DB.customers.find(c => (c.phone || '').replace(/\D/g, '') === q);
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
    matched = DB.customers.slice();
  } else {
    const startsWithPhone = [];
    const includesPhone = [];
    const startsWithName = [];
    const includesName = [];

    DB.customers.forEach(c => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      const nameL = (c.name || '').toLowerCase();

      // Nếu có chữ số (người dùng đang tìm theo SĐT: 09, 091, 0912...)
      if (qDigits.length > 0) {
        if (cleanPhone.startsWith(qDigits)) {
          startsWithPhone.push(c);
          return;
        } else if (cleanPhone.includes(qDigits)) {
          includesPhone.push(c);
          return;
        }
      }

      // Tìm theo họ tên (hỗ trợ cả có dấu và không dấu)
      const nameNoTone = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(nameL) : nameL;
      const qNoTone = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(qLower) : qLower;
      if (nameL.startsWith(qLower) || nameNoTone.startsWith(qNoTone)) {
        startsWithName.push(c);
      } else if (nameL.includes(qLower) || nameNoTone.includes(qNoTone)) {
        includesName.push(c);
      }
    });

    // Ưu tiên cao nhất: SĐT BẮT ĐẦU BẰNG qDigits -> SĐT CHỨA qDigits -> Tên bắt đầu -> Tên chứa
    matched = [...startsWithPhone, ...includesPhone, ...startsWithName, ...includesName];
  }

  matched.forEach(c => {
    const phoneDisplay = c.phone ? `📞 ${highlightPhoneMatch(c.phone, qDigits)}` : '<span style="color:var(--dim)">Chưa có SĐT</span>';
    items.push({
      name: c.name,
      phone: c.phone || '',
      type: c.type,
      sub: phoneDisplay
    });
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
  const rawVal = input.value || '';
  const val = rawVal.trim();

  // 1. Nếu ô input trống
  if (!val) {
    input.classList.remove('is-invalid');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if (quickBox) quickBox.style.display = 'none';
    renderCustomerMenu('');
    return;
  }

  // 2. Nhận biết người dùng đang nhập SĐT hay Tên:
  // Nếu bắt đầu bằng chữ số HOẶC toàn bộ chuỗi là chữ số
  const startsWithDigit = /^\d/.test(val);
  const isAllDigits = /^\d+$/.test(val);

  if (startsWithDigit || isAllDigits) {
    // a. Bắt đầu không phải số 0 -> BÁO LỖI LUÔN
    if (!val.startsWith('0')) {
      input.classList.add('is-invalid');
      const msg = 'Số điện thoại phải bắt đầu bằng số 0!';
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
      toast(msg);
      if (quickBox) quickBox.style.display = 'none';
      if (menu) menu.style.display = 'none';
      return;
    }

    // b. Chứa ký tự không phải số -> BÁO LỖI LUÔN
    if (/\D/.test(val)) {
      input.classList.add('is-invalid');
      const msg = 'Số điện thoại chỉ được chứa các chữ số (0-9)!';
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
      toast(msg);
      if (quickBox) quickBox.style.display = 'none';
      if (menu) menu.style.display = 'none';
      return;
    }

    // c. Nhập quá 10 ký tự -> BÁO LỖI LUÔN
    if (val.length > 10) {
      input.classList.add('is-invalid');
      const msg = `Số điện thoại chỉ gồm tối đa 10 chữ số (đang có ${val.length} số)!`;
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
      toast('Số điện thoại chỉ gồm tối đa 10 chữ số!');
      if (quickBox) quickBox.style.display = 'none';
      if (menu) menu.style.display = 'none';
      return;
    }

    // d. Nếu đang gõ hợp lệ (bắt đầu bằng 0, chỉ gồm số, length <= 10):
    input.classList.remove('is-invalid');
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }

    // Lọc gợi ý khách hàng theo số đang gõ (09...)
    renderCustomerMenu(val);

    // e. Nếu đã nhập ĐỦ ĐÚNG 10 CHỮ SỐ bắt đầu bằng 0:
    if (val.length === 10) {
      const existing = DB.customers.find(c => {
        const cPhone = (c.phone || '').replace(/\D/g, '');
        return cPhone === val;
      });

      if (!existing) {
        // SĐT chưa có trong hệ thống -> Mở hộp tạo khách mới
        if (quickBox) {
          quickBox.style.display = 'block';
          quickBox.dataset.phone = val;
          if (quickPhoneDisplay) quickPhoneDisplay.textContent = formatPhone(val);
        }
        if (badge) badge.style.display = 'none';
      } else {
        if (quickBox) quickBox.style.display = 'none';
      }
    } else {
      if (quickBox) quickBox.style.display = 'none';
    }
    return;
  }

  // 3. Nếu người dùng nhập tên (chữ cái):
  input.classList.remove('is-invalid');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (quickBox) quickBox.style.display = 'none';

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
  if (nameInput) {
    nameInput.focus();
    nameInput.select();
  }
  const menu = document.getElementById('customerMenu');
  if (menu) menu.style.display = 'none';
}

/* ===== Lưu nhanh khách hàng mới ngay tại màn hình Bán hàng (Chỉ yêu cầu Tên & SĐT, không cần địa chỉ) ===== */
function saveQuickCustomer() {
  const nameInput = document.getElementById('quickCustName');
  const posInput = document.getElementById('posCustomer');
  const quickBox = document.getElementById('quickAddCustBox');
  const name = (nameInput?.value || '').trim();
  const phoneDigits = (quickBox?.dataset?.phone || posInput?.value || '').trim();

  // Validate SĐT bắt buộc đúng 10 số, bắt đầu bằng 0, chỉ chứa số
  const pCheck = validatePhoneNumber(phoneDigits, false);
  if (!pCheck.valid) {
    toast(pCheck.error);
    if (posInput) markInvalid(posInput, pCheck.error);
    return;
  }

  if (!name) {
    markInvalid(nameInput, 'Vui lòng nhập tên khách hàng mới!');
    return;
  }
  if (name.length < 2) {
    markInvalid(nameInput, 'Tên khách hàng phải có ít nhất 2 ký tự!');
    return;
  }

  // Kiểm tra trùng SĐT trong database
  const existing = DB.customers.find(c => (c.phone || '').replace(/\D/g, '') === phoneDigits);
  if (existing) {
    toast(`Số điện thoại này đã thuộc về khách hàng "${existing.name}"!`);
    return;
  }

  // Tự sinh mã KH tiếp theo không trùng lặp
  let maxNum = 0;
  DB.customers.forEach(c => {
    if (c.id && c.id.startsWith('KH-')) {
      const num = parseInt(c.id.replace('KH-', ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  const nextNum = Math.max(maxNum + 1, DB.nextCustomerId || 1);
  DB.nextCustomerId = nextNum + 1;
  const id = 'KH-' + String(nextNum).padStart(2, '0');

  const formattedPhone = formatPhone(phoneDigits);
  const newCust = {
    id,
    name,
    phone: formattedPhone,
    type: 'retail'
  };

  DB.customers.push(newCust);
  saveDB();

  // Tự động gán khách hàng mới vào POS
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
  toast(`Đã tạo và chọn khách hàng: ${newCust.name} (${formattedPhone})`);
}

function closeCustomerMenu() {
  setTimeout(() => {
    const m = document.getElementById('customerMenu');
    if (m) m.style.display = 'none';
  }, 200);
}

function selectCustomer(name) {
  const el = document.getElementById('posCustomer');
  if (el) {
    el.value = name;
    el.classList.remove('is-invalid');
  }
  const errEl = document.getElementById('posCustError');
  if (errEl) {
    errEl.textContent = '';
    errEl.style.display = 'none';
  }
  const m = document.getElementById('customerMenu');
  if (m) m.style.display = 'none';
  const quickBox = document.getElementById('quickAddCustBox');
  if (quickBox) quickBox.style.display = 'none';
  onPosCustomerChange();
}

/* ===== Điều hướng bằng bàn phím (Mũi tên lên/xuống, Enter, Escape) ===== */
function onCustomerKeyDown(e) {
  const menu = document.getElementById('customerMenu');
  const quickBox = document.getElementById('quickAddCustBox');

  if (e.key === 'Enter') {
    // Nếu hộp tạo nhanh đang hiện, bấm Enter chuyển tiêu điểm xuống nhập tên
    if (quickBox && quickBox.style.display !== 'none') {
      e.preventDefault();
      focusQuickCustomer();
      return;
    }
  }

  if (!menu || menu.style.display === 'none') {
    if (e.key === 'ArrowDown') {
      openCustomerMenu();
      e.preventDefault();
    }
    return;
  }

  const items = menu.querySelectorAll('.cust-item');
  if (!items.length) return;

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
    if (activeCustomerMenuIdx >= 0 && activeCustomerMenuIdx < items.length) {
      const activeEl = items[activeCustomerMenuIdx];
      if (activeEl.classList.contains('quick-add-item')) {
        focusQuickCustomer();
        return;
      }
      const selectedName = activeEl.getAttribute('data-name');
      selectCustomer(selectedName);
    } else if (items.length > 0) {
      const firstEl = items[0];
      if (firstEl.classList.contains('quick-add-item')) {
        focusQuickCustomer();
        return;
      }
      const selectedName = firstEl.getAttribute('data-name');
      selectCustomer(selectedName);
    }
    closeCustomerMenu();
  } else if (e.key === 'Escape') {
    closeCustomerMenu();
    if (quickBox) quickBox.style.display = 'none';
  }
}

function updateActiveCustomerMenuItem(items) {
  items.forEach((item, idx) => {
    if (idx === activeCustomerMenuIdx) {
      item.classList.add('active');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('active');
    }
  });
}

/* ===== Xử lý thay đổi chiết khấu (%) ===== */
function onDiscountChange() {
  const input = document.getElementById('posDiscountPct');
  let pct = parseFloat(input.value);
  if (isNaN(pct) || pct < 0) pct = 0;
  if (pct > 100) {
    pct = 100;
    input.value = 100;
    toast('Chiết khấu tối đa 100%');
  }
  discountPct = pct;
  discountMode = 'pct';
  renderPosCart();
}

/* ===== Xử lý thay đổi chiết khấu tiền mặt (VNĐ) ===== */
function onDiscountAmtChange() {
  const input = document.getElementById('posDiscountAmt');
  let amt = parseFloat(input.value);
  if (isNaN(amt) || amt < 0) amt = 0;
  const rev = posRevenueAmount();
  if (amt > rev) {
    amt = rev;
    input.value = rev;
    toast('Chiết khấu không được vượt quá tổng tiền hàng');
  }
  discountAmt = amt;
  discountMode = 'amt';
  discountPct = rev > 0 ? Math.round((amt / rev) * 10000) / 100 : 0;
  renderPosCart();
}

/* ===== Khởi tạo giao diện POS ===== */
function renderPos() {
  const catSel = document.getElementById('posCat');
  if (catSel) {
    const cc = catSel.value;
    catSel.innerHTML = '<option value="">Tất cả danh mục</option>' + DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    catSel.value = cc;
  }
  const cust = document.getElementById('posCustomer');
  if (cust && !cust.value) cust.value = 'Khách lẻ';

  renderPosProducts();
  renderPosCart();
}

/* ===== Hiển thị lưới sản phẩm để chọn bán (Lọc theo mã, tên, danh mục - ưu tiên khớp đầu mã/tên) ===== */
function renderPosProducts() {
  const searchInput = document.getElementById('posSearch');
  const q = (searchInput?.value || '').trim();
  const qRaw = q.toLowerCase();
  const qNoTone = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(qRaw) : qRaw;
  const qClean = qRaw.replace(/[^a-z0-9]/g, '');
  const cat = document.getElementById('posCat')?.value || '';

  let list = DB.products.filter(p => {
    if (cat && p.cat !== cat) return false;
    if (!q) return true;
    const rank = getProductSearchRank(p, qRaw, qNoTone, qClean);
    return rank < 999;
  });

  // Nếu người dùng có nhập từ khóa tìm kiếm: Sắp xếp theo mức độ ưu tiên khớp mã/tên
  if (q) {
    list.sort((a, b) => {
      const rankA = getProductSearchRank(a, qRaw, qNoTone, qClean);
      const rankB = getProductSearchRank(b, qRaw, qNoTone, qClean);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name, 'vi');
    });
  }

  const container = document.getElementById('posProducts');
  if (!container) return;

  container.innerHTML = list.length ? list.map(p => {
    const out = p.stock <= 0;
    return `<div class="prod-card ${out ? 'disabled' : ''}" onclick="${out ? 'toast(\'Sản phẩm đã hết hàng!\')' : `addToCart('${p.id}')`}">
      <div class="pname"><span class="muted" style="font-weight:600;font-size:12px;margin-right:4px">[${p.id}]</span>${escapeHtml(p.name)}</div>
      <div class="pcat">${catName(p.cat)} · ${p.brand || 'Khác'}</div>
      <div class="prow"><span class="pprice">${fmt(p.price)}</span><span class="punit">/${catUnit(p.cat)}</span></div>
      <div class="pstock ${out ? 'out' : ''}">${out ? 'Hết hàng' : 'Còn ' + fmtQty(p.stock) + ' ' + catUnit(p.cat)}</div>
    </div>`;
  }).join('') : '<div class="empty">Không tìm thấy sản phẩm phù hợp</div>';
}

function onPosSearchKeyDown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const container = document.getElementById('posProducts');
    const firstCard = container?.querySelector('.prod-card:not(.disabled)');
    if (firstCard) {
      firstCard.click();
    }
  }
}

/* ===== Thêm sản phẩm vào giỏ hàng ===== */
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
    cart.push({ id, qty: step });
  }
  renderPosCart();
}

/* ===== Thiết lập số lượng trực tiếp từ input ===== */
function setQty(id, v) {
  const p = findP(id);
  if (!p) return;
  const step = catStep(p.cat);

  if (typeof v === 'string') v = v.replace(',', '.');
  v = parseFloat(v);

  // Validate giá trị nhập
  if (isNaN(v) || v <= 0) {
    v = step;
    toast('Số lượng phải lớn hơn 0');
  }

  v = roundQty(v, step);

  if (v > p.stock) {
    v = p.stock;
    toast(`Kho chỉ còn tối đa ${fmtQty(p.stock)} ${catUnit(p.cat)}`);
  }

  const idx = cart.findIndex(c => c.id === id);
  if (idx >= 0) {
    cart[idx].qty = v;
  }
  renderPosCart();
}

/* ===== Tăng / giảm số lượng bằng nút +/- ===== */
function incQty(id, d) {
  const p = findP(id);
  const idx = cart.findIndex(c => c.id === id);
  if (!p || idx < 0) return;

  const step = catStep(p.cat);
  let v = roundQty(cart[idx].qty + d * step, step);

  if (v < step) {
    v = step;
  }
  if (v > p.stock) {
    v = p.stock;
    toast(`Kho chỉ còn ${fmtQty(p.stock)} ${catUnit(p.cat)}`);
  }

  cart[idx].qty = v;
  renderPosCart();
}

/* ===== Xóa 1 sản phẩm khỏi giỏ hàng ===== */
function removeCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderPosCart();
}

/* ===== Làm trống giỏ hàng ===== */
function clearCart() {
  if (cart.length && !confirm('Xóa toàn bộ sản phẩm trong hóa đơn hiện tại?')) return;
  cart = [];
  renderPosCart();
}

/* ===== Hiển thị giỏ hàng & tính toán tiền ===== */
function renderPosCart() {
  const box = document.getElementById('posCart');
  if (!box) return;

  let rev = 0, cost = 0;

  if (!cart.length) {
    box.innerHTML = '<div class="empty" style="padding:26px 0">Chọn sản phẩm bên trái để thêm vào giỏ</div>';
  } else {
    box.innerHTML = cart.map(c => {
      const p = findP(c.id);
      if (!p) return '';
      rev += p.price * c.qty;
      cost += p.cost * c.qty;
      const step = catStep(p.cat);

      return `<div class="cart-line">
        <div class="cinfo">
          <b>${p.name}</b>
          <span>${fmt(p.price)} / ${catUnit(p.cat)}</span>
        </div>
        <div class="qty-ctrl">
          <button type="button" onclick="incQty('${c.id}', -1)">−</button>
          <input type="number" min="${step}" max="${p.stock}" step="${step}" value="${qtyInputValue(c.qty)}" onchange="setQty('${c.id}', this.value)">
          <button type="button" onclick="incQty('${c.id}', 1)">＋</button>
        </div>
        <div style="width:90px;text-align:right" class="money">${fmt(p.price * c.qty)}</div>
        <span class="close-x" style="font-size:15px" onclick="removeCart('${c.id}')" title="Xóa món">✕</span>
      </div>`;
    }).join('');
  }

  const isAgent = posCustomerIsAgent();
  const discountBox = document.getElementById('discountBox');
  if (discountBox) discountBox.style.display = isAgent ? '' : 'none';

  if (!isAgent) {
    discountPct = 0;
    discountAmt = 0;
  }

  const disc = getDiscountAmt();
  const pay = Math.max(0, rev - disc);

  document.getElementById('posRevenue').textContent = fmt(rev);
  document.getElementById('posCost').textContent = fmt(cost);

  const drow = document.getElementById('discountRow');
  if (drow) {
    if (isAgent && disc > 0) {
      drow.style.display = '';
      document.getElementById('posDiscount').textContent = '−' + fmt(disc);
    } else {
      drow.style.display = 'none';
    }
  }

  document.getElementById('posPay').textContent = fmt(pay);
  document.getElementById('posProfit').textContent = fmt(rev - cost - disc);

  // Cập nhật ô nhập chiết khấu khi không active
  const pctInput = document.getElementById('posDiscountPct');
  const amtInput = document.getElementById('posDiscountAmt');
  if (pctInput && document.activeElement !== pctInput) pctInput.value = discountPct;
  if (amtInput && document.activeElement !== amtInput) amtInput.value = discountAmt;
}

/* ===== Validate và Lưu Hóa Đơn ===== */
function savePosInvoice() {
  if (!cart.length) {
    toast('Vui lòng chọn ít nhất 1 sản phẩm vào giỏ hàng!');
    return;
  }

  const custInput = document.getElementById('posCustomer');
  const customer = (custInput?.value || '').trim() || 'Khách lẻ';
  const status = document.getElementById('posStatus')?.value || 'paid';

  // Validate nếu người dùng nhập số điện thoại thay vì tên
  if (/^\d/.test(customer) || /^\d+$/.test(customer)) {
    const pCheck = validatePhoneNumber(customer, false);
    if (!pCheck.valid) {
      markInvalid(custInput, pCheck.error);
      const errEl = document.getElementById('posCustError');
      if (errEl) {
        errEl.textContent = pCheck.error;
        errEl.style.display = 'block';
      }
      return;
    }
  }

  // 1. Validate tồn kho thực tế trước khi xuất hóa đơn
  for (const c of cart) {
    const p = findP(c.id);
    if (!p) {
      toast(`Lỗi: Không tìm thấy sản phẩm ${c.id}`);
      return;
    }
    if (c.qty <= 0) {
      toast(`Số lượng mua của "${p.name}" phải lớn hơn 0!`);
      return;
    }
    if (c.qty > p.stock) {
      toast(`Sản phẩm "${p.name}" chỉ còn ${fmtQty(p.stock)} ${catUnit(p.cat)}, không đủ để bán!`);
      return;
    }
  }

  // 2. Validate chiết khấu
  const isAgent = posCustomerIsAgent();
  const discAmt = isAgent ? getDiscountAmt() : 0;
  const discPct = isAgent ? discountPct : 0;

  // 3. Tạo mã hóa đơn mới
  const id = 'HD-' + DB.nextInvoiceId++;
  const invoiceData = {
    id,
    customer,
    date: todayStr(),
    items: cart.map(c => [c.id, c.qty]),
    status,
    exportCount: 0,
    discountAmt: discAmt,
    discountPct: discPct
  };

  DB.invoices.unshift(invoiceData);

  // 4. Trừ số lượng tồn kho chính xác
  cart.forEach(c => {
    const p = findP(c.id);
    p.stock = roundQty(p.stock - c.qty, catStep(p.cat));
  });

  // 5. Reset trạng thái POS
  discountMode = 'pct';
  discountPct = 0;
  discountAmt = 0;
  cart = [];

  // 6. Ghi dữ liệu vào SQLite & LocalStorage
  saveDB();

  // 7. Chuyển sang danh sách hóa đơn
  switchView('hoadon');
  toast('Đã lưu thành công hóa đơn ' + id);
}

/* ==========================================================================
   CHI TIẾT, IN ẤN VÀ XUẤT HÓA ĐƠN
   ========================================================================== */

function setPrintPaper(size) {
  printPaper = PAPER_SIZES[size] ? size : 'A4';
  const cfg = PAPER_SIZES[printPaper];
  const paper = document.querySelector('.inv-paper');
  if (paper) paper.style.maxWidth = cfg.preview;

  let st = document.getElementById('printPageStyle');
  if (!st) {
    st = document.createElement('style');
    st.id = 'printPageStyle';
    document.head.appendChild(st);
  }
  st.textContent = `@media print{ @page{ size:${cfg.page} portrait; margin:10mm } }`;
}

function renderInvoicePaper(i) {
  const total = invoiceTotal(i.items);
  const disc = invDisc(i);
  const net = total - disc;

  const rows = i.items.map(([pid, q], idx) => {
    const p = findP(pid);
    if (!p) return '';
    return `<tr>
      <td style="width:26px;text-align:center">${idx + 1}</td>
      <td class="l">${p.name}${p.spec ? '<br><span style="font-size:11px;color:#555">' + p.spec + '</span>' : ''}</td>
      <td style="text-align:center">${catUnit(p.cat)}</td>
      <td style="text-align:center">${fmtQty(q)}</td>
      <td class="r">${p.price.toLocaleString('vi-VN')}</td>
      <td class="r">${(p.price * q).toLocaleString('vi-VN')}</td>
    </tr>`;
  }).join('');

  const dateParts = i.date.split('/'); // dd/mm/yyyy
  const info = customerInfo(i.customer);
  const c = findCustomerByName(i.customer);
  const isAgent = c && c.type === 'agent';

  const discountHtml = (isAgent && disc > 0) ? `
    <div class="inv-total" style="font-weight:400">Cộng tiền hàng: ${total.toLocaleString('vi-VN')} đồng</div>
    <div class="inv-total" style="font-weight:400">Chiết khấu đại lý${i.discountPct ? ` (${i.discountPct}%)` : ''}: − ${disc.toLocaleString('vi-VN')} đồng</div>
    <div class="inv-total">Khách thanh toán: ${net.toLocaleString('vi-VN')} đồng</div>` : `
    <div class="inv-total">Cộng: ${total.toLocaleString('vi-VN')} đồng</div>`;

  document.getElementById('printArea').innerHTML = `<div class="inv-paper">
    <div class="inv-shop">${STORE.name}</div>
    <div class="inv-sub">Địa chỉ: ${STORE.address}</div>
    <div class="inv-sub">ĐT: ${STORE.phone}</div>
    <div class="inv-sub2">${STORE.desc}</div>
    <div class="inv-title">Hóa đơn bán hàng</div>
    <div class="inv-meta">
      <span>Ngày ${dateParts[0] || ''} tháng ${dateParts[1] || ''} năm ${dateParts[2] || ''}</span>
      <span>Số: ${i.id.replace('HD-', '')}</span>
    </div>
    <div class="inv-cust">Khách hàng: ${i.customer}${isAgent ? ' <span style="font-style:italic">(Đại lý)</span>' : ''}</div>
    <div class="inv-cust">Điện thoại: ${info.phone || '—'}</div>
    <table class="inv-tbl">
      <thead><tr>
        <th>STT</th><th>Tên hàng &amp; quy cách</th><th>ĐVT</th><th>S.Lượng</th><th>Đơn giá</th><th>Thành tiền</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${discountHtml}
    <div class="inv-words">Số tiền viết bằng chữ: ${capFirst(numberToWords(net))}</div>
    <div class="inv-note">Trạng thái thanh toán: <b>${i.status === 'paid' ? 'Đã thanh toán' : i.status === 'pending' ? 'Chưa thanh toán' : 'Đã hủy'}</b></div>
    <div class="inv-sign">
      <div class="col"><div class="line">Người mua hàng</div><div style="font-size:11px;color:#555">(Ký, ghi rõ họ tên)</div></div>
      <div class="col"><div class="line">Người bán hàng</div><div style="font-size:11px;color:#555">(Ký, ghi rõ họ tên)</div></div>
    </div>
  </div>`;
}

function viewInvoice(id) {
  const i = DB.invoices.find(x => x.id === id);
  if (!i) return;
  viewingInvoiceId = id;
  renderInvoicePaper(i);

  const sel = document.getElementById('printPaper');
  if (sel) sel.value = printPaper;
  setPrintPaper(printPaper);

  openModal('invViewModal');
}

function printInvoice() {
  window.print();
}

function exportOneInvoice() {
  const i = DB.invoices.find(x => x.id === viewingInvoiceId);
  if (!i) return;

  const rows = [['Mã HĐ', 'Khách hàng', 'Ngày', 'STT', 'Tên hàng', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền']];
  i.items.forEach(([pid, q], idx) => {
    const p = findP(pid);
    if (p) {
      rows.push([i.id, i.customer, i.date, idx + 1, p.name, catUnit(p.cat), q, p.price, p.price * q]);
    }
  });

  rows.push([]);
  rows.push(['', '', '', '', '', '', '', 'Tổng tiền hàng', invoiceTotal(i.items)]);
  if (invDisc(i) > 0) {
    rows.push(['', '', '', '', '', '', '', 'Chiết khấu đại lý' + (i.discountPct ? ` (${i.discountPct}%)` : ''), -invDisc(i)]);
    rows.push(['', '', '', '', '', '', '', 'Khách thanh toán', invNet(i)]);
  } else {
    rows.push(['', '', '', '', '', '', '', 'Tổng cộng', invNet(i)]);
  }

  exportCSV(`hoa-don-${i.id}.csv`, rows);
}
