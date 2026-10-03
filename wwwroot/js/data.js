/* ==========================================================================
   PMBANHANG - DATA LAYER (data.js)
   Quản lý cấu trúc dữ liệu, seedData, lưu/đọc LocalStorage & SQLite C#
   ========================================================================== */

const DB_KEY = 'warehouse_db_v2';

const CAT_TYPES = {
  quantity: { label: 'Số lượng', units: ['cái', 'chiếc', 'bộ', 'hộp', 'thùng'] },
  weight: { label: 'Cân nặng', units: ['kg', 'gam', 'tấn', 'yến'] },
  length: { label: 'Độ dài', units: ['m', 'cm', 'mm', 'cuộn'] },
  area: { label: 'Diện tích', units: ['m²', 'cm²'] },
  volume: { label: 'Thể tích', units: ['lít', 'ml', 'm³'] },
};

/* ===== Thông tin cửa hàng (dùng trên hóa đơn và chứng từ) ===== */
const STORE = {
  name: "CỬA HÀNG ĐIỆN GIA DỤNG",
  address: "123 Đường Lê Lợi, P. Bến Thành, Q.1, TP.HCM",
  phone: "0987 654 321 - 0912 345 678",
  desc: "CHUYÊN: ĐỒ ĐIỆN GIA DỤNG - THIẾT BỊ NHÀ BẾP\nTỦ LẠNH - MÁY GIẶT - ĐIỀU HÒA - TIVI\nTƯ VẤN LẮP ĐẶT - BẢO HÀNH TẬN NƠI",
};

/* ===== Dữ liệu ban đầu (Seed Data) ===== */
function seedData() {
  return {
    categories: [
      { id: "DM-01", name: "Tủ lạnh", type: "quantity", unit: "cái", desc: "Tủ lạnh các loại" },
      { id: "DM-02", name: "Máy giặt", type: "quantity", unit: "cái", desc: "Máy giặt cửa ngang/đứng" },
      { id: "DM-03", name: "Điều hòa", type: "quantity", unit: "bộ", desc: "Điều hòa nhiệt độ" },
      { id: "DM-04", name: "Tivi", type: "quantity", unit: "cái", desc: "Tivi các kích cỡ" },
      { id: "DM-05", name: "Gia dụng nhỏ", type: "quantity", unit: "cái", desc: "Đồ gia dụng nhỏ" },
      { id: "DM-06", name: "Bếp & Nồi", type: "quantity", unit: "cái", desc: "Thiết bị nhà bếp" },
      { id: "DM-07", name: "Dây điện", type: "length", unit: "m", desc: "Dây điện bán theo mét" },
      { id: "DM-08", name: "Gạo & Ngũ cốc", type: "weight", unit: "kg", desc: "Bán theo cân nặng" },
    ],
    products: [
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
      { id: "GN-003", name: "Quạt điện Kangaroo", cat: "DM-05", brand: "Kangaroo", cost: 480000, price: 720000, stock: 0, spec: "" },
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
    ],
    invoices: [
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
    ],
    customers: [
      { id: "KH-01", name: "Nguyễn Văn An", phone: "0912 345 678", type: "retail" },
      { id: "KH-02", name: "Trần Thị Bình", phone: "0987 654 321", type: "retail" },
      { id: "KH-03", name: "Lê Hoàng Cường", phone: "0903 111 222", type: "retail" },
      { id: "KH-04", name: "Phạm Thu Dung", phone: "0938 999 000", type: "retail" },
      { id: "KH-05", name: "Đại lý Hải Đăng", phone: "0918 222 333", type: "agent" },
      { id: "KH-06", name: "Vũ Thị Lan", phone: "0977 444 555", type: "retail" },
      { id: "KH-07", name: "Đại lý Minh Phát", phone: "0966 777 888", type: "agent" },
      { id: "KH-08", name: "Ngô Thị Mai", phone: "0908 123 456", type: "retail" },
    ],
    nextInvoiceId: 1015,
    nextCustomerId: 9,
    nextProductId: 28,
    nextCategoryId: 9,
  };
}

/* ===== Quản lý lưu trữ SQLite & LocalStorage ===== */
function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Lỗi đọc từ localStorage, dùng seedData:', e);
  }
  return seedData();
}

// 1. Cấu hình Firebase từ dự án của bạn
const firebaseConfig = {
  apiKey: "AIzaSyCiFZhOlPkFXbrBNjYAxXt76KhtGtPQh-0",
  authDomain: "kho-ban-hang.firebaseapp.com",
  projectId: "kho-ban-hang",
  storageBucket: "kho-ban-hang.firebasestorage.app",
  messagingSenderId: "138484453740",
  appId: "1:138484453740:web:080f25b670f47d205da349"
};

// Khởi tạo Firebase & Firestore
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const docRef = db.collection('app_data').doc('main_store');

// 2. Nạp dữ liệu ban đầu từ LocalStorage trước để giao diện hiện lên ngay lập tức
let DB = loadDB();

// 3. Lắng nghe thay đổi thời gian thực (REAL-TIME) từ Cloud
// Bất cứ khi nào máy tính hoặc điện thoại đổi dữ liệu, hàm này sẽ TỰ KÍCH HOẠT tức thì
docRef.onSnapshot((doc) => {
  if (doc.exists) {
    DB = doc.data();
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    switchView(currentView); // Tự động cập nhật lại màn hình đang xem
  } else {
    // Nếu trên Cloud chưa có dữ liệu, đẩy dữ liệu hiện tại lên Cloud
    docRef.set(DB);
  }
}, (error) => {
  console.error("Lỗi kết nối Firestore:", error);
});

// 4. Hàm lưu dữ liệu: Đồng thời lưu LocalStorage, gửi về C# và đẩy lên Cloud
function saveDB() {
  try {
    const raw = JSON.stringify(DB);
    localStorage.setItem(DB_KEY, raw);

    // Gửi dữ liệu về C# WinForms (nếu đang chạy app desktop)
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(raw);
    }

    // Đẩy dữ liệu lên Firebase Firestore để đồng bộ sang điện thoại / máy khác
    docRef.set(DB).catch((err) => {
      console.error('Lỗi khi đẩy dữ liệu lên Firestore:', err);
    });
  } catch (e) {
    console.error('Lỗi khi lưu DB:', e);
  }
}

// C# WebView2 gọi hàm này khi nạp xong dữ liệu từ SQLite
function applySavedData(data) {
  if (data) {
    DB = data;
    // Đồng bộ ngược vào localStorage để lần load sau luôn có dữ liệu mới nhất
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(DB));
    } catch (e) {
      console.warn('Không thể lưu vào localStorage:', e);
    }
    if (typeof switchView === 'function' && typeof currentView !== 'undefined') {
      switchView(currentView);
    }
  }
}

function resetData() {
  if (confirm('Bạn có chắc chắn muốn đặt lại dữ liệu mẫu ban đầu? Toàn bộ thay đổi chưa sao lưu sẽ được làm mới.')) {
    DB = seedData();
    saveDB();
    if (typeof switchView === 'function' && typeof currentView !== 'undefined') {
      switchView(currentView);
    }
    if (typeof toast === 'function') {
      toast('Đã đặt lại dữ liệu mẫu');
    }
  }
}

/* ==========================================================================
   HELPERS TRA CỨU & XỬ LÝ DỮ LIỆU
   ========================================================================== */

const fmt = n => Math.round(n || 0).toLocaleString('vi-VN') + '₫';

function findP(id) {
  return DB.products.find(p => p.id === id);
}

function findCat(id) {
  return DB.categories.find(c => c.id === id);
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
  return c ? (CAT_TYPES[c.type] || { label: 'Khác' }).label : '—';
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
  return Math.round(v * f) / f;
}

function fmtQty(v) {
  return Number.isInteger(v) ? v.toLocaleString('vi-VN') : v.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}

function qtyInputValue(v) {
  v = roundQty(v, 0.01);
  return String(v);
}

function stockStatus(s) {
  if (s <= 0) return { cls: 'out', label: 'Hết hàng' };
  if (s <= 5) return { cls: 'low', label: 'Sắp hết' };
  return { cls: 'ok', label: 'Còn hàng' };
}

const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

function invoiceTotal(items) {
  return items.reduce((s, [id, q]) => {
    const p = findP(id);
    return s + (p ? p.price * q : 0);
  }, 0);
}

function invoiceProfit(items) {
  return items.reduce((s, [id, q]) => {
    const p = findP(id);
    return s + (p ? (p.price - p.cost) * q : 0);
  }, 0);
}

function invDisc(i) {
  return i.discountAmt || 0;
}

function invNet(i) {
  return invoiceTotal(i.items) - invDisc(i);
}

function invProfitNet(i) {
  return invoiceProfit(i.items) - invDisc(i);
}

function invoiceItemsCount(items) {
  return items.reduce((s, [, q]) => s + q, 0);
}

/* ===== Phân tích chuỗi ngày DD/MM/YYYY hoặc YYYY-MM-DD thành Date object ===== */
function parseInvoiceDate(dStr) {
  if (!dStr) return null;
  dStr = String(dStr).trim();
  if (dStr.includes('/')) {
    const parts = dStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      return new Date(y, m, d, 12, 0, 0);
    }
  } else if (dStr.includes('-')) {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d, 12, 0, 0);
    }
  }
  return new Date(dStr);
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

/* ===== Đánh giá độ khớp tìm kiếm sản phẩm (Số càng nhỏ ưu tiên càng cao) ===== */
function getProductSearchRank(p, qRaw, qNoTone, qClean) {
  if (!qRaw) return 0;

  const idRaw = (p.id || '').toLowerCase();
  const idClean = idRaw.replace(/[^a-z0-9]/g, '');
  const nameRaw = (p.name || '').toLowerCase();
  const nameNoTone = removeVietnameseTones(nameRaw);
  const brandRaw = (p.brand || '').toLowerCase();
  const brandNoTone = removeVietnameseTones(brandRaw);

  // 1. Mã sản phẩm BẮT ĐẦU bằng từ khóa (Ví dụ gõ TL, TL-001...)
  if (idRaw.startsWith(qRaw) || (qClean && idClean.startsWith(qClean))) return 1;

  // 2. Tên sản phẩm BẮT ĐẦU bằng từ khóa (Ví dụ gõ Tu, Tủ lạnh...)
  if (nameRaw.startsWith(qRaw) || nameNoTone.startsWith(qNoTone)) return 2;

  // 3. Có từ nào trong tên sản phẩm BẮT ĐẦU bằng từ khóa (Ví dụ gõ Pana -> Tủ lạnh Panasonic)
  const nameWords = nameRaw.split(/\s+/);
  const nameWordsNoTone = nameNoTone.split(/\s+/);
  if (nameWords.some(w => w.startsWith(qRaw)) || nameWordsNoTone.some(w => w.startsWith(qNoTone))) return 3;

  // 4. Thương hiệu BẮT ĐẦU bằng từ khóa
  if (brandRaw.startsWith(qRaw) || brandNoTone.startsWith(qNoTone)) return 4;

  // 5. Mã sản phẩm CHỨA từ khóa (Ví dụ gõ 001, 002...)
  if (idRaw.includes(qRaw) || (qClean && idClean.includes(qClean))) return 5;

  // 6. Tên sản phẩm CHỨA từ khóa
  if (nameRaw.includes(qRaw) || nameNoTone.includes(qNoTone)) return 6;

  // 7. Thương hiệu CHỨA từ khóa
  if (brandRaw.includes(qRaw) || brandNoTone.includes(qNoTone)) return 7;

  // 8. Tên danh mục của sản phẩm chứa từ khóa
  const cat = typeof findCat === 'function' ? findCat(p.cat) : null;
  if (cat) {
    const catNameRaw = (cat.name || '').toLowerCase();
    const catNameNoTone = removeVietnameseTones(catNameRaw);
    if (catNameRaw.startsWith(qRaw) || catNameNoTone.startsWith(qNoTone)) return 8;
    if (catNameRaw.includes(qRaw) || catNameNoTone.includes(qNoTone)) return 9;
  }

  // 9. Quy cách sản phẩm chứa từ khóa
  if (p.spec) {
    const specRaw = p.spec.toLowerCase();
    if (specRaw.includes(qRaw) || removeVietnameseTones(specRaw).includes(qNoTone)) return 10;
  }

  return 999; // Không khớp
}

/* ===== Đánh giá độ khớp tìm kiếm danh mục (Số càng nhỏ ưu tiên càng cao) ===== */
function getCategorySearchRank(c, qRaw, qNoTone, qClean) {
  if (!qRaw) return 0;

  const idRaw = (c.id || '').toLowerCase();
  const idClean = idRaw.replace(/[^a-z0-9]/g, '');
  const nameRaw = (c.name || '').toLowerCase();
  const nameNoTone = removeVietnameseTones(nameRaw);

  // 1. Mã danh mục BẮT ĐẦU bằng từ khóa (Ví dụ gõ DM, DM-01...)
  if (idRaw.startsWith(qRaw) || (qClean && idClean.startsWith(qClean))) return 1;

  // 2. Tên danh mục BẮT ĐẦU bằng từ khóa (Ví dụ gõ Dien, Điện lạnh...)
  if (nameRaw.startsWith(qRaw) || nameNoTone.startsWith(qNoTone)) return 2;

  // 3. Có từ nào trong tên danh mục BẮT ĐẦU bằng từ khóa (Ví dụ gõ bep -> Gia dụng nhà bếp)
  const nameWords = nameRaw.split(/\s+/);
  const nameWordsNoTone = nameNoTone.split(/\s+/);
  if (nameWords.some(w => w.startsWith(qRaw)) || nameWordsNoTone.some(w => w.startsWith(qNoTone))) return 3;

  // 4. Mã danh mục CHỨA từ khóa (Ví dụ gõ 01, 02...)
  if (idRaw.includes(qRaw) || (qClean && idClean.includes(qClean))) return 4;

  // 5. Tên danh mục CHỨA từ khóa
  if (nameRaw.includes(qRaw) || nameNoTone.includes(qNoTone)) return 5;

  // 6. Mô tả, Đơn vị tính hoặc Kiểu danh mục chứa từ khóa
  if (c.desc) {
    const descRaw = c.desc.toLowerCase();
    if (descRaw.includes(qRaw) || removeVietnameseTones(descRaw).includes(qNoTone)) return 6;
  }
  if (c.unit && (c.unit.toLowerCase().includes(qRaw) || removeVietnameseTones(c.unit).includes(qNoTone))) return 7;

  return 999; // Không khớp
}

/* ===== Validate Số Điện Thoại Theo Đúng Yêu Cầu =====
 * - Chuỗi chỉ gồm các chữ số (0-9)
 * - Độ dài đúng 10 kí tự
 * - Bắt đầu bằng số 0
 * - Báo lỗi chi tiết:
 *   + Chứa ký tự không phải số -> 'Số điện thoại chỉ được chứa các chữ số (0-9)!'
 *   + Không bắt đầu bằng số 0 -> 'Số điện thoại phải bắt đầu bằng số 0!'
 *   + Quá 10 chữ số -> 'Số điện thoại chỉ gồm tối đa 10 chữ số!'
 *   + Thiếu chữ số (khi xác nhận/submit) -> 'Số điện thoại phải có đúng 10 chữ số!'
 */
function validatePhoneNumber(phone, isLiveTyping = false) {
  if (phone == null) phone = '';
  const str = String(phone).trim();

  if (!str) {
    return {
      valid: false,
      code: 'EMPTY',
      error: 'Vui lòng nhập số điện thoại!'
    };
  }

  // 1. Chứa các kí tự không phải là số (kể cả khoảng trắng, chữ cái, ký hiệu)
  if (/\D/.test(str)) {
    return {
      valid: false,
      code: 'NON_DIGIT',
      error: 'Số điện thoại chỉ được chứa các chữ số (0-9)!'
    };
  }

  // 2. Bắt đầu không phải là số 0
  if (!str.startsWith('0')) {
    return {
      valid: false,
      code: 'NOT_ZERO_START',
      error: 'Số điện thoại phải bắt đầu bằng số 0!'
    };
  }

  // 3. Quá 10 kí tự
  if (str.length > 10) {
    return {
      valid: false,
      code: 'TOO_LONG',
      error: `Số điện thoại chỉ gồm tối đa 10 chữ số (đang có ${str.length} số)!`
    };
  }

  // 4. Nếu đang gõ mà chưa đủ 10 số
  if (isLiveTyping) {
    if (str.length < 10) {
      return {
        valid: false,
        incomplete: true,
        code: 'INCOMPLETE',
        error: `Đang nhập: ${str.length}/10 số (cần đủ 10 số)`
      };
    }
  } else {
    // Khi xác nhận/submit/blur mà chưa đủ 10 số
    if (str.length < 10) {
      return {
        valid: false,
        code: 'TOO_SHORT',
        error: `Số điện thoại phải có đúng 10 chữ số (hiện có ${str.length} số)!`
      };
    }
  }

  return { valid: true, error: '', code: 'OK' };
}

/* ===== Chuẩn hóa số điện thoại dạng chữ số (hỗ trợ cả đầu 84 và 0) ===== */
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
  const qLower = q.toLowerCase();
  const qNorm = normalizePhoneDigits(q);
  const qNoTone = removeVietnameseTones(qLower);

  // 1. Tìm chính xác theo tên (có dấu hoặc không dấu)
  let found = DB.customers.find(c => {
    const nameL = c.name.toLowerCase();
    return nameL === qLower || removeVietnameseTones(nameL) === qNoTone;
  });
  if (found) return found;

  // 2. Tìm theo số điện thoại (nếu có số)
  if (qNorm.length >= 3) {
    found = DB.customers.find(c => {
      const pNorm = normalizePhoneDigits(c.phone);
      return pNorm === qNorm || (pNorm.length >= qNorm.length && (pNorm.startsWith(qNorm) || pNorm.endsWith(qNorm)));
    });
    if (found) return found;
  }

  // 3. Tìm theo mã KH (KH-01,...)
  found = DB.customers.find(c => c.id.toLowerCase() === qLower);
  return found || null;
}

function findCustomerByName(name) {
  return findCustomer(name);
}

function customerInfo(name) {
  const c = DB.customers.find(x => x.name === name);
  return c ? { phone: c.phone || '', address: '' } : { phone: '', address: '' };
}

function customerStats(c) {
  const invs = DB.invoices.filter(i => i.status !== 'cancel' && i.customer === c.name);
  return {
    count: invs.length,
    spend: invs.reduce((s, i) => s + invoiceTotal(i.items), 0)
  };
}

function customerType(c) {
  return c.type === 'agent' ? { cls: 'purple', label: 'Đại lý' } : { cls: 'blue', label: 'Khách lẻ' };
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
