/* ==========================================================================
   MỤC 7 — ĐỒNG BỘ GIỮA MÁY TÍNH VÀ ĐIỆN THOẠI (pcsync.js)
   --------------------------------------------------------------------------
   File này CHỈ lo phần giao diện của mục "Cài đặt cửa hàng → 7. Đồng bộ":
     - Bảng chẩn đoán trạng thái (chấm màu, số liệu từng máy, lỗi, mã cửa hàng)
     - Ô nhập mã cửa hàng + gợi ý/hợp lệ hóa mã
     - Các nút: Kết nối, Gửi lên cloud, Lấy từ cloud, Tạo mã, Sao chép, Ngắt
     - Chỉ báo nhỏ trên thanh trên cùng (bấm vào là nhảy tới mục 7)

   TOÀN BỘ logic đồng bộ nằm ở js/cloud.js — dùng CHUNG với bản điện thoại.
   Ở đây không định nghĩa lại Storage / pushNow / pullNow.
   ========================================================================== */

/* Mã cửa hàng hợp lệ: chỉ chữ, số, gạch ngang, gạch dưới — ít nhất 3 ký tự */
function pcNormalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

function pcEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Mở mục Cài đặt cửa hàng để người dùng thấy phần đồng bộ (bấm chỉ báo trên topbar) */
function pcGoToSyncSettings() {
  if (typeof switchView === 'function') switchView('caidat');
  setTimeout(() => {
    const box = document.getElementById('pcSyncStatus');
    if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const inp = document.getElementById('setStoreCode');
    if (inp && !Storage.key()) { try { inp.focus(); } catch (_) { } }
  }, 120);
}

/* ==========================================================================
   CHỈ BÁO TRÊN THANH TRÊN CÙNG
   ========================================================================== */
function pcRenderTopbarSync() {
  const box = document.getElementById('syncIndicator');
  const dot = document.getElementById('syncDot');
  const txt = document.getElementById('syncText');
  if (!dot) return;

  const state = (typeof lastSyncState !== 'undefined') ? lastSyncState : 'off';
  const hasKey = (typeof Storage !== 'undefined') && !!Storage.key();

  dot.dataset.state = state;
  dot.classList.toggle('spin', state === 'syncing');

  const label = state === 'ok' ? 'Đã đồng bộ'
    : state === 'syncing' ? 'Đang kết nối'
      : state === 'error' ? 'Lỗi đồng bộ'
        : state === 'local' ? 'Chỉ lưu trên máy'
          : 'Chưa đồng bộ';

  if (txt) txt.textContent = hasKey ? label + ' · ' + Storage.key() : label;

  if (box) {
    box.dataset.state = state;
    box.title = state === 'ok'
      ? 'Dữ liệu đang được đồng bộ với điện thoại (mã ' + Storage.key() + '). Bấm để mở mục 7.'
      : state === 'error'
        ? 'Đồng bộ đang lỗi: ' + (lastSyncError || 'không rõ nguyên nhân') + '. Bấm để mở mục 7.'
        : state === 'syncing' ? 'Đang kết nối tới cloud... Bấm để mở mục 7.'
          : 'Chưa bật đồng bộ. Bấm để mở mục 7 trong Cài đặt cửa hàng.';
  }
}

/* ==========================================================================
   BẢNG CHẨN ĐOÁN TRONG MỤC 7
   ========================================================================== */
function pcRenderSyncStatus() {
  pcRenderTopbarSync();

  const el = document.getElementById('pcSyncStatus');
  if (!el) return;

  const inp = document.getElementById('setStoreCode');
  if (inp && !inp.value && typeof Storage !== 'undefined' && Storage.key()) {
    inp.value = Storage.key();
  }

  const devEl = document.getElementById('pcDeviceId');
  if (devEl) {
    const d = (typeof deviceId === 'function') ? deviceId() : '—';
    devEl.innerHTML = '<b style="font-family:ui-monospace,Consolas,monospace">' + pcEscape(d) + '</b>'
      + '<br><span style="color:var(--muted)">Mã riêng của máy tính này, dùng để phân biệt máy nào vừa sửa dữ liệu.</span>';
  }

  pcUpdateButtons();
  pcRenderGuide();

  const noFb = (typeof cloudConfigured !== 'function' || !cloudConfigured());
  if (noFb) {
    el.innerHTML = pcStateLine('off', 'Chưa cấu hình Firebase')
      + '<br><span style="color:var(--muted)">Dữ liệu chỉ lưu trên máy này. Xem file '
      + '<b>HUONG-DAN-FIREBASE.md</b> để bật đồng bộ.</span>';
    return;
  }
  if (typeof firebase === 'undefined') {
    el.innerHTML = pcStateLine('error', 'Không tải được thư viện Firebase')
      + '<br><span style="color:var(--muted)">Kiểm tra thư mục <b>wwwroot/lib/</b> có đủ 2 file '
      + '<b>firebase-app-compat.js</b> và <b>firebase-firestore-compat.js</b>, rồi mở lại app.</span>';
    return;
  }

  const state = (typeof lastSyncState !== 'undefined') ? lastSyncState : 'off';
  const code = (typeof Storage !== 'undefined') ? Storage.key() : null;

  const prodCount = (typeof DB !== 'undefined' && DB.products) ? DB.products.length : 0;
  const invCount = (typeof DB !== 'undefined' && DB.invoices) ? DB.invoices.length : 0;
  const custCount = (typeof DB !== 'undefined' && DB.customers) ? DB.customers.length : 0;

  const label = state === 'ok' ? 'Đã đồng bộ với cloud'
    : state === 'syncing' ? 'Đang kết nối...'
      : state === 'error' ? 'Đồng bộ đang lỗi'
        : 'Chưa kết nối';

  let html = pcStateLine(state, label);

  html += '<br>Trên máy này: <b>' + prodCount + '</b> sản phẩm, <b>' + invCount + '</b> hóa đơn, <b>'
    + custCount + '</b> khách hàng.';

  if (state === 'ok' && typeof lastCloudAt !== 'undefined' && lastCloudAt) {
    html += '<br>Lần đồng bộ gần nhất: <b>' + pcEscape(dateStamp()) + '</b>.';
  }

  if (state === 'error' && typeof lastSyncError !== 'undefined' && lastSyncError) {
    html += '<br><span style="color:var(--red)">Lỗi: <b>' + pcEscape(lastSyncError) + '</b></span>';
  }

  if (code) {
    html += '<br>Đang dùng mã cửa hàng: <b style="font-family:ui-monospace,Consolas,monospace;color:var(--brand);'
      + 'letter-spacing:1.5px">' + pcEscape(code) + '</b>';
    html += '<br><span style="color:var(--muted)">Trên điện thoại: mở app → Cài đặt → nhập ĐÚNG mã này → '
      + 'bấm Kết nối. Sai một ký tự là hai nơi không gặp được dữ liệu của nhau.</span>';
  } else {
    html += '<br><span style="color:var(--muted)">Chưa có mã cửa hàng. Nhập một mã khó đoán ở ô dưới '
      + '(hoặc bấm <b>🎲 Tạo mã ngẫu nhiên</b>) rồi bấm Kết nối.</span>';
  }

  el.innerHTML = html;
}

/* Một dòng trạng thái có chấm màu, dùng lại cho mọi nhánh */
function pcStateLine(state, label) {
  const color = state === 'ok' ? 'var(--teal)'
    : state === 'syncing' ? 'var(--amber)'
      : state === 'error' ? 'var(--red)' : 'var(--dim)';
  return '<span style="color:' + color + ';font-weight:700">● ' + pcEscape(label) + '</span>';
}

/* Khối hướng dẫn ghép máy lần đầu — đổi nội dung theo tình trạng thực tế */
function pcRenderGuide() {
  const el = document.getElementById('pcSyncGuide');
  if (!el) return;

  const hasKey = (typeof Storage !== 'undefined') && !!Storage.key();
  const state = (typeof lastSyncState !== 'undefined') ? lastSyncState : 'off';

  if (!hasKey) {
    el.innerHTML = '<b>Thứ tự ghép hai máy (làm đúng thứ tự để không mất dữ liệu):</b><br>'
      + '1. Ở máy tính này (máy đang có dữ liệu đầy đủ): nhập mã cửa hàng → bấm <b>🔗 Kết nối</b>.<br>'
      + '2. Bấm <b>⬆️ Gửi dữ liệu máy này lên cloud</b> — chờ tới khi hiện <b>Đã đồng bộ với cloud</b>.<br>'
      + '3. Sang điện thoại: nhập <b>đúng y hệt mã đó</b> → bấm Kết nối.<br>'
      + '<span style="color:var(--muted)">Nếu làm ngược lại (điện thoại trước) thì lúc cloud còn trống, '
      + 'điện thoại sẽ đẩy bộ dữ liệu rỗng của nó lên và ghi đè mất số liệu.</span>';
    return;
  }

  if (state === 'ok') {
    el.innerHTML = '<b>Đang đồng bộ hai chiều.</b> Mọi thay đổi trên máy tính hoặc điện thoại sẽ tự động '
      + 'hiện bên kia trong vài giây, không cần bấm gì.<br>'
      + '<span style="color:var(--muted)">Nếu nghi ngờ lệch số liệu: bấm <b>⬇️ Lấy dữ liệu mới nhất từ cloud</b> '
      + 'ở máy đang thiếu, hoặc <b>⬆️ Gửi dữ liệu máy này lên cloud</b> ở máy đang đúng nhất. '
      + 'Chỉ nên bấm Gửi ở MỘT máy — bấm Gửi ở máy có dữ liệu cũ hơn sẽ ghi đè số liệu mới.</span>';
    return;
  }

  if (state === 'syncing') {
    el.innerHTML = '<b>Đang kết nối tới cloud...</b> Chờ vài giây để chấm chuyển sang màu xanh. '
      + 'Nếu mãi không xanh, kiểm tra mạng internet của máy tính.';
    return;
  }

  el.innerHTML = '<b>Đã có mã cửa hàng nhưng chưa kết nối được.</b><br>'
    + '• Kiểm tra máy tính có mạng internet không.<br>'
    + '• Bấm <b>🔗 Kết nối</b> để thử lại.<br>'
    + '• Nếu điện thoại đã có dữ liệu mới hơn, bấm <b>⬇️ Lấy dữ liệu mới nhất từ cloud</b>.';
}

/* ==========================================================================
   Ô NHẬP MÃ — gợi ý & hợp lệ hóa ngay khi gõ
   ========================================================================== */
function pcCodeKeydown(ev) {
  if (ev && ev.key === 'Enter') { ev.preventDefault(); pcConnectStore(); }
}

function pcPreviewCodeInput(val) {
  const hint = document.getElementById('pcCodeHint');
  if (!hint) return;
  const code = pcNormalizeCode(val);
  const typed = String(val || '').trim();

  if (!typed) { hint.style.display = 'none'; return; }

  if (code !== typed.toUpperCase()) {
    hint.style.display = 'block';
    hint.innerHTML = 'Mã sẽ được chuẩn hóa thành: <b style="font-family:ui-monospace,Consolas,monospace">'
      + pcEscape(code) + '</b> <span style="color:var(--muted)">(chỉ giữ chữ, số, gạch ngang)</span>';
    return;
  }

  if (code.length < 3) {
    hint.style.display = 'block';
    hint.innerHTML = '<span style="color:var(--amber)">Mã cần ít nhất 3 ký tự — hiện có ' + code.length + '.</span>';
    return;
  }

  const current = (typeof Storage !== 'undefined') ? Storage.key() : null;
  hint.style.display = 'block';
  if (current && code === current) {
    hint.innerHTML = '<span style="color:var(--teal)">✓ Đây là mã cửa hàng máy tính đang dùng.</span>';
  } else if (current) {
    hint.innerHTML = '<span style="color:var(--amber)">Mã này KHÁC mã đang dùng ('
      + pcEscape(current) + '). Bấm Kết nối sẽ chuyển sang mã mới.</span>';
  } else {
    hint.innerHTML = '<span style="color:var(--teal)">✓ Mã hợp lệ. Bấm Kết nối để bắt đầu đồng bộ.</span>';
  }
}

/* ==========================================================================
   BẬT / TẮT NÚT THEO TÌNH TRẠNG — tránh bấm nhầm khi chưa kết nối
   ========================================================================== */
function pcUpdateButtons() {
  const hasKey = (typeof Storage !== 'undefined') && !!Storage.key();
  const state = (typeof lastSyncState !== 'undefined') ? lastSyncState : 'off';
  const busy = state === 'syncing';
  const online = hasKey && state !== 'off' && state !== 'local';

  const set = (id, on, why) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = !on;
    b.style.opacity = on ? '' : '.5';
    b.style.cursor = on ? '' : 'not-allowed';
    if (why) b.title = on ? '' : why;
  };

  set('pcBtnPush', !busy && online, 'Hãy bấm Kết nối trước');
  set('pcBtnPull', !busy && online, 'Hãy bấm Kết nối trước');
  set('pcBtnCopy', !!hasKey, 'Chưa có mã cửa hàng');
  set('pcBtnDisconnect', online, 'Máy tính chưa kết nối cloud');
  set('pcBtnConnect', !busy, '');
}

/* ==========================================================================
   CÁC HÀNH ĐỘNG
   ========================================================================== */

/* Tạo mã ngẫu nhiên dạng CUA-HANG-XXXX */
function pcGenerateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tail = '';
  for (let i = 0; i < 5; i++) tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  const code = 'CUA-HANG-' + tail;

  const inp = document.getElementById('setStoreCode');
  if (inp) { inp.value = code; pcPreviewCodeInput(code); }
  toast('Đã tạo mã: ' + code + ' — bấm Kết nối để dùng');
}

/* Sao chép mã cửa hàng để dán sang điện thoại */
async function pcCopyCode() {
  const code = (typeof Storage !== 'undefined') ? Storage.key() : null;
  if (!code) { toast('Chưa có mã cửa hàng để sao chép'); return; }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
    } else {
      const ta = document.createElement('textarea');
      ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    toast('✓ Đã sao chép mã: ' + code);
  } catch (e) {
    toast('Không sao chép được — mã là: ' + code);
  }
}

/* Kết nối theo mã cửa hàng */
function pcConnectStore() {
  const inp = document.getElementById('setStoreCode');
  const raw = ((inp && inp.value) || '').trim();

  if (!raw) { toast('Vui lòng nhập mã cửa hàng'); if (inp) inp.focus(); return; }
  if (typeof cloudConfigured !== 'function' || !cloudConfigured()) {
    toast('Chưa điền cấu hình Firebase — xem file HUONG-DAN-FIREBASE.md'); return;
  }
  if (typeof firebase === 'undefined') { toast('Không tải được thư viện Firebase'); return; }

  const code = pcNormalizeCode(raw);
  if (code.length < 3) { toast('Mã cửa hàng phải có ít nhất 3 ký tự (chữ, số, -)'); if (inp) inp.focus(); return; }

  const current = (typeof Storage !== 'undefined') ? Storage.key() : null;
  if (current && current === code) {
    toast('Máy tính đang dùng đúng mã này rồi');
    startCloudSync(code);
    pcRenderSyncStatus();
    return;
  }

  if (!confirm('Kết nối tới cửa hàng "' + code + '"?\n\n'
    + 'Máy tính và điện thoại gõ cùng mã này sẽ dùng chung một bộ dữ liệu.\n'
    + 'Nếu cloud đã có dữ liệu của mã này, máy tính sẽ lấy dữ liệu đó về.')) return;

  const ok = startCloudSync(code);
  if (inp) inp.value = code;
  pcRenderSyncStatus();
  if (!ok) { toast('Không kết nối được — kiểm tra mạng và cấu hình Firebase'); return; }

  toast('✓ Đã kết nối mã ' + code);
  // Đẩy dữ liệu máy này lên để chắc chắn cloud có dữ liệu (nếu cloud đang trống)
  setTimeout(() => { pcPushNow(); }, 700);
}

function pcDisconnectStore() {
  if (typeof Storage === 'undefined' || !Storage.key()) { toast('Máy tính chưa kết nối cloud'); return; }
  if (!confirm('Ngắt kết nối cloud?\n\nDữ liệu vẫn còn nguyên trên máy này, nhưng sẽ KHÔNG đồng bộ '
    + 'sang điện thoại nữa.')) return;

  stopCloudSync();
  Storage.setKey(null);
  setSyncState('local');
  pcRenderSyncStatus();
  toast('Đã ngắt kết nối cloud — dữ liệu vẫn an toàn trên máy này');
}

async function pcPushNow() {
  const btn = document.getElementById('pcBtnPush');
  if (btn) btn.disabled = true;
  try {
    if (typeof pushNow === 'function') await pushNow();
  } finally {
    pcRenderSyncStatus();
  }
}

async function pcPullNow() {
  const btn = document.getElementById('pcBtnPull');
  if (btn) btn.disabled = true;
  try {
    if (typeof pullNow === 'function') await pullNow();
  } finally {
    pcRenderSyncStatus();
  }
}

/* ==========================================================================
   TỰ ĐỘNG CẬP NHẬT MỤC 7 KHI TRẠNG THÁI ĐỔI
   cloud.js chỉ gọi được setSyncState + renderStorageStatus (tên dùng chung
   với bản điện thoại). Ở đây bọc lại để mục 7 tự vẽ lại, không phải sửa cloud.js.
   ========================================================================== */
(function pcHookSyncStatus() {
  function install() {
    if (typeof setSyncState !== 'function' || setSyncState.__pcHooked) return false;

    const originalSetSyncState = setSyncState;
    const wrapped = function (state) {
      originalSetSyncState.apply(this, arguments);
      try { pcRenderSyncStatus(); } catch (_) { }
    };
    wrapped.__pcHooked = true;
    setSyncState = wrapped;

    if (typeof renderStorageStatus !== 'function') {
      window.renderStorageStatus = function () { try { pcRenderSyncStatus(); } catch (_) { } };
      window.renderStorageStatus.__pcHooked = true;
    }
    return true;
  }

  if (!install()) {
    // cloud.js có thể nạp sau pcsync.js — thử lại vài nhịp rồi thôi
    let tries = 0;
    const t = setInterval(() => {
      if (install() || ++tries > 40) clearInterval(t);
    }, 50);
  }
})();
