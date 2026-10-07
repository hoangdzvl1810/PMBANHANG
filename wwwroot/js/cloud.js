/* ==========================================================================
   TẦNG ĐỒNG BỘ ĐÁM MÂY — FIREBASE FIRESTORE (js/cloud.js)
   --------------------------------------------------------------------------
   Ứng dụng CHẠY ĐƯỢC NGAY khi chưa cấu hình Firebase (chế độ chỉ trên máy).
   Điền FIREBASE_CONFIG bên dưới là đồng bộ thời gian thực hoạt động lập tức,
   giữa mọi thiết bị (máy tính, điện thoại), KHÔNG phải sửa phần còn lại.

   Cách hoạt động:
     - Mỗi cửa hàng = 1 mã riêng (mã cửa hàng). Dữ liệu lưu ở
       collection "stores", document = mã cửa hàng.
     - Máy nào lưu thì đẩy lên Firestore; máy khác nghe onSnapshot nên
       nhận được NGAY, không cần chờ.
     - Nếu Firestore chưa có dữ liệu cho mã đó thì đẩy dữ liệu hiện tại lên.
   ========================================================================== */

/* 1️⃣  CẤU HÌNH FIREBASE
   Lấy tại: https://console.firebase.google.com
   → Project settings (⚙) → Your apps → Web (</>) → Config
   (Xem hướng dẫn chi tiết trong file HUONG-DAN-FIREBASE.md) */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBZ6szSW0UHXRYioIhXOg5nwz39JMo-lqg",
  authDomain: "cua-hang-cua-toi.firebaseapp.com",
  projectId: "cua-hang-cua-toi",
  storageBucket: "cua-hang-cua-toi.firebasestorage.app",
  messagingSenderId: "607380674182",
  appId: "1:607380674182:web:af42de442bcc6b2aa3a307",
};

const STORE_COLLECTION = 'stores';

let fbApp = null;
let fbDb = null;
let fbDoc = null;
let fbUnsubscribe = null;
let fbReady = false;
let fbApplying = false;
let lastCloudWrite = 0;
let lastSyncState = 'off';
let lastSyncError = '';
let lastCloudAt = 0;
let lastPushOk = false;
let fbConnected = false;
let initialDone = false;
let lastPushedRaw = '';

/* Giờ ghi lên server (được Firestore điền tự động khi gửi lên cloud) */
function serverTimestamp() {
  try {
    const fs = fbDb || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
    return fs.FieldValue.serverTimestamp();
  } catch (e) {
    return new Date();
  }
}

/* ===== Đã điền cấu hình Firebase chưa? ===== */
function cloudConfigured() {
  return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

/* ===== Khởi tạo Firebase an toàn (không làm app chết nếu lỗi/offline) ===== */
function cloudInit() {
  if (!cloudConfigured()) return false;
  if (fbReady) return true;
  if (typeof firebase === 'undefined') return false;
  try {
    if (!firebase.apps || !firebase.apps.length) {
      fbApp = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      fbApp = firebase.app();
    }
    fbDb = firebase.firestore();
    fbReady = true;
    return true;
  } catch (e) {
    console.warn('Không khởi tạo được Firebase:', e);
    return false;
  }
}

/* ==========================================================================
   Storage — lớp đồng bộ thật (Firestore)
   ========================================================================== */
const Storage = {
  _key: null,

  /* Mã cửa hàng: gõ giống nhau trên máy tính và điện thoại là thấy chung dữ liệu */
  setKey(code) {
    this._key = code || null;
    try {
      if (code) localStorage.setItem('pmbanhang_store_code', code);
      else localStorage.removeItem('pmbanhang_store_code');
    } catch (_) { }
  },

  key() {
    if (this._key) return this._key;
    try { this._key = localStorage.getItem('pmbanhang_store_code'); } catch (_) { }
    return this._key;
  },

  enabled() {
    return !!(fbReady && this.key());
  },

  /* Đẩy toàn bộ dữ liệu hiện tại lên Firestore */
  async push(db) {
    if (!this.enabled() || fbApplying) return false;
    try {
      lastCloudWrite = Date.now();
      const raw = JSON.stringify(db);
      const payload = {
        rawJson: raw,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId(),
      };
      await fbDoc.set(payload);
      lastPushedRaw = raw;
      lastPushOk = true;
      lastCloudAt = Date.now();
      lastSyncError = '';
      setSyncState('ok');
      return true;
    } catch (e) {
      lastPushOk = false;
      lastSyncError = (e && e.message) ? e.message : String(e);
      console.warn('Đẩy dữ liệu lên Firebase thất bại:', e);
      setSyncState('error');
      return false;
    }
  },

  /* Tải dữ liệu mới nhất từ Firestore về (dùng khi cần kéo thủ công) */
  async pull() {
    if (!this.enabled()) return false;
    try {
      const snap = await fbDoc.get();
      if (!snap.exists) {
        await this.push(typeof DB !== 'undefined' ? DB : null);
        return false;
      }
      const data = snap.data() || {};
      if (!data.rawJson) return false;
      applyRemote(data.rawJson);
      lastCloudAt = Date.now();
      lastSyncError = '';
      setSyncState('ok');
      return true;
    } catch (e) {
      lastSyncError = (e && e.message) ? e.message : String(e);
      console.warn('Tải dữ liệu từ Firebase thất bại:', e);
      setSyncState('error');
      return false;
    }
  },
};

/* Nhận dữ liệu từ cloud, cập nhật app mà không phát ngược trở lại */
function applyRemote(rawJson) {
  try {
    const incoming = normalizeDB(JSON.parse(rawJson));
    if (!incoming) return;
    fbApplying = true;
    // Bản PC có thêm bước ghi xuống SQLite (applyCloudData lo việc đó)
    if (typeof applyCloudData === 'function') {
      applyCloudData(incoming);
    } else {
      DB = incoming;
      try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (_) { }
      if (typeof refreshCurrentView === 'function') refreshCurrentView();
    }
    if (typeof applyAuthUI === 'function') applyAuthUI();
    fbApplying = false;
  } catch (e) {
    fbApplying = false;
    console.warn('Dữ liệu cloud không hợp lệ:', e);
  }
}

/* Mã thiết bị: chỉ để biết máy nào vừa sửa */
function deviceId() {
  try {
    let d = localStorage.getItem('pmbanhang_device_id');
    if (!d) {
      d = 'dev-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('pmbanhang_device_id', d);
    }
    return d;
  } catch (_) { return 'dev-unknown'; }
}

/* Giờ dạng chuỗi để hiển thị cho người dùng biết lần đồng bộ gần nhất */
function dateStamp() {
  try {
    return new Date().toLocaleString('vi-VN');
  } catch (_) { return String(Date.now()); }
}

/* ===== Bắt đầu đồng bộ thời gian thực cho một mã cửa hàng ===== */
function startCloudSync(code) {
  if (!cloudInit()) { setSyncState('local'); return false; }

  if (code) Storage.setKey(code);
  const key = Storage.key();
  if (!key) { setSyncState('local'); return false; }

  // Ngắt kết nối cũ (nếu đổi mã cửa hàng)
  stopCloudSync();

  try {
    fbDoc = fbDb.collection(STORE_COLLECTION).doc(key);
    fbConnected = false;
    lastSyncError = '';

    // Lắng nghe thay đổi TỨC THỜI từ cloud
    fbUnsubscribe = fbDoc.onSnapshot(snap => {
      fbConnected = true;
      lastCloudAt = Date.now();

      // Bỏ qua thay đổi do chính máy này vừa ghi (tránh giật giao diện)
      if (snap.metadata && snap.metadata.hasPendingWrites) return;

      if (snap.exists) {
        const data = snap.data() || {};
        if (!data.rawJson) return;
        // Bỏ qua đúng bản ghi của chính máy này (so theo mã thiết bị, KHÔNG so đồng hồ
        // vì đồng hồ máy và đồng hồ máy chủ Google lệch nhau sẽ làm mất đồng bộ âm thầm).
        if (data.updatedBy && data.updatedBy === deviceId()) return;
        if (data.rawJson === lastPushedRaw) return;
        applyRemote(data.rawJson);
        setSyncState('ok');
      } else if (!initialDone) {
        // Cloud chưa có dữ liệu cho mã này -> đẩy dữ liệu hiện tại lên
        Storage.push(typeof DB !== 'undefined' ? DB : null);
      }
    }, err => {
      fbConnected = false;
      lastSyncError = (err && err.message) ? err.message : String(err);
      console.warn('Mất kết nối Firestore:', err);
      setSyncState('error');
    });

    setSyncState('syncing');

    // Đọc cloud MỘT LẦN ngay khi kết nối, để quyết định rõ ràng:
    //  - cloud đã có dữ liệu  -> lấy về máy này
    //  - cloud còn trống       -> đẩy dữ liệu máy này lên
    // (Không phụ thuộc vào việc onSnapshot có bắn callback đầu tiên hay không.)
    initialDone = false;
    fbDoc.get().then(snap => {
      initialDone = true;
      if (snap && snap.exists) {
        const data = snap.data() || {};
        if (data.rawJson && data.rawJson !== lastPushedRaw) applyRemote(data.rawJson);
      } else {
        Storage.push(typeof DB !== 'undefined' ? DB : null);
      }
      setSyncState('ok');
      if (typeof renderStorageStatus === 'function') renderStorageStatus();
    }).catch(e => {
      initialDone = true;
      lastSyncError = (e && e.message) ? e.message : String(e);
      console.warn('Không đọc được dữ liệu cloud:', e);
      setSyncState('error');
    });

    return true;
  } catch (e) {
    lastSyncError = (e && e.message) ? e.message : String(e);
    console.warn('Không mở được đồng bộ Firebase:', e);
    setSyncState('error');
    return false;
  }
}

function stopCloudSync() {
  if (fbUnsubscribe) {
    try { fbUnsubscribe(); } catch (_) { }
    fbUnsubscribe = null;
  }
  fbDoc = null;
  fbConnected = false;
}

/* ===== Gửi dữ liệu máy này LÊN cloud ngay (nút bấm thủ công) ===== */
async function pushNow() {
  if (!cloudConfigured()) { toast('Chưa cấu hình Firebase'); return false; }
  if (!Storage.key()) { toast('Chưa có mã cửa hàng — nhập mã rồi bấm Kết nối'); return false; }
  if (!cloudInit()) { toast('Không khởi tạo được Firebase — kiểm tra mạng'); return false; }
  if (!fbDoc) { toast('Chưa kết nối — bấm Kết nối trước'); return false; }
  const ok = await Storage.push(DB);
  if (ok) toast('✓ Đã gửi dữ liệu máy này lên cloud');
  else toast('Gửi thất bại: ' + (lastSyncError || 'không rõ nguyên nhân'));
  if (typeof renderStorageStatus === 'function') renderStorageStatus();
  return ok;
}

/* ===== Kéo dữ liệu MỚI NHẤT từ cloud về máy này ===== */
async function pullNow() {
  if (!cloudConfigured()) { toast('Chưa cấu hình Firebase'); return false; }
  if (!Storage.key()) { toast('Chưa có mã cửa hàng'); return false; }
  if (!cloudInit()) { toast('Không khởi tạo được Firebase — kiểm tra mạng'); return false; }
  if (!fbDoc) { toast('Chưa kết nối — bấm Kết nối trước'); return false; }
  const ok = await Storage.pull();
  if (ok) toast('✓ Đã lấy dữ liệu mới nhất từ cloud');
  else toast('Cloud chưa có dữ liệu cho mã này — bấm "Gửi lên cloud" trước');
  if (typeof renderStorageStatus === 'function') renderStorageStatus();
  return ok;
}

/* ===== Chỉ báo đồng bộ trên thanh trên cùng ===== */
function setSyncState(state) {
  lastSyncState = state;
  const el = document.getElementById('syncDot');
  if (!el) return;
  el.dataset.state = state;
  el.classList.toggle('spin', state === 'syncing');
  el.title = state === 'syncing' ? 'Đang kết nối đồng bộ...'
    : state === 'ok' ? 'Đã đồng bộ với cloud'
      : state === 'error' ? 'Đồng bộ lỗi — kiểm tra mạng/cấu hình'
        : state === 'local' ? 'Chỉ lưu trên máy này (chưa bật đồng bộ)'
          : 'Chưa bật đồng bộ';
}

/* Giữ tương thích với phần còn lại của app */
function startAutoSync() { /* Firestore tự đẩy/nhận tức thời, không cần hẹn giờ */ }
function stopAutoSync() { stopCloudSync(); }

/* ===== Khởi động đồng bộ khi mở app =====
   Chỉ chạy khi đã điền FIREBASE_CONFIG và đã có mã cửa hàng.
   Nếu chưa cấu hình thì app vẫn chạy bình thường (SQLite / localStorage trên máy). */
function startCloudIfConfigured() {
  if (!cloudConfigured()) { setSyncState('local'); return false; }
  if (typeof firebase === 'undefined') { setSyncState('local'); return false; }
  try {
    if (!Storage.key()) { setSyncState('local'); return false; }
    return startCloudSync();
  } catch (e) {
    console.warn('Không khởi động được đồng bộ Firebase:', e);
    setSyncState('local');
    return false;
  }
}

/* Đồng bộ lại khi có mạng trở lại */
window.addEventListener('online', () => {
  if (Storage.enabled()) Storage.pull();
});
