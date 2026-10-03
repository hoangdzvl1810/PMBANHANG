/* ==========================================================================
   PMBANHANG - MAIN APPLICATION & ROUTER (app.js)
   Logic điều hướng tab, biểu đồ thống kê, quản lý danh mục, kho, khách hàng & validate
   ========================================================================== */

/* ================= MODAL & TOAST ================= */
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================= DARK / LIGHT THEME ================= */
const THEME_KEY = 'pmbanhang_theme';

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  updateThemeIcon();
  toast(isDark ? 'Đã chuyển sang giao diện tối' : 'Đã chuyển sang giao diện sáng');
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.textContent = document.body.classList.contains('dark') ? '☀' : '🌙';
    btn.title = document.body.classList.contains('dark') ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  }
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark') {
    document.body.classList.add('dark');
  }
  updateThemeIcon();
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    // Xóa toàn bộ trạng thái lỗi cũ khi mở modal
    m.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    m.classList.add('show');
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('show');
}

/* ================= VALIDATION HELPERS ================= */
function markInvalid(inputEl, msg) {
  if (!inputEl) return;
  inputEl.classList.add('is-invalid');
  inputEl.focus();
  if (msg) toast(msg);
}

function clearInvalid(inputEl) {
  if (inputEl) inputEl.classList.remove('is-invalid');
}

/* ================= ROUTER & NAVIGATION ================= */
let currentView = 'dashboard';

const VIEW_META = {
  dashboard: ["Dashboard", "Tổng quan cửa hàng"],
  banhang: ["Bán hàng (POS)", "Chọn sản phẩm và tạo hóa đơn"],
  hoadon: ["Hóa đơn bán hàng", "Quản lý bán hàng & thanh toán"],
  danhmuc: ["Quản lý danh mục", "Danh mục sản phẩm & kiểu hàng hóa"],
  sanpham: ["Quản lý sản phẩm", "Danh sách sản phẩm & tồn kho"],
  khachhang: ["Khách hàng", "Danh sách khách hàng"],
  baocao: ["Báo cáo", "Thống kê doanh thu & lợi nhuận"],
};

function switchView(v) {
  if (!VIEW_META[v]) v = 'dashboard';
  currentView = v;

  // Cập nhật trạng thái active trên sidebar
  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.view === v);
  });

  // Ẩn tất cả các view section, hiển thị view tương ứng
  document.querySelectorAll('.content > section').forEach(s => {
    s.style.display = 'none';
  });

  const activeSection = document.getElementById('view-' + v);
  if (activeSection) {
    activeSection.style.display = 'block';
  }

  // Cập nhật tiêu đề Topbar
  const titleEl = document.getElementById('pageTitle');
  const crumbEl = document.getElementById('pageCrumb');
  if (titleEl) titleEl.textContent = VIEW_META[v][0];
  if (crumbEl) crumbEl.textContent = VIEW_META[v][1];

  // Nạp dữ liệu tương ứng cho từng View
  if (v === 'dashboard') renderDashboard();
  else if (v === 'banhang') renderPos();
  else if (v === 'hoadon') renderInvoices();
  else if (v === 'danhmuc') renderCategories();
  else if (v === 'sanpham') renderInventory();
  else if (v === 'khachhang') renderCustomers();
  else if (v === 'baocao') renderReport();
}

function globalSearchHandler(q) {
  q = (q || '').trim();
  if (!q) return;
  switchView('sanpham');
  const searchInput = document.getElementById('khoSearch');
  if (searchInput) {
    searchInput.value = q;
    renderInventory();
  }
}

/* ================= DASHBOARD & CHARTS ================= */
let chartCategory = null;

/* ===== Xác định khoảng thời gian lọc Dashboard ===== */
function getDashDateRange() {
  const preset = document.getElementById('dashTimePreset')?.value || 'this_month';
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  let start = null;
  let end = null;
  let label = '';

  if (preset === 'today') {
    start = new Date(y, m, d, 0, 0, 0, 0);
    end = new Date(y, m, d, 23, 59, 59, 999);
    label = `Hôm nay (${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y})`;
  } else if (preset === 'yesterday') {
    const yest = new Date(y, m, d - 1);
    start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
    end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
    label = `Hôm qua (${String(yest.getDate()).padStart(2, '0')}/${String(yest.getMonth() + 1).padStart(2, '0')}/${yest.getFullYear()})`;
  } else if (preset === 'last7') {
    start = new Date(y, m, d - 6, 0, 0, 0, 0);
    end = new Date(y, m, d, 23, 59, 59, 999);
    const startStr = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`;
    const endStr = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
    label = `7 ngày qua (${startStr} – ${endStr})`;
  } else if (preset === 'this_month') {
    start = new Date(y, m, 1, 0, 0, 0, 0);
    end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    label = `Tháng ${m + 1}/${y}`;
  } else if (preset === 'last_month') {
    start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    end = new Date(y, m, 0, 23, 59, 59, 999);
    const prevMonth = m === 0 ? 12 : m;
    const prevYear = m === 0 ? y - 1 : y;
    label = `Tháng ${prevMonth}/${prevYear}`;
  } else if (preset === 'this_year') {
    start = new Date(y, 0, 1, 0, 0, 0, 0);
    end = new Date(y, 11, 31, 23, 59, 59, 999);
    label = `Năm ${y}`;
  } else if (preset === 'all') {
    start = null;
    end = null;
    label = 'Toàn bộ thời gian';
  } else if (preset === 'custom') {
    const fromInput = document.getElementById('dashFromDate')?.value;
    const toInput = document.getElementById('dashToDate')?.value;
    if (fromInput) {
      const p = fromInput.split('-');
      start = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 0, 0, 0, 0);
    }
    if (toInput) {
      const p = toInput.split('-');
      end = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 23, 59, 59, 999);
    }
    if (fromInput && toInput) {
      const p1 = fromInput.split('-'), p2 = toInput.split('-');
      label = `${p1[2]}/${p1[1]}/${p1[0]} – ${p2[2]}/${p2[1]}/${p2[0]}`;
    } else if (fromInput) {
      const p1 = fromInput.split('-');
      label = `Từ ${p1[2]}/${p1[1]}/${p1[0]}`;
    } else if (toInput) {
      const p2 = toInput.split('-');
      label = `Đến ${p2[2]}/${p2[1]}/${p2[0]}`;
    } else {
      label = 'Khoảng ngày tùy chọn';
    }
  }

  return { start, end, label, preset };
}

/* ===== Xử lý khi thay đổi kiểu lọc thời gian ===== */
function onDashTimePresetChange() {
  const preset = document.getElementById('dashTimePreset')?.value;
  const customBox = document.getElementById('dashCustomDateRange');
  if (customBox) {
    customBox.style.display = preset === 'custom' ? 'flex' : 'none';
  }
  if (preset === 'custom') {
    const fromEl = document.getElementById('dashFromDate');
    const toEl = document.getElementById('dashToDate');
    const now = new Date();
    if (fromEl && !fromEl.value) {
      fromEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }
    if (toEl && !toEl.value) {
      toEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
  }
  renderDashboard();
}

function renderDashboard() {
  const dateRange = getDashDateRange();
  const act = DB.invoices.filter(i => i.status !== 'cancel' && isInvoiceInDateRange(i, dateRange.start, dateRange.end));

  const revenue = act.reduce((s, i) => s + invNet(i), 0);
  const profit = act.reduce((s, i) => s + invProfitNet(i), 0);
  const stockVal = DB.products.reduce((s, p) => s + p.cost * p.stock, 0);
  const lowCount = DB.products.filter(p => p.stock <= 5).length;

  document.getElementById('kpiRevenue').textContent = fmt(revenue);
  document.getElementById('kpiProfit').textContent = fmt(profit);
  document.getElementById('kpiOrders').textContent = act.length;
  document.getElementById('kpiStock').textContent = fmt(stockVal);
  document.getElementById('kpiStockDelta').textContent = lowCount + ' sản phẩm sắp hết';

  const timeTextEl = document.getElementById('dashTimeText');
  if (timeTextEl) timeTextEl.textContent = `${dateRange.label} (${act.length} đơn)`;

  const kpiRevSub = document.getElementById('kpiRevenueSub');
  if (kpiRevSub) kpiRevSub.textContent = `▲ Trong ${dateRange.label}`;

  const kpiProfSub = document.getElementById('kpiProfitSub');
  if (kpiProfSub) kpiProfSub.textContent = revenue > 0 ? `▲ Tỷ suất ${(profit / revenue * 100).toFixed(1)}%` : '▲ Chưa có doanh thu';

  const kpiOrdersSub = document.getElementById('kpiOrdersSub');
  if (kpiOrdersSub) kpiOrdersSub.textContent = `trong ${dateRange.label}`;

  const badge = document.getElementById('lowStockBadge');
  if (badge) badge.textContent = lowCount;

  // 1. Biểu đồ tròn Doanh thu theo danh mục (tính theo khoảng lọc)
  const catData = {};
  act.forEach(i => i.items.forEach(([id, q]) => {
    const p = findP(id);
    if (p) {
      const n = catName(p.cat);
      catData[n] = (catData[n] || 0) + p.price * q;
    }
  }));

  const catSubEl = document.getElementById('chartCatSub');
  if (catSubEl) catSubEl.textContent = `Đang lọc: ${dateRange.label}`;

  const canvasCat = document.getElementById('chartCategory');
  if (canvasCat && typeof Chart !== 'undefined') {
    if (chartCategory) chartCategory.destroy();
    const catKeys = Object.keys(catData);
    const catVals = Object.values(catData);
    chartCategory = new Chart(canvasCat, {
      type: 'doughnut',
      data: {
        labels: catKeys.length ? catKeys : ['Chưa có đơn hàng'],
        datasets: [{
          data: catVals.length ? catVals : [1],
          backgroundColor: catVals.length
            ? ['#2f6bff', '#12a878', '#f5a623', '#e5484d', '#8b5cf6', '#0ea5e9', '#ec4899', '#84cc16']
            : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#8a92a3', boxWidth: 10, padding: 10 } } }
      }
    });
  }

  // 2. Top sản phẩm bán chạy trong khoảng lọc
  const topSubEl = document.getElementById('topProdSub');
  if (topSubEl) topSubEl.textContent = `Đang lọc: ${dateRange.label}`;

  const sales = {};
  act.forEach(i => i.items.forEach(([id, q]) => { sales[id] = (sales[id] || 0) + q; }));
  const top = Object.entries(sales).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const topEl = document.getElementById('topProducts');
  if (topEl) {
    topEl.innerHTML = top.length ?
      '<table><thead><tr><th>#</th><th>Sản phẩm</th><th style="text-align:center">Đã bán</th><th style="text-align:right">Doanh thu</th></tr></thead><tbody>' +
      top.map(([id, q], idx) => {
        const p = findP(id);
        if (!p) return '';
        return `<tr><td class="muted">${idx + 1}</td><td><b>${p.name}</b></td><td style="text-align:center">${fmtQty(q)} ${catUnit(p.cat)}</td><td class="money" style="text-align:right">${fmt(p.price * q)}</td></tr>`;
      }).join('') + '</tbody></table>'
      : '<div class="empty">Chưa có dữ liệu bán hàng trong khoảng thời gian này</div>';
  }

  // 3. Cảnh báo tồn kho thấp (giữ theo trạng thái kho thực tế)
  const low = DB.products.filter(p => p.stock <= 5).sort((a, b) => a.stock - b.stock);
  const lowEl = document.getElementById('lowStockList');
  if (lowEl) {
    lowEl.innerHTML = low.length ?
      '<table><thead><tr><th>Mã SP</th><th>Tên sản phẩm</th><th>Danh mục</th><th style="text-align:center">Tồn kho</th><th style="text-align:center">Trạng thái</th></tr></thead><tbody>' +
      low.map(p => {
        const st = stockStatus(p.stock);
        return `<tr>
          <td class="muted">${p.id}</td>
          <td><b>${p.name}</b></td>
          <td><span class="cat-tag">${catName(p.cat)}</span></td>
          <td style="text-align:center"><b>${fmtQty(p.stock)}</b> ${catUnit(p.cat)}</td>
          <td style="text-align:center"><span class="pill ${st.cls}">${st.label}</span></td>
        </tr>`;
      }).join('') + '</tbody></table>'
      : '<div class="empty">Không có sản phẩm nào sắp hết</div>';
  }
}

/* ================= PHÂN TRANG ================= */
const PAGE_SIZE = 8;
const pageState = { cat: 1, kho: 1, invoice: 1, customer: 1, report: 1 };

function pageSlice(list, key) {
  const total = list.length;
  const max = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pageState[key] > max) pageState[key] = max;
  if (pageState[key] < 1) pageState[key] = 1;
  const cur = pageState[key];
  const start = (cur - 1) * PAGE_SIZE;
  return { items: list.slice(start, start + PAGE_SIZE), total, cur, max, start };
}

function renderPager(key, total, cur, max) {
  const el = document.getElementById(key + 'Pager');
  if (!el) return;
  if (total <= PAGE_SIZE) {
    el.innerHTML = '';
    return;
  }
  const from = (cur - 1) * PAGE_SIZE + 1;
  const to = Math.min(cur * PAGE_SIZE, total);

  // Danh sách nút số trang
  let pageButtons = '';
  for (let p = 1; p <= max; p++) {
    if (p === 1 || p === max || (p >= cur - 1 && p <= cur + 1)) {
      pageButtons += `<button type="button" class="pg-btn ${p === cur ? 'active' : ''}" onclick="goPage('${key}',${p})">${p}</button>`;
    } else if (p === cur - 2 || p === cur + 2) {
      pageButtons += `<span style="font-size:12px;color:var(--dim);padding:0 2px">…</span>`;
    }
  }

  el.innerHTML = `<span class="pg-info">Hiển thị ${from}–${to} / ${total}</span>
    <button type="button" class="pg-btn" ${cur <= 1 ? 'disabled' : ''} onclick="goPage('${key}',1)" title="Trang đầu">«</button>
    <button type="button" class="pg-btn" ${cur <= 1 ? 'disabled' : ''} onclick="goPage('${key}',${cur - 1})" title="Trang trước">‹</button>
    ${pageButtons}
    <button type="button" class="pg-btn" ${cur >= max ? 'disabled' : ''} onclick="goPage('${key}',${cur + 1})" title="Trang sau">›</button>
    <button type="button" class="pg-btn" ${cur >= max ? 'disabled' : ''} onclick="goPage('${key}',${max})" title="Trang cuối">»</button>`;
}

function goPage(key, page) {
  pageState[key] = page;
  if (key === 'cat') renderCategories();
  else if (key === 'kho') renderInventory();
  else if (key === 'invoice') renderInvoices();
  else if (key === 'customer') renderCustomers();
  else if (key === 'report') renderReport();
}

/* ================= QUẢN LÝ DANH MỤC ================= */
let editingCatId = null;
let lastCatSearch = '';

function renderCategories() {
  const searchInput = document.getElementById('catSearch');
  const q = (searchInput?.value || '').trim();
  const qRaw = q.toLowerCase();
  const qNoTone = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(qRaw) : qRaw;
  const qClean = qRaw.replace(/[^a-z0-9]/g, '');

  // Tự động chuyển về trang 1 khi từ khóa tìm kiếm thay đổi
  if (q !== lastCatSearch) {
    pageState.cat = 1;
    lastCatSearch = q;
  }

  let list = DB.categories.filter(c => {
    if (!q) return true;
    const rank = getCategorySearchRank(c, qRaw, qNoTone, qClean);
    return rank < 999;
  });

  if (q) {
    list.sort((a, b) => {
      const rankA = getCategorySearchRank(a, qRaw, qNoTone, qClean);
      const rankB = getCategorySearchRank(b, qRaw, qNoTone, qClean);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name, 'vi');
    });
  }

  const pg = pageSlice(list, 'cat');

  document.getElementById('catCount').textContent = `${list.length} danh mục`;
  const body = document.getElementById('catBody');
  if (body) {
    body.innerHTML = pg.items.length ? pg.items.map(c => {
      const ps = DB.products.filter(p => p.cat === c.id);
      const stock = ps.reduce((s, p) => s + p.stock, 0);
      return `<tr>
        <td class="muted">${c.id}</td>
        <td><b>${c.name}</b>${c.desc ? `<div class="muted" style="font-size:11px">${c.desc}</div>` : ''}</td>
        <td><span class="pill purple">${(CAT_TYPES[c.type] || { label: 'Khác' }).label}</span></td>
        <td><span class="unit-tag">${c.unit}</span></td>
        <td style="text-align:center">${ps.length}</td>
        <td style="text-align:right"><b>${fmtQty(stock)}</b> ${c.unit}</td>
        <td style="white-space:nowrap;text-align:center">
          <button class="btn ghost sm" onclick="openCategoryModal('${c.id}')">Sửa</button>
          <button class="btn ghost sm" onclick="deleteCategory('${c.id}')">Xóa</button>
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="7"><div class="empty">Không tìm thấy danh mục phù hợp</div></td></tr>';
  }

  renderPager('cat', pg.total, pg.cur, pg.max);
}

function openCategoryModal(id) {
  editingCatId = id || null;
  const nameInput = document.getElementById('catName');
  const typeInput = document.getElementById('catType');
  const unitInput = document.getElementById('catUnit');
  const descInput = document.getElementById('catDesc');

  if (id) {
    const c = findCat(id);
    document.getElementById('catModalTitle').textContent = 'Sửa danh mục ' + id;
    nameInput.value = c.name;
    typeInput.value = c.type;
    unitInput.value = c.unit;
    descInput.value = c.desc || '';
  } else {
    document.getElementById('catModalTitle').textContent = 'Thêm danh mục mới';
    nameInput.value = '';
    typeInput.value = 'quantity';
    unitInput.value = 'cái';
    descInput.value = '';
  }

  onCatTypeChange();
  openModal('categoryModal');
}

function onCatTypeChange() {
  const t = document.getElementById('catType')?.value || 'quantity';
  const units = (CAT_TYPES[t] || { units: [] }).units;
  const listEl = document.getElementById('unitList');
  if (listEl) {
    listEl.innerHTML = units.map(u => `<option value="${u}">`).join('');
  }
}

/* ===== Validate & Lưu Danh Mục ===== */
function saveCategory() {
  const nameInput = document.getElementById('catName');
  const typeInput = document.getElementById('catType');
  const unitInput = document.getElementById('catUnit');
  const descInput = document.getElementById('catDesc');

  const name = (nameInput.value || '').trim();
  const type = typeInput.value;
  const unit = (unitInput.value || '').trim();
  const desc = (descInput.value || '').trim();

  // Validate tên danh mục
  if (!name) {
    markInvalid(nameInput, 'Vui lòng nhập tên danh mục!');
    return;
  }
  if (name.length < 2) {
    markInvalid(nameInput, 'Tên danh mục phải có ít nhất 2 ký tự!');
    return;
  }

  // Kiểm tra trùng tên danh mục
  const dup = DB.categories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingCatId);
  if (dup) {
    markInvalid(nameInput, `Tên danh mục "${name}" đã tồn tại!`);
    return;
  }

  // Validate đơn vị tính
  if (!unit) {
    markInvalid(unitInput, 'Vui lòng nhập đơn vị bán!');
    return;
  }

  if (editingCatId) {
    const c = findCat(editingCatId);
    if (c) {
      Object.assign(c, { name, type, unit, desc });
      toast('Đã cập nhật danh mục ' + name);
    }
  } else {
    const id = 'DM-' + String(DB.nextCategoryId++).padStart(2, '0');
    DB.categories.push({ id, name, type, unit, desc });
    toast('Đã thêm danh mục mới: ' + name);
  }

  saveDB();
  closeModal('categoryModal');
  renderCategories();
}

function deleteCategory(id) {
  const used = DB.products.filter(p => p.cat === id).length;
  if (used > 0) {
    toast(`Không thể xóa: Có ${used} sản phẩm đang thuộc danh mục này!`);
    return;
  }
  const c = findCat(id);
  if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${c.name}"?`)) return;

  DB.categories = DB.categories.filter(x => x.id !== id);
  saveDB();
  renderCategories();
  toast('Đã xóa danh mục thành công');
}

/* ================= QUẢN LÝ SẢN PHẨM ================= */
let editingProdId = null;

let lastKhoSearch = '';

function renderInventory() {
  // Điền danh sách danh mục vào bộ lọc
  const catSel = document.getElementById('filterCat');
  if (catSel) {
    const cc = catSel.value;
    catSel.innerHTML = '<option value="">Tất cả danh mục</option>' + DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    catSel.value = cc;
  }

  // Điền danh sách thương hiệu vào bộ lọc
  const bSel = document.getElementById('filterBrand');
  if (bSel) {
    const bb = bSel.value;
    const brands = [...new Set(DB.products.map(p => p.brand).filter(Boolean))];
    bSel.innerHTML = '<option value="">Tất cả thương hiệu</option>' + brands.map(b => `<option value="${b}">${b}</option>`).join('');
    bSel.value = bb;
  }

  const searchInput = document.getElementById('khoSearch');
  const q = (searchInput?.value || '').trim();
  const qRaw = q.toLowerCase();
  const qNoTone = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(qRaw) : qRaw;
  const qClean = qRaw.replace(/[^a-z0-9]/g, '');
  const cat = document.getElementById('filterCat')?.value || '';
  const brand = document.getElementById('filterBrand')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const sort = document.getElementById('sortBy')?.value || 'name';

  // Tự động chuyển về trang 1 khi từ khóa tìm kiếm thay đổi
  if (q !== lastKhoSearch) {
    pageState.kho = 1;
    lastKhoSearch = q;
  }

  let list = DB.products.filter(p => {
    if (cat && p.cat !== cat) return false;
    if (brand && p.brand !== brand) return false;
    if (status && stockStatus(p.stock).cls !== status) return false;
    if (!q) return true;
    const rank = getProductSearchRank(p, qRaw, qNoTone, qClean);
    return rank < 999;
  });

  if (q && sort === 'name') {
    // Khi đang tìm kiếm theo từ khóa và chế độ sắp xếp theo Tên: Ưu tiên khớp đầu mã/tên lên trước
    list.sort((a, b) => {
      const rankA = getProductSearchRank(a, qRaw, qNoTone, qClean);
      const rankB = getProductSearchRank(b, qRaw, qNoTone, qClean);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name, 'vi');
    });
  } else {
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'stock-asc') list.sort((a, b) => a.stock - b.stock);
    else if (sort === 'stock-desc') list.sort((a, b) => b.stock - a.stock);
    else list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  const pg = pageSlice(list, 'kho');
  document.getElementById('khoCount').textContent = `${list.length} sản phẩm`;

  const body = document.getElementById('khoBody');
  if (body) {
    body.innerHTML = pg.items.length ? pg.items.map(p => {
      const st = stockStatus(p.stock);
      return `<tr>
        <td class="muted">${p.id}</td>
        <td><b>${p.name}</b>${p.spec ? `<div class="muted" style="font-size:11px">${p.spec}</div>` : ''}</td>
        <td><span class="cat-tag">${catName(p.cat)}</span></td>
        <td class="muted">${p.brand || 'Khác'}</td>
        <td class="muted" style="text-align:right">${fmt(p.cost)}</td>
        <td class="money" style="text-align:right">${fmt(p.price)}</td>
        <td style="text-align:center"><span class="unit-tag">${catUnit(p.cat)}</span></td>
        <td style="text-align:center"><b>${fmtQty(p.stock)}</b></td>
        <td style="text-align:center"><span class="pill ${st.cls}">${st.label}</span></td>
        <td style="white-space:nowrap;text-align:center">
          <button class="btn ghost sm" onclick="openProductModal('${p.id}')">Sửa</button>
          <button class="btn ghost sm" onclick="deleteProduct('${p.id}')">Xóa</button>
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="10"><div class="empty">Không tìm thấy sản phẩm phù hợp</div></td></tr>';
  }

  renderPager('kho', pg.total, pg.cur, pg.max);
}

function openProductModal(id) {
  editingProdId = id || null;
  const sel = document.getElementById('prodCat');
  sel.innerHTML = DB.categories.map(c => `<option value="${c.id}">${c.name} (${c.unit})</option>`).join('');

  const nameInput = document.getElementById('prodName');
  const brandInput = document.getElementById('prodBrand');
  const costInput = document.getElementById('prodCost');
  const priceInput = document.getElementById('prodPrice');
  const stockInput = document.getElementById('prodStock');
  const specInput = document.getElementById('prodSpec');

  if (id) {
    const p = findP(id);
    document.getElementById('prodModalTitle').textContent = 'Sửa sản phẩm ' + id;
    nameInput.value = p.name;
    sel.value = p.cat;
    brandInput.value = p.brand || '';
    costInput.value = p.cost;
    priceInput.value = p.price;
    stockInput.value = p.stock;
    specInput.value = p.spec || '';
  } else {
    document.getElementById('prodModalTitle').textContent = 'Thêm sản phẩm mới';
    nameInput.value = '';
    brandInput.value = '';
    costInput.value = 0;
    priceInput.value = 0;
    stockInput.value = 0;
    specInput.value = '';
  }

  onProdCatChange();
  openModal('productModal');
}

function onProdCatChange() {
  const cat = document.getElementById('prodCat')?.value;
  const unitInput = document.getElementById('prodUnit');
  const stockInput = document.getElementById('prodStock');

  if (unitInput) unitInput.value = catUnit(cat) || '—';
  if (stockInput) {
    const step = isDecimalUnit(cat) ? '0.01' : '1';
    stockInput.step = step;
  }
}

/* ===== Validate & Lưu Sản Phẩm ===== */
function saveProduct() {
  const nameInput = document.getElementById('prodName');
  const catInput = document.getElementById('prodCat');
  const brandInput = document.getElementById('prodBrand');
  const costInput = document.getElementById('prodCost');
  const priceInput = document.getElementById('prodPrice');
  const stockInput = document.getElementById('prodStock');
  const specInput = document.getElementById('prodSpec');

  const name = (nameInput.value || '').trim();
  const cat = catInput.value;

  // 1. Validate Tên sản phẩm
  if (!name) {
    markInvalid(nameInput, 'Vui lòng nhập tên sản phẩm!');
    return;
  }
  if (name.length < 2) {
    markInvalid(nameInput, 'Tên sản phẩm phải có ít nhất 2 ký tự!');
    return;
  }

  // 2. Validate Danh mục
  if (!cat) {
    markInvalid(catInput, 'Vui lòng chọn danh mục sản phẩm!');
    return;
  }

  // 3. Validate Giá nhập
  const costRaw = costInput.value.replace(/[,.]/g, '');
  const cost = parseInt(costRaw, 10);
  if (isNaN(cost) || cost < 0) {
    markInvalid(costInput, 'Giá nhập phải là số không âm (>= 0)!');
    return;
  }

  // 4. Validate Giá bán
  const priceRaw = priceInput.value.replace(/[,.]/g, '');
  const price = parseInt(priceRaw, 10);
  if (isNaN(price) || price < 0) {
    markInvalid(priceInput, 'Giá bán phải là số không âm (>= 0)!');
    return;
  }

  // Cảnh báo bán lỗ (nếu giá bán nhỏ hơn giá nhập)
  if (price < cost && price > 0) {
    if (!confirm(`Cảnh báo: Giá bán (${fmt(price)}) đang NHỎ HƠN giá nhập (${fmt(cost)}).\nBạn có chắc chắn muốn lưu mức giá này?`)) {
      priceInput.focus();
      return;
    }
  }

  // 5. Validate Tồn kho
  const step = catStep(cat);
  let stockVal = parseFloat(stockInput.value.replace(',', '.'));
  if (isNaN(stockVal) || stockVal < 0) {
    markInvalid(stockInput, 'Số lượng tồn kho không được âm!');
    return;
  }

  // Nếu là đơn vị số lượng nguyên thì không cho số lẻ
  if (!isDecimalUnit(cat) && !Number.isInteger(stockVal)) {
    markInvalid(stockInput, `Sản phẩm thuộc đơn vị "${catUnit(cat)}" nên số lượng tồn phải là số nguyên!`);
    return;
  }
  const stock = roundQty(stockVal, step);

  const brand = (brandInput.value || '').trim() || 'Khác';
  const spec = (specInput.value || '').trim();

  if (editingProdId) {
    const p = findP(editingProdId);
    if (p) {
      Object.assign(p, { name, cat, brand, cost, price, stock, spec });
      toast('Đã cập nhật sản phẩm thành công');
    }
  } else {
    const id = 'SP-' + String(DB.nextProductId++).padStart(3, '0');
    DB.products.push({ id, name, cat, brand, cost, price, stock, spec });
    toast('Đã thêm mới sản phẩm ' + name);
  }

  saveDB();
  closeModal('productModal');
  renderInventory();
}

function deleteProduct(id) {
  const p = findP(id);
  if (!p) return;
  if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${p.name}"?`)) return;

  DB.products = DB.products.filter(x => x.id !== id);
  saveDB();
  renderInventory();
  toast('Đã xóa sản phẩm thành công');
}

/* ================= DANH SÁCH HÓA ĐƠN ================= */
let selectedInvoices = new Set();

function renderInvoices() {
  const q = (document.getElementById('invoiceSearch')?.value || '').toLowerCase().trim();
  const status = document.getElementById('invoiceStatus')?.value || '';
  const month = document.getElementById('invoiceMonth')?.value || '';

  let list = DB.invoices.filter(i => {
    if (q && !(i.id.toLowerCase().includes(q) || i.customer.toLowerCase().includes(q))) return false;
    if (status && i.status !== status) return false;
    if (month) {
      const d = i.date.split('/');
      if (`${d[2]}-${d[1]}` !== month) return false;
    }
    return true;
  });

  list.sort((a, b) => b.id.localeCompare(a.id));

  const totalRev = list.reduce((s, i) => s + invNet(i), 0);
  const totalProf = list.reduce((s, i) => s + invProfitNet(i), 0);
  document.getElementById('invoiceCount').textContent = `${list.length} hóa đơn · Doanh thu: ${fmt(totalRev)} · Lợi nhuận: ${fmt(totalProf)}`;

  const pg = pageSlice(list, 'invoice');
  const body = document.getElementById('invoiceBody');
  if (body) {
    body.innerHTML = pg.items.length ? pg.items.map(i => {
      const st = i.status === 'paid' ? { cls: 'ok', label: 'Đã thanh toán' } : i.status === 'pending' ? { cls: 'low', label: 'Chưa TT' } : { cls: 'out', label: 'Đã hủy' };
      const ec = i.exportCount || 0;
      return `<tr>
        <td><input type="checkbox" class="inv-check" data-id="${i.id}" onchange="onRowCheck()" ${selectedInvoices.has(i.id) ? 'checked' : ''}></td>
        <td><b>${i.id}</b></td>
        <td>${i.customer}</td>
        <td class="muted">${i.date}</td>
        <td class="money" style="text-align:right">${fmt(invNet(i))}</td>
        <td class="money" style="text-align:right;color:var(--teal)">${fmt(invProfitNet(i))}</td>
        <td style="text-align:center">${fmtQty(invoiceItemsCount(i.items))}</td>
        <td style="text-align:center"><span class="pill ${st.cls}">${st.label}</span></td>
        <td style="text-align:center">${ec > 0 ? `<span class="pill blue">${ec} lần</span>` : '<span class="muted">—</span>'}</td>
        <td style="text-align:center"><button class="btn ghost sm" onclick="viewInvoice('${i.id}')">Chi tiết</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="10"><div class="empty">Không tìm thấy hóa đơn phù hợp</div></td></tr>';
  }

  renderPager('invoice', pg.total, pg.cur, pg.max);
  updateSelectedInfo();
}

function onRowCheck() {
  document.querySelectorAll('.inv-check').forEach(cb => {
    cb.checked ? selectedInvoices.add(cb.dataset.id) : selectedInvoices.delete(cb.dataset.id);
  });
  syncCheckAll();
  updateSelectedInfo();
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.inv-check').forEach(cb => {
    cb.checked = checked;
    checked ? selectedInvoices.add(cb.dataset.id) : selectedInvoices.delete(cb.dataset.id);
  });
  updateSelectedInfo();
}

function syncCheckAll() {
  const all = document.querySelectorAll('.inv-check');
  const checked = document.querySelectorAll('.inv-check:checked');
  const checkAll = document.getElementById('checkAll');
  if (checkAll) {
    checkAll.checked = all.length > 0 && all.length === checked.length;
    checkAll.indeterminate = checked.length > 0 && checked.length < all.length;
  }
}

function updateSelectedInfo() {
  const n = selectedInvoices.size;
  const infoEl = document.getElementById('selectedInfo');
  const btnEl = document.getElementById('btnExportSelected');
  if (infoEl) infoEl.textContent = n > 0 ? `Đã chọn ${n} hóa đơn` : 'Chưa chọn hóa đơn nào';
  if (btnEl) btnEl.textContent = n > 0 ? `⬇ Xuất Excel (${n})` : '⬇ Xuất Excel (đã chọn)';
}


/* ================= QUẢN LÝ KHÁCH HÀNG ================= */
let editingCustomerId = null;
let lastCustomerSearch = '';

function renderCustomers() {
  const searchInput = document.getElementById('customerSearch');
  const q = (searchInput?.value || '').toLowerCase().trim();
  const qNorm = typeof normalizePhoneDigits === 'function' ? normalizePhoneDigits(q) : q.replace(/\D/g, '');

  // Tự động chuyển về trang 1 khi từ khóa tìm kiếm thay đổi
  if (q !== lastCustomerSearch) {
    pageState.customer = 1;
    lastCustomerSearch = q;
  }

  const list = DB.customers.filter(c => {
    if (!q) return true;
    if (c.name.toLowerCase().includes(q)) return true;
    if (c.phone) {
      if (c.phone.toLowerCase().includes(q)) return true;
      const cNorm = typeof normalizePhoneDigits === 'function' ? normalizePhoneDigits(c.phone) : c.phone.replace(/\D/g, '');
      if (qNorm && cNorm.includes(qNorm)) return true;
    }
    return false;
  });

  const pg = pageSlice(list, 'customer');

  document.getElementById('customerCount').textContent = `${list.length} khách hàng`;
  const body = document.getElementById('customerBody');
  if (body) {
    body.innerHTML = pg.items.length ? pg.items.map(c => {
      const st = customerStats(c);
      const t = customerType(c);
      const btn = c.type === 'agent'
        ? `<button class="btn ghost sm" onclick="toggleCustomerType('${c.id}')" title="Chuyển về khách lẻ">→ Khách lẻ</button>`
        : `<button class="btn purple sm" onclick="toggleCustomerType('${c.id}')" title="Nâng cấp lên đại lý">↑ Nâng đại lý</button>`;
      return `<tr>
        <td class="muted">${c.id}</td>
        <td><b>${c.name}</b></td>
        <td class="muted">${c.phone || '—'}</td>
        <td style="text-align:center"><span class="pill ${t.cls}">${t.label}</span></td>
        <td style="text-align:center">${st.count}</td>
        <td class="money" style="text-align:right">${fmt(st.spend)}</td>
        <td style="text-align:center;white-space:nowrap">${btn} <button class="btn ghost sm" onclick="openEditCustomer('${c.id}')">Sửa</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="7"><div class="empty">Không tìm thấy khách hàng phù hợp</div></td></tr>';
  }

  renderPager('customer', pg.total, pg.cur, pg.max);
}

function openAddCustomer() {
  editingCustomerId = null;
  document.getElementById('custModalTitle').textContent = 'Thêm khách hàng mới';
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custType').value = 'retail';
  const phoneInput = document.getElementById('custPhone');
  if (phoneInput) phoneInput.classList.remove('is-invalid');
  const errEl = document.getElementById('custPhoneError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  openModal('customerModal');
}

function openEditCustomer(id) {
  const c = DB.customers.find(x => x.id === id);
  if (!c) return;
  editingCustomerId = id;
  document.getElementById('custModalTitle').textContent = 'Sửa khách hàng ' + c.id;
  document.getElementById('custName').value = c.name;
  const rawPhone = (c.phone || '').replace(/\D/g, '');
  document.getElementById('custPhone').value = rawPhone || c.phone || '';
  document.getElementById('custType').value = c.type || 'retail';
  const phoneInput = document.getElementById('custPhone');
  if (phoneInput) phoneInput.classList.remove('is-invalid');
  const errEl = document.getElementById('custPhoneError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  openModal('customerModal');
}

/* ===== Validate Live Số Điện Thoại Trong Modal Khách Hàng ===== */
function onCustPhoneInput(inputEl) {
  const errEl = document.getElementById('custPhoneError');
  const val = inputEl ? inputEl.value : '';

  if (!val) {
    inputEl.classList.remove('is-invalid');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    return;
  }

  // 1. Chứa các kí tự không phải là số -> BÁO LỖI LUÔN
  if (/\D/.test(val)) {
    inputEl.classList.add('is-invalid');
    const msg = 'Số điện thoại chỉ được chứa các chữ số (0-9)!';
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.color = 'var(--red)';
      errEl.style.display = 'block';
    }
    toast(msg);
    return;
  }

  // 2. Bắt đầu không phải số 0 -> BÁO LỖI LUÔN
  if (!val.startsWith('0')) {
    inputEl.classList.add('is-invalid');
    const msg = 'Số điện thoại phải bắt đầu bằng số 0!';
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.color = 'var(--red)';
      errEl.style.display = 'block';
    }
    toast(msg);
    return;
  }

  // 3. Nhập quá 10 kí tự -> BÁO LỖI LUÔN
  if (val.length > 10) {
    inputEl.classList.add('is-invalid');
    const msg = `Số điện thoại chỉ gồm tối đa 10 chữ số (đang có ${val.length} số)!`;
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.color = 'var(--red)';
      errEl.style.display = 'block';
    }
    toast('Số điện thoại chỉ gồm tối đa 10 chữ số!');
    return;
  }

  // Hợp lệ khi đang nhập (< 10 số)
  inputEl.classList.remove('is-invalid');
  if (errEl) {
    if (val.length < 10) {
      errEl.textContent = `Đang nhập: ${val.length}/10 số (cần đủ 10 số)`;
      errEl.style.color = 'var(--muted)';
      errEl.style.display = 'block';
    } else {
      errEl.textContent = '✓ Số điện thoại hợp lệ (10 chữ số)';
      errEl.style.color = 'var(--teal)';
      errEl.style.display = 'block';
    }
  }
}

/* ===== Validate & Lưu Khách Hàng ===== */
function saveCustomer() {
  const nameInput = document.getElementById('custName');
  const phoneInput = document.getElementById('custPhone');
  const typeInput = document.getElementById('custType');
  const errEl = document.getElementById('custPhoneError');

  const name = (nameInput.value || '').trim();
  const phone = (phoneInput.value || '').trim();
  const type = typeInput.value || 'retail';

  // 1. Validate Tên khách hàng
  if (!name) {
    markInvalid(nameInput, 'Vui lòng nhập họ và tên khách hàng!');
    return;
  }
  if (name.length < 2) {
    markInvalid(nameInput, 'Tên khách hàng phải có ít nhất 2 ký tự!');
    return;
  }

  // 2. Validate Số điện thoại (nếu có nhập): Phải đúng 10 số, bắt đầu bằng 0, chỉ chứa số
  if (phone) {
    const pCheck = validatePhoneNumber(phone, false);
    if (!pCheck.valid) {
      markInvalid(phoneInput, pCheck.error);
      if (errEl) {
        errEl.textContent = pCheck.error;
        errEl.style.color = 'var(--red)';
        errEl.style.display = 'block';
      }
      return;
    }

    // Kiểm tra trùng SĐT với khách hàng khác trong DB
    const existing = DB.customers.find(c => c.id !== editingCustomerId && (c.phone || '').replace(/\D/g, '') === phone);
    if (existing) {
      const dupMsg = `Số điện thoại này đã thuộc về khách hàng "${existing.name}"!`;
      markInvalid(phoneInput, dupMsg);
      if (errEl) {
        errEl.textContent = dupMsg;
        errEl.style.color = 'var(--red)';
        errEl.style.display = 'block';
      }
      return;
    }
  }

  const formattedPhone = phone ? formatPhone(phone) : '';

  if (editingCustomerId) {
    const c = DB.customers.find(x => x.id === editingCustomerId);
    if (c) {
      c.name = name;
      c.phone = formattedPhone;
      c.type = type;
    }
  } else {
    let maxNum = 0;
    DB.customers.forEach(cust => {
      if (cust.id && cust.id.startsWith('KH-')) {
        const num = parseInt(cust.id.replace('KH-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextNum = Math.max(maxNum + 1, DB.nextCustomerId || 1);
    DB.nextCustomerId = nextNum + 1;
    const id = 'KH-' + String(nextNum).padStart(2, '0');
    DB.customers.push({ id, name, phone: formattedPhone, type });
  }

  saveDB();
  closeModal('customerModal');
  renderCustomers();
  toast(editingCustomerId ? 'Đã cập nhật thông tin khách hàng' : 'Đã thêm khách hàng: ' + name);
}

function toggleCustomerType(id) {
  const c = DB.customers.find(x => x.id === id);
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

/* ================= BÁO CÁO THỐNG KÊ ================= */
function renderReport() {
  const act = DB.invoices.filter(i => i.status !== 'cancel');

  // Bảng tổng hợp kinh doanh theo danh mục
  const reportBody = document.getElementById('reportBody');
  if (reportBody) {
    reportBody.innerHTML = '<table><thead><tr><th>Danh mục</th><th style="text-align:center">Số SP</th><th style="text-align:center">Tồn kho</th><th style="text-align:right">Giá trị tồn</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">Lợi nhuận</th></tr></thead><tbody>' +
      DB.categories.map(c => {
        const ps = DB.products.filter(p => p.cat === c.id);
        let rev = 0, prof = 0;
        act.forEach(i => i.items.forEach(([id, q]) => {
          const p = findP(id);
          if (p && p.cat === c.id) {
            rev += p.price * q;
            prof += (p.price - p.cost) * q;
          }
        }));
        return `<tr>
          <td><span class="cat-tag">${c.name}</span></td>
          <td style="text-align:center">${ps.length}</td>
          <td style="text-align:center"><b>${fmtQty(ps.reduce((s, p) => s + p.stock, 0))}</b> ${c.unit}</td>
          <td style="text-align:right" class="money">${fmt(ps.reduce((s, p) => s + p.cost * p.stock, 0))}</td>
          <td style="text-align:right" class="money">${fmt(rev)}</td>
          <td style="text-align:right" class="money" style="color:var(--teal)">${fmt(prof)}</td>
        </tr>`;
      }).join('') + '</tbody></table>';
  }
}

/* ================= XUẤT CSV (EXCEL) ================= */
function exportCSV(filename, rows) {
  const csv = '\ufeff' + rows.map(r => r.map(c => `"${String(c != null ? c : '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast('Đã xuất thành công: ' + filename);
}

function exportInventory() {
  const rows = [['Mã SP', 'Tên sản phẩm', 'Danh mục', 'Thương hiệu', 'Giá nhập', 'Giá bán', 'Đơn vị', 'Tồn kho', 'Quy cách', 'Tình trạng']];
  DB.products.forEach(p => rows.push([p.id, p.name, catName(p.cat), p.brand, p.cost, p.price, catUnit(p.cat), p.stock, p.spec || '', stockStatus(p.stock).label]));
  exportCSV('danh-sach-san-pham.csv', rows);
}

function exportSelectedInvoices() {
  const ids = [...selectedInvoices];
  if (ids.length === 0) {
    toast('Vui lòng tích chọn ít nhất 1 hóa đơn để xuất!');
    return;
  }
  const chosen = DB.invoices.filter(i => ids.includes(i.id));
  chosen.sort((a, b) => b.id.localeCompare(a.id));
  const rows = [['Mã HĐ', 'Khách hàng', 'Ngày tạo', 'Số mặt hàng', 'Tổng tiền hàng', 'Chiết khấu', 'Khách thanh toán', 'Lợi nhuận', 'Trạng thái', 'Số lần đã xuất']];
  chosen.forEach(i => rows.push([i.id, i.customer, i.date, invoiceItemsCount(i.items), invoiceTotal(i.items), invDisc(i), invNet(i), invProfitNet(i), i.status === 'paid' ? 'Đã thanh toán' : i.status === 'pending' ? 'Chưa TT' : 'Đã hủy', (i.exportCount || 0) + 1]));
  chosen.forEach(i => { i.exportCount = (i.exportCount || 0) + 1; });
  saveDB();
  exportCSV(`hoa-don-${chosen.length}-don.csv`, rows);
  selectedInvoices.clear();
  renderInvoices();
}

function exportReport() {
  const rows = [['Danh mục', 'Kiểu hàng hóa', 'Đơn vị', 'Số SP', 'Tồn kho', 'Giá trị tồn (VNĐ)']];
  DB.categories.forEach(c => {
    const ps = DB.products.filter(p => p.cat === c.id);
    rows.push([c.name, (CAT_TYPES[c.type] || { label: '' }).label, c.unit, ps.length, ps.reduce((s, p) => s + p.stock, 0), ps.reduce((s, p) => s + p.cost * p.stock, 0)]);
  });
  exportCSV('bao-cao-ton-kho.csv', rows);
}

function exportCurrent() {
  if (currentView === 'sanpham') exportInventory();
  else if (currentView === 'hoadon' || currentView === 'banhang') exportSelectedInvoices();
  else if (currentView === 'baocao') exportReport();
  else exportInventory();
}

/* ================= KHỞI CHẠY ỨNG DỤNG ================= */
document.addEventListener('DOMContentLoaded', () => {
  // Gán sự kiện click điều hướng cho Sidebar
  document.querySelectorAll('.nav a').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(a.dataset.view);
    });
  });

  // Tự động bỏ viền đỏ is-invalid khi người dùng nhập dữ liệu
  document.addEventListener('input', (e) => {
    if (e.target && e.target.classList.contains('is-invalid')) {
      e.target.classList.remove('is-invalid');
    }
  });

  // Đóng modal khi bấm phím Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.overlay.show').forEach(m => m.classList.remove('show'));
    }
  });

  // Đóng modal khi bấm ra ngoài phần thân modal
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('show');
      }
    });
  });

  // Khôi phục giao diện sáng/tối đã lưu
  loadTheme();

  onCatTypeChange();
  switchView('dashboard');
});
