/* ==========================================================================
   PMBANHANG - MAIN APPLICATION & ROUTER (app.js)
   Điều hướng, Dashboard, Danh mục, Sản phẩm, Kho, NCC, Khách hàng,
   Báo cáo, Cài đặt, Sao lưu & Đăng nhập
   ========================================================================== */

/* ================= MODAL & TOAST ================= */
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ================= DARK / LIGHT THEME ================= */
const THEME_KEY = 'pmbanhang_theme';

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  updateThemeIcon();
  toast(isDark ? 'Đã chuyển sang giao diện tối' : 'Đã chuyển sang giao diện sáng');
  refreshCurrentView();
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.textContent = document.body.classList.contains('dark') ? '☀' : '🌙';
    btn.title = document.body.classList.contains('dark') ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  }
}

function loadTheme() {
  if (localStorage.getItem(THEME_KEY) === 'dark') {
    document.body.classList.add('dark');
  }
  updateThemeIcon();
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    m.classList.add('show');
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('show');
}

/* ================= MENU DI ĐỘNG (SIDEBAR DRAWER) ================= */
/* Bản web mở bằng trình duyệt: luôn là giao diện xem số liệu (mobile-shell).
   App desktop WebView2: chỉ dùng giao diện điện thoại khi cửa sổ hẹp (<= 768px). */
function isMobileLayout() {
  if (window.__MOBILE_SHELL__) return true;
  return window.matchMedia('(max-width: 768px)').matches;
}

function openSidebar() {
  document.body.classList.add('sidebar-open');
  const bd = document.getElementById('sidebarBackdrop');
  if (bd) bd.classList.add('show');
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  const bd = document.getElementById('sidebarBackdrop');
  if (bd) bd.classList.remove('show');
}

function toggleSidebar() {
  if (document.body.classList.contains('sidebar-open')) closeSidebar();
  else openSidebar();
}

/* ================= VALIDATION HELPERS ================= */
function markInvalid(inputEl, msg) {
  if (!inputEl) return;
  inputEl.classList.add('is-invalid');
  try { inputEl.focus(); } catch (_) { }
  if (msg) toast(msg);
}

function clearInvalid(inputEl) {
  if (inputEl) inputEl.classList.remove('is-invalid');
}

function num(v, fallback) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[,.\s]/g, ''));
  return isNaN(n) ? (fallback || 0) : n;
}

/* ================= ĐĂNG NHẬP ĐƠN GIẢN ================= */
const MANAGER_ONLY_VIEWS = ['danhmuc', 'sanpham', 'khachhang', 'baocao', 'caidat', 'saoluu'];

function applyAuthUI() {
  const manager = isManager();
  const ava = document.getElementById('userAvatar');
  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRoleText');
  const lockBtn = document.getElementById('authBtn');

  if (ava) ava.textContent = manager ? 'QL' : 'NV';
  if (nameEl) nameEl.textContent = manager ? 'Quản lý cửa hàng' : 'Nhân viên bán hàng';
  if (roleEl) roleEl.textContent = manager ? 'Toàn quyền hệ thống' : 'Chỉ bán hàng & hóa đơn';
  if (lockBtn) {
    lockBtn.textContent = manager ? '🔓 Đăng xuất' : '🔑 Đăng nhập quản lý';
    lockBtn.title = manager ? 'Thoát quyền quản lý, trở về chế độ nhân viên' : 'Nhập mật khẩu để mở toàn quyền';
  }

  document.querySelectorAll('.nav a[data-view]').forEach(a => {
    const needManager = MANAGER_ONLY_VIEWS.indexOf(a.dataset.view) !== -1;
    a.style.display = (!needManager || manager) ? '' : 'none';
  });
  document.querySelectorAll('.nav-label[data-group]').forEach(el => {
    if (el.dataset.group === 'admin') el.style.display = manager ? '' : 'none';
  });

  const sheetAuth = document.getElementById('sheetAuthBtn');
  if (sheetAuth) sheetAuth.textContent = manager ? '🔓 Đăng xuất khỏi quyền quản lý' : '🔑 Đăng nhập quản lý';
  const sheetUser = document.getElementById('sheetUserInfo');
  if (sheetUser) {
    sheetUser.textContent = manager
      ? 'Đang đăng nhập: Quản lý cửa hàng (toàn quyền hệ thống)'
      : 'Đang đăng nhập: Nhân viên bán hàng';
  }

  document.body.classList.toggle('staff-mode', !manager);
}

function onAuthButtonClick() {
  if (isManager()) {
    if (!confirm('Đăng xuất khỏi quyền quản lý?\n\nCác mục Cài đặt, Kho, Sao lưu sẽ bị ẩn cho tới khi đăng nhập lại.')) return;
    setManagerAuth(false);
    applyAuthUI();
    if (MANAGER_ONLY_VIEWS.indexOf(currentView) !== -1) switchView(homeView());
    toast('Đã chuyển sang chế độ Nhân viên bán hàng');
    return;
  }

  const pwInput = document.getElementById('loginPassword');
  if (pwInput) pwInput.value = '';
  const errEl = document.getElementById('loginError');
  if (errEl) errEl.style.display = 'none';
  openModal('loginModal');
  setTimeout(() => { if (pwInput) pwInput.focus(); }, 80);
}

function submitLogin() {
  const pwInput = document.getElementById('loginPassword');
  const errEl = document.getElementById('loginError');
  const pw = pwInput ? pwInput.value : '';

  if (!pw) {
    if (errEl) { errEl.textContent = 'Vui lòng nhập mật khẩu quản lý!'; errEl.style.display = 'block'; }
    if (pwInput) pwInput.classList.add('is-invalid');
    return;
  }
  if (!checkManagerPassword(pw)) {
    if (errEl) { errEl.textContent = 'Mật khẩu không đúng. Vui lòng thử lại!'; errEl.style.display = 'block'; }
    if (pwInput) { pwInput.classList.add('is-invalid'); pwInput.select(); }
    return;
  }

  setManagerAuth(true);
  closeModal('loginModal');
  applyAuthUI();
  refreshCurrentView();
  toast('✓ Đã đăng nhập quyền Quản lý');
}

/* ================= ROUTER & NAVIGATION ================= */
let currentView = 'dashboard';

const VIEW_META = {
  dashboard: ["Dashboard", "Tổng quan cửa hàng"],
  banhang: ["Bán hàng (POS)", "Chọn sản phẩm và tạo hóa đơn"],
  hoadon: ["Hóa đơn bán hàng", "Quản lý bán hàng & thanh toán"],
  danhmuc: ["Quản lý danh mục", "Danh mục sản phẩm & kiểu hàng hóa"],
  sanpham: ["Quản lý sản phẩm", "Danh sách sản phẩm & tồn kho"],
  khachhang: ["Khách hàng", "Danh sách khách hàng & công nợ"],
  baocao: ["Báo cáo", "Nhập – xuất – tồn & lợi nhuận"],
  caidat: ["Cài đặt cửa hàng", "Thông tin hóa đơn, VietQR & mật khẩu"],
  saoluu: ["Sao lưu & dữ liệu", "Sao lưu, phục hồi và đặt lại dữ liệu"],
  doanhthu: ["Doanh thu", "Thống kê doanh thu, lợi nhuận & bán chạy"],
  congno: ["Dư nợ khách hàng", "Theo dõi và thu nợ khách hàng"],
};

/* Bản xem số liệu trên điện thoại KHÔNG có bán hàng và báo cáo Nhập–Xuất–Tồn. */
const MOBILE_HIDDEN_VIEWS = ['banhang', 'baocao'];
const MOBILE_PRIMARY_VIEWS = ['dashboard', 'doanhthu', 'congno'];

function homeView() {
  return isMobileLayout() ? 'dashboard' : 'banhang';
}

function updateTabbar(v) {
  const tabs = document.querySelectorAll('.tabbar .tab-item');
  if (!tabs.length) return;
  tabs.forEach(b => {
    const t = b.dataset.tab;
    b.classList.toggle('active', MOBILE_PRIMARY_VIEWS.indexOf(v) !== -1 ? t === v : t === 'more');
  });
}

function openMoreSheet() {
  const s = document.getElementById('moreSheet');
  if (s) s.classList.add('show');
  updateTabbar('more');
}

function closeMoreSheet() {
  const s = document.getElementById('moreSheet');
  if (s) s.classList.remove('show');
}

function moreGo(v) {
  closeMoreSheet();
  switchView(v);
}

function switchView(v) {
  if (!VIEW_META[v]) v = 'dashboard';
  if (isMobileLayout() && MOBILE_HIDDEN_VIEWS.indexOf(v) !== -1) v = 'dashboard';
  if (MANAGER_ONLY_VIEWS.indexOf(v) !== -1 && !isManager()) {
    toast('Mục này chỉ dành cho Quản lý. Vui lòng đăng nhập!');
    v = homeView();
  }
  currentView = v;
  closeMoreSheet();

  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.view === v);
  });
  document.querySelectorAll('.content > section').forEach(s => { s.style.display = 'none'; });

  const activeSection = document.getElementById('view-' + v);
  if (activeSection) activeSection.style.display = 'block';

  const titleEl = document.getElementById('pageTitle');
  const crumbEl = document.getElementById('pageCrumb');
  if (titleEl) titleEl.textContent = VIEW_META[v][0];
  if (crumbEl) crumbEl.textContent = VIEW_META[v][1];

  const contentEl = document.getElementById('content');
  if (contentEl) contentEl.scrollTop = 0;

  updateTabbar(v);
  refreshCurrentView();
}

function refreshCurrentView() {
  const v = currentView;
  if (v === 'dashboard') renderDashboard();
  else if (v === 'banhang') renderPos();
  else if (v === 'hoadon') renderInvoices();
  else if (v === 'danhmuc') renderCategories();
  else if (v === 'sanpham') renderInventory();
  else if (v === 'khachhang') renderCustomers();
  else if (v === 'baocao') renderReport();
  else if (v === 'caidat') renderStoreSettings();
  else if (v === 'saoluu') renderBackupPage();
  else if (v === 'doanhthu') renderDoanhThu();
  else if (v === 'congno') renderCongNo();
}

function refreshAllViews() {
  updateLowStockBadge();
  refreshCurrentView();
}

function updateLowStockBadge() {
  const products = (DB && Array.isArray(DB.products)) ? DB.products : [];
  const threshold = lowStockThreshold();
  const lowCount = products.filter(p => (p.stock || 0) <= threshold).length;
  const badge = document.getElementById('lowStockBadge');
  if (badge) {
    badge.textContent = lowCount;
    badge.style.display = lowCount > 0 ? '' : 'none';
  }
}

function globalSearchHandler(q) {
  q = (q || '').trim();
  if (!q) return;
  if (!isManager()) { toast('Tìm kiếm toàn hệ thống chỉ dành cho Quản lý!'); return; }
  switchView('sanpham');
  const searchInput = document.getElementById('khoSearch');
  if (searchInput) {
    searchInput.value = q;
    pageState.kho = 1;
    renderInventory();
  }
}

/* ================= DASHBOARD & CHARTS ================= */
let chartCategory = null;
let chartDebt = null;
let debtChartMode = 'top';

function setDebtChartMode(mode) {
  debtChartMode = mode;
  const btnTop = document.getElementById('btnDebtTop');
  const btnType = document.getElementById('btnDebtType');
  if (btnTop) {
    btnTop.classList.toggle('active', mode === 'top');
    btnTop.classList.toggle('ghost', mode !== 'top');
  }
  if (btnType) {
    btnType.classList.toggle('active', mode === 'type');
    btnType.classList.toggle('ghost', mode !== 'type');
  }
  renderDashboardDebtChart();
}

/* Khoảng ngày dùng chung cho Dashboard & trang Doanh thu */
function dateRangeForPreset(preset) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  let start = null, end = null, label = '';
  const pad = n => String(n).padStart(2, '0');

  if (preset === 'today') {
    start = new Date(y, m, d, 0, 0, 0, 0);
    end = new Date(y, m, d, 23, 59, 59, 999);
    label = `Hôm nay (${pad(d)}/${pad(m + 1)}/${y})`;
  } else if (preset === 'yesterday') {
    const t = new Date(y, m, d - 1);
    start = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
    end = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999);
    label = `Hôm qua (${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()})`;
  } else if (preset === 'last7') {
    start = new Date(y, m, d - 6, 0, 0, 0, 0);
    end = new Date(y, m, d, 23, 59, 59, 999);
    label = `7 ngày qua (${pad(start.getDate())}/${pad(start.getMonth() + 1)} – ${pad(d)}/${pad(m + 1)}/${y})`;
  } else if (preset === 'this_month') {
    start = new Date(y, m, 1, 0, 0, 0, 0);
    end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    label = `Tháng ${m + 1}/${y}`;
  } else if (preset === 'last_month') {
    start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    end = new Date(y, m, 0, 23, 59, 59, 999);
    const pm = m === 0 ? 12 : m;
    const py = m === 0 ? y - 1 : y;
    label = `Tháng ${pm}/${py}`;
  } else if (preset === 'this_year') {
    start = new Date(y, 0, 1, 0, 0, 0, 0);
    end = new Date(y, 11, 31, 23, 59, 59, 999);
    label = `Năm ${y}`;
  } else {
    label = 'Toàn bộ thời gian';
  }

  return { start, end, label, preset };
}

function getDashDateRange() {
  const preset = (document.getElementById('dashTimePreset') || {}).value || 'this_month';
  if (preset !== 'custom') return dateRangeForPreset(preset);

  let start = null, end = null, label = '';
  const fromInput = (document.getElementById('dashFromDate') || {}).value;
  const toInput = (document.getElementById('dashToDate') || {}).value;
  if (fromInput) {
    const p = fromInput.split('-');
    start = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 0, 0, 0, 0);
  }
  if (toInput) {
    const p = toInput.split('-');
    end = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 23, 59, 59, 999);
  }
  if (fromInput && toInput) {
    label = `${isoToDisplay(fromInput)} – ${isoToDisplay(toInput)}`;
  } else if (fromInput) {
    label = `Từ ${isoToDisplay(fromInput)}`;
  } else if (toInput) {
    label = `Đến ${isoToDisplay(toInput)}`;
  } else {
    label = 'Khoảng ngày tùy chọn';
  }

  return { start, end, label, preset };
}

function onDashTimePresetChange() {
  const preset = (document.getElementById('dashTimePreset') || {}).value;
  const customBox = document.getElementById('dashCustomDateRange');
  if (customBox) customBox.style.display = preset === 'custom' ? 'flex' : 'none';

  if (preset === 'custom') {
    const fromEl = document.getElementById('dashFromDate');
    const toEl = document.getElementById('dashToDate');
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    if (fromEl && !fromEl.value) {
      fromEl.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    }
    if (toEl && !toEl.value) {
      toEl.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }
  }
  renderDashboard();
}

function renderDashboard() {
  const dateRange = getDashDateRange();
  const invoices = (DB && Array.isArray(DB.invoices)) ? DB.invoices : [];
  const products = (DB && Array.isArray(DB.products)) ? DB.products : [];
  const customers = (DB && Array.isArray(DB.customers)) ? DB.customers : [];
  const act = invoices.filter(i => i.status !== 'cancel' && isInvoiceInDateRange(i, dateRange.start, dateRange.end));

  const revenue = act.reduce((s, i) => s + invNet(i), 0);
  const profit = act.reduce((s, i) => s + invProfitNet(i), 0);
  const collected = act.reduce((s, i) => s + invTotalPaid(i), 0);
  const stockVal = products.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0);

  const threshold = lowStockThreshold();
  const lowCount = products.filter(p => (p.stock || 0) <= threshold).length;

  const indebtedCusts = customers.filter(c => (c.debt || 0) > 0);
  const totalCustDebt = indebtedCusts.reduce((s, c) => s + (c.debt || 0), 0);
  const totalAgentDebt = indebtedCusts.filter(c => c.type === 'agent').reduce((s, c) => s + (c.debt || 0), 0);
  const totalRetailDebt = indebtedCusts.filter(c => c.type !== 'agent').reduce((s, c) => s + (c.debt || 0), 0);

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  set('kpiRevenue', fmt(revenue));
  set('kpiProfit', fmt(profit));
  set('kpiOrders', act.length);
  set('kpiStock', fmt(stockVal));
  set('kpiStockDelta', lowCount + ' sản phẩm sắp hết');
  set('kpiDebt', fmt(totalCustDebt));

  const kpiDebtSubEl = document.getElementById('kpiDebtSub');
  if (kpiDebtSubEl) {
    if (totalCustDebt > 0) {
      kpiDebtSubEl.className = 'delta down';
      kpiDebtSubEl.textContent = `${indebtedCusts.length} khách đang nợ (ĐL: ${fmt(totalAgentDebt)} · Lẻ: ${fmt(totalRetailDebt)})`;
    } else {
      kpiDebtSubEl.className = 'delta up';
      kpiDebtSubEl.textContent = '✓ Không có khách nợ';
    }
  }

  set('dashTimeText', `${dateRange.label} · ${act.length} đơn`);
  set('kpiRevenueSub', `▲ Đã thu: ${fmt(collected)}`);
  set('kpiProfitSub', revenue > 0 ? `▲ Tỷ suất ${(profit / revenue * 100).toFixed(1)}%` : '▲ Chưa có doanh thu');
  set('kpiOrdersSub', `trong ${dateRange.label}`);

  updateLowStockBadge();

  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#a0aec0' : '#8a92a3';

  const catData = {};
  act.forEach(i => i.items.forEach(row => {
    const p = findP(row[0]);
    if (p) {
      const n = catName(p.cat);
      catData[n] = (catData[n] || 0) + Math.max(0, p.price * row[1] - itemDiscAmount(row));
    }
  }));

  set('chartCatSub', `Đang lọc: ${dateRange.label}`);

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
            : [isDark ? '#363b47' : '#e2e8f0'],
          borderWidth: 2,
          borderColor: isDark ? '#1a1d25' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 10, padding: 10 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
        }
      }
    });
  }

  renderDashboardDebtChart();

  set('topProdSub', `Đang lọc: ${dateRange.label}`);
  const sales = {};
  act.forEach(i => i.items.forEach(row => { sales[row[0]] = (sales[row[0]] || 0) + row[1]; }));
  const top = Object.entries(sales).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const topEl = document.getElementById('topProducts');
  if (topEl) {
    topEl.innerHTML = top.length
      ? '<table><thead><tr><th>#</th><th>Sản phẩm</th><th style="text-align:center">Đã bán</th><th style="text-align:right">Doanh thu</th></tr></thead><tbody>'
        + top.map((row, idx) => {
          const p = findP(row[0]);
          if (!p) return '';
          return `<tr><td class="muted">${idx + 1}</td><td><b>${escapeHtml(p.name)}</b></td><td style="text-align:center">${fmtQty(row[1])} ${escapeHtml(catUnit(p.cat))}</td><td class="money" style="text-align:right">${fmt(p.price * row[1])}</td></tr>`;
        }).join('') + '</tbody></table>'
      : '<div class="empty">Chưa có dữ liệu bán hàng trong khoảng thời gian này</div>';
  }

  const debtListSub = document.getElementById('debtListSub');
  if (debtListSub) {
    debtListSub.textContent = totalCustDebt > 0
      ? `Tổng nợ: ${fmt(totalCustDebt)} (${indebtedCusts.length} khách)`
      : 'Không có khách nào đang nợ';
  }

  const debtListEl = document.getElementById('dashDebtList');
  if (debtListEl) {
    const topDebtors = [...indebtedCusts].sort((a, b) => (b.debt || 0) - (a.debt || 0)).slice(0, 5);
    debtListEl.innerHTML = topDebtors.length
      ? '<table><thead><tr><th>#</th><th>Khách hàng</th><th style="text-align:center">Loại</th><th>SĐT</th><th style="text-align:right">Dư nợ</th><th style="text-align:center">Thao tác</th></tr></thead><tbody>'
        + topDebtors.map((c, idx) => {
          const t = customerType(c);
          return `<tr>
            <td class="muted">${idx + 1}</td>
            <td><b>${escapeHtml(c.name)}</b></td>
            <td style="text-align:center"><span class="pill ${t.cls}">${t.label}</span></td>
            <td class="muted">${escapeHtml(c.phone || '—')}</td>
            <td class="money" style="text-align:right;color:var(--red);font-weight:700">${fmt(c.debt || 0)}</td>
            <td style="text-align:center"><button class="btn green sm" onclick="openSettleDebtModal('${c.id}')">Thu nợ</button></td>
          </tr>`;
        }).join('') + '</tbody></table>'
      : '<div class="empty">Hiện không có khách hàng nào còn nợ tiền</div>';
  }

  const low = products.filter(p => (p.stock || 0) <= threshold).sort((a, b) => (a.stock || 0) - (b.stock || 0));
  const lowEl = document.getElementById('lowStockList');
  if (lowEl) {
    lowEl.innerHTML = low.length
      ? '<table><thead><tr><th>Mã SP</th><th>Tên sản phẩm</th><th>Danh mục</th><th style="text-align:center">Tồn kho</th><th style="text-align:center">Trạng thái</th><th style="text-align:center">Thao tác</th></tr></thead><tbody>'
        + low.map(p => {
          const st = stockStatus(p.stock, p.minStock);
          return `<tr>
            <td class="muted">${p.id}</td>
            <td><b>${escapeHtml(p.name)}</b></td>
            <td><span class="cat-tag">${escapeHtml(catName(p.cat))}</span></td>
            <td style="text-align:center"><b>${fmtQty(p.stock)}</b> ${escapeHtml(catUnit(p.cat))}</td>
            <td style="text-align:center"><span class="pill ${st.cls}">${st.label}</span></td>
            <td style="text-align:center">${isManager() ? `<button class="btn sm" onclick="openStockAudit('${p.id}')">Kiểm kho</button>` : '<span class="muted">—</span>'}</td>
          </tr>`;
        }).join('') + '</tbody></table>'
      : '<div class="empty">Không có sản phẩm nào sắp hết</div>';
  }
}

function renderDashboardDebtChart() {
  const customers = (DB && Array.isArray(DB.customers)) ? DB.customers : [];
  const indebtedCusts = customers.filter(c => (c.debt || 0) > 0);
  const totalCustDebt = indebtedCusts.reduce((s, c) => s + (c.debt || 0), 0);
  const totalAgentDebt = indebtedCusts.filter(c => c.type === 'agent').reduce((s, c) => s + (c.debt || 0), 0);
  const totalRetailDebt = indebtedCusts.filter(c => c.type !== 'agent').reduce((s, c) => s + (c.debt || 0), 0);

  const debtSubEl = document.getElementById('chartDebtSub');
  if (debtSubEl) {
    if (debtChartMode === 'top') {
      debtSubEl.textContent = totalCustDebt > 0
        ? `Tổng dư nợ: ${fmt(totalCustDebt)} (${indebtedCusts.length} khách)`
        : 'Hiện không có dư nợ khách hàng';
    } else {
      debtSubEl.textContent = `Đại lý: ${fmt(totalAgentDebt)} · Khách lẻ: ${fmt(totalRetailDebt)}`;
    }
  }

  const canvasDebt = document.getElementById('chartDebt');
  const emptyDebtEl = document.getElementById('chartDebtEmpty');
  if (!canvasDebt || typeof Chart === 'undefined') return;

  if (chartDebt) { chartDebt.destroy(); chartDebt = null; }

  if (totalCustDebt === 0) {
    if (emptyDebtEl) emptyDebtEl.style.display = 'flex';
    canvasDebt.style.display = 'none';
    return;
  }

  if (emptyDebtEl) emptyDebtEl.style.display = 'none';
  canvasDebt.style.display = 'block';

  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#a0aec0' : '#8a92a3';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  if (debtChartMode === 'top') {
    const topDebtors = [...indebtedCusts].sort((a, b) => (b.debt || 0) - (a.debt || 0)).slice(0, 6);

    chartDebt = new Chart(canvasDebt, {
      type: 'bar',
      data: {
        labels: topDebtors.map(c => c.name),
        datasets: [{
          label: 'Dư nợ',
          data: topDebtors.map(c => c.debt || 0),
          backgroundColor: topDebtors.map(c => c.type === 'agent' ? '#8b5cf6' : '#e5484d'),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 26
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const c = topDebtors[ctx.dataIndex];
                return ` Dư nợ: ${fmt(ctx.raw)} (${c && c.type === 'agent' ? 'Đại lý' : 'Khách lẻ'})`;
              },
              afterLabel: ctx => {
                const c = topDebtors[ctx.dataIndex];
                return c && c.phone ? ` 📞 ${c.phone} · Bấm cột để thu nợ` : ' Bấm cột để thu nợ';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: v => (v >= 1000000 ? (v / 1000000).toFixed(1) + ' tr' : v >= 1000 ? v / 1000 + ' k' : v)
            }
          },
          y: { grid: { display: false }, ticks: { color: textColor, font: { weight: '600' } } }
        },
        onClick: (e, elements) => {
          if (elements && elements.length > 0) {
            const c = topDebtors[elements[0].index];
            if (c) openSettleDebtModal(c.id);
          }
        }
      }
    });
  } else {
    const typeLabels = [], typeVals = [], typeColors = [];
    if (totalAgentDebt > 0) { typeLabels.push('Đại lý'); typeVals.push(totalAgentDebt); typeColors.push('#8b5cf6'); }
    if (totalRetailDebt > 0) { typeLabels.push('Khách lẻ'); typeVals.push(totalRetailDebt); typeColors.push('#e5484d'); }

    chartDebt = new Chart(canvasDebt, {
      type: 'doughnut',
      data: {
        labels: typeLabels,
        datasets: [{
          data: typeVals,
          backgroundColor: typeColors,
          borderWidth: 2,
          borderColor: isDark ? '#1a1d25' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 10, padding: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = totalCustDebt > 0 ? (ctx.raw / totalCustDebt * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}

/* ================= TRANG DOANH THU (DI ĐỘNG) ================= */
let revPreset = 'this_month';
let revTrendMode = 'day';
let revTopMode = 'product';
let chartRevTrend = null;

function setRevPreset(p) {
  revPreset = p;
  const bar = document.getElementById('revPresetBar');
  if (bar) bar.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === p));
  renderDoanhThu();
}

function setRevTrendMode(m) {
  revTrendMode = m;
  const bar = document.getElementById('revTrendBar');
  if (bar) bar.querySelectorAll('.seg-mini-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  renderDoanhThu();
}

function setRevTopMode(m) {
  revTopMode = m;
  const bar = document.getElementById('revTopBar');
  if (bar) bar.querySelectorAll('.seg-mini-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  renderDoanhThu();
}

function revRange() {
  const r = dateRangeForPreset(revPreset);
  if (r.start && r.end) return r;
  const invoices = (DB && Array.isArray(DB.invoices)) ? DB.invoices : [];
  const dates = invoices.map(i => parseInvoiceDate(i.date)).filter(Boolean).sort((a, b) => a - b);
  if (dates.length) {
    const first = dates[0], last = dates[dates.length - 1];
    r.start = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0, 0);
    r.end = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59, 999);
  }
  return r;
}

function renderDoanhThu() {
  const range = revRange();
  const invoices = (DB && Array.isArray(DB.invoices)) ? DB.invoices : [];
  const act = invoices.filter(i => i.status !== 'cancel' && isInvoiceInDateRange(i, range.start, range.end));

  const revenue = act.reduce((s, i) => s + invNet(i), 0);
  const profit = act.reduce((s, i) => s + invProfitNet(i), 0);
  const collected = act.reduce((s, i) => s + invTotalPaid(i), 0);
  const outstanding = act.reduce((s, i) => s + (i.debtAmount || 0), 0);

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  set('revKpiRevenue', fmt(revenue));
  set('revKpiProfit', fmt(profit));
  set('revKpiOrders', act.length);
  set('revKpiCollected', fmt(collected));
  set('revKpiRevenueSub', `${range.label} · ${act.length} đơn`);
  set('revKpiProfitSub', revenue > 0 ? `Tỷ suất ${(profit / revenue * 100).toFixed(1)}%` : 'Chưa có doanh thu');
  set('revKpiOrdersSub', act.length ? `TB ${fmt(Math.round(revenue / act.length))}/đơn` : 'Chưa có đơn nào');
  set('revKpiCollectedSub', outstanding > 0 ? `Còn nợ ${fmt(outstanding)}` : '✓ Đã thu đủ');

  renderRevTrendChart(range, act);
  renderRevTop(range, act);
  renderRevInvoiceList(range, act);
}

function renderRevTrendChart(range, act) {
  const canvas = document.getElementById('chartRevTrend');
  const subEl = document.getElementById('revTrendSub');
  if (subEl) subEl.textContent = `${range.label} · Doanh thu & lợi nhuận`;
  if (!canvas || typeof Chart === 'undefined') return;

  const useMonth = revTrendMode === 'month' || revPreset === 'this_year' || !range.start || !range.end;
  const keyOf = dt => useMonth
    ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  const buckets = {};
  act.forEach(i => {
    const dt = parseInvoiceDate(i.date);
    if (!dt) return;
    const k = keyOf(dt);
    if (!buckets[k]) buckets[k] = { rev: 0, prof: 0 };
    buckets[k].rev += invNet(i);
    buckets[k].prof += invProfitNet(i);
  });

  const axis = [];
  if (range.start && range.end) {
    if (useMonth) {
      const cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
      const last = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
      let guard = 0;
      while (cur <= last && guard++ < 60) { axis.push(keyOf(cur)); cur.setMonth(cur.getMonth() + 1); }
    } else {
      const cur = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
      const last = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
      let guard = 0;
      while (cur <= last && guard++ < 200) { axis.push(keyOf(cur)); cur.setDate(cur.getDate() + 1); }
    }
  }
  if (!axis.length) Object.keys(buckets).sort().forEach(k => axis.push(k));

  const labels = axis.map(k => {
    const p = k.split('-');
    return useMonth ? `${p[1]}/${p[0]}` : `${p[2]}/${p[1]}`;
  });
  const revData = axis.map(k => (buckets[k] ? buckets[k].rev : 0));
  const profData = axis.map(k => (buckets[k] ? buckets[k].prof : 0));

  if (chartRevTrend) { chartRevTrend.destroy(); chartRevTrend = null; }

  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#a0aec0' : '#8a92a3';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  chartRevTrend = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          type: 'bar', label: 'Doanh thu', data: revData, backgroundColor: '#2f6bff',
          borderRadius: 5, maxBarThickness: 26, order: 2
        },
        {
          type: 'line', label: 'Lợi nhuận', data: profData, borderColor: '#12a878',
          backgroundColor: '#12a878', borderWidth: 2, tension: .3, pointRadius: 2.5, order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, boxWidth: 10, padding: 10, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: v => (v >= 1000000 ? (v / 1000000).toFixed(1) + ' tr' : v >= 1000 ? Math.round(v / 1000) + ' k' : v)
          }
        }
      }
    }
  });
}

function renderRevTop(range, act) {
  const subEl = document.getElementById('revTopSub');
  const el = document.getElementById('revTopList');
  if (!el) return;

  const byProduct = {};
  const byCat = {};
  act.forEach(i => i.items.forEach(row => {
    const p = findP(row[0]);
    if (!p) return;
    const disc = itemDiscAmount(row);
    const lineRev = Math.max(0, p.price * row[1] - disc);
    const lineProf = (p.price - p.cost) * row[1] - disc;

    if (!byProduct[p.id]) byProduct[p.id] = { qty: 0, rev: 0, prof: 0 };
    byProduct[p.id].qty += row[1];
    byProduct[p.id].rev += lineRev;
    byProduct[p.id].prof += lineProf;

    const cn = catName(p.cat);
    if (!byCat[cn]) byCat[cn] = { rev: 0, prof: 0 };
    byCat[cn].rev += lineRev;
    byCat[cn].prof += lineProf;
  }));

  const totalRev = Object.values(byProduct).reduce((s, v) => s + v.rev, 0);

  if (revTopMode === 'category') {
    const list = Object.entries(byCat).sort((a, b) => b[1].rev - a[1].rev);
    if (subEl) subEl.textContent = list.length ? `${list.length} danh mục · ${range.label}` : range.label;
    el.innerHTML = list.length
      ? '<table><thead><tr><th>#</th><th>Danh mục</th><th style="text-align:right">Doanh thu</th><th style="text-align:center">Tỷ trọng</th><th style="text-align:right">Lợi nhuận</th></tr></thead><tbody>'
        + list.map((row, idx) => {
          const pct = totalRev > 0 ? (row[1].rev / totalRev * 100).toFixed(1) : '0.0';
          return `<tr><td class="muted">${idx + 1}</td><td><b>${escapeHtml(row[0])}</b></td>
            <td class="money" style="text-align:right">${fmt(row[1].rev)}</td>
            <td style="text-align:center"><span class="pill blue">${pct}%</span></td>
            <td class="money" style="text-align:right;color:var(--teal)">${fmt(row[1].prof)}</td></tr>`;
        }).join('') + '</tbody></table>'
      : '<div class="empty">Chưa có dữ liệu bán hàng trong khoảng thời gian này</div>';
    return;
  }

  const list = Object.entries(byProduct).sort((a, b) => b[1].rev - a[1].rev).slice(0, 10);
  if (subEl) subEl.textContent = list.length ? `Top ${list.length} sản phẩm · ${range.label}` : range.label;
  el.innerHTML = list.length
    ? '<table><thead><tr><th>#</th><th>Sản phẩm</th><th style="text-align:center">Đã bán</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">Lợi nhuận</th></tr></thead><tbody>'
      + list.map((row, idx) => {
        const p = findP(row[0]);
        if (!p) return '';
        return `<tr><td class="muted">${idx + 1}</td>
          <td><b>${escapeHtml(p.name)}</b><div class="muted" style="font-size:11px">${escapeHtml(catName(p.cat))}</div></td>
          <td style="text-align:center">${fmtQty(row[1].qty)} ${escapeHtml(catUnit(p.cat))}</td>
          <td class="money" style="text-align:right">${fmt(row[1].rev)}</td>
          <td class="money" style="text-align:right;color:var(--teal)">${fmt(row[1].prof)}</td></tr>`;
      }).join('') + '</tbody></table>'
    : '<div class="empty">Chưa có dữ liệu bán hàng trong khoảng thời gian này</div>';
}

function renderRevInvoiceList(range, act) {
  const el = document.getElementById('revInvoiceList');
  const subEl = document.getElementById('revInvSub');
  if (!el) return;

  const list = [...act].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
  if (subEl) subEl.textContent = `${list.length} hóa đơn · ${range.label}`;

  const shown = list.slice(0, 30);
  el.innerHTML = shown.length
    ? '<table><thead><tr><th>Mã HĐ</th><th>Khách hàng</th><th>Ngày</th><th style="text-align:right">Tổng tiền</th><th style="text-align:center">Trạng thái</th><th style="text-align:center">Thao tác</th></tr></thead><tbody>'
      + shown.map(i => {
        const st = i.status === 'paid'
          ? { cls: 'ok', label: 'Đã TT' }
          : { cls: 'low', label: (i.debtAmount > 0 ? `Nợ ${fmt(i.debtAmount)}` : 'Chưa TT') };
        return `<tr><td><b>${escapeHtml(i.id)}</b></td><td>${escapeHtml(i.customer)}</td>
          <td class="muted">${isoToDisplay(i.date)}</td>
          <td class="money" style="text-align:right">${fmt(invNet(i))}</td>
          <td style="text-align:center"><span class="pill ${st.cls}">${st.label}</span></td>
          <td style="text-align:center"><button class="btn ghost sm" onclick="viewInvoice('${i.id}')">Xem</button></td></tr>`;
      }).join('') + '</tbody></table>'
      + (list.length > shown.length
        ? `<div class="empty" style="padding:12px">… còn ${list.length - shown.length} hóa đơn khác. Vào mục "Hóa đơn bán" để xem đầy đủ.</div>`
        : '')
    : '<div class="empty">Chưa có hóa đơn nào trong khoảng thời gian này</div>';
}

/* ================= TRANG DƯ NỢ KHÁCH HÀNG (DI ĐỘNG) ================= */
function renderCongNo() {
  const customers = (DB && Array.isArray(DB.customers)) ? DB.customers : [];
  const indebted = customers.filter(c => (c.debt || 0) > 0);
  const totalDebt = indebted.reduce((s, c) => s + (c.debt || 0), 0);
  const agentList = indebted.filter(c => c.type === 'agent');
  const agentDebt = agentList.reduce((s, c) => s + (c.debt || 0), 0);
  const retailDebt = totalDebt - agentDebt;

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('debtKpiTotal', fmt(totalDebt));
  set('debtKpiAgent', fmt(agentDebt));
  set('debtKpiRetail', fmt(retailDebt));
  set('debtKpiCount', indebted.length);
  set('debtKpiTotalSub', indebted.length ? `${indebted.length} khách đang nợ` : '✓ Không có khách nợ');
  set('debtKpiAgentSub', `${agentList.length} đại lý`);
  set('debtKpiRetailSub', `${indebted.length - agentList.length} khách lẻ`);
  set('debtKpiCountSub', indebted.length ? `TB ${fmt(Math.round(totalDebt / indebted.length))}/khách` : '—');

  const q = ((document.getElementById('debtSearch') || {}).value || '').toLowerCase().trim();
  const qNorm = normalizePhoneDigits(q);
  const list = indebted.filter(c => {
    if (!q) return true;
    if ((c.name || '').toLowerCase().includes(q)) return true;
    if (removeVietnameseTones(c.name || '').includes(removeVietnameseTones(q))) return true;
    if (c.phone && (c.phone.toLowerCase().includes(q) || (qNorm && normalizePhoneDigits(c.phone).includes(qNorm)))) return true;
    return false;
  }).sort((a, b) => (b.debt || 0) - (a.debt || 0));

  const subEl = document.getElementById('debtMobileSub');
  if (subEl) {
    subEl.textContent = q
      ? `${list.length} khách khớp từ khóa`
      : (indebted.length ? 'Sắp xếp theo dư nợ cao nhất' : 'Không có dư nợ');
  }

  const el = document.getElementById('debtListEl');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = indebted.length
      ? '<div class="empty">Không tìm thấy khách nợ phù hợp với từ khóa</div>'
      : '<div class="empty" style="padding:30px 0"><div style="font-size:34px;margin-bottom:8px">🎉</div><b style="color:var(--txt)">Không có dư nợ</b><div style="margin-top:4px">Tất cả khách hàng đã thanh toán đầy đủ công nợ</div></div>';
    return;
  }

  el.innerHTML = '<div class="debt-list">' + list.map((c, idx) => {
    const t = customerType(c);
    const st = customerStats(c);
    const pct = totalDebt > 0 ? Math.max(4, Math.round((c.debt || 0) / totalDebt * 100)) : 4;
    return `<div class="debt-card">
      <div class="dc-top">
        <span class="dc-rank">${idx + 1}</span>
        <div class="dc-info">
          <b>${escapeHtml(c.name)}</b>
          <span class="dc-meta">${escapeHtml(c.id)} · ${escapeHtml(c.phone || 'Chưa có SĐT')} · ${st.count} đơn</span>
        </div>
        <span class="pill ${t.cls}">${t.label}</span>
      </div>
      <div class="dc-bar"><span style="width:${pct}%"></span></div>
      <div class="dc-bottom">
        <div><span class="dc-lbl">Dư nợ</span><b class="dc-debt">${fmt(c.debt || 0)}</b></div>
        <button type="button" class="btn green sm" onclick="openSettleDebtModal('${c.id}')">Thu nợ</button>
      </div>
    </div>`;
  }).join('') + '</div>';
}

/* ================= PHÂN TRANG ================= */
const PAGE_SIZE = 10;
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
  if (total <= PAGE_SIZE) { el.innerHTML = ''; return; }

  const from = (cur - 1) * PAGE_SIZE + 1;
  const to = Math.min(cur * PAGE_SIZE, total);

  let pageButtons = '';
  for (let p = 1; p <= max; p++) {
    if (p === 1 || p === max || (p >= cur - 1 && p <= cur + 1)) {
      pageButtons += `<button type="button" class="pg-btn ${p === cur ? 'active' : ''}" onclick="goPage('${key}',${p})">${p}</button>`;
    } else if (p === cur - 2 || p === cur + 2) {
      pageButtons += '<span style="font-size:12px;color:var(--dim);padding:0 2px">…</span>';
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
  refreshCurrentView();
}

/* ================= QUẢN LÝ DANH MỤC ================= */
let editingCatId = null;
let lastCatSearch = '';

function renderCategories() {
  const q = ((document.getElementById('catSearch') || {}).value || '').trim();
  const qRaw = q.toLowerCase();
  const qNoTone = removeVietnameseTones(qRaw);
  const qClean = qRaw.replace(/[^a-z0-9]/g, '');

  if (q !== lastCatSearch) { pageState.cat = 1; lastCatSearch = q; }

  const categories = (DB && Array.isArray(DB.categories)) ? DB.categories : [];
  const products = (DB && Array.isArray(DB.products)) ? DB.products : [];

  const list = categories.filter(c => !q || getCategorySearchRank(c, qRaw, qNoTone, qClean) < 999);
  if (q) {
    list.sort((a, b) => {
      const ra = getCategorySearchRank(a, qRaw, qNoTone, qClean);
      const rb = getCategorySearchRank(b, qRaw, qNoTone, qClean);
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name, 'vi');
    });
  }

  const pg = pageSlice(list, 'cat');
  const countEl = document.getElementById('catCount');
  if (countEl) countEl.textContent = `${list.length} danh mục`;

  const body = document.getElementById('catBody');
  if (body) {
    body.innerHTML = pg.items.length ? pg.items.map(c => {
      const ps = products.filter(p => p.cat === c.id);
      const stock = ps.reduce((s, p) => s + (p.stock || 0), 0);
      return `<tr>
        <td class="muted">${c.id}</td>
        <td><b>${escapeHtml(c.name)}</b>${c.desc ? `<div class="muted" style="font-size:11px">${escapeHtml(c.desc)}</div>` : ''}</td>
        <td><span class="pill purple">${(CAT_TYPES[c.type] || { label: 'Số lượng' }).label}</span></td>
        <td><span class="unit-tag">${escapeHtml(c.unit)}</span></td>
        <td style="text-align:center">${ps.length}</td>
        <td style="text-align:right"><b>${fmtQty(stock)}</b> ${escapeHtml(c.unit)}</td>
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
    if (!c) return;
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
  const t = (document.getElementById('catType') || {}).value || 'quantity';
  const units = (CAT_TYPES[t] || { units: [] }).units;
  const listEl = document.getElementById('unitList');
  if (listEl) listEl.innerHTML = units.map(u => `<option value="${u}">`).join('');
}

function saveCategory() {
  const nameInput = document.getElementById('catName');
  const typeInput = document.getElementById('catType');
  const unitInput = document.getElementById('catUnit');
  const descInput = document.getElementById('catDesc');

  const name = (nameInput.value || '').trim();
  const type = typeInput.value;
  const unit = (unitInput.value || '').trim();
  const desc = (descInput.value || '').trim();

  if (!name) { markInvalid(nameInput, 'Vui lòng nhập tên danh mục!'); return; }
  if (name.length < 2) { markInvalid(nameInput, 'Tên danh mục phải có ít nhất 2 ký tự!'); return; }

  const dup = DB.categories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingCatId);
  if (dup) { markInvalid(nameInput, `Tên danh mục "${name}" đã tồn tại!`); return; }

  if (!unit) { markInvalid(unitInput, 'Vui lòng nhập đơn vị bán!'); return; }

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
  updateFilterDropdowns();
}

function deleteCategory(id) {
  const used = DB.products.filter(p => p.cat === id).length;
  if (used > 0) {
    toast(`Không thể xóa: có ${used} sản phẩm đang thuộc danh mục này!`);
    return;
  }
  const c = findCat(id);
  if (!c) return;
  if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${c.name}"?`)) return;

  DB.categories = DB.categories.filter(x => x.id !== id);
  saveDB();
  renderCategories();
  updateFilterDropdowns();
  toast('Đã xóa danh mục thành công');
}

/* ================= QUẢN LÝ SẢN PHẨM ================= */
let editingProdId = null;
let lastKhoSearch = '';

function updateFilterDropdowns() {
  const categories = (DB && Array.isArray(DB.categories)) ? DB.categories : [];
  const products = (DB && Array.isArray(DB.products)) ? DB.products : [];

  const catSel = document.getElementById('filterCat');
  if (catSel) {
    const cc = catSel.value;
    catSel.innerHTML = '<option value="">Tất cả danh mục</option>' + categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    catSel.value = cc;
  }

  const bSel = document.getElementById('filterBrand');
  if (bSel) {
    const bb = bSel.value;
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    bSel.innerHTML = '<option value="">Tất cả thương hiệu</option>' + brands.map(b => `<option value="${b}">${escapeHtml(b)}</option>`).join('');
    bSel.value = bb;
  }
}

function renderInventory() {
  updateFilterDropdowns();

  const products = (DB && Array.isArray(DB.products)) ? DB.products : [];
  const q = ((document.getElementById('khoSearch') || {}).value || '').trim();
  const qRaw = q.toLowerCase();
  const qNoTone = removeVietnameseTones(qRaw);
  const qClean = qRaw.replace(/[^a-z0-9]/g, '');
  const cat = (document.getElementById('filterCat') || {}).value || '';
  const brand = (document.getElementById('filterBrand') || {}).value || '';
  const status = (document.getElementById('filterStatus') || {}).value || '';
  const sort = (document.getElementById('sortBy') || {}).value || 'name';

  if (q !== lastKhoSearch) { pageState.kho = 1; lastKhoSearch = q; }

  const list = products.filter(p => {
    if (cat && p.cat !== cat) return false;
    if (brand && p.brand !== brand) return false;
    if (status && stockStatus(p.stock, p.minStock).cls !== status) return false;
    if (!q) return true;
    return getProductSearchRank(p, qRaw, qNoTone, qClean) < 999;
  });

  if (q && sort === 'name') {
    list.sort((a, b) => {
      const ra = getProductSearchRank(a, qRaw, qNoTone, qClean);
      const rb = getProductSearchRank(b, qRaw, qNoTone, qClean);
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name, 'vi');
    });
  } else if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (sort === 'stock-asc') list.sort((a, b) => (a.stock || 0) - (b.stock || 0));
  else if (sort === 'stock-desc') list.sort((a, b) => (b.stock || 0) - (a.stock || 0));
  else list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const pg = pageSlice(list, 'kho');
  const countEl = document.getElementById('khoCount');
  if (countEl) countEl.textContent = `${list.length} sản phẩm`;

  const body = document.getElementById('khoBody');
  if (body) {
    body.innerHTML = pg.items.length ? pg.items.map(p => {
      const st = stockStatus(p.stock, p.minStock);
      return `<tr>
        <td class="muted">${p.id}</td>
        <td><b>${escapeHtml(p.name)}</b>${p.spec ? `<div class="muted" style="font-size:11px">${escapeHtml(p.spec)}</div>` : ''}</td>
        <td><span class="cat-tag">${escapeHtml(catName(p.cat))}</span></td>
        <td class="muted">${escapeHtml(p.brand || 'Khác')}</td>
        <td class="muted" style="text-align:right">${fmt(p.cost)}</td>
        <td class="money" style="text-align:right">${fmt(p.price)}</td>
        <td style="text-align:center"><span class="unit-tag">${escapeHtml(catUnit(p.cat))}</span></td>
        <td style="text-align:center"><b>${fmtQty(p.stock)}</b></td>
        <td style="text-align:center"><span class="pill ${st.cls}">${st.label}</span></td>
        <td style="white-space:nowrap;text-align:center">
          <button class="btn ghost sm" onclick="openStockAudit('${p.id}')" title="Điều chỉnh tồn kho theo số đếm thực tế">Kiểm kho</button>
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
  if (!DB.categories.length) {
    toast('Vui lòng tạo ít nhất 1 danh mục trước khi thêm sản phẩm!');
    return;
  }
  sel.innerHTML = DB.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.unit)})</option>`).join('');

  const nameInput = document.getElementById('prodName');
  const brandInput = document.getElementById('prodBrand');
  const costInput = document.getElementById('prodCost');
  const priceInput = document.getElementById('prodPrice');
  const stockInput = document.getElementById('prodStock');
  const specInput = document.getElementById('prodSpec');
  const minStockInput = document.getElementById('prodMinStock');
  const stockWrap = document.getElementById('prodStockWrap');
  const stockHint = document.getElementById('prodStockHint');

  if (id) {
    const p = findP(id);
    if (!p) return;
    document.getElementById('prodModalTitle').textContent = 'Sửa sản phẩm ' + id;
    nameInput.value = p.name;
    sel.value = p.cat;
    brandInput.value = p.brand || '';
    costInput.value = p.cost;
    priceInput.value = p.price;
    stockInput.value = p.stock;
    specInput.value = p.spec || '';
    if (minStockInput) minStockInput.value = p.minStock;

    if (stockWrap) stockWrap.style.display = 'none';
    if (stockHint) {
      stockHint.style.display = 'block';
      stockHint.innerHTML = `Tồn kho hiện tại: <b>${fmtQty(p.stock)} ${escapeHtml(catUnit(p.cat))}</b>.
        Muốn thay đổi tồn kho, hãy dùng nút <b>Kiểm kho</b> ở danh sách sản phẩm để nhập số lượng đếm thực tế.`;
    }
  } else {
    document.getElementById('prodModalTitle').textContent = 'Thêm sản phẩm mới';
    nameInput.value = '';
    brandInput.value = '';
    costInput.value = 0;
    priceInput.value = 0;
    stockInput.value = 0;
    specInput.value = '';
    if (minStockInput) minStockInput.value = lowStockThreshold();
    if (stockWrap) stockWrap.style.display = '';
    if (stockHint) stockHint.style.display = 'none';
  }

  onProdCatChange();
  openModal('productModal');
}

function onProdCatChange() {
  const cat = (document.getElementById('prodCat') || {}).value;
  const unitInput = document.getElementById('prodUnit');
  const stockInput = document.getElementById('prodStock');
  if (unitInput) unitInput.value = catUnit(cat) || '—';
  if (stockInput) stockInput.step = isDecimalUnit(cat) ? '0.01' : '1';
}

function saveProduct() {
  const nameInput = document.getElementById('prodName');
  const catInput = document.getElementById('prodCat');
  const brandInput = document.getElementById('prodBrand');
  const costInput = document.getElementById('prodCost');
  const priceInput = document.getElementById('prodPrice');
  const stockInput = document.getElementById('prodStock');
  const specInput = document.getElementById('prodSpec');
  const minStockInput = document.getElementById('prodMinStock');

  const name = (nameInput.value || '').trim();
  const cat = catInput.value;

  if (!name) { markInvalid(nameInput, 'Vui lòng nhập tên sản phẩm!'); return; }
  if (name.length < 2) { markInvalid(nameInput, 'Tên sản phẩm phải có ít nhất 2 ký tự!'); return; }
  if (!cat) { markInvalid(catInput, 'Vui lòng chọn danh mục sản phẩm!'); return; }

  const cost = num(costInput.value, NaN);
  if (isNaN(cost) || cost < 0) { markInvalid(costInput, 'Giá nhập phải là số không âm!'); return; }

  const price = num(priceInput.value, NaN);
  if (isNaN(price) || price < 0) { markInvalid(priceInput, 'Giá bán phải là số không âm!'); return; }

  if (price > 0 && price < cost) {
    if (!confirm(`Cảnh báo: Giá bán (${fmt(price)}) đang NHỎ HƠN giá nhập (${fmt(cost)}).\nBạn có chắc chắn muốn lưu mức giá này?`)) {
      priceInput.focus();
      return;
    }
  }

  const brand = (brandInput.value || '').trim() || 'Khác';
  const spec = (specInput.value || '').trim();
  const minStock = Math.max(0, num(minStockInput ? minStockInput.value : lowStockThreshold(), lowStockThreshold()));

  if (editingProdId) {
    // SỬA sản phẩm: KHÔNG ghi đè tồn kho (tồn kho chỉ đổi qua phiếu nhập/kiểm kho)
    const p = findP(editingProdId);
    if (!p) return;
    Object.assign(p, { name, cat, brand, cost, price, spec, minStock });
    toast('Đã cập nhật sản phẩm. Tồn kho giữ nguyên (' + fmtQty(p.stock) + ' ' + catUnit(p.cat) + ').');
  } else {
    // THÊM MỚI: tồn kho ban đầu được ghi thành phiếu nhập kho đầu kỳ
    const step = catStep(cat);
    const stockVal = parseFloat(String(stockInput.value).replace(',', '.'));
    if (isNaN(stockVal) || stockVal < 0) { markInvalid(stockInput, 'Số lượng tồn kho không được âm!'); return; }
    if (!isDecimalUnit(cat) && !Number.isInteger(stockVal)) {
      markInvalid(stockInput, `Sản phẩm thuộc đơn vị "${catUnit(cat)}" nên số lượng tồn phải là số nguyên!`);
      return;
    }
    const stock = roundQty(stockVal, step);

    const id = 'SP-' + String(DB.nextProductId++).padStart(3, '0');
    DB.products.push({ id, name, cat, brand, cost, price, stock: 0, spec, minStock });

    if (stock > 0) {
      recordStockMove(id, stock, 'import', {
        reason: 'Nhập kho đầu kỳ khi tạo sản phẩm',
        refName: 'Tồn kho ban đầu',
        unitCost: cost,
      });
    }
    toast('Đã thêm sản phẩm ' + name + (stock > 0 ? ` với ${fmtQty(stock)} ${catUnit(cat)} tồn đầu kỳ` : ''));
  }

  saveDB(true);
  closeModal('productModal');
  updateFilterDropdowns();
  renderInventory();
  updateLowStockBadge();
}

function deleteProduct(id) {
  const p = findP(id);
  if (!p) return;

  const usedIn = (DB.invoices || []).filter(i => i.items.some(row => row[0] === id));
  if (usedIn.length > 0) {
    const sample = usedIn.slice(0, 3).map(i => i.id).join(', ');
    toast(`Không thể xóa: sản phẩm đã xuất hiện trong ${usedIn.length} hóa đơn (${sample}${usedIn.length > 3 ? '...' : ''}).`);
    alert(`Không thể xóa sản phẩm "${p.name}".\n\nSản phẩm này đã xuất hiện trong ${usedIn.length} hóa đơn nên nếu xóa sẽ làm sai lệch lợi nhuận của các hóa đơn cũ.\n\nGợi ý: giữ lại sản phẩm và để tồn kho = 0, hoặc dùng chức năng Kiểm kho để điều chỉnh.`);
    return;
  }

  if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${p.name}" (${p.id})?\n\nSản phẩm chưa từng được bán nên có thể xóa an toàn.`)) return;

  DB.products = DB.products.filter(x => x.id !== id);
  DB.stockMoves = (DB.stockMoves || []).filter(m => m.productId !== id);

  saveDB(true);
  updateFilterDropdowns();
  renderInventory();
  updateLowStockBadge();
  toast('Đã xóa sản phẩm thành công');
}

/* ================= SỔ KHO (LỊCH SỬ NHẬP XUẤT) ================= */




/* ================= PHIẾU NHẬP KHO ================= */















/* ================= KIỂM KHO (ĐIỀU CHỈNH TỒN) ================= */
let auditProductId = null;


function openStockAudit(productId) {
  const p = findP(productId);
  if (!p) return;
  auditProductId = productId;

  const titleEl = document.getElementById('auditTitle');
  if (titleEl) titleEl.textContent = 'Kiểm kho: ' + p.name;

  const infoEl = document.getElementById('auditInfo');
  if (infoEl) {
    infoEl.innerHTML = `Mã: <b>${p.id}</b> · Đơn vị: <b>${escapeHtml(catUnit(p.cat))}</b>
      <br>Tồn kho đang ghi nhận: <b>${fmtQty(p.stock)}</b> ${escapeHtml(catUnit(p.cat))}`;
  }

  const actualInput = document.getElementById('auditActual');
  if (actualInput) {
    actualInput.value = p.stock;
    actualInput.step = catStep(p.cat);
  }
  const reasonInput = document.getElementById('auditReason');
  if (reasonInput) reasonInput.value = '';
  const preview = document.getElementById('auditPreview');
  if (preview) preview.innerHTML = '';

  openModal('stockAuditModal');
}

function previewAudit() {
  const p = findP(auditProductId);
  const actualInput = document.getElementById('auditActual');
  const preview = document.getElementById('auditPreview');
  if (!p || !actualInput || !preview) return;

  const actual = roundQty(parseFloat(String(actualInput.value).replace(',', '.')) || 0, catStep(p.cat));
  const diff = roundQty(actual - (p.stock || 0), catStep(p.cat));

  if (diff === 0) {
    preview.innerHTML = '<span class="pill ok">Không có chênh lệch — tồn kho đã đúng</span>';
    return;
  }
  preview.innerHTML = `<span class="pill ${diff > 0 ? 'low' : 'out'}">Chênh lệch: ${diff > 0 ? '+' : ''}${fmtQty(diff)} ${escapeHtml(catUnit(p.cat))}</span>
    <div class="muted" style="font-size:12px;margin-top:6px">${diff > 0 ? 'Thừa hàng so với tồn đang ghi nhận' : 'Thiếu hàng so với tồn đang ghi nhận'} — hệ thống sẽ cập nhật lại tồn kho theo số đếm thực tế.</div>`;
}

function confirmStockAudit() {
  const p = findP(auditProductId);
  if (!p) return;
  const actualInput = document.getElementById('auditActual');
  const reasonInput = document.getElementById('auditReason');

  let actual = parseFloat(String(actualInput.value).replace(',', '.'));
  if (isNaN(actual) || actual < 0) {
    markInvalid(actualInput, 'Số lượng thực tế phải là số không âm!');
    return;
  }
  actual = roundQty(actual, catStep(p.cat));

  const reason = ((reasonInput || {}).value || '').trim() || 'Điều chỉnh sau kiểm kho';
  const diff = roundQty(actual - (p.stock || 0), catStep(p.cat));

  if (diff === 0) { toast('Tồn kho không có chênh lệch, không cần điều chỉnh.'); closeModal('stockAuditModal'); return; }

  const before = p.stock;
  p.stock = actual;

  if (!Array.isArray(DB.stockMoves)) DB.stockMoves = [];
  DB.stockMoves.push({
    id: DB.nextMoveId++,
    date: todayIso(),
    productId: p.id,
    type: 'adjust',
    qty: Math.abs(diff),
    before: before,
    after: actual,
    reason: reason,
    refId: '',
    refName: 'Kiểm kho',
    unitCost: 0,
    by: currentOperator(),
  });

  saveDB(true);
  closeModal('stockAuditModal');
  refreshAllViews();
  toast(`✓ Đã điều chỉnh tồn kho ${p.name}: ${fmtQty(before)} → ${fmtQty(actual)} ${catUnit(p.cat)}`);
}

/* ================= NHÀ CUNG CẤP ================= */





/* ================= DANH SÁCH HÓA ĐƠN ================= */
let selectedInvoices = new Set();

function renderInvoices() {
  const q = ((document.getElementById('invoiceSearch') || {}).value || '').toLowerCase().trim();
  const status = (document.getElementById('invoiceStatus') || {}).value || '';
  const month = (document.getElementById('invoiceMonth') || {}).value || '';

  const invoices = (DB && Array.isArray(DB.invoices)) ? DB.invoices : [];
  const list = invoices.filter(i => {
    if (q && !((i.id || '').toLowerCase().includes(q) || (i.customer || '').toLowerCase().includes(q))) return false;
    if (status && i.status !== status) return false;
    if (month && toIsoDate(i.date).slice(0, 7) !== month) return false;
    return true;
  });

  list.sort((a, b) => String(b.id).localeCompare(String(a.id)));

  const totalRev = list.reduce((s, i) => s + (i.status === 'cancel' ? 0 : invNet(i)), 0);
  const totalProf = list.reduce((s, i) => s + (i.status === 'cancel' ? 0 : invProfitNet(i)), 0);
  const totalDebt = list.reduce((s, i) => s + (i.status === 'cancel' ? 0 : (i.debtAmount || 0)), 0);

  const countEl = document.getElementById('invoiceCount');
  if (countEl) {
    countEl.textContent = `${list.length} hóa đơn · Doanh thu: ${fmt(totalRev)} · Lợi nhuận: ${fmt(totalProf)} · Còn nợ: ${fmt(totalDebt)}`;
  }

  const pg = pageSlice(list, 'invoice');
  const body = document.getElementById('invoiceBody');
  if (body) {
    body.innerHTML = pg.items.length ? pg.items.map(i => {
      const st = i.status === 'paid'
        ? { cls: 'ok', label: 'Đã thanh toán' }
        : i.status === 'pending'
          ? { cls: 'low', label: (i.debtAmount > 0 ? `Nợ ${fmt(i.debtAmount)}` : 'Chưa TT') }
          : { cls: 'out', label: 'Đã hủy' };
      const ec = i.exportCount || 0;
      return `<tr>
        <td><input type="checkbox" class="inv-check" data-id="${i.id}" onchange="onRowCheck()" ${selectedInvoices.has(i.id) ? 'checked' : ''}></td>
        <td><b>${escapeHtml(i.id)}</b></td>
        <td>${escapeHtml(i.customer)}</td>
        <td class="muted">${isoToDisplay(i.date)}</td>
        <td class="money" style="text-align:right">${fmt(invNet(i))}</td>
        <td class="money" style="text-align:right;color:${i.status === 'cancel' ? 'var(--muted)' : 'var(--teal)'}">${fmt(i.status === 'cancel' ? 0 : invProfitNet(i))}</td>
        <td style="text-align:center">${fmtQty(invoiceItemsCount(i.items))}</td>
        <td style="text-align:center"><span class="pill ${st.cls}">${st.label}</span></td>
        <td style="text-align:center">${ec > 0 ? `<span class="pill blue">${ec} lần</span>` : '<span class="muted">—</span>'}</td>
        <td style="text-align:center;white-space:nowrap">
          ${i.status === 'pending' ? `<button class="btn green sm" onclick="confirmPaymentInvoice('${i.id}')" title="Xác nhận khách đã trả đủ">✓ Đã TT</button> ` : ''}
          ${i.status !== 'cancel' ? `<button class="btn ghost sm" onclick="cancelInvoice('${i.id}')" title="Hủy hóa đơn và hoàn kho">Hủy</button> ` : ''}
          <button class="btn ghost sm" onclick="viewInvoice('${i.id}')">Chi tiết</button>
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="10"><div class="empty">Không tìm thấy hóa đơn phù hợp</div></td></tr>';
  }

  renderPager('invoice', pg.total, pg.cur, pg.max);
  updateSelectedInfo();
}

function onRowCheck() {
  document.querySelectorAll('.inv-check').forEach(cb => {
    if (cb.checked) selectedInvoices.add(cb.dataset.id); else selectedInvoices.delete(cb.dataset.id);
  });
  syncCheckAll();
  updateSelectedInfo();
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.inv-check').forEach(cb => {
    cb.checked = checked;
    if (checked) selectedInvoices.add(cb.dataset.id); else selectedInvoices.delete(cb.dataset.id);
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
  const q = ((document.getElementById('customerSearch') || {}).value || '').toLowerCase().trim();
  const qNorm = normalizePhoneDigits(q);

  if (q !== lastCustomerSearch) { pageState.customer = 1; lastCustomerSearch = q; }

  const customers = (DB && Array.isArray(DB.customers)) ? DB.customers : [];
  const list = customers.filter(c => {
    if (!q) return true;
    if ((c.name || '').toLowerCase().includes(q)) return true;
    if (removeVietnameseTones(c.name || '').includes(removeVietnameseTones(q))) return true;
    if (c.phone) {
      if (c.phone.toLowerCase().includes(q)) return true;
      if (qNorm && normalizePhoneDigits(c.phone).includes(qNorm)) return true;
    }
    if ((c.id || '').toLowerCase().includes(q)) return true;
    return false;
  });

  const pg = pageSlice(list, 'customer');
  const totalCustDebt = list.reduce((s, c) => s + (c.debt || 0), 0);
  const countEl = document.getElementById('customerCount');
  if (countEl) countEl.textContent = `${list.length} khách hàng · Tổng dư nợ: ${fmt(totalCustDebt)}`;

  const body = document.getElementById('customerBody');
  if (body) {
    body.innerHTML = pg.items.length ? pg.items.map(c => {
      const st = customerStats(c);
      const t = customerType(c);
      const typeBtn = c.type === 'agent'
        ? `<button class="btn ghost sm" onclick="toggleCustomerType('${c.id}')" title="Chuyển về khách lẻ">→ Khách lẻ</button>`
        : `<button class="btn purple sm" onclick="toggleCustomerType('${c.id}')" title="Nâng lên đại lý">↑ Đại lý</button>`;
      const debtVal = (typeof c.debt === 'number') ? c.debt : 0;
      const debtHtml = debtVal > 0 ? `<b style="color:var(--red)">${fmt(debtVal)}</b>` : '<span class="muted">0₫</span>';
      const payDebtBtn = debtVal > 0 ? `<button class="btn green sm" onclick="openSettleDebtModal('${c.id}')">Thu nợ</button> ` : '';
      return `<tr>
        <td class="muted">${c.id}</td>
        <td><b>${escapeHtml(c.name)}</b></td>
        <td class="muted">${escapeHtml(c.phone || '—')}</td>
        <td style="text-align:center"><span class="pill ${t.cls}">${t.label}</span></td>
        <td style="text-align:center">${st.count}</td>
        <td class="money" style="text-align:right">${fmt(st.spend)}</td>
        <td class="money" style="text-align:right">${debtHtml}</td>
        <td style="text-align:center;white-space:nowrap">${payDebtBtn}${typeBtn} <button class="btn ghost sm" onclick="openEditCustomer('${c.id}')">Sửa</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="8"><div class="empty">Không tìm thấy khách hàng phù hợp</div></td></tr>';
  }

  renderPager('customer', pg.total, pg.cur, pg.max);
}

function openAddCustomer() {
  editingCustomerId = null;
  document.getElementById('custModalTitle').textContent = 'Thêm khách hàng mới';
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custType').value = 'retail';
  const debtEl = document.getElementById('custDebt');
  if (debtEl) debtEl.value = '0';
  const debtWrap = document.getElementById('custDebtWrap');
  if (debtWrap) debtWrap.style.display = '';
  const phoneInput = document.getElementById('custPhone');
  if (phoneInput) phoneInput.classList.remove('is-invalid');
  const errEl = document.getElementById('custPhoneError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  openModal('customerModal');
}

function openEditCustomer(id) {
  const c = (DB.customers || []).find(x => x.id === id);
  if (!c) return;
  editingCustomerId = id;
  document.getElementById('custModalTitle').textContent = 'Sửa khách hàng ' + c.id;
  document.getElementById('custName').value = c.name;
  document.getElementById('custPhone').value = (c.phone || '').replace(/\D/g, '');
  document.getElementById('custType').value = c.type || 'retail';
  const debtEl = document.getElementById('custDebt');
  if (debtEl) debtEl.value = (typeof c.debt === 'number') ? c.debt : 0;
  const debtWrap = document.getElementById('custDebtWrap');
  if (debtWrap) debtWrap.style.display = 'none';
  const phoneInput = document.getElementById('custPhone');
  if (phoneInput) phoneInput.classList.remove('is-invalid');
  const errEl = document.getElementById('custPhoneError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  openModal('customerModal');
}

function onCustPhoneInput(inputEl) {
  const errEl = document.getElementById('custPhoneError');
  const val = inputEl ? inputEl.value : '';

  if (!val) {
    inputEl.classList.remove('is-invalid');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    return;
  }

  if (/\D/.test(val)) {
    inputEl.classList.add('is-invalid');
    const msg = 'Số điện thoại chỉ được chứa các chữ số (0-9)!';
    if (errEl) { errEl.textContent = msg; errEl.style.color = 'var(--red)'; errEl.style.display = 'block'; }
    toast(msg);
    return;
  }
  if (!val.startsWith('0')) {
    inputEl.classList.add('is-invalid');
    const msg = 'Số điện thoại phải bắt đầu bằng số 0!';
    if (errEl) { errEl.textContent = msg; errEl.style.color = 'var(--red)'; errEl.style.display = 'block'; }
    toast(msg);
    return;
  }
  if (val.length > 10) {
    inputEl.classList.add('is-invalid');
    const msg = `Số điện thoại chỉ gồm tối đa 10 chữ số (đang có ${val.length} số)!`;
    if (errEl) { errEl.textContent = msg; errEl.style.color = 'var(--red)'; errEl.style.display = 'block'; }
    toast('Số điện thoại chỉ gồm tối đa 10 chữ số!');
    return;
  }

  inputEl.classList.remove('is-invalid');
  if (errEl) {
    if (val.length < 10) {
      errEl.textContent = `Đang nhập: ${val.length}/10 số (cần đủ 10 số)`;
      errEl.style.color = 'var(--muted)';
    } else {
      errEl.textContent = '✓ Số điện thoại hợp lệ (10 chữ số)';
      errEl.style.color = 'var(--teal)';
    }
    errEl.style.display = 'block';
  }
}

function saveCustomer() {
  const nameInput = document.getElementById('custName');
  const phoneInput = document.getElementById('custPhone');
  const typeInput = document.getElementById('custType');
  const errEl = document.getElementById('custPhoneError');

  const name = (nameInput.value || '').trim();
  const phone = (phoneInput.value || '').trim();
  const type = typeInput.value || 'retail';

  if (!name) { markInvalid(nameInput, 'Vui lòng nhập họ và tên khách hàng!'); return; }
  if (name.length < 2) { markInvalid(nameInput, 'Tên khách hàng phải có ít nhất 2 ký tự!'); return; }

  if (phone) {
    const pCheck = validatePhoneNumber(phone, false);
    if (!pCheck.valid) {
      markInvalid(phoneInput, pCheck.error);
      if (errEl) { errEl.textContent = pCheck.error; errEl.style.color = 'var(--red)'; errEl.style.display = 'block'; }
      return;
    }
    const existing = (DB.customers || []).find(c => c.id !== editingCustomerId && (c.phone || '').replace(/\D/g, '') === phone);
    if (existing) {
      const dupMsg = `Số điện thoại này đã thuộc về khách hàng "${existing.name}"!`;
      markInvalid(phoneInput, dupMsg);
      if (errEl) { errEl.textContent = dupMsg; errEl.style.color = 'var(--red)'; errEl.style.display = 'block'; }
      return;
    }
  }

  const formattedPhone = phone ? formatPhone(phone) : '';

  if (editingCustomerId) {
    const c = (DB.customers || []).find(x => x.id === editingCustomerId);
    if (c) {
      c.name = name;
      c.phone = formattedPhone;
      c.type = type;
    }
    toast('Đã cập nhật thông tin khách hàng');
  } else {
    const debtInput = document.getElementById('custDebt');
    const debt = Math.max(0, num(debtInput ? debtInput.value : 0, 0));
    const id = nextId('KH', DB.customers, 'nextCustomerId', 2);
    DB.customers.push({ id, name, phone: formattedPhone, type, debt });
    toast('Đã thêm khách hàng: ' + name);
  }

  saveDB(true);
  closeModal('customerModal');
  renderCustomers();
}

/* ================= BÁO CÁO NHẬP – XUẤT – TỒN ================= */
function renderReport() {
  const invoices = (DB && Array.isArray(DB.invoices)) ? DB.invoices : [];
  const categories = (DB && Array.isArray(DB.categories)) ? DB.categories : [];
  const products = (DB && Array.isArray(DB.products)) ? DB.products : [];
  const moves = (DB && Array.isArray(DB.stockMoves)) ? DB.stockMoves : [];
  const act = invoices.filter(i => i.status !== 'cancel');

  const fromVal = (document.getElementById('reportFrom') || {}).value || '';
  const toVal = (document.getElementById('reportTo') || {}).value || '';
  const start = fromVal ? parseInvoiceDate(fromVal) : null;
  const end = toVal ? parseInvoiceDate(toVal) : null;
  const inRange = dStr => {
    if (!start && !end) return true;
    const d = parseInvoiceDate(dStr);
    if (!d) return true;
    if (start && d.getTime() < start.getTime()) return false;
    if (end && d.getTime() > end.getTime()) return false;
    return true;
  };

  const body = document.getElementById('reportBody');
  if (body) {
    let tIn = 0, tOut = 0, tStock = 0, tRev = 0, tProf = 0;

    const rows = categories.map(c => {
      const ps = products.filter(p => p.cat === c.id);
      const ids = ps.map(p => p.id);

      const qtyIn = moves.filter(m => ids.indexOf(m.productId) !== -1 && m.type === 'import' && inRange(m.date)).reduce((s, m) => s + m.qty, 0);
      const qtyOut = moves.filter(m => ids.indexOf(m.productId) !== -1 && m.type === 'sale' && inRange(m.date)).reduce((s, m) => s + m.qty, 0);
      const stockQty = ps.reduce((s, p) => s + (p.stock || 0), 0);
      const stockVal = ps.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0);

      let rev = 0, prof = 0;
      act.filter(i => inRange(i.date)).forEach(i => i.items.forEach(row => {
        const p = findP(row[0]);
        if (p && p.cat === c.id) {
          const lineDisc = itemDiscAmount(row);
          rev += Math.max(0, p.price * row[1] - lineDisc);
          prof += (p.price - p.cost) * row[1] - lineDisc;
        }
      }));

      tIn += qtyIn; tOut += qtyOut; tStock += stockVal; tRev += rev; tProf += prof;

      return `<tr>
        <td><span class="cat-tag">${escapeHtml(c.name)}</span></td>
        <td style="text-align:center">${ps.length}</td>
        <td style="text-align:center"><span class="unit-tag">${escapeHtml(c.unit)}</span></td>
        <td style="text-align:right;color:var(--teal);font-weight:600">+${fmtQty(qtyIn)}</td>
        <td style="text-align:right;color:var(--red);font-weight:600">−${fmtQty(qtyOut)}</td>
        <td style="text-align:right"><b>${fmtQty(stockQty)}</b></td>
        <td style="text-align:right" class="money">${fmt(stockVal)}</td>
        <td style="text-align:right" class="money">${fmt(rev)}</td>
        <td style="text-align:right money" style="color:var(--teal)">${fmt(prof)}</td>
      </tr>`;
    }).join('');

    body.innerHTML = '<table><thead><tr>'
      + '<th>Danh mục</th><th style="text-align:center">Số SP</th><th style="text-align:center">ĐVT</th>'
      + '<th style="text-align:right">Nhập</th><th style="text-align:right">Xuất</th><th style="text-align:right">Tồn</th>'
      + '<th style="text-align:right">Giá trị tồn</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">Lợi nhuận</th>'
      + '</tr></thead><tbody>' + rows
      + `<tr style="background:var(--bg);font-weight:700">
          <td>TỔNG CỘNG</td><td></td><td></td>
          <td style="text-align:right;color:var(--teal)">+${fmtQty(tIn)}</td>
          <td style="text-align:right;color:var(--red)">−${fmtQty(tOut)}</td>
          <td></td>
          <td style="text-align:right">${fmt(tStock)}</td>
          <td style="text-align:right">${fmt(tRev)}</td>
          <td style="text-align:right;color:var(--teal)">${fmt(tProf)}</td>
        </tr></tbody></table>`;
  }

}

function resetReportFilter() {
  ['reportFrom', 'reportTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderReport();
}

/* ================= XUẤT CSV (EXCEL) ================= */
function exportCSV(filename, rows) {
  const csv = '\ufeff' + rows.map(r => r.map(c => `"${String(c != null ? c : '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('Đã xuất thành công: ' + filename);
}

function exportInventory() {
  const rows = [['Mã SP', 'Tên sản phẩm', 'Danh mục', 'Thương hiệu', 'Giá nhập', 'Giá bán', 'Đơn vị', 'Tồn kho', 'Ngưỡng cảnh báo', 'Quy cách', 'Tình trạng']];
  ((DB && DB.products) || []).forEach(p => rows.push([
    p.id, p.name, catName(p.cat), p.brand, p.cost, p.price, catUnit(p.cat),
    p.stock, p.minStock, p.spec || '', stockStatus(p.stock, p.minStock).label
  ]));
  exportCSV('danh-sach-san-pham.csv', rows);
}



function exportSelectedInvoices() {
  const ids = [...selectedInvoices];
  if (ids.length === 0) { toast('Vui lòng tích chọn ít nhất 1 hóa đơn để xuất!'); return; }

  const chosen = ((DB && DB.invoices) || []).filter(i => ids.indexOf(i.id) !== -1);
  chosen.sort((a, b) => String(b.id).localeCompare(String(a.id)));

  const rows = [['Mã HĐ', 'Khách hàng', 'Ngày tạo', 'Số mặt hàng', 'Tổng tiền hàng', 'Chiết khấu', 'Cần thanh toán', 'Đã thu', 'Còn nợ', 'Lợi nhuận', 'Trạng thái', 'Số lần đã xuất']];
  chosen.forEach(i => rows.push([
    i.id, i.customer, isoToDisplay(i.date), invoiceItemsCount(i.items),
    invoiceTotal(i.items), invDisc(i), invNet(i), invTotalPaid(i),
    i.status === 'cancel' ? 0 : (i.debtAmount || 0),
    i.status === 'cancel' ? 0 : invProfitNet(i),
    i.status === 'paid' ? 'Đã thanh toán' : i.status === 'pending' ? 'Chưa thanh toán' : 'Đã hủy',
    (i.exportCount || 0) + 1
  ]));

  chosen.forEach(i => { i.exportCount = (i.exportCount || 0) + 1; });
  saveDB();
  exportCSV(`hoa-don-${chosen.length}-don.csv`, rows);
  selectedInvoices.clear();
  renderInvoices();
}

function exportReport() {
  const rows = [['Danh mục', 'Kiểu hàng hóa', 'Đơn vị', 'Số SP', 'Tồn kho', 'Giá trị tồn (VNĐ)']];
  const products = (DB && DB.products) || [];
  ((DB && DB.categories) || []).forEach(c => {
    const ps = products.filter(p => p.cat === c.id);
    rows.push([
      c.name, (CAT_TYPES[c.type] || { label: '' }).label, c.unit, ps.length,
      ps.reduce((s, p) => s + (p.stock || 0), 0),
      ps.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0)
    ]);
  });
  exportCSV('bao-cao-nhap-xuat-ton.csv', rows);
}

function exportCustomers() {
  const rows = [['Mã KH', 'Tên khách hàng', 'Điện thoại', 'Loại', 'Số đơn', 'Tổng chi tiêu', 'Dư nợ']];
  ((DB && DB.customers) || []).forEach(c => {
    const st = customerStats(c);
    rows.push([c.id, c.name, c.phone || '', c.type === 'agent' ? 'Đại lý' : 'Khách lẻ', st.count, st.spend, c.debt || 0]);
  });
  exportCSV('danh-sach-khach-hang.csv', rows);
}

/* ================= SAO LƯU & DỮ LIỆU ================= */
const BACKUP_PREFIX = 'pmbanhang_bk_';
const BACKUP_KEEP = 5;

function backupKey(date) {
  return BACKUP_PREFIX + date;
}

function listLocalBackups() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(BACKUP_PREFIX) === 0) {
        const raw = localStorage.getItem(k) || '';
        out.push({ key: k, date: k.replace(BACKUP_PREFIX, ''), size: raw.length });
      }
    }
  } catch (_) { }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function runAutoBackup() {
  const s = getStoreSettings();
  if (!s.dailyBackup) return;
  const today = todayIso();
  if (s.lastBackupDate === today) return;
  if (!(DB.products || []).length && !(DB.invoices || []).length) return;

  try {
    localStorage.setItem(backupKey(today), JSON.stringify(DB));
    listLocalBackups().slice(BACKUP_KEEP).forEach(b => {
      try { localStorage.removeItem(b.key); } catch (_) { }
    });
    DB.settings.lastBackupDate = today;
    saveDB(true);
  } catch (e) {
    console.warn('Không thể tạo bản sao lưu tự động (bộ nhớ đầy?):', e);
  }
}

function renderBackupPage() {
  const infoEl = document.getElementById('backupDbInfo');
  if (infoEl) {
    const raw = JSON.stringify(DB);
    const kb = (raw.length / 1024).toFixed(1);
    infoEl.innerHTML = `<div class="stat-grid">
      <div class="stat"><div class="stat-lbl">Sản phẩm</div><div class="stat-val">${(DB.products || []).length}</div></div>
      <div class="stat"><div class="stat-lbl">Hóa đơn</div><div class="stat-val">${(DB.invoices || []).length}</div></div>
      <div class="stat"><div class="stat-lbl">Khách hàng</div><div class="stat-val">${(DB.customers || []).length}</div></div>
      <div class="stat"><div class="stat-lbl">Dung lượng dữ liệu</div><div class="stat-val">${kb} KB</div></div>
    </div>`;
  }

  const autoEl = document.getElementById('setDailyBackup');
  if (autoEl) autoEl.value = getStoreSettings().dailyBackup ? 'true' : 'false';

  const listEl = document.getElementById('backupList');
  if (listEl) {
    const list = listLocalBackups();
    listEl.innerHTML = list.length
      ? '<table><thead><tr><th>Ngày sao lưu</th><th style="text-align:right">Dung lượng</th><th style="text-align:center">Thao tác</th></tr></thead><tbody>'
        + list.map(b => `<tr>
            <td><b>${isoToDisplay(b.date)}</b></td>
            <td style="text-align:right" class="muted">${(b.size / 1024).toFixed(1)} KB</td>
            <td style="text-align:center;white-space:nowrap">
              <button class="btn sm" onclick="restoreLocalBackup('${b.key}')">Phục hồi</button>
              <button class="btn ghost sm" onclick="downloadLocalBackup('${b.key}')">Tải về</button>
              <button class="btn ghost sm" onclick="deleteLocalBackup('${b.key}')">Xóa</button>
            </td>
          </tr>`).join('') + '</tbody></table>'
      : '<div class="empty">Chưa có bản sao lưu nào. Hãy bật "Tự động sao lưu hằng ngày" hoặc bấm "Sao lưu ngay".</div>';
  }
}

function toggleDailyBackup() {
  const el = document.getElementById('setDailyBackup');
  if (!DB.settings) DB.settings = {};
  DB.settings.dailyBackup = el && el.value === 'true';
  saveDB(true);
  toast(DB.settings.dailyBackup ? '✓ Đã bật tự động sao lưu hằng ngày' : 'Đã tắt tự động sao lưu');
}

function createBackupNow() {
  const today = todayIso();
  try {
    localStorage.setItem(backupKey(today), JSON.stringify(DB));
    listLocalBackups().slice(BACKUP_KEEP).forEach(b => { try { localStorage.removeItem(b.key); } catch (_) { } });
    if (!DB.settings) DB.settings = {};
    DB.settings.lastBackupDate = today;
    saveDB(true);
    renderBackupPage();
    toast('✓ Đã tạo bản sao lưu ngày ' + isoToDisplay(today));
  } catch (e) {
    alert('Không thể tạo bản sao lưu: bộ nhớ trình duyệt đã đầy.\n\nHãy dùng chức năng "Tải file sao lưu toàn bộ về máy" để lưu ra ổ đĩa thay vì lưu trong ứng dụng.');
  }
}

function restoreLocalBackup(key) {
  const raw = localStorage.getItem(key);
  if (!raw) { toast('Không tìm thấy bản sao lưu này!'); return; }
  const normalized = normalizeDB(raw);
  if (!normalized) { toast('Bản sao lưu bị hỏng, không thể phục hồi!'); return; }

  const date = key.replace(BACKUP_PREFIX, '');
  if (!confirm(`PHỤC HỒI dữ liệu từ bản sao lưu ngày ${isoToDisplay(date)}?\n\nToàn bộ dữ liệu hiện tại sẽ bị THAY THẾ bằng bản sao lưu này. Tiếp tục?`)) return;

  try { localStorage.setItem(backupKey('truoc-phuc-hoi-' + todayIso()), JSON.stringify(DB)); } catch (_) { }

  DB = normalized;
  saveDB(true);
  refreshAllViews();
  renderBackupPage();
  toast('✓ Đã phục hồi dữ liệu từ bản sao lưu ngày ' + isoToDisplay(date));
}

function downloadLocalBackup(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const date = key.replace(BACKUP_PREFIX, '');
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pmbanhang-saoluu-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('Đã tải file sao lưu về máy');
}

function deleteLocalBackup(key) {
  const date = key.replace(BACKUP_PREFIX, '');
  if (!confirm(`Xóa bản sao lưu ngày ${isoToDisplay(date)}?`)) return;
  try { localStorage.removeItem(key); } catch (_) { }
  renderBackupPage();
  toast('Đã xóa bản sao lưu');
}

function exportBackupFile() {
  const payload = {
    app: 'PMBANHANG',
    version: 3,
    exportedAt: new Date().toISOString(),
    data: DB
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pmbanhang-toanbo-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('✓ Đã tải file sao lưu toàn bộ dữ liệu');
}

function importBackupFile(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    let parsed = null;
    try {
      parsed = JSON.parse(e.target.result);
    } catch (err) {
      alert('File không hợp lệ: không đọc được định dạng JSON.');
      input.value = '';
      return;
    }

    const candidate = (parsed && parsed.data) ? parsed.data : parsed;
    const normalized = normalizeDB(candidate);
    if (!normalized) {
      alert('File không hợp lệ: không nhận diện được cấu trúc dữ liệu PMBANHANG.');
      input.value = '';
      return;
    }

    const summary = `${(normalized.products || []).length} sản phẩm, ${(normalized.invoices || []).length} hóa đơn, ${(normalized.customers || []).length} khách hàng`;
    if (!confirm(`PHỤC HỒI từ file sao lưu?\n\nNội dung file: ${summary}\n\nToàn bộ dữ liệu hiện tại sẽ bị THAY THẾ. Tiếp tục?`)) {
      input.value = '';
      return;
    }

    try { localStorage.setItem(backupKey('truoc-phuc-hoi-' + todayIso()), JSON.stringify(DB)); } catch (_) { }

    DB = normalized;
    saveDB(true);
    refreshAllViews();
    renderBackupPage();
    toast('✓ Đã phục hồi dữ liệu từ file sao lưu');
    input.value = '';
  };
  reader.onerror = function () {
    alert('Không đọc được file. Vui lòng thử lại.');
    input.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function confirmResetData() {
  if (!isManager()) { toast('Chỉ Quản lý mới được đặt lại dữ liệu!'); return; }
  resetData();
}

/* ================= CÀI ĐẶT CỬA HÀNG & VIETQR ================= */
function renderStoreSettings() {
  const s = getStoreSettings();

  const bind = (id, val) => { const el = document.getElementById(id); if (el) el.value = val == null ? '' : val; };
  bind('setStoreName', s.storeName);
  bind('setStoreAddress', s.address);
  bind('setStorePhone', s.phone);
  bind('setStoreFooter', s.footerNote);
  bind('setStoreDesc', s.desc);
  bind('setAccountNo', s.accountNo);
  bind('setAccountName', s.accountName);
  bind('setLowStockThreshold', s.lowStockThreshold);

  const bankSel = document.getElementById('setBankId');
  if (bankSel && Array.isArray(VIETNAM_BANKS)) {
    bankSel.innerHTML = VIETNAM_BANKS.map(b => `<option value="${b.id}" ${b.id === s.bankId ? 'selected' : ''}>${b.name}</option>`).join('');
  }
  const qrEnEl = document.getElementById('setQrEnabled');
  if (qrEnEl) qrEnEl.value = s.qrEnabled ? 'true' : 'false';

  const pwEl = document.getElementById('setManagerPassword');
  if (pwEl) pwEl.value = '';

  if (typeof pcRenderSyncStatus === 'function') pcRenderSyncStatus();

  updateQrPreview();
}

function updateQrPreview() {
  const previewBox = document.getElementById('settingsQrPreview');
  if (!previewBox) return;

  const bankId = (document.getElementById('setBankId') || {}).value || 'MB';
  const accountNo = ((document.getElementById('setAccountNo') || {}).value || '').trim().replace(/\s+/g, '');
  const accountName = ((document.getElementById('setAccountName') || {}).value || '').trim().toUpperCase();

  if (!accountNo) {
    previewBox.innerHTML = '<span class="muted" style="font-size:12px;text-align:center">Nhập số tài khoản để xem trước VietQR</span>';
    return;
  }

  const bankObj = (VIETNAM_BANKS || []).find(b => b.id === bankId) || { name: bankId };
  const url = getVietQrUrl(50000, 'HD-TEST-VIETQR', { bankId, accountNo, accountName, bankName: bankObj.name });
  previewBox.innerHTML = `<img src="${url}" alt="Mã VietQR mẫu" style="width:130px;height:130px;border-radius:6px;border:1px solid var(--line2);box-shadow:0 2px 6px rgba(0,0,0,0.08)">`;
}

function saveStoreSettings() {
  const val = id => ((document.getElementById(id) || {}).value || '').trim();

  const storeName = val('setStoreName');
  const address = val('setStoreAddress');
  const phone = val('setStorePhone');
  const footerNote = val('setStoreFooter');
  const desc = val('setStoreDesc');
  const bankId = (document.getElementById('setBankId') || {}).value || 'MB';
  const accountNo = val('setAccountNo').replace(/\s+/g, '');
  const accountName = val('setAccountName').toUpperCase();
  const qrEnabled = (document.getElementById('setQrEnabled') || {}).value === 'true';
  const threshold = Math.max(0, num(val('setLowStockThreshold'), 5));
  const newPw = val('setManagerPassword');

  if (!storeName) { toast('Vui lòng nhập tên cửa hàng!'); document.getElementById('setStoreName').focus(); return; }
  if (!address) { toast('Vui lòng nhập địa chỉ cửa hàng!'); document.getElementById('setStoreAddress').focus(); return; }
  if (!phone) { toast('Vui lòng nhập số điện thoại hotline!'); document.getElementById('setStorePhone').focus(); return; }
  if (!accountNo) { toast('Vui lòng nhập số tài khoản ngân hàng để tạo VietQR!'); document.getElementById('setAccountNo').focus(); return; }
  if (!accountName) { toast('Vui lòng nhập tên chủ tài khoản!'); document.getElementById('setAccountName').focus(); return; }

  if (newPw && newPw.length < 4) {
    toast('Mật khẩu quản lý phải có ít nhất 4 ký tự!');
    document.getElementById('setManagerPassword').focus();
    return;
  }

  const bankObj = (VIETNAM_BANKS || []).find(b => b.id === bankId);

  if (!DB.settings) DB.settings = {};
  Object.assign(DB.settings, {
    storeName, address, phone, footerNote, desc,
    bankId,
    bankName: bankObj ? bankObj.name : bankId,
    accountNo, accountName, qrEnabled,
    lowStockThreshold: threshold
  });

  if (newPw) {
    DB.settings.managerPassword = newPw;
    const pwEl = document.getElementById('setManagerPassword');
    if (pwEl) pwEl.value = '';
    toast('✓ Đã lưu cài đặt và đổi mật khẩu quản lý');
  } else {
    toast('✓ Đã lưu thành công cài đặt cửa hàng & VietQR!');
  }

  saveDB(true);
  updateLowStockBadge();
  renderStoreSettings();
}

/* ================= KHỞI CHẠY ỨNG DỤNG ================= */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav a').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(a.dataset.view);
      if (isMobileLayout()) closeSidebar();
    });
  });

  document.addEventListener('input', (e) => {
    if (e.target && e.target.classList.contains('is-invalid')) {
      e.target.classList.remove('is-invalid');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.overlay.show').forEach(m => m.classList.remove('show'));
      closeSidebar();
    }
  });

  window.addEventListener('resize', () => {
    if (!isMobileLayout()) closeSidebar();
  });

  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  });

  loadTheme();
  applyAuthUI();
  onCatTypeChange();
  runAutoBackup();
  switchView('dashboard');
  startCloudIfConfigured();
});
