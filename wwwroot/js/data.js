/* ==========================================================================
   PMBANHANG - DATA LAYER (data.js)
   Cấu trúc dữ liệu, seedData, lưu/đọc LocalStorage + SQLite (C# WebView2)
   Lưu ý: Ứng dụng chạy OFFLINE hoàn toàn, không dùng đồng bộ đám mây.
   ========================================================================== */

const DB_KEY = 'pmbanhang_db_v3';
const LEGACY_DB_KEYS = ['warehouse_db_v2', 'warehouse_db_v1'];
const AUTH_KEY = 'pmbanhang_auth';

/* ===== Các trường hợp lệ cho trạng thái phiếu kho ===== */
const STOCK_REASONS = {
  import: { label: 'Nhập kho', cls: 'ok', dir: 1 },
  sale: { label: 'Bán hàng', cls: 'blue', dir: -1 },
  return: { label: 'Khách trả hàng', cls: 'purple', dir: 1 },
  adjust: { label: 'Điều chỉnh kiểm kho', cls: 'low', dir: 0 },
  delete: { label: 'Xóa sản phẩm', cls: 'out', dir: 0 },
};

/* ===== Các kiểu hàng hóa (chỉ dùng để gợi ý đơn vị + cho phép số lẻ) ===== */
const CAT_TYPES = {
  quantity: { label: 'Số lượng', units: ['cái', 'chiếc', 'bộ', 'hộp', 'thùng', 'gói', 'bao'] },
  weight: { label: 'Cân nặng', units: ['kg', 'gam', 'tấn', 'yến'] },
  length: { label: 'Độ dài', units: ['m', 'cm', 'mm', 'cuộn'] },
  area: { label: 'Diện tích', units: ['m²', 'cm²'] },
  volume: { label: 'Thể tích', units: ['lít', 'ml', 'm³'] },
};

/* ===== Danh sách ngân hàng hỗ trợ VietQR ===== */
const VIETNAM_BANKS = [
  { id: "MB", name: "MBBank (Ngân hàng Quân Đội)" },
  { id: "VCB", name: "Vietcombank (Ngoại Thương Việt Nam)" },
  { id: "TCB", name: "Techcombank (Kỹ Thương Việt Nam)" },
  { id: "BIDV", name: "BIDV (Đầu tư và Phát triển VN)" },
  { id: "ICB", name: "VietinBank (Công Thương Việt Nam)" },
  { id: "ACB", name: "ACB (Á Châu)" },
  { id: "VPB", name: "VPBank (Việt Nam Thịnh Vượng)" },
  { id: "TPB", name: "TPBank (Tiên Phong)" },
  { id: "STB", name: "Sacombank (Sài Gòn Thương Tín)" },
  { id: "VIB", name: "VIB (Quốc Tế)" },
  { id: "HDB", name: "HDBank (Phát triển TP.HCM)" },
  { id: "SHB", name: "SHB (Sài Gòn - Hà Nội)" },
  { id: "VBA", name: "Agribank (Nông nghiệp & PTNT)" },
  { id: "LPB", name: "LPBank (Lộc Phát Việt Nam)" },
  { id: "MSB", name: "MSB (Hàng Hải)" },
  { id: "OCB", name: "OCB (Phương Đông)" },
  { id: "SEAB", name: "SeABank (Đông Nam Á)" }
];

/* ===== Mật khẩu quản lý mặc định (đổi được trong tab Cài đặt) ===== */
const DEFAULT_MANAGER_PASSWORD = '123456';

/* ===== Cấu hình cửa hàng mặc định ===== */
function defaultSettings() {
  return {
    storeName: "CỬA HÀNG ĐIỆN GIA DỤNG",
    address: "123 Đường Lê Lợi, P. Bến Thành, Q.1, TP.HCM",
    phone: "0987 654 321 - 0912 345 678",
    desc: "CHUYÊN: ĐỒ ĐIỆN GIA DỤNG - THIẾT BỊ NHÀ BẾP\nTỦ LẠNH - MÁY GIẶT - ĐIỀU HÒA - TIVI\nTƯ VẤN LẮP ĐẶT - BẢO HÀNH TẬN NƠI",
    footerNote: "Cảm ơn Quý khách! Hẹn gặp lại!",
    bankId: "MB",
    bankName: "MBBank (Ngân hàng Quân Đội)",
    accountNo: "0987654321",
    accountName: "NGUYEN VAN ADMIN",
    qrEnabled: true,
    lowStockThreshold: 5,
    managerPassword: DEFAULT_MANAGER_PASSWORD,
    dailyBackup: true,
    lastBackupDate: ''
  };
}

/* ===== Lấy cấu hình cửa hàng hiện tại ===== */
function getStoreSettings() {
  return Object.assign({}, defaultSettings(), (DB && DB.settings) ? DB.settings : {});
}

/* ===== Tạo link ảnh mã VietQR tự động theo chuẩn Napas ===== */
function getVietQrUrl(amount, content, customSettings) {
  const s = customSettings || getStoreSettings();
  if (!s || !s.bankId || !s.accountNo) return '';
  const bank = s.bankId;
  const acc = (s.accountNo || '').replace(/\s+/g, '');
  const amt = Math.max(0, Math.round(amount || 0));
  const desc = encodeURIComponent((content || 'PMBANHANG').trim());
  const name = encodeURIComponent((s.accountName || '').trim().toUpperCase());
  return `https://img.vietqr.io/image/${bank}-${acc}-compact2.png?amount=${amt}&addInfo=${desc}&accountName=${name}`;
}

/* ===== Thông tin cửa hàng dùng trên hóa đơn ===== */
const STORE = {
  get name() { return getStoreSettings().storeName; },
  get address() { return getStoreSettings().address; },
  get phone() { return getStoreSettings().phone; },
  get desc() { return getStoreSettings().desc; },
  get footerNote() { return getStoreSettings().footerNote; },
};

/* ===== Dữ liệu ban đầu (Seed Data) ===== */
function seedData() {
  const s = seedStock();
  return Object.assign(s, {
    nextInvoiceId: 1015,
    nextCustomerId: 9,
    nextProductId: 28,
    nextCategoryId: 9,
    nextMoveId: 1,
  });
}

/* ===== Sinh dữ liệu mẫu + lịch sử kho tương ứng ===== */
function seedStock() {
  const categories = [
    { id: "DM-01", name: "Tủ lạnh", type: "quantity", unit: "cái", desc: "Tủ lạnh các loại" },
    { id: "DM-02", name: "Máy giặt", type: "quantity", unit: "cái", desc: "Máy giặt cửa ngang/đứng" },
    { id: "DM-03", name: "Điều hòa", type: "quantity", unit: "bộ", desc: "Điều hòa nhiệt độ" },
    { id: "DM-04", name: "Tivi", type: "quantity", unit: "cái", desc: "Tivi các kích cỡ" },
    { id: "DM-05", name: "Gia dụng nhỏ", type: "quantity", unit: "cái", desc: "Đồ gia dụng nhỏ" },
    { id: "DM-06", name: "Bếp & Nồi", type: "quantity", unit: "cái", desc: "Thiết bị nhà bếp" },
    { id: "DM-07", name: "Dây điện", type: "length", unit: "m", desc: "Dây điện bán theo mét" },
    { id: "DM-08", name: "Gạo & Ngũ cốc", type: "weight", unit: "kg", desc: "Bán theo cân nặng" },
  ];

  const products = [
    { id: "TL-001", name: "Tủ lạnh Panasonic 320L Inverter", cat: "DM-01", brand: "Panasonic", cost: 10500000, price: 13500000, stock: 14, spec: "" },
    { id: "TL-002", name: "Tủ lạnh Samsung 230L", cat: "DM-01", brand: "Samsung", cost: 7200000, price: 9400000, stock: 8, spec: "" },
    { id: "TL-003", name: "Tủ lạnh LG 450L Side by side", cat: "DM-01", brand: "LG", cost: 19800000, price: 24900000, stock: 3, spec: "" },
    { id: "TL-004", name: "Tủ lạnh Toshiba 180L", cat: "DM-01", brand: "Toshiba", cost: 5200000, price: 6900000, stock: 12, spec: "" },
    { id: "MG-001", name: "Máy giặt LG 9kg Inverter", cat: "DM-02", brand: "LG", cost: 6500000, price: 8400000, stock: 22, spec: "" },
    { id: "MG-002", name: "Máy giặt Samsung 8kg", cat: "DM-02", brand: "Samsung", cost: 5400000, price: 7100000, stock: 0, spec: "" },
    { id: "MG-003", name: "Máy giặt Panasonic 10kg", cat: "DM-02", brand: "Panasonic", cost: 8900000, price: 11200000, stock: 6, spec: "" },
    { id: "MG-004", name: "Máy giặt Toshiba 7.5kg", cat: "DM-02", brand: "Toshiba", cost: 4800000, price: 6300000, stock: 15, spec: "" },
    { id: "DH-001", name: "Điều hòa Daikin 12000BTU", cat: "DM-03", brand: "Daikin", cost: 9800000, price: 12900000, stock: 11, spec: "" },
    { id: "DH-002", name: "Điều hòa Panasonic 9000BTU", cat: "DM-03", brand: "Panasonic", cost: 7800000, price: 9900000, stock: 5, spec: "" },
    { id: "DH-003", name: "Điều hòa Casper 12000BTU", cat: "DM-03", brand: "Casper", cost: 6200000, price: 8200000, stock: 17, spec: "" },
    { id: "DH-004", name: "Điều hòa LG 18000BTU", cat: "DM-03", brand: "LG", cost: 13900000, price: 17500000, stock: 4, spec: "" },
    { id: "TV-001", name: "Tivi Samsung 55 inch 4K", cat: "DM-04", brand: "Samsung", cost: 11900000, price: 14900000, stock: 7, spec: "" },
    { id: "TV-002", name: "Tivi LG 43 inch Smart", cat: "DM-04", brand: "LG", cost: 6900000, price: 8900000, stock: 10, spec: "" },
    { id: "GN-001", name: "Nồi cơm điện Sharp 1.8L", cat: "DM-05", brand: "Sharp", cost: 850000, price: 1250000, stock: 40, spec: "" },
    { id: "GN-002", name: "Bình nóng lạnh Ariston 30L", cat: "DM-05", brand: "Ariston", cost: 3100000, price: 4100000, stock: 9, spec: "" },
    { id: "GN-003", name: "Quạt điện Kangaroo", cat: "DM-05", brand: "Kangaroo", cost: 480000, price: 720000, stock: 6, spec: "" },
    { id: "GN-004", name: "Máy hút bụi Hitachi", cat: "DM-05", brand: "Hitachi", cost: 2300000, price: 3100000, stock: 16, spec: "" },
    { id: "GN-005", name: "Bàn ủi hơi nước Panasonic", cat: "DM-05", brand: "Panasonic", cost: 750000, price: 1100000, stock: 28, spec: "" },
    { id: "BP-001", name: "Bếp từ đôi Sunhouse", cat: "DM-06", brand: "Sunhouse", cost: 2900000, price: 3900000, stock: 13, spec: "" },
    { id: "BP-002", name: "Lò vi sóng Sharp 23L", cat: "DM-06", brand: "Sharp", cost: 1800000, price: 2400000, stock: 25, spec: "" },
    { id: "BP-003", name: "Máy lọc nước Kangaroo", cat: "DM-06", brand: "Kangaroo", cost: 4200000, price: 5600000, stock: 2, spec: "" },
    { id: "BP-004", name: "Nồi chiên không dầu Philips", cat: "DM-06", brand: "Philips", cost: 1700000, price: 2300000, stock: 19, spec: "" },
    { id: "DD-001", name: "Dây điện Cadivi 2.5mm", cat: "DM-07", brand: "Cadivi", cost: 9500, price: 14000, stock: 1200, spec: "Bán theo mét" },
    { id: "DD-002", name: "Dây điện Trần Phú 1.5mm", cat: "DM-07", brand: "Trần Phú", cost: 6200, price: 9500, stock: 850, spec: "Bán theo mét" },
    { id: "GA-001", name: "Gạo ST25", cat: "DM-08", brand: "ST25", cost: 22000, price: 29000, stock: 340, spec: "Bán theo kg" },
    { id: "GA-002", name: "Gạo Jasmine", cat: "DM-08", brand: "Vinaseed", cost: 16000, price: 22000, stock: 520, spec: "Bán theo kg" },
  ];

  const invoices = [
    { id: "HD-1001", customer: "Nguyễn Văn An", date: "02/10/2026", items: [["TL-001", 1], ["GN-001", 2]], status: "paid", exportCount: 2, discountAmt: 0, discountPct: 0 },
    { id: "HD-1002", customer: "Trần Thị Bình", date: "02/10/2026", items: [["MG-001", 1]], status: "paid", exportCount: 0, discountAmt: 0, discountPct: 0 },
    { id: "HD-1003", customer: "Lê Hoàng Cường", date: "01/10/2026", items: [["DH-001", 2], ["DH-002", 1]], status: "paid", exportCount: 1, discountAmt: 0, discountPct: 0 },
    { id: "HD-1004", customer: "Phạm Thu Dung", date: "01/10/2026", items: [["TL-003", 1]], status: "pending", exportCount: 0, discountAmt: 0, discountPct: 0 },
    { id: "HD-1005", customer: "Khách lẻ", date: "30/09/2026", items: [["GN-003", 2], ["BP-001", 1]], status: "paid", exportCount: 3, discountAmt: 0, discountPct: 0 },
    { id: "HD-1006", customer: "Hoàng Minh", date: "29/09/2026", items: [["MG-002", 1]], status: "cancel", exportCount: 0, discountAmt: 0, discountPct: 0 },
    { id: "HD-1007", customer: "Đỗ Quang Hải", date: "28/09/2026", items: [["BP-002", 3]], status: "paid", exportCount: 1, discountAmt: 0, discountPct: 0 },
    { id: "HD-1008", customer: "Vũ Thị Lan", date: "25/09/2026", items: [["TV-001", 1]], status: "paid", exportCount: 0, discountAmt: 0, discountPct: 0 },
    { id: "HD-1009", customer: "Khách lẻ", date: "22/09/2026", items: [["GN-004", 1], ["GN-005", 1]], status: "paid", exportCount: 2, discountAmt: 0, discountPct: 0 },
    { id: "HD-1010", customer: "Bùi Văn Khoa", date: "18/09/2026", items: [["DH-003", 1], ["BP-004", 2]], status: "paid", exportCount: 0, discountAmt: 0, discountPct: 0 },
    { id: "HD-1011", customer: "Ngô Thị Mai", date: "12/09/2026", items: [["TL-002", 1], ["MG-003", 1]], status: "paid", exportCount: 0, discountAmt: 0, discountPct: 0 },
    { id: "HD-1012", customer: "Khách lẻ", date: "05/09/2026", items: [["TV-002", 1]], status: "cancel", exportCount: 0, discountAmt: 0, discountPct: 0 },
    { id: "HD-1013", customer: "Khách lẻ", date: "03/10/2026", items: [["DD-001", 50]], status: "paid", exportCount: 0, discountAmt: 0, discountPct: 0 },
    { id: "HD-1014", customer: "Trần Văn Tú", date: "03/10/2026", items: [["GA-001", 20]], status: "paid", exportCount: 0, discountAmt: 0, discountPct: 0 },
  ];

  const customers = [
    { id: "KH-01", name: "Nguyễn Văn An", phone: "0912 345 678", type: "retail", debt: 0 },
    { id: "KH-02", name: "Trần Thị Bình", phone: "0987 654 321", type: "retail", debt: 0 },
    { id: "KH-03", name: "Lê Hoàng Cường", phone: "0903 111 222", type: "retail", debt: 0 },
    { id: "KH-04", name: "Phạm Thu Dung", phone: "0938 999 000", type: "retail", debt: 4242000 },
    { id: "KH-05", name: "Đại lý Hải Đăng", phone: "0918 222 333", type: "agent", debt: 0 },
    { id: "KH-06", name: "Vũ Thị Lan", phone: "0977 444 555", type: "retail", debt: 0 },
    { id: "KH-07", name: "Đại lý Minh Phát", phone: "0966 777 888", type: "agent", debt: 0 },
    { id: "KH-08", name: "Ngô Thị Mai", phone: "0908 123 456", type: "retail", debt: 0 },
  ];

  // Lịch sử kho mẫu: nhập kho đầu kỳ = tồn hiện tại + hàng đã bán, rồi phát lại các
  // lần bán => Tồn kho luôn khớp 100% với sổ kho theo thứ tự thời gian.
  // LƯU Ý: hóa đơn mẫu có ngày cũ hơn (từ 05/09/2026), nên phiếu nhập đầu kỳ phải
  // đặt TRƯỚC hóa đơn sớm nhất, nếu không sổ kho sẽ lệch khi sắp theo ngày.
  const invoiceDates = invoices
    .filter(inv => inv.status !== 'cancel')
    .map(inv => inv.date)
    .filter(Boolean)
    .sort((a, b) => toIsoDate(a).localeCompare(toIsoDate(b)));
  const openingDate = invoiceDates.length ? invoiceDates[0] : "01/10/2026";

  const openingQty = {};
  invoices.forEach(inv => {
    if (inv.status === 'cancel') return;
    inv.items.forEach(([pid, q]) => { openingQty[pid] = (openingQty[pid] || 0) + q; });
  });

  const moves = products.map((p, i) => {
    const total = p.stock + (openingQty[p.id] || 0);
    return {
      id: i + 1,
      date: openingDate,
      productId: p.id,
      type: 'import',
      qty: total,
      before: 0,
      after: total,
      reason: 'Nhập kho đầu kỳ',
      refId: "",
      refName: "Tồn kho ban đầu",
      unitCost: p.cost,
      by: 'Quản lý',
    };
  });

  // Ghi nhận lại lịch sử bán hàng cho các hóa đơn chưa hủy
  let moveId = moves.length;
  // Sinh phiếu xuất kho cho từng lần bán
  invoices.forEach(inv => {
    if (inv.status === 'cancel') return;
    inv.items.forEach(([pid, q]) => {
      const p = products.find(x => x.id === pid);
      if (!p) return;
      const before = p.stock;
      const after = roundQty(before - q, catStep(p.cat));
      moveId++;
      moves.push({
        id: moveId,
        date: inv.date,
        productId: pid,
        type: 'sale',
        qty: q,
        before: before,
        after: after,
        reason: 'Xuất bán theo hóa đơn',
        refId: inv.id,
        refName: inv.customer,
        unitCost: 0,
        by: 'Quản lý',
      });
      p.stock = after;
    });
  });

  return {
    categories,
    products,
    invoices,
    customers,
    stockMoves: moves,
    settings: defaultSettings(),
  };
}

/* ===== Chuẩn hóa ngày về ISO (yyyy-mm-dd) để lưu và so sánh chính xác ===== */
function toIsoDate(value) {
  if (!value) return '';
  const s = String(value).trim();

  // yyyy-mm-dd (đã đúng chuẩn)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  }
  // dd/mm/yyyy
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  // mm/yyyy
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[2]}-${String(m[1]).padStart(2, '0')}-01`;
  }

  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ===== Đổi ISO -> dd/mm/yyyy để hiển thị cho người dùng ===== */
function isoToDisplay(iso) {
  const v = toIsoDate(iso);
  if (!v) return '';
  const p = v.split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

/* ===== Ngày hôm nay dạng ISO ===== */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ===== Chuẩn hóa và bảo vệ cấu trúc dữ liệu DB ===== */
function normalizeDB(data) {
  if (!data) return null;

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.error('Lỗi giải mã chuỗi JSON:', e);
      return null;
    }
  }

  // Hỗ trợ dữ liệu cũ bọc trong { rawJson: "..." } (định dạng đám mây trước đây)
  if (data && typeof data.rawJson === 'string') {
    try {
      data = JSON.parse(data.rawJson);
    } catch (e) {
      console.error('Lỗi giải mã rawJson:', e);
      return null;
    }
  }
  if (data && typeof data.raw_json === 'string') {
    try {
      data = JSON.parse(data.raw_json);
    } catch (e) {
      console.error('Lỗi giải mã raw_json:', e);
      return null;
    }
  }

  if (!data || typeof data !== 'object') return null;

  if (!Array.isArray(data.categories)) data.categories = [];
  if (!Array.isArray(data.products)) data.products = [];
  if (!Array.isArray(data.invoices)) data.invoices = [];
  if (!Array.isArray(data.customers)) data.customers = [];
  delete data.suppliers;
  if (!Array.isArray(data.stockMoves)) data.stockMoves = [];

  // Dữ liệu trống hoàn toàn -> nạp bộ dữ liệu mẫu
  if (data.categories.length === 0 && data.products.length === 0) {
    const seed = seedData();
    if (data.invoices.length === 0) data.invoices = seed.invoices;
    if (data.customers.length === 0) data.customers = seed.customers;
    if (data.stockMoves.length === 0) data.stockMoves = seed.stockMoves;
    data.categories = seed.categories;
    data.products = seed.products;
    if (!data.settings) data.settings = seed.settings;
  }

  data.settings = Object.assign({}, defaultSettings(), data.settings || {});

  // DI CƯ DỮ LIỆU CŨ: bản cũ chỉ có 1 con số tồn kho, không có sổ kho.
  // Sinh phiếu "Nhập kho đầu kỳ" cho mỗi sản phẩm để sổ kho luôn khớp tồn kho.
  if (data.stockMoves.length === 0 && data.products.length > 0) {
    const openingDate = data.settings.openingDate || todayIso();
    data.stockMoves = data.products.map((p, i) => {
      const qty = Number(p.stock) || 0;
      return {
        id: i + 1,
        date: openingDate,
        productId: p.id,
        type: 'import',
        qty: qty,
        before: 0,
        after: qty,
        reason: 'Nhập kho đầu kỳ (chuyển đổi từ dữ liệu cũ)',
        refId: '',
        refName: 'Tồn kho ban đầu',
        unitCost: Number(p.cost) || 0,
        by: 'Quản lý',
      };
    });
    data.nextMoveId = data.stockMoves.length + 1;
  }

  // Chuẩn hóa danh mục
  data.categories.forEach(c => {
    if (!c.type || !CAT_TYPES[c.type]) c.type = 'quantity';
    if (!c.unit) c.unit = CAT_TYPES[c.type].units[0];
    if (typeof c.desc !== 'string') c.desc = '';
  });

  // Chuẩn hóa sản phẩm: ép số, chống dữ liệu rác
  data.products.forEach(p => {
    p.cost = Number(p.cost) || 0;
    p.price = Number(p.price) || 0;
    p.stock = Number(p.stock) || 0;
    if (p.stock < 0) p.stock = 0;
    if (typeof p.brand !== 'string' || !p.brand) p.brand = 'Khác';
    if (typeof p.spec !== 'string') p.spec = '';
    if (typeof p.minStock !== 'number' || isNaN(p.minStock)) p.minStock = data.settings.lowStockThreshold || 5;
  });

  // Chuẩn hóa khách hàng
  data.customers.forEach(c => {
    if (typeof c.debt !== 'number' || isNaN(c.debt) || c.debt < 0) c.debt = 0;
    if (c.type !== 'agent') c.type = 'retail';
  });

  // Giá phải được chuẩn hóa TRƯỚC khi tính tiền hóa đơn, và truyền tường minh danh
  // sách sản phẩm vì lúc này biến toàn cục DB có thể vẫn là null (lần chạy đầu tiên).
  const productList = data.products;

  // Chuẩn hóa hóa đơn: ngày về ISO, đảm bảo trường thanh toán
  data.invoices.forEach(i => {
    i.date = toIsoDate(i.date);
    if (typeof i.note !== 'string') i.note = '';
    if (typeof i.paymentMethod !== 'string') i.paymentMethod = 'cash';
    if (!Array.isArray(i.items)) i.items = [];
    // Chuẩn hóa chiết khấu từng dòng: [id, qty] -> [id, qty, discPct]
    i.items = i.items.filter(r => Array.isArray(r) && r.length >= 2).map(r => {
      const qty = Number(r[1]) || 0;
      const pct = Number(r[2]);
      return [r[0], qty, (isNaN(pct) || pct <= 0) ? 0 : (pct > 100 ? 100 : pct)];
    });
    if (typeof i.discountAmt !== 'number' || isNaN(i.discountAmt)) i.discountAmt = 0;
    if (typeof i.discountPct !== 'number' || isNaN(i.discountPct)) i.discountPct = 0;
    if (typeof i.exportCount !== 'number' || isNaN(i.exportCount)) i.exportCount = 0;
    if (!i.status || ['paid', 'pending', 'cancel'].indexOf(i.status) === -1) i.status = 'paid';

    const net = Math.max(0, invoiceTotal(i.items, productList) - invoiceItemsDiscount(i.items, productList) - i.discountAmt);
    const hasPaidField = typeof i.customerPaid === 'number' && !isNaN(i.customerPaid);
    const hasDebtField = typeof i.debtAmount === 'number' && !isNaN(i.debtAmount);

    if (i.status === 'paid') {
      i.customerPaid = hasPaidField ? Math.min(Math.max(0, i.customerPaid), net) : net;
      i.debtAmount = 0;
    } else if (i.status === 'cancel') {
      i.debtAmount = 0;
      i.customerPaid = hasPaidField ? Math.min(Math.max(0, i.customerPaid), net) : 0;
    } else {
      // Hóa đơn "còn nợ": số nợ là nguồn sự thật chính. Chỉ suy ra nợ từ số tiền
      // đã trả khi bản ghi chưa có trường nợ — tránh việc hóa đơn nợ bị coi là đã
      // thu đủ (nợ = 0) rồi biến mất khỏi công nợ, không thu tiền được nữa.
      i.customerPaid = hasPaidField ? Math.min(Math.max(0, i.customerPaid), net) : 0;
      if (hasDebtField) i.debtAmount = Math.min(Math.max(0, i.debtAmount), net);
      else if (hasPaidField) i.debtAmount = Math.max(0, net - i.customerPaid);
      else i.debtAmount = net;
      if (i.debtAmount <= 0) i.status = 'paid';
    }
  });

  // Chuẩn hóa lịch sử kho
  data.stockMoves.forEach(m => {
    m.date = toIsoDate(m.date);
    m.qty = Number(m.qty) || 0;
    m.before = Number(m.before) || 0;
    m.after = Number(m.after) || 0;
    if (!STOCK_REASONS[m.type]) m.type = 'adjust';
    if (typeof m.reason !== 'string') m.reason = '';
    if (typeof m.refId !== 'string') m.refId = '';
    if (typeof m.refName !== 'string') m.refName = '';
    if (typeof m.by !== 'string') m.by = 'Quản lý';
  });

  // Đảm bảo bộ đếm ID luôn lớn hơn ID lớn nhất đang có (chống trùng mã)
  // Công nợ khách hàng luôn được suy ra từ chính các hóa đơn còn nợ, để số nợ hiển
  // thị, số thu được và số gỡ khi hủy hóa đơn luôn khớp nhau (tránh "nợ trên trời").
  reconcileCustomerDebt(data);

  data.nextCategoryId = Math.max(data.nextCategoryId || 0, maxNumericId(data.categories, 'DM-') + 1, 1);
  data.nextProductId = Math.max(data.nextProductId || 0, maxNumericId(data.products, 'SP-') + 1, 1);
  data.nextCustomerId = Math.max(data.nextCustomerId || 0, maxNumericId(data.customers, 'KH-') + 1, 1);
  data.nextInvoiceId = Math.max(data.nextInvoiceId || 0, maxNumericId(data.invoices, 'HD-') + 1, 1001);
  data.nextMoveId = Math.max(data.nextMoveId || 0, maxNumericId(data.stockMoves, '', 'id') + 1, 1);

  return data;
}

/* ===== Tìm số lớn nhất trong các mã dạng TIEN-TO + số ===== */
function maxNumericId(list, prefix, field) {
  let max = 0;
  (list || []).forEach(item => {
    const raw = field ? item[field] : item.id;
    if (raw == null) return;
    const str = String(raw).replace(prefix || '', '');
    const n = parseInt(str, 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max;
}

/* Công nợ của mỗi khách = tổng số nợ còn lại của tất cả hóa đơn chưa hủy mang tên
   khách đó. Nhờ vậy số nợ hiển thị, số tiền thu được và số nợ gỡ khi hủy hóa đơn
   luôn khớp nhau, kể cả khi dữ liệu mẫu hoặc dữ liệu cũ bị lệch. */
function reconcileCustomerDebt(data) {
  const debtByName = {};
  (data.invoices || []).forEach(i => {
    if (i.status === 'cancel') return;
    const d = Number(i.debtAmount) || 0;
    if (d <= 0) return;
    const key = String(i.customer || '').trim();
    if (!key) return;
    debtByName[key] = (debtByName[key] || 0) + d;
  });
  (data.customers || []).forEach(c => {
    c.debt = debtByName[String(c.name || '').trim()] || 0;
  });
}

/* ===== Lưu trữ LocalStorage ===== */
function loadDB() {
  const keys = [DB_KEY].concat(LEGACY_DB_KEYS);
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const normalized = normalizeDB(JSON.parse(raw));
      if (normalized) {
        try { localStorage.setItem(DB_KEY, JSON.stringify(normalized)); } catch (_) { }
        return normalized;
      }
    } catch (e) {
      console.warn('Lỗi đọc localStorage với khóa ' + key + ':', e);
    }
  }
  const initial = seedData();
  try { localStorage.setItem(DB_KEY, JSON.stringify(initial)); } catch (_) { }
  return initial;
}

/* ===== Dữ liệu toàn cục ===== */
// Khai báo DB trước khi nạp: tránh lỗi "Cannot access 'DB' before initialization"
// khi seedData() gọi tới các hàm tra cứu danh mục (findCat/catStep) ở lần chạy đầu tiên.
let DB = null;
DB = normalizeDB(loadDB()) || seedData();

/* ===== Hàm lưu dữ liệu: LocalStorage + SQLite qua WebView2 + đồng bộ Firebase ===== */
let savePending = false;
function saveDB(immediate) {
  try {
    normalizeDB(DB);
    const raw = JSON.stringify(DB);

    try { localStorage.setItem(DB_KEY, raw); } catch (_) { }

    // Gửi về C# để ghi xuống SQLite (gộp nhiều lần bấm liên tiếp thành 1 lần ghi)
    const push = () => {
      savePending = false;
      try {
        if (window.chrome && window.chrome.webview) {
          window.chrome.webview.postMessage(raw);
        }
      } catch (e) {
        console.error('Lỗi gửi dữ liệu xuống SQLite:', e);
      }
      // Đẩy lên Firebase (nếu đã bật đồng bộ). Lỗi mạng không làm hỏng app.
      try {
        if (typeof Storage !== 'undefined' && Storage.enabled()) Storage.push(DB);
      } catch (e) {
        console.warn('Đồng bộ Firebase thất bại:', e);
      }
    };

    if (immediate) {
      push();
    } else if (!savePending) {
      savePending = true;
      setTimeout(push, 120);
    }
  } catch (e) {
    console.error('Lỗi khi lưu DB:', e);
  }
}

/* ===== C# WebView2 gọi hàm này khi nạp xong dữ liệu từ SQLite ===== */
function applySavedData(data) {
  const normalized = normalizeDB(data);
  if (!normalized) return;

  // Chọn bản ghi có số hóa đơn nhiều hơn (dữ liệu mới hơn) để tránh SQLite cũ ghi đè
  // khi người dùng vừa thao tác xong mà tệp SQLite chưa kịp cập nhật.
  const localCount = (DB && Array.isArray(DB.invoices)) ? DB.invoices.length : 0;
  const remoteCount = normalized.invoices.length;
  if (remoteCount < localCount && localCount > 0) {
    console.warn('Bỏ qua dữ liệu cũ hơn từ SQLite (' + remoteCount + ' < ' + localCount + ' hóa đơn)');
    return;
  }

  DB = normalized;
  try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (_) { }

  if (typeof refreshCurrentView === 'function') {
    refreshCurrentView();
  }
}

/* ===== Nhận dữ liệu từ Firebase, cập nhật app mà không phát ngược trở lại ===== */
function applyCloudData(incoming) {
  const normalized = normalizeDB(incoming);
  if (!normalized) return;
  DB = normalized;
  try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (_) { }
  // Ghi xuống SQLite để lần mở sau vẫn còn (không đẩy lại lên cloud)
  try {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(JSON.stringify(DB));
    }
  } catch (_) { }
  if (typeof refreshCurrentView === 'function') refreshCurrentView();
}

/* ===== Đặt lại dữ liệu mẫu ===== */
function resetData() {
  if (!confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu hiện tại và nạp lại bộ dữ liệu mẫu?\n\nThao tác này không thể hoàn tác. Hãy sao lưu trước nếu cần.')) return;
  DB = normalizeDB(seedData());
  saveDB(true);
  if (typeof refreshCurrentView === 'function') refreshCurrentView();
  if (typeof toast === 'function') toast('Đã đặt lại dữ liệu mẫu');
}

/* ==========================================================================
   HELPERS TRA CỨU & XỬ LÝ DỮ LIỆU
   ========================================================================== */

const fmt = n => Math.round(Number(n) || 0).toLocaleString('vi-VN') + '₫';

function fmtShort(n) {
  n = Number(n) || 0;
  const abs = Math.abs(n);
  if (abs >= 1000000000) return (n / 1000000000).toFixed(abs % 1000000000 === 0 ? 0 : 2) + ' tỷ';
  if (abs >= 1000000) return (n / 1000000).toFixed(abs % 1000000 === 0 ? 0 : 1) + ' tr';
  if (abs >= 1000) return (n / 1000).toFixed(0) + ' k';
  return String(n);
}

function findP(id) {
  return (DB && DB.products ? DB.products : []).find(p => p.id === id);
}

function findCat(id) {
  return (DB && DB.categories ? DB.categories : []).find(c => c.id === id);
}

function catName(id) {
  const c = findCat(id);
  return c ? c.name : '—';
}

function catUnit(id) {
  const c = findCat(id);
  return c ? c.unit : '';
}

function catTypeLabel(id) {
  const c = findCat(id);
  return c ? ((CAT_TYPES[c.type] || { label: 'Số lượng' }).label) : '—';
}

function isDecimalUnit(catId) {
  const c = findCat(catId);
  return !!(c && c.type && c.type !== 'quantity');
}

function catStep(catId) {
  return isDecimalUnit(catId) ? 0.01 : 1;
}

function roundQty(v, step) {
  const f = step < 1 ? 100 : 1;
  return Math.round((Number(v) || 0) * f) / f;
}

function fmtQty(v) {
  v = Number(v) || 0;
  return Number.isInteger(v) ? v.toLocaleString('vi-VN') : v.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}

function qtyInputValue(v) {
  return String(roundQty(v, 0.01));
}

/* ===== Ngưỡng cảnh báo tồn kho lấy từ cài đặt cửa hàng ===== */
function lowStockThreshold() {
  const t = Number(getStoreSettings().lowStockThreshold);
  return (isNaN(t) || t < 0) ? 5 : t;
}

function stockStatus(s, minStock) {
  const threshold = (typeof minStock === 'number') ? minStock : lowStockThreshold();
  if ((Number(s) || 0) <= 0) return { cls: 'out', label: 'Hết hàng' };
  if ((Number(s) || 0) <= threshold) return { cls: 'low', label: 'Sắp hết' };
  return { cls: 'ok', label: 'Còn hàng' };
}

function todayStr() {
  return todayIso();
}

/* ===== Tính tiền hóa đơn ===== */
/* Lưu ý quan trọng: hàm tính tiền phải nhận được danh sách sản phẩm TƯỜNG MINH khi
   được gọi trong lúc chuẩn hóa dữ liệu. Lúc đó biến toàn cục DB vẫn còn null, nên nếu
   đọc qua findP() thì giá sẽ bằng 0 và mọi hóa đơn ghi nợ sẽ mất số nợ. */
function findProductIn(list, id) {
  return (list || []).find(p => p && p.id === id);
}

function invoiceTotal(items, productList) {
  const list = productList || (DB && DB.products ? DB.products : []);
  return (items || []).reduce((s, row) => {
    const p = findProductIn(list, row[0]);
    return s + (p ? p.price * row[1] : 0);
  }, 0);
}

/* ===== Chiết khấu theo TỪNG MÓN HÀNG ===== */
/* Mỗi dòng hóa đơn có dạng [id, qty, discPct] — discPct là % chiết khấu riêng của món
   (chỉ áp dụng cho đại lý). Dòng cũ [id, qty] được coi như discPct = 0. */
function itemDiscPct(row) {
  const pct = Number(row && row[2]);
  if (isNaN(pct) || pct <= 0) return 0;
  return pct > 100 ? 100 : pct;
}

/* Tiền chiết khấu của từng dòng (làm tròn từng dòng rồi mới cộng) */
function itemDiscAmount(row, productList) {
  const list = productList || (DB && DB.products ? DB.products : []);
  const p = findProductIn(list, row[0]);
  if (!p) return 0;
  const lineTotal = p.price * row[1];
  return Math.round((lineTotal * itemDiscPct(row)) / 100);
}

/* Tổng chiết khấu của cả hóa đơn = cộng chiết khấu từng món */
function invoiceItemsDiscount(items, productList) {
  return (items || []).reduce((s, row) => s + itemDiscAmount(row, productList), 0);
}

/* Tổng tiền hàng sau chiết khấu từng món (chưa trừ chiết khấu cấp hóa đơn cũ) */
function invoiceSubtotalAfterItemDisc(items, productList) {
  return Math.max(0, invoiceTotal(items, productList) - invoiceItemsDiscount(items, productList));
}

/* Lợi nhuận gộp = tổng (giá bán − giá vốn) theo số lượng. KHÔNG trừ chiết khấu ở đây. */
function invoiceProfit(items) {
  return (items || []).reduce((s, row) => {
    const p = findP(row[0]);
    return s + (p ? (p.price - p.cost) * row[1] : 0);
  }, 0);
}

/* Tổng chiết khấu hóa đơn = chiết khấu từng món (mới) + chiết khấu cấp hóa đơn (dữ liệu cũ).
   Với hóa đơn mới, discountAmt = 0 nên tổng này chính là tổng chiết khấu từng món. */
function invDisc(i) {
  const billLevel = Number(i.discountAmt) || 0;
  return invoiceItemsDiscount(i.items) + billLevel;
}

/* Doanh thu thuần = tổng tiền hàng − toàn bộ chiết khấu */
function invNet(i) {
  return Math.max(0, invoiceTotal(i.items) - invDisc(i));
}

/* Lợi nhuận thuần = lợi nhuận gộp − chiết khấu (chiết khấu chỉ bị trừ đúng 1 lần) */
function invProfitNet(i) {
  return invoiceProfit(i.items) - invDisc(i);
}

function invoiceItemsCount(items) {
  return (items || []).reduce((s, row) => s + row[1], 0);
}

/* ===== Phân tích chuỗi ngày thành Date object ===== */
function parseInvoiceDate(dStr) {
  const iso = toIsoDate(dStr);
  if (!iso) return null;
  const p = iso.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12, 0, 0);
}

/* ===== Kiểm tra hóa đơn có nằm trong khoảng ngày lọc hay không ===== */
function isInvoiceInDateRange(inv, start, end) {
  if (!start && !end) return true;
  const d = parseInvoiceDate(inv.date);
  if (!d) return true;
  const t = d.getTime();
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}

/* ===== Xóa dấu tiếng Việt để tìm kiếm không phân biệt dấu ===== */
function removeVietnameseTones(str) {
  if (!str) return '';
  str = String(str).toLowerCase().trim();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* ===== Đánh giá độ khớp tìm kiếm sản phẩm (số càng nhỏ càng ưu tiên) ===== */
function getProductSearchRank(p, qRaw, qNoTone, qClean) {
  if (!qRaw) return 0;

  const idRaw = (p.id || '').toLowerCase();
  const idClean = idRaw.replace(/[^a-z0-9]/g, '');
  const nameRaw = (p.name || '').toLowerCase();
  const nameNoTone = removeVietnameseTones(nameRaw);
  const brandRaw = (p.brand || '').toLowerCase();
  const brandNoTone = removeVietnameseTones(brandRaw);

  if (idRaw.startsWith(qRaw) || (qClean && idClean.startsWith(qClean))) return 1;
  if (nameRaw.startsWith(qRaw) || nameNoTone.startsWith(qNoTone)) return 2;

  const nameWords = nameRaw.split(/\s+/);
  const nameWordsNoTone = nameNoTone.split(/\s+/);
  if (nameWords.some(w => w.startsWith(qRaw)) || nameWordsNoTone.some(w => w.startsWith(qNoTone))) return 3;
  if (brandRaw.startsWith(qRaw) || brandNoTone.startsWith(qNoTone)) return 4;
  if (idRaw.includes(qRaw) || (qClean && idClean.includes(qClean))) return 5;
  if (nameRaw.includes(qRaw) || nameNoTone.includes(qNoTone)) return 6;
  if (brandRaw.includes(qRaw) || brandNoTone.includes(qNoTone)) return 7;

  const cat = findCat(p.cat);
  if (cat) {
    const catNameRaw = (cat.name || '').toLowerCase();
    const catNameNoTone = removeVietnameseTones(catNameRaw);
    if (catNameRaw.startsWith(qRaw) || catNameNoTone.startsWith(qNoTone)) return 8;
    if (catNameRaw.includes(qRaw) || catNameNoTone.includes(qNoTone)) return 9;
  }

  if (p.spec) {
    const specRaw = p.spec.toLowerCase();
    if (specRaw.includes(qRaw) || removeVietnameseTones(specRaw).includes(qNoTone)) return 10;
  }

  return 999;
}

/* ===== Đánh giá độ khớp tìm kiếm danh mục ===== */
function getCategorySearchRank(c, qRaw, qNoTone, qClean) {
  if (!qRaw) return 0;

  const idRaw = (c.id || '').toLowerCase();
  const idClean = idRaw.replace(/[^a-z0-9]/g, '');
  const nameRaw = (c.name || '').toLowerCase();
  const nameNoTone = removeVietnameseTones(nameRaw);

  if (idRaw.startsWith(qRaw) || (qClean && idClean.startsWith(qClean))) return 1;
  if (nameRaw.startsWith(qRaw) || nameNoTone.startsWith(qNoTone)) return 2;

  const nameWords = nameRaw.split(/\s+/);
  const nameWordsNoTone = nameNoTone.split(/\s+/);
  if (nameWords.some(w => w.startsWith(qRaw)) || nameWordsNoTone.some(w => w.startsWith(qNoTone))) return 3;
  if (idRaw.includes(qRaw) || (qClean && idClean.includes(qClean))) return 4;
  if (nameRaw.includes(qRaw) || nameNoTone.includes(qNoTone)) return 5;

  if (c.desc) {
    const descRaw = c.desc.toLowerCase();
    if (descRaw.includes(qRaw) || removeVietnameseTones(descRaw).includes(qNoTone)) return 6;
  }
  if (c.unit && (c.unit.toLowerCase().includes(qRaw) || removeVietnameseTones(c.unit).includes(qNoTone))) return 7;

  return 999;
}

/* ===== Validate số điện thoại: chỉ chữ số, đúng 10 ký tự, bắt đầu bằng 0 ===== */
function validatePhoneNumber(phone, isLiveTyping) {
  const str = (phone == null) ? '' : String(phone).trim();

  if (!str) {
    return { valid: false, code: 'EMPTY', error: 'Vui lòng nhập số điện thoại!' };
  }
  if (/\D/.test(str)) {
    return { valid: false, code: 'NON_DIGIT', error: 'Số điện thoại chỉ được chứa các chữ số (0-9)!' };
  }
  if (!str.startsWith('0')) {
    return { valid: false, code: 'NOT_ZERO_START', error: 'Số điện thoại phải bắt đầu bằng số 0!' };
  }
  if (str.length > 10) {
    return { valid: false, code: 'TOO_LONG', error: `Số điện thoại chỉ gồm tối đa 10 chữ số (đang có ${str.length} số)!` };
  }
  if (str.length < 10) {
    if (isLiveTyping) {
      return { valid: false, incomplete: true, code: 'INCOMPLETE', error: `Đang nhập: ${str.length}/10 số (cần đủ 10 số)` };
    }
    return { valid: false, code: 'TOO_SHORT', error: `Số điện thoại phải có đúng 10 chữ số (hiện có ${str.length} số)!` };
  }

  return { valid: true, error: '', code: 'OK' };
}

/* ===== Chuẩn hóa số điện thoại dạng chữ số (hỗ trợ cả đầu 84) ===== */
function normalizePhoneDigits(phone) {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }
  return digits;
}

/* ===== Tìm khách hàng theo Tên, SĐT hoặc Mã KH ===== */
function findCustomer(queryOrName) {
  if (!queryOrName) return null;
  const q = String(queryOrName).trim();
  if (!q || q.toLowerCase() === 'khách lẻ') return null;

  const qLower = q.toLowerCase();
  const qNorm = normalizePhoneDigits(q);
  const qNoTone = removeVietnameseTones(qLower);
  const customers = (DB && DB.customers) ? DB.customers : [];

  let found = customers.find(c => {
    const nameL = (c.name || '').toLowerCase();
    return nameL === qLower || removeVietnameseTones(nameL) === qNoTone;
  });
  if (found) return found;

  if (qNorm.length >= 3) {
    found = customers.find(c => {
      const pNorm = normalizePhoneDigits(c.phone);
      return pNorm === qNorm || (pNorm.length >= qNorm.length && (pNorm.startsWith(qNorm) || pNorm.endsWith(qNorm)));
    });
    if (found) return found;
  }

  found = customers.find(c => (c.id || '').toLowerCase() === qLower);
  return found || null;
}

function customerInfo(name) {
  const c = (DB && DB.customers) ? DB.customers.find(x => x.name === name) : null;
  return c ? { phone: c.phone || '', id: c.id } : { phone: '', id: '' };
}

function customerStats(c) {
  const invoices = (DB && DB.invoices) ? DB.invoices : [];
  const invs = invoices.filter(i => i.status !== 'cancel' && i.customer === c.name);
  return {
    count: invs.length,
    spend: invs.reduce((s, i) => s + invTotalPaid(i), 0),
    debt: (typeof c.debt === 'number') ? c.debt : 0
  };
}

/* ===== Số tiền khách đã trả thực tế của một hóa đơn ===== */
function invTotalPaid(i) {
  if (i.status === 'cancel') return 0;
  if (typeof i.customerPaid === 'number') return i.customerPaid;
  return i.status === 'paid' ? invNet(i) : 0;
}

function customerType(c) {
  return c.type === 'agent' ? { cls: 'purple', label: 'Đại lý' } : { cls: 'blue', label: 'Khách lẻ' };
}

/* ==========================================================================
   SỔ KHO — GHI NHẬN MỌI BIẾN ĐỘNG TỒN KHO
   ========================================================================== */

/* Ghi 1 dòng vào sổ kho và cập nhật tồn kho tương ứng.
   type: 'import' | 'sale' | 'return' | 'adjust'
   delta: số lượng thay đổi (dương = tăng kho, âm = giảm kho) */
function recordStockMove(productId, delta, type, opts) {
  const p = findP(productId);
  if (!p) return null;
  const o = opts || {};
  const step = catStep(p.cat);

  const before = roundQty(p.stock || 0, step);
  const after = roundQty(before + delta, step);
  if (after < 0) return null;

  p.stock = after;

  if (!Array.isArray(DB.stockMoves)) DB.stockMoves = [];
  const move = {
    id: DB.nextMoveId || (DB.stockMoves.length + 1),
    date: o.date || todayIso(),
    productId: productId,
    type: type,
    qty: roundQty(Math.abs(delta), step),
    before: before,
    after: after,
    reason: o.reason || '',
    refId: o.refId || '',
    refName: o.refName || '',
    unitCost: Number(o.unitCost) || 0,
    by: o.by || currentOperator(),
  };
  DB.nextMoveId = move.id + 1;
  DB.stockMoves.push(move);
  return move;
}

/* ==========================================================================
   ĐĂNG NHẬP ĐƠN GIẢN (1 cấp quyền quản lý)
   ========================================================================== */

function currentOperator() {
  try {
    const a = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
    return a.manager ? 'Quản lý' : 'Nhân viên';
  } catch (_) {
    return 'Nhân viên';
  }
}

function isManager() {
  try {
    return !!JSON.parse(localStorage.getItem(AUTH_KEY) || '{}').manager;
  } catch (_) {
    return false;
  }
}

function setManagerAuth(ok) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ manager: !!ok, at: new Date().toISOString() }));
  } catch (_) { }
}

function checkManagerPassword(pw) {
  return String(pw || '') === String(getStoreSettings().managerPassword || DEFAULT_MANAGER_PASSWORD);
}

/* ===== Đọc số tiền sang chữ (Tiếng Việt) ===== */
function numberToWords(n) {
  n = Math.floor(n || 0);
  if (n === 0) return "không đồng";
  const ones = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const units = ["", "nghìn", "triệu", "tỷ"];

  function read3(x) {
    let s = "";
    const h = Math.floor(x / 100), t = Math.floor((x % 100) / 10), u = x % 10;
    if (h > 0) s += ones[h] + " trăm";
    if (t === 0) {
      if (u > 0 && h > 0) s += " lẻ " + ones[u];
    } else if (t === 1) {
      if (s) s += " ";
      s += "mười";
      if (u === 5) s += " lăm";
      else if (u > 0) s += " " + ones[u];
    } else {
      if (s) s += " ";
      s += ones[t] + " mươi";
      if (u === 1) s += " mốt";
      else if (u === 5) s += " lăm";
      else if (u > 0) s += " " + ones[u];
    }
    if (h === 0 && t === 0 && u > 0) s = ones[u];
    return s.trim();
  }

  const parts = [];
  while (n > 0) {
    parts.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  let out = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    const v = parts[i];
    if (v === 0) continue;
    out += (out ? " " : "") + read3(v) + (i > 0 ? " " + units[i] : "");
  }
  return out.trim() + " đồng";
}

function capFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
