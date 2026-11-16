/**
 * E-RAPOR SD (KURIKULUM MERDEKA) - BACKEND GOOGLE APPS SCRIPT
 * API Router, Authentication, LockService, and Batch Handlers
 */

// Helper hash SHA-256 dengan salt
function hashPassword(password, salt) {
  var raw = password + ':' + salt;
  var signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < signature.length; i++) {
    var byteVal = signature[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hex += byteHex;
  }
  return hex;
}

// Endpoint Utama doPost
function doPost(e) {
  var output;
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action;
    var token = body.token;
    var payload = body.payload || {};

    var res = handleAction(action, token, payload);
    output = ContentService.createTextOutput(JSON.stringify({ ok: true, data: res }));
  } catch (err) {
    output = ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err.message || 'Terjadi kesalahan pada server Google Apps Script.'
    }));
  }
  return output.setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    message: 'API E-Rapor SD Kurikulum Merdeka aktif. Gunakan method POST.'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Validasi Token Sesi dari CacheService
function validateSession(token) {
  if (!token) throw new Error('Akses ditolak: Token autentikasi tidak ditemukan.');
  var cache = CacheService.getScriptCache();
  var sessionData = cache.get('session_' + token);
  if (!sessionData) {
    throw new Error('Sesi berakhir. Silakan masuk lagi.');
  }
  return JSON.parse(sessionData);
}

// Helper Inisialisasi Akun & Pengaturan jika belum ada
function ensureAkunDanPengaturanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sheet akun
  var sheetAkun = ss.getSheetByName('akun');
  if (!sheetAkun) {
    sheetAkun = ss.insertSheet('akun');
    var akunHeaders = [
      'id', 'peran', 'username', 'kelas', 'nama', 'nip', 'hash', 'salt', 'aktif',
      'wajib_ganti_sandi', 'terakhir_masuk', 'created_at', 'updated_at'
    ];
    sheetAkun.appendRow(akunHeaders);
    sheetAkun.setFrozenRows(1);
    sheetAkun.getRange(1, 1, 1, akunHeaders.length).setFontWeight('bold').setBackground('#e2e8f0');

    // Buat akun admin default
    var adminSalt = Utilities.getUuid();
    var adminHash = hashPassword('admin123', adminSalt);
    var nowIso = new Date().toISOString();
    sheetAkun.appendRow([
      'akun_admin', 'admin', 'admin', '', 'Administrator Sekolah', '', adminHash, adminSalt,
      true, true, '', nowIso, nowIso
    ]);

    // Buat akun default wali kelas I - VI
    var defaultGurus = [
      { tingkat: 'I', nama: 'SITI NURJANAH, S.Pd', nip: '198501012010012001' },
      { tingkat: 'II', nama: 'AHMAD FAUZI, S.Pd', nip: '198802022011011002' },
      { tingkat: 'III', nama: 'SRI WAHYUNI, S.Pd', nip: '199003032014022003' },
      { tingkat: 'IV', nama: 'BAMBANG HERMANTO, S.Pd', nip: '199204042017011004' },
      { tingkat: 'V', nama: 'DEWI KARTIKA, S.Pd', nip: '199405052020022005' },
      { tingkat: 'VI', nama: 'ADNAN BAHAR, S.Pd', nip: '199601262023211006' }
    ];

    for (var g = 0; g < defaultGurus.length; g++) {
      var itemG = defaultGurus[g];
      var gSalt = Utilities.getUuid();
      var gHash = hashPassword('guru' + (g + 1), gSalt);
      sheetAkun.appendRow([
        'akun_k_' + itemG.tingkat, 'guru', '', itemG.tingkat, itemG.nama, itemG.nip,
        gHash, gSalt, true, false, '', nowIso, nowIso
      ]);
    }
    try {
      sheetAkun.hideSheet();
    } catch(e) {}
  }

  // 2. Sheet pengaturan
  var sheetPengaturan = ss.getSheetByName('pengaturan');
  if (!sheetPengaturan) {
    sheetPengaturan = ss.insertSheet('pengaturan');
    sheetPengaturan.appendRow(['kunci', 'nilai']);
    sheetPengaturan.setFrozenRows(1);
    sheetPengaturan.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#e2e8f0');
    sheetPengaturan.appendRow(['tahun_ajaran_aktif', '2025/2026']);
    sheetPengaturan.appendRow(['semester_aktif', '1']);
  }
}

// Router Action
function handleAction(action, token, payload) {
  // Aksi publik tanpa token
  if (action === 'daftarKelasLogin') {
    return handleDaftarKelasLogin();
  }
  if (action === 'loginGuru') {
    return handleLoginGuru(payload);
  }
  if (action === 'loginAdmin') {
    return handleLoginAdmin(payload);
  }
  if (action === 'login') {
    return handleLogin(payload);
  }

  // Semua aksi selain login wajib token valid
  var session = validateSession(token);

  // Jika mode hanya_lihat aktif, tolak semua aksi tulis
  var mutatingActions = [
    'upsert', 'upsertMany', 'delete', 'importSiswa', 'copySemester',
    'saveTema', 'reorderTema', 'deleteTema', 'copyTema', 'savePenilaianKoku',
    'saveKaih', 'copyKaih', 'migrateKaihPeriode',
    'pindahRombelSiswa', 'tambahRombel', 'toggleRombelAktif', 'kunciTpLmPerTingkat', 'salinTemaKeRombelLain', 'migrateKeRombel'
  ];
  if (session.hanya_lihat && mutatingActions.indexOf(action) !== -1) {
    throw new Error('Mode lihat saja — data pada semester ini tidak bisa diubah.');
  }

  // Validasi peran guru (guru hanya boleh menulis/membaca rombelnya sendiri)
  if (session.peran === 'guru' && payload && payload.kelas_id && payload.kelas_id !== session.kelasId) {
    throw new Error('Akses ditolak: Anda hanya dapat mengakses kelas Anda sendiri.');
  }

  switch (action) {
    case 'logout':
      return handleLogout(token);
    case 'gantiSandi':
    case 'changePassword':
      return handleGantiSandi(session, payload);
    case 'resetSandiGuru':
      return handleResetSandiGuru(session, payload);
    case 'simpanAkunGuru':
      return handleSimpanAkunGuru(session, payload);
    case 'listAkunGuru':
      return handleListAkunGuru(session);
    case 'simpanPengaturan':
      return handleSimpanPengaturan(session, payload);
    case 'getAll':
      return handleGetAll(payload.kelas_id || session.kelasId);
    case 'upsert':
      return handleUpsert(payload.sheetName, payload.item, payload.keyFields);
    case 'upsertMany':
      return handleUpsertMany(payload.sheetName, payload.items, payload.keyFields, payload.kelas_id);
    case 'delete':
      return handleDelete(payload.sheetName, payload.id, payload.keyField);
    case 'importSiswa':
      return handleImportSiswa(payload.kelas_id, payload.siswaList);
    case 'copySemester':
      return handleCopySemester(payload.sourceKelasId, payload.targetKelasId);
    case 'exportRekap':
      return handleExportRekap(payload.rekapRows);
    case 'listTema':
      return handleListTema(payload.kelas_id || session.kelasId);
    case 'saveTema':
      return handleSaveTema(payload);
    case 'reorderTema':
      return handleReorderTema(payload.kelas_id || session.kelasId, payload.ids);
    case 'deleteTema':
      return handleDeleteTema(payload.id);
    case 'copyTema':
      return handleCopyTema(payload.dari_kelas_id, payload.ke_kelas_id || session.kelasId);
    case 'listPenilaianKoku':
      return handleListPenilaianKoku(payload.kelas_id || session.kelasId);
    case 'savePenilaianKoku':
      return handleSavePenilaianKoku(payload.rows);
    case 'listKaih':
      return handleListKaih(payload);
    case 'saveKaih':
      return handleSaveKaih(payload);
    case 'copyKaih':
      return handleCopyKaih(payload);
    case 'listKaihPeriode':
      return handleListKaihPeriode(payload);
    case 'migrateKaihPeriode':
      return migrateKaihPeriode();
    case 'pindahRombelSiswa':
      return handlePindahRombelSiswa(payload);
    case 'tambahRombel':
      return handleTambahRombel(payload);
    case 'toggleRombelAktif':
      return handleToggleRombelAktif(payload);
    case 'kunciTpLmPerTingkat':
      return handleKunciTpLmPerTingkat(payload);
    case 'salinTemaKeRombelLain':
      return handleSalinTemaKeRombelLain(payload);
    case 'migrateKeRombel':
      return migrateKeRombel();
    default:
      throw new Error('Aksi tidak dikenali: ' + action);
  }
}

// 1. DAFTAR KELAS LOGIN (Publik)
function handleDaftarKelasLogin() {
  ensureAkunDanPengaturanSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Baca pengaturan
  var sheetP = ss.getSheetByName('pengaturan');
  var pData = getSheetDataAsObjects(sheetP);
  var pMap = {};
  for (var i = 0; i < pData.length; i++) {
    pMap[pData[i].kunci] = pData[i].nilai;
  }
  var taAktif = pMap['tahun_ajaran_aktif'] || '2025/2026';
  var semAktif = parseInt(pMap['semester_aktif'] || '1', 10);

  // Baca akun guru
  var sheetA = ss.getSheetByName('akun');
  var aData = getSheetDataAsObjects(sheetA);

  // Baca rombel
  var sheetR = ss.getSheetByName('rombel');
  var rData = sheetR ? getSheetDataAsObjects(sheetR) : [];
  if (rData.length === 0) {
    setupDatabase();
    seedData();
    sheetR = ss.getSheetByName('rombel');
    rData = sheetR ? getSheetDataAsObjects(sheetR) : [];
  }

  var rombelList = [];
  for (var r = 0; r < rData.length; r++) {
    var rb = rData[r];
    var acc = null;
    for (var a = 0; a < aData.length; a++) {
      if (aData[a].peran === 'guru' && (aData[a].rombel_id === rb.id || aData[a].kelas === rb.nama)) {
        acc = aData[a];
        break;
      }
    }
    var tNum = parseInt(rb.tingkat || rb.nama.replace(/\D/g, '') || '1', 10);
    var fase = tNum <= 2 ? 'A' : tNum <= 4 ? 'B' : 'C';
    var isAktif = (rb.aktif === true || String(rb.aktif).toUpperCase() === 'TRUE');
    rombelList.push({
      id: rb.id,
      nama: rb.nama,
      tingkat: tNum,
      huruf: rb.huruf,
      fase: fase,
      nama_wali: acc ? (acc.nama || rb.nama_wali || '') : (rb.nama_wali || ''),
      nip_wali: acc ? (acc.nip || rb.nip_wali || '') : (rb.nip_wali || ''),
      ada_akun: !!acc,
      aktif: isAktif
    });
  }

  var kelasList = rombelList.map(function(item) {
    return {
      kelas: item.nama,
      nama_wali: item.nama_wali,
      aktif: item.aktif,
      fase: item.fase
    };
  });

  var semesters = [
    { tahun: '2024/2025', semester: 1, label: '2024/2025 Ganjil' },
    { tahun: '2024/2025', semester: 2, label: '2024/2025 Genap' },
    { tahun: '2025/2026', semester: 1, label: '2025/2026 Ganjil' },
    { tahun: '2025/2026', semester: 2, label: '2025/2026 Genap' },
    { tahun: '2026/2027', semester: 1, label: '2026/2027 Ganjil' },
    { tahun: '2026/2027', semester: 2, label: '2026/2027 Genap' }
  ];

  for (var s = 0; s < semesters.length; s++) {
    semesters[s].aktif = (semesters[s].tahun === taAktif && semesters[s].semester === semAktif);
  }

  return {
    rombel: rombelList,
    kelasList: kelasList,
    tahunAjaranAktif: taAktif,
    semesterAktif: semAktif,
    daftarSemester: semesters
  };
}

// 2. LOGIN GURU (Publik)
function handleLoginGuru(payload) {
  var targetKey = String(payload.rombel_id || payload.rombel || payload.kelas || '').trim();
  var password = payload.password;
  var tahunAjaran = payload.tahun_ajaran;
  var semester = parseInt(payload.semester || '1', 10);

  if (!targetKey) throw new Error('Pilih rombel yang Anda ampu.');
  if (!password) throw new Error('Kata sandi harus diisi.');

  var cache = CacheService.getScriptCache();
  var rateKey = 'fail_guru_' + targetKey;
  var failCount = parseInt(cache.get(rateKey) || '0', 10);
  if (failCount >= 5) {
    throw new Error('Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  }

  ensureAkunDanPengaturanSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAkun = ss.getSheetByName('akun');
  var aData = getSheetDataAsObjects(sheetAkun);

  var acc = null;
  var rowIndex = -1;
  for (var i = 0; i < aData.length; i++) {
    if (aData[i].peran === 'guru' && (aData[i].rombel_id === targetKey || aData[i].kelas === targetKey || (aData[i].id && aData[i].id === 'akun_' + targetKey))) {
      acc = aData[i];
      rowIndex = i + 2; // +2 for header and 1-based index
      break;
    }
  }

  var isAktif = acc && (acc.aktif === true || String(acc.aktif).toUpperCase() === 'TRUE');
  if (!acc || !isAktif) {
    cache.put(rateKey, (failCount + 1).toString(), 900);
    throw new Error('Kata sandi salah.');
  }

  var testHash = hashPassword(password, acc.salt);
  if (testHash !== acc.hash) {
    cache.put(rateKey, (failCount + 1).toString(), 900);
    throw new Error('Kata sandi salah.');
  }

  cache.remove(rateKey);

  // Update terakhir masuk
  var nowIso = new Date().toISOString();
  sheetAkun.getRange(rowIndex, 11).setValue(nowIso);

  // Ambil data pengaturan
  var sheetP = ss.getSheetByName('pengaturan');
  var pData = getSheetDataAsObjects(sheetP);
  var pMap = {};
  for (var p = 0; p < pData.length; p++) {
    pMap[pData[p].kunci] = pData[p].nilai;
  }
  var taAktif = pMap['tahun_ajaran_aktif'] || '2025/2026';
  var semAktif = parseInt(pMap['semester_aktif'] || '1', 10);

  var isReadOnly = (tahunAjaran !== taAktif || semester !== semAktif);

  // Dapatkan rombel info dari sheet rombel
  var sheetR = ss.getSheetByName('rombel');
  var rombelRows = sheetR ? getSheetDataAsObjects(sheetR) : [];
  var foundRombel = null;
  for (var r = 0; r < rombelRows.length; r++) {
    if (rombelRows[r].id === targetKey || rombelRows[r].nama.toUpperCase() === targetKey.toUpperCase()) {
      foundRombel = rombelRows[r];
      break;
    }
  }

  var tingkatAngka = foundRombel ? parseInt(foundRombel.tingkat, 10) : (parseInt(targetKey.replace(/\D/g, ''), 10) || 1);
  var huruf = foundRombel ? foundRombel.huruf : (targetKey.replace(/\d/g, '').toUpperCase() || 'A');
  var rombelNama = foundRombel ? foundRombel.nama : (tingkatAngka + huruf);
  var rombelId = foundRombel ? foundRombel.id : ('rombel_' + tingkatAngka + huruf.toLowerCase());
  var fase = tingkatAngka <= 2 ? 'A' : tingkatAngka <= 4 ? 'B' : 'C';

  var token = Utilities.getUuid();
  var sessionObj = {
    token: token,
    peran: 'guru',
    rombelId: rombelId,
    rombelNama: rombelNama,
    tingkatAngka: tingkatAngka,
    huruf: huruf,
    kelas: rombelNama,
    kelasId: rombelId,
    namaWali: acc.nama || (foundRombel ? foundRombel.nama_wali : 'Wali Kelas'),
    nipWali: acc.nip || (foundRombel ? foundRombel.nip_wali : ''),
    tahunAjaran: tahunAjaran,
    semester: semester,
    fase: fase,
    hanya_lihat: isReadOnly,
    wajib_ganti_sandi: (acc.wajib_ganti_sandi === true || String(acc.wajib_ganti_sandi).toUpperCase() === 'TRUE'),
    loginAt: nowIso
  };

  cache.put('session_' + token, JSON.stringify(sessionObj), 28800); // 8 jam

  return {
    token: token,
    session: sessionObj,
    wajib_ganti_sandi: sessionObj.wajib_ganti_sandi
  };
}

// 3. LOGIN ADMIN (Publik)
function handleLoginAdmin(payload) {
  var username = (payload.username || '').trim();
  var password = payload.password;

  if (!username) throw new Error('Nama pengguna harus diisi.');
  if (!password) throw new Error('Kata sandi harus diisi.');

  var cache = CacheService.getScriptCache();
  var rateKey = 'fail_admin_' + username.toLowerCase();
  var failCount = parseInt(cache.get(rateKey) || '0', 10);
  if (failCount >= 5) {
    throw new Error('Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  }

  ensureAkunDanPengaturanSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAkun = ss.getSheetByName('akun');
  var aData = getSheetDataAsObjects(sheetAkun);

  var acc = null;
  var rowIndex = -1;
  for (var i = 0; i < aData.length; i++) {
    if (aData[i].peran === 'admin' && String(aData[i].username).toLowerCase() === username.toLowerCase()) {
      acc = aData[i];
      rowIndex = i + 2;
      break;
    }
  }

  var isAktif = acc && (acc.aktif === true || String(acc.aktif).toUpperCase() === 'TRUE');
  if (!acc || !isAktif) {
    cache.put(rateKey, (failCount + 1).toString(), 900);
    throw new Error('Kata sandi salah.');
  }

  var testHash = hashPassword(password, acc.salt);
  if (testHash !== acc.hash) {
    cache.put(rateKey, (failCount + 1).toString(), 900);
    throw new Error('Kata sandi salah.');
  }

  cache.remove(rateKey);

  var nowIso = new Date().toISOString();
  sheetAkun.getRange(rowIndex, 11).setValue(nowIso);

  var sheetP = ss.getSheetByName('pengaturan');
  var pData = getSheetDataAsObjects(sheetP);
  var pMap = {};
  for (var p = 0; p < pData.length; p++) {
    pMap[pData[p].kunci] = pData[p].nilai;
  }
  var taAktif = pMap['tahun_ajaran_aktif'] || '2025/2026';
  var semAktif = parseInt(pMap['semester_aktif'] || '1', 10);

  var token = Utilities.getUuid();
  var sessionObj = {
    token: token,
    peran: 'admin',
    username: acc.username,
    namaWali: acc.nama || 'Administrator',
    tahunAjaran: taAktif,
    semester: semAktif,
    hanya_lihat: false,
    wajib_ganti_sandi: (acc.wajib_ganti_sandi === true || String(acc.wajib_ganti_sandi).toUpperCase() === 'TRUE'),
    loginAt: nowIso
  };

  cache.put('session_' + token, JSON.stringify(sessionObj), 28800); // 8 jam

  return {
    token: token,
    session: sessionObj,
    wajib_ganti_sandi: sessionObj.wajib_ganti_sandi
  };
}

// 4. GANTI SANDI SENDIRI
function handleGantiSandi(session, payload) {
  var oldPassword = payload.oldPassword;
  var newPassword = payload.newPassword;

  if (!newPassword || newPassword.length < 8) {
    throw new Error('Kata sandi baru minimal 8 karakter.');
  }

  ensureAkunDanPengaturanSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAkun = ss.getSheetByName('akun');
  var aData = getSheetDataAsObjects(sheetAkun);

  var acc = null;
  var rowIndex = -1;
  for (var i = 0; i < aData.length; i++) {
    if (session.peran === 'admin' && aData[i].peran === 'admin') {
      acc = aData[i];
      rowIndex = i + 2;
      break;
    } else if (session.peran === 'guru' && aData[i].peran === 'guru' && aData[i].kelas === session.kelas) {
      acc = aData[i];
      rowIndex = i + 2;
      break;
    }
  }

  if (!acc) throw new Error('Akun pengguna tidak ditemukan.');

  var oldHash = hashPassword(oldPassword, acc.salt);
  if (oldHash !== acc.hash) {
    throw new Error('Kata sandi lama tidak cocok.');
  }

  var newSalt = Utilities.getUuid();
  var newHash = hashPassword(newPassword, newSalt);
  var nowIso = new Date().toISOString();

  sheetAkun.getRange(rowIndex, 7).setValue(newHash); // hash
  sheetAkun.getRange(rowIndex, 8).setValue(newSalt); // salt
  sheetAkun.getRange(rowIndex, 10).setValue(false);   // wajib_ganti_sandi = FALSE
  sheetAkun.getRange(rowIndex, 13).setValue(nowIso);  // updated_at

  return { success: true, message: 'Kata sandi berhasil diperbarui.' };
}

// 5. ADMIN: RESET SANDI GURU
function handleResetSandiGuru(session, payload) {
  if (session.peran !== 'admin') throw new Error('Hanya admin yang dapat mengatur ulang kata sandi guru.');
  var kelas = payload.kelas;
  if (!kelas) throw new Error('Pilih kelas yang akan direset sandinya.');

  ensureAkunDanPengaturanSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAkun = ss.getSheetByName('akun');
  var aData = getSheetDataAsObjects(sheetAkun);

  var rowIndex = -1;
  for (var i = 0; i < aData.length; i++) {
    if (aData[i].peran === 'guru' && aData[i].kelas === kelas) {
      rowIndex = i + 2;
      break;
    }
  }

  if (rowIndex === -1) throw new Error('Akun kelas ' + kelas + ' tidak ditemukan.');

  var randomSuffix = Math.floor(1000 + Math.random() * 9000);
  var tempPassword = 'guru' + kelas.toLowerCase() + randomSuffix;
  var newSalt = Utilities.getUuid();
  var newHash = hashPassword(tempPassword, newSalt);
  var nowIso = new Date().toISOString();

  sheetAkun.getRange(rowIndex, 7).setValue(newHash);
  sheetAkun.getRange(rowIndex, 8).setValue(newSalt);
  sheetAkun.getRange(rowIndex, 10).setValue(true); // wajib_ganti_sandi = TRUE
  sheetAkun.getRange(rowIndex, 13).setValue(nowIso);

  return { ok: true, tempPassword: tempPassword };
}

// 6. ADMIN: SIMPAN AKUN GURU
function handleSimpanAkunGuru(session, payload) {
  if (session.peran !== 'admin') throw new Error('Hanya admin yang dapat mengelola akun guru.');
  var kelas = payload.kelas;
  var nama = (payload.nama || '').trim();
  var nip = (payload.nip || '').trim();
  var aktif = payload.aktif !== false;

  if (!kelas) throw new Error('Kelas wajib ditentukan.');
  if (!nama) throw new Error('Nama wali kelas wajib diisi.');

  ensureAkunDanPengaturanSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAkun = ss.getSheetByName('akun');
  var aData = getSheetDataAsObjects(sheetAkun);

  var rowIndex = -1;
  for (var i = 0; i < aData.length; i++) {
    if (aData[i].peran === 'guru' && aData[i].kelas === kelas) {
      rowIndex = i + 2;
      break;
    }
  }

  var nowIso = new Date().toISOString();
  if (rowIndex >= 2) {
    sheetAkun.getRange(rowIndex, 5).setValue(nama);
    sheetAkun.getRange(rowIndex, 6).setValue(nip);
    sheetAkun.getRange(rowIndex, 9).setValue(aktif);
    sheetAkun.getRange(rowIndex, 13).setValue(nowIso);
  } else {
    var salt = Utilities.getUuid();
    var hash = hashPassword('guru' + kelas.toLowerCase(), salt);
    sheetAkun.appendRow([
      'akun_k_' + kelas, 'guru', '', kelas, nama, nip, hash, salt,
      aktif, false, '', nowIso, nowIso
    ]);
  }

  // Sinkronkan nama wali ke tabel kelas
  var sheetKelas = ss.getSheetByName('kelas');
  if (sheetKelas) {
    updateRowByField(sheetKelas, 'tingkat', kelas, { nama_wali: nama, nip_wali: nip });
  }

  return { success: true };
}

// 7. ADMIN: LIST AKUN GURU
function handleListAkunGuru(session) {
  if (session.peran !== 'admin') throw new Error('Hanya admin yang dapat melihat daftar akun.');
  ensureAkunDanPengaturanSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAkun = ss.getSheetByName('akun');
  var aData = getSheetDataAsObjects(sheetAkun);

  var list = [];
  for (var i = 0; i < aData.length; i++) {
    if (aData[i].peran === 'guru') {
      list.push({
        id: aData[i].id,
        peran: aData[i].peran,
        kelas: aData[i].kelas,
        nama: aData[i].nama,
        nip: aData[i].nip,
        aktif: (aData[i].aktif === true || String(aData[i].aktif).toUpperCase() === 'TRUE'),
        wajib_ganti_sandi: (aData[i].wajib_ganti_sandi === true || String(aData[i].wajib_ganti_sandi).toUpperCase() === 'TRUE'),
        terakhir_masuk: aData[i].terakhir_masuk
      });
    }
  }
  return list;
}

// 8. ADMIN: SIMPAN PENGATURAN
function handleSimpanPengaturan(session, payload) {
  if (session.peran !== 'admin') throw new Error('Hanya admin yang dapat mengubah pengaturan sekolah.');
  var taAktif = payload.tahun_ajaran_aktif;
  var semAktif = String(payload.semester_aktif);

  if (!taAktif) throw new Error('Tahun ajaran aktif wajib diisi.');
  if (semAktif !== '1' && semAktif !== '2') throw new Error('Semester aktif harus 1 atau 2.');

  ensureAkunDanPengaturanSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetP = ss.getSheetByName('pengaturan');

  updateRowByField(sheetP, 'kunci', 'tahun_ajaran_aktif', { nilai: taAktif });
  updateRowByField(sheetP, 'kunci', 'semester_aktif', { nilai: semAktif });

  return { success: true };
}

// 9. LOGIN LAMA (Backward Compatibility)
function handleLogin(payload) {
  if (payload.kelas) {
    return handleLoginGuru(payload);
  }
  return handleLoginAdmin(payload);
}

// 2. LOGOUT
function handleLogout(token) {
  var cache = CacheService.getScriptCache();
  cache.remove('session_' + token);
  return { loggedOut: true };
}

// 3. GANTI PASSWORD ADMIN
function handleChangePassword(payload) {
  var oldPassword = payload.oldPassword;
  var newPassword = payload.newPassword;

  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }

  var props = PropertiesService.getScriptProperties();
  var adminHash = props.getProperty('ADMIN_HASH');
  var adminSalt = props.getProperty('ADMIN_SALT');

  if (hashPassword(oldPassword, adminSalt) !== adminHash) {
    throw new Error('Password lama salah.');
  }

  var newSalt = Utilities.getUuid();
  var newHash = hashPassword(newPassword, newSalt);
  props.setProperty('ADMIN_HASH', newHash);
  props.setProperty('ADMIN_SALT', newSalt);

  return { message: 'Password admin berhasil diperbarui.' };
}

// 4. GET ALL DATA UNTUK SATU KELAS
function handleGetAll(kelasId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Baca master dengan cache jika ada
  var cache = CacheService.getScriptCache();
  var masterCache = cache.get('master_data');
  var master = null;
  if (masterCache) {
    try { master = JSON.parse(masterCache); } catch(e){}
  }

  if (!master) {
    master = {
      sekolah: getSheetDataAsObjects(ss.getSheetByName('sekolah'))[0] || {},
      tahunAjaran: getSheetDataAsObjects(ss.getSheetByName('tahun_ajaran')),
      ekskul: getSheetDataAsObjects(ss.getSheetByName('ekstrakurikuler'))
    };
    cache.put('master_data', JSON.stringify(master), 300); // 5 menit
  }

  var kelasList = getSheetDataAsObjects(ss.getSheetByName('kelas'));
  var allKelasSiswa = getSheetDataAsObjects(ss.getSheetByName('kelas_siswa'));
  var kelasSiswa = allKelasSiswa.filter(function(r) { return r.kelas_id === kelasId; });
  
  // Ambil ID siswa yang terdaftar di kelas ini
  var siswaIdMap = {};
  for (var i = 0; i < kelasSiswa.length; i++) {
    siswaIdMap[kelasSiswa[i].siswa_id] = true;
  }

  var allSiswa = getSheetDataAsObjects(ss.getSheetByName('siswa'));
  var siswa = allSiswa.filter(function(s) { return siswaIdMap[s.id]; });

  var allMapel = getSheetDataAsObjects(ss.getSheetByName('mapel'));
  var mapel = allMapel.filter(function(m) { return !m.kelas_id || m.kelas_id === kelasId; });
  var mapelIdMap = {};
  for (var j = 0; j < mapel.length; j++) {
    mapelIdMap[mapel[j].id] = true;
  }

  var allTP = getSheetDataAsObjects(ss.getSheetByName('tujuan_pembelajaran'));
  var tp = allTP.filter(function(t) { return mapelIdMap[t.mapel_id]; });

  var allLM = getSheetDataAsObjects(ss.getSheetByName('lingkup_materi'));
  var lm = allLM.filter(function(l) { return mapelIdMap[l.mapel_id]; });

  // Filter nilai & atribut hanya untuk siswa di kelas ini
  var formatif = getSheetDataAsObjects(ss.getSheetByName('nilai_formatif')).filter(function(r) { return siswaIdMap[r.siswa_id]; });
  var sumatifLM = getSheetDataAsObjects(ss.getSheetByName('nilai_sumatif_lm')).filter(function(r) { return siswaIdMap[r.siswa_id]; });
  var sumatifSemester = getSheetDataAsObjects(ss.getSheetByName('nilai_sumatif_semester')).filter(function(r) { return siswaIdMap[r.siswa_id]; });
  var nilaiEkskul = getSheetDataAsObjects(ss.getSheetByName('nilai_ekskul')).filter(function(r) { return r.kelas_id === kelasId; });

  // Kokurikuler
  var allTema = getSheetDataAsObjects(ss.getSheetByName('tema_kokurikuler'));
  var temaKokurikuler = allTema.filter(function(t) { return t.kelas_id === kelasId; });
  temaKokurikuler.sort(function(a, b) { return (Number(a.urutan) || 0) - (Number(b.urutan) || 0); });
  var temaIdMap = {};
  for (var t = 0; t < temaKokurikuler.length; t++) {
    temaIdMap[temaKokurikuler[t].id] = true;
  }
  var allPenilaianKoku = getSheetDataAsObjects(ss.getSheetByName('penilaian_kokurikuler'));
  var penilaianKokurikuler = allPenilaianKoku.filter(function(p) { return temaIdMap[p.tema_id]; });

  var allKaihRaw = getSheetDataAsObjects(ss.getSheetByName('kaih'));
  var kaih = allKaihRaw.filter(function(r) { return r.kelas_id === kelasId; }).map(function(r) {
    var rawPeriode = String(r.periode || '').trim().toUpperCase();
    var tahun = Number(r.tahun);
    var periode = 'JUL-DES';
    if (rawPeriode.indexOf('JAN') !== -1) {
      periode = 'JAN-JUN';
    } else if (rawPeriode.indexOf('JUL') !== -1 || rawPeriode.indexOf('DES') !== -1) {
      periode = 'JUL-DES';
    }
    if (!tahun || isNaN(tahun)) {
      var match = rawPeriode.match(/\b(20\d\d)\b/);
      tahun = match ? parseInt(match[1], 10) : 2025;
    }
    r.tahun = tahun;
    r.periode = periode;
    return r;
  });
  var kehadiran = getSheetDataAsObjects(ss.getSheetByName('kehadiran')).filter(function(r) { return r.kelas_id === kelasId; });
  var catatanWali = getSheetDataAsObjects(ss.getSheetByName('catatan_wali')).filter(function(r) { return r.kelas_id === kelasId; });
  var mutasi = getSheetDataAsObjects(ss.getSheetByName('mutasi')).filter(function(r) { return siswaIdMap[r.siswa_id]; });

  return {
    sekolah: master.sekolah,
    tahunAjaran: master.tahunAjaran,
    kelas: kelasList,
    currentKelasId: kelasId,
    siswa: siswa,
    kelasSiswa: kelasSiswa,
    mapel: mapel,
    tp: tp,
    lm: lm,
    formatif: formatif,
    sumatifLM: sumatifLM,
    sumatifSemester: sumatifSemester,
    ekskul: master.ekskul,
    nilaiEkskul: nilaiEkskul,
    temaKokurikuler: temaKokurikuler,
    penilaianKokurikuler: penilaianKokurikuler,
    kokurikuler: kokurikuler,
    kaih: kaih,
    kehadiran: kehadiran,
    catatanWali: catatanWali,
    mutasi: mutasi
  };
}

// 5. BATCH UPSERT (DENGAN LOCKSERVICE DAN SETVALUES BATCH)
function handleUpsertMany(sheetName, items, keyFields, kelasId) {
  if (!items || items.length === 0) return { updated: 0 };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // tunggu hingga 10 detik

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan.');

    // Validasi kuota 50 siswa jika menulis kelas_siswa
    if (sheetName === 'kelas_siswa' && kelasId) {
      var currentRoster = getSheetDataAsObjects(sheet).filter(function(r) { return r.kelas_id === kelasId; });
      var existingMap = {};
      for (var k = 0; k < currentRoster.length; k++) {
        existingMap[currentRoster[k].siswa_id] = true;
      }
      var newAddCount = 0;
      for (var m = 0; m < items.length; m++) {
        if (!existingMap[items[m].siswa_id]) newAddCount++;
      }
      if (currentRoster.length + newAddCount > 50) {
        throw new Error('Kelas sudah berisi ' + currentRoster.length + ' siswa. Batas maksimal adalah 50 siswa.');
      }
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var headers = values[0];
    var keys = keyFields || ['id'];

    var headerIndexMap = {};
    for (var h = 0; h < headers.length; h++) {
      headerIndexMap[headers[h]] = h;
    }

    // Buat index baris berdasarkan composite keys
    var rowIndexMap = {};
    for (var r = 1; r < values.length; r++) {
      var keyParts = [];
      for (var k = 0; k < keys.length; k++) {
        var colIdx = headerIndexMap[keys[k]];
        keyParts.push(values[r][colIdx]);
      }
      var compositeKey = keyParts.join('|||');
      rowIndexMap[compositeKey] = r;
    }

    var nowIso = new Date().toISOString();
    var rowsToAppend = [];
    var updatedCount = 0;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var keyParts = [];
      for (var k = 0; k < keys.length; k++) {
        keyParts.push(item[keys[k]]);
      }
      var itemKey = keyParts.join('|||');

      if (rowIndexMap.hasOwnProperty(itemKey)) {
        // Baris sudah ada, update di memory values
        var existingRowIdx = rowIndexMap[itemKey];
        for (var colName in item) {
          if (item.hasOwnProperty(colName) && headerIndexMap.hasOwnProperty(colName)) {
            values[existingRowIdx][headerIndexMap[colName]] = item[colName];
          }
        }
        if (headerIndexMap.hasOwnProperty('updated_at')) {
          values[existingRowIdx][headerIndexMap['updated_at']] = nowIso;
        }
        updatedCount++;
      } else {
        // Baris baru
        var newRow = new Array(headers.length);
        for (var c = 0; c < headers.length; c++) {
          newRow[c] = '';
        }
        for (var colName in item) {
          if (item.hasOwnProperty(colName) && headerIndexMap.hasOwnProperty(colName)) {
            newRow[headerIndexMap[colName]] = item[colName];
          }
        }
        if (!item.id && headerIndexMap.hasOwnProperty('id')) {
          newRow[headerIndexMap['id']] = Utilities.getUuid();
        }
        if (headerIndexMap.hasOwnProperty('created_at')) {
          newRow[headerIndexMap['created_at']] = nowIso;
        }
        if (headerIndexMap.hasOwnProperty('updated_at')) {
          newRow[headerIndexMap['updated_at']] = nowIso;
        }
        rowsToAppend.push(newRow);
        updatedCount++;
      }
    }

    // Tulis update yang ada sekaligus
    if (values.length > 1) {
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
    }

    // Tulis baris baru sekaligus dengan setValues (bukan appendRow berulang!)
    if (rowsToAppend.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }

    // Hapus cache master jika mengubah data master
    if (['sekolah', 'mapel', 'tujuan_pembelajaran', 'lingkup_materi', 'ekstrakurikuler', 'tema_kokurikuler'].indexOf(sheetName) !== -1) {
      CacheService.getScriptCache().remove('master_data');
    }

    return { success: true, count: updatedCount };
  } finally {
    lock.releaseLock();
  }
}

// 6. SINGLE UPSERT
function handleUpsert(sheetName, item, keyFields) {
  return handleUpsertMany(sheetName, [item], keyFields || ['id']);
}

// 7. DELETE
function handleDelete(sheetName, id, keyField) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan.');
    var kField = keyField || 'id';

    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var colIdx = headers.indexOf(kField);
    if (colIdx === -1) throw new Error('Kolom ' + kField + ' tidak ditemukan.');

    for (var r = values.length - 1; r >= 1; r--) {
      if (values[r][colIdx] === id) {
        sheet.deleteRow(r + 1);
        break;
      }
    }
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

// 8. IMPORT SISWA BATCH
function handleImportSiswa(kelasId, siswaList) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetKelasSiswa = ss.getSheetByName('kelas_siswa');
    var existingRoster = getSheetDataAsObjects(sheetKelasSiswa).filter(function(r) { return r.kelas_id === kelasId; });

    if (existingRoster.length + siswaList.length > 50) {
      throw new Error('Kelas sudah berisi ' + existingRoster.length + ' siswa. Penambahan ' + siswaList.length + ' siswa melebihi batas 50 siswa per kelas.');
    }

    var sheetSiswa = ss.getSheetByName('siswa');
    var nowIso = new Date().toISOString();

    var siswaRecords = [];
    var kelasSiswaRecords = [];

    var startUrut = existingRoster.length + 1;

    for (var i = 0; i < siswaList.length; i++) {
      var raw = siswaList[i];
      var siswaId = Utilities.getUuid();
      
      siswaRecords.push({
        id: siswaId,
        nis: String(raw.nis || ''),
        nisn: String(raw.nisn || ''),
        nama: raw.nama || '',
        jk: raw.jk || 'L',
        tempat_lahir: raw.tempat_lahir || '',
        tanggal_lahir: raw.tanggal_lahir || '',
        agama: raw.agama || 'Islam',
        pendidikan_sebelumnya: raw.pendidikan_sebelumnya || '',
        alamat: raw.alamat || '',
        nama_ayah: raw.nama_ayah || '',
        nama_ibu: raw.nama_ibu || '',
        pekerjaan_ayah: raw.pekerjaan_ayah || '',
        pekerjaan_ibu: raw.pekerjaan_ibu || '',
        alamat_ortu_jalan: raw.alamat_ortu_jalan || '',
        alamat_ortu_desa: raw.alamat_ortu_desa || '',
        alamat_ortu_kecamatan: raw.alamat_ortu_kecamatan || '',
        alamat_ortu_kabupaten: raw.alamat_ortu_kabupaten || '',
        alamat_ortu_provinsi: raw.alamat_ortu_provinsi || '',
        nama_wali: raw.nama_wali || '',
        pekerjaan_wali: raw.pekerjaan_wali || '',
        alamat_wali: raw.alamat_wali || '',
        telepon: raw.telepon || '',
        created_at: nowIso,
        updated_at: nowIso
      });

      kelasSiswaRecords.push({
        kelas_id: kelasId,
        siswa_id: siswaId,
        no_urut: startUrut + i,
        tinggi_badan: raw.tinggi_badan || '',
        berat_badan: raw.berat_badan || '',
        pendengaran: raw.pendengaran || 'Baik',
        penglihatan: raw.penglihatan || 'Baik',
        gigi: raw.gigi || 'Baik',
        kesehatan_lain: raw.kesehatan_lain || '',
        prestasi_kesenian: raw.prestasi_kesenian || '',
        prestasi_olahraga: raw.prestasi_olahraga || '',
        prestasi_sains: raw.prestasi_sains || '',
        created_at: nowIso,
        updated_at: nowIso
      });
    }

    handleUpsertMany('siswa', siswaRecords, ['id']);
    handleUpsertMany('kelas_siswa', kelasSiswaRecords, ['kelas_id', 'siswa_id'], kelasId);

    return { importedCount: siswaList.length };
  } finally {
    lock.releaseLock();
  }
}

// 9. COPY SEMESTER
function handleCopySemester(sourceKelasId, targetKelasId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetKelasSiswa = ss.getSheetByName('kelas_siswa');
  var existingTarget = getSheetDataAsObjects(sheetKelasSiswa).filter(function(r) { return r.kelas_id === targetKelasId; });
  if (existingTarget.length > 0) {
    throw new Error('Kelas target sudah memiliki data siswa. Penghapusan manual diperlukan sebelum menyalin.');
  }

  var sourceStudents = getSheetDataAsObjects(sheetKelasSiswa).filter(function(r) { return r.kelas_id === sourceKelasId; });
  var newKelasSiswa = sourceStudents.map(function(s) {
    return {
      kelas_id: targetKelasId,
      siswa_id: s.siswa_id,
      no_urut: s.no_urut,
      tinggi_badan: s.tinggi_badan,
      berat_badan: s.berat_badan,
      pendengaran: s.pendengaran,
      penglihatan: s.penglihatan,
      gigi: s.gigi,
      kesehatan_lain: s.kesehatan_lain
    };
  });

  handleUpsertMany('kelas_siswa', newKelasSiswa, ['kelas_id', 'siswa_id'], targetKelasId);
  return { copiedStudents: newKelasSiswa.length };
}

// 10. EXPORT REKAP KE GOOGLE SHEETS
function handleExportRekap(rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('rekap_nilai_akhir');
  if (!sheet) {
    sheet = ss.insertSheet('rekap_nilai_akhir');
  }
  sheet.clear();
  if (rows && rows.length > 0) {
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#e2e8f0');
  }
  return { success: true };
}

// Helper Baca Sheet Menjadi Objek
function getSheetDataAsObjects(sheet) {
  if (!sheet) return [];
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  if (values.length <= 1) return [];

  var headers = values[0];
  var results = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var val = row[c];
      obj[headers[c]] = (val === undefined) ? '' : val;
    }
    results.push(obj);
  }
  return results;
}

// Helper Update Baris Berdasarkan Kunci
function updateRowByField(sheet, fieldName, fieldValue, updateData) {
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var colIdx = headers.indexOf(fieldName);
  if (colIdx === -1) return;

  for (var r = 1; r < values.length; r++) {
    if (values[r][colIdx] === fieldValue) {
      for (var key in updateData) {
        var c = headers.indexOf(key);
        if (c !== -1) {
          sheet.getRange(r + 1, c + 1).setValue(updateData[key]);
        }
      }
      break;
    }
  }
}

// Helper Append Baris Tunggal
function appendRowToSheet(sheet, obj) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRow = new Array(headers.length);
  for (var i = 0; i < headers.length; i++) {
    newRow[i] = obj[headers[i]] !== undefined ? obj[headers[i]] : '';
  }
  sheet.appendRow(newRow);
}

// 11. KOKURIKULER ACTIONS
function handleListTema(kelasId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('tema_kokurikuler');
  var list = getSheetDataAsObjects(sheet).filter(function(t) { return t.kelas_id === kelasId; });
  list.sort(function(a, b) { return (Number(a.urutan) || 0) - (Number(b.urutan) || 0); });
  return list;
}

function handleSaveTema(payload) {
  var kelasId = payload.kelas_id;
  var nama = (payload.nama || '').trim();
  if (!nama) {
    throw new Error('Nama tema tidak boleh kosong.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('tema_kokurikuler');
    if (!sheet) throw new Error('Sheet tema_kokurikuler tidak ditemukan.');

    var existing = getSheetDataAsObjects(sheet).filter(function(t) { return t.kelas_id === kelasId; });
    var isDuplicate = existing.some(function(t) {
      return t.id !== payload.id && t.nama.trim().toLowerCase() === nama.toLowerCase();
    });
    if (isDuplicate) {
      throw new Error('Tema dengan nama ini sudah ada.');
    }

    var urutan = payload.urutan;
    if (urutan === undefined || urutan === null || urutan === '') {
      var maxUrutan = 0;
      for (var i = 0; i < existing.length; i++) {
        var u = Number(existing[i].urutan) || 0;
        if (u > maxUrutan) maxUrutan = u;
      }
      urutan = maxUrutan + 1;
    }

    var tampilDiRapor = payload.tampil_di_rapor !== false && payload.tampil_di_rapor !== 'FALSE';

    var temaObj = {
      id: payload.id || Utilities.getUuid(),
      kelas_id: kelasId,
      nama: nama,
      keterangan: payload.keterangan || '',
      urutan: urutan,
      tampil_di_rapor: tampilDiRapor
    };

    handleUpsertMany('tema_kokurikuler', [temaObj], ['id']);
    return temaObj;
  } finally {
    lock.releaseLock();
  }
}

function handleReorderTema(kelasId, ids) {
  if (!ids || ids.length === 0) return { success: true };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('tema_kokurikuler');
    if (!sheet) throw new Error('Sheet tema_kokurikuler tidak ditemukan.');

    var items = [];
    for (var i = 0; i < ids.length; i++) {
      items.push({
        id: ids[i],
        kelas_id: kelasId,
        urutan: i + 1
      });
    }

    handleUpsertMany('tema_kokurikuler', items, ['id']);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteTema(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Hapus dari tema_kokurikuler
    handleDelete('tema_kokurikuler', id, 'id');

    // Hapus juga semua baris penilaian_kokurikuler dengan tema_id === id
    var sheetPenilaian = ss.getSheetByName('penilaian_kokurikuler');
    if (sheetPenilaian) {
      var values = sheetPenilaian.getDataRange().getValues();
      if (values.length > 1) {
        var headers = values[0];
        var temaIdx = headers.indexOf('tema_id');
        if (temaIdx !== -1) {
          var remaining = [headers];
          for (var r = 1; r < values.length; r++) {
            if (values[r][temaIdx] !== id) {
              remaining.push(values[r]);
            }
          }
          sheetPenilaian.clear();
          sheetPenilaian.getRange(1, 1, remaining.length, headers.length).setValues(remaining);
        }
      }
    }
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function handleCopyTema(dariKelasId, keKelasId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('tema_kokurikuler');
    if (!sheet) throw new Error('Sheet tema_kokurikuler tidak ditemukan.');

    var allTema = getSheetDataAsObjects(sheet);
    var sourceList = allTema.filter(function(t) { return t.kelas_id === dariKelasId; });
    var targetList = allTema.filter(function(t) { return t.kelas_id === keKelasId; });

    var existingNames = {};
    var maxUrutan = 0;
    for (var i = 0; i < targetList.length; i++) {
      existingNames[targetList[i].nama.trim().toLowerCase()] = true;
      var u = Number(targetList[i].urutan) || 0;
      if (u > maxUrutan) maxUrutan = u;
    }

    var newThemes = [];
    sourceList.sort(function(a, b) { return (Number(a.urutan) || 0) - (Number(b.urutan) || 0); });
    for (var j = 0; j < sourceList.length; j++) {
      var src = sourceList[j];
      var nameKey = src.nama.trim().toLowerCase();
      if (existingNames[nameKey]) continue; // lewati nama yang sudah ada

      maxUrutan++;
      newThemes.push({
        id: Utilities.getUuid(),
        kelas_id: keKelasId,
        nama: src.nama,
        keterangan: src.keterangan || '',
        urutan: maxUrutan,
        tampil_di_rapor: src.tampil_di_rapor !== false && src.tampil_di_rapor !== 'FALSE'
      });
      existingNames[nameKey] = true;
    }

    if (newThemes.length > 0) {
      handleUpsertMany('tema_kokurikuler', newThemes, ['id']);
    }

    return { copiedCount: newThemes.length };
  } finally {
    lock.releaseLock();
  }
}

function handleListPenilaianKoku(kelasId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTema = ss.getSheetByName('tema_kokurikuler');
  var temaList = getSheetDataAsObjects(sheetTema).filter(function(t) { return t.kelas_id === kelasId; });
  var temaIdMap = {};
  for (var i = 0; i < temaList.length; i++) {
    temaIdMap[temaList[i].id] = true;
  }
  var sheetPenilaian = ss.getSheetByName('penilaian_kokurikuler');
  var list = getSheetDataAsObjects(sheetPenilaian).filter(function(p) { return temaIdMap[p.tema_id]; });
  return list;
}

function handleSavePenilaianKoku(rows) {
  if (!rows || rows.length === 0) return { count: 0 };
  return handleUpsertMany('penilaian_kokurikuler', rows, ['tema_id', 'siswa_id']);
}

// 12. KAIH ACTIONS & MIGRATION
function handleListKaih(payload) {
  var kelasId = payload.kelas_id;
  var tahun = Number(payload.tahun);
  var periode = String(payload.periode || '').trim().toUpperCase();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetKaih = ss.getSheetByName('kaih');
  var allKaih = getSheetDataAsObjects(sheetKaih);

  return allKaih.filter(function(k) {
    var rTahun = Number(k.tahun);
    var rawPeriode = String(k.periode || '').trim().toUpperCase();
    var rPeriode = rawPeriode.indexOf('JAN') !== -1 ? 'JAN-JUN' : 'JUL-DES';
    if (!rTahun || isNaN(rTahun)) {
      var match = rawPeriode.match(/\b(20\d\d)\b/);
      rTahun = match ? parseInt(match[1], 10) : 2025;
    }
    return k.kelas_id === kelasId && rTahun === tahun && rPeriode === periode;
  });
}

function handleSaveKaih(payload) {
  var rows = payload.rows;
  if (!rows || rows.length === 0) return { count: 0 };

  var allowedStatus = {
    '': true,
    'Belum Terbiasa': true,
    'Mulai Terbiasa': true,
    'Sudah Terbiasa': true
  };

  var habits = ['bangun_pagi', 'beribadah', 'berolahraga', 'makan_sehat', 'gemar_belajar', 'bermasyarakat', 'tidur_cepat'];
  var validatedRows = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tahun = Number(r.tahun);
    if (!tahun || tahun < 2000 || tahun > 2100) {
      throw new Error('Tahun tidak valid: ' + r.tahun + '. Harus antara 2000-2100.');
    }
    var periode = String(r.periode || '').trim().toUpperCase();
    if (periode !== 'JAN-JUN' && periode !== 'JUL-DES') {
      throw new Error('Periode tidak valid: ' + r.periode + '. Harus JAN-JUN atau JUL-DES.');
    }

    for (var h = 0; h < habits.length; h++) {
      var val = r[habits[h]] !== undefined && r[habits[h]] !== null ? String(r[habits[h]]).trim() : '';
      if (!allowedStatus[val]) {
        throw new Error('Nilai kebiasaan tidak valid pada ' + habits[h] + ': ' + val);
      }
    }

    validatedRows.push({
      id: r.id || Utilities.getUuid(),
      siswa_id: r.siswa_id,
      kelas_id: r.kelas_id,
      tahun: tahun,
      periode: periode,
      bangun_pagi: r.bangun_pagi || '',
      beribadah: r.beribadah || '',
      berolahraga: r.berolahraga || '',
      makan_sehat: r.makan_sehat || '',
      gemar_belajar: r.gemar_belajar || '',
      bermasyarakat: r.bermasyarakat || '',
      tidur_cepat: r.tidur_cepat || ''
    });
  }

  return handleUpsertMany('kaih', validatedRows, ['siswa_id', 'tahun', 'periode']);
}

function handleCopyKaih(payload) {
  var kelasId = payload.kelas_id;
  var dari = payload.dari;
  var ke = payload.ke;
  var timpa = payload.timpa === true;

  if (!dari || !dari.tahun || !dari.periode) throw new Error('Periode asal tidak lengkap.');
  if (!ke || !ke.tahun || !ke.periode) throw new Error('Periode tujuan tidak lengkap.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetKaih = ss.getSheetByName('kaih');
    if (!sheetKaih) throw new Error('Sheet kaih tidak ditemukan.');

    var allKaih = getSheetDataAsObjects(sheetKaih);
    var targetExisting = allKaih.filter(function(k) {
      var kThn = Number(k.tahun);
      var kPer = String(k.periode || '').trim().toUpperCase();
      if (!kThn && typeof k.periode === 'string') {
        var match = k.periode.match(/\b(20\d\d)\b/);
        kThn = match ? parseInt(match[1], 10) : 2025;
        kPer = k.periode.indexOf('JAN') !== -1 ? 'JAN-JUN' : 'JUL-DES';
      }
      return k.kelas_id === kelasId && kThn === Number(ke.tahun) && kPer === String(ke.periode).trim().toUpperCase();
    });

    if (targetExisting.length > 0 && !timpa) {
      throw new Error('Periode tujuan sudah memiliki data penilaian. Aktifkan timpa untuk menimpa.');
    }

    var sheetKelasSiswa = ss.getSheetByName('kelas_siswa');
    var kelasSiswa = getSheetDataAsObjects(sheetKelasSiswa).filter(function(ks) { return ks.kelas_id === kelasId; });
    var siswaIdMap = {};
    for (var s = 0; s < kelasSiswa.length; s++) {
      siswaIdMap[kelasSiswa[s].siswa_id] = true;
    }

    var sourceRows = allKaih.filter(function(k) {
      var kThn = Number(k.tahun);
      var kPer = String(k.periode || '').trim().toUpperCase();
      if (!kThn && typeof k.periode === 'string') {
        var match = k.periode.match(/\b(20\d\d)\b/);
        kThn = match ? parseInt(match[1], 10) : 2025;
        kPer = k.periode.indexOf('JAN') !== -1 ? 'JAN-JUN' : 'JUL-DES';
      }
      return k.kelas_id === kelasId && kThn === Number(dari.tahun) && kPer === String(dari.periode).trim().toUpperCase() && siswaIdMap[k.siswa_id];
    });

    if (sourceRows.length === 0) {
      return { copiedCount: 0, message: 'Tidak ada data penilaian pada periode asal.' };
    }

    var newRows = sourceRows.map(function(src) {
      return {
        id: Utilities.getUuid(),
        siswa_id: src.siswa_id,
        kelas_id: kelasId,
        tahun: Number(ke.tahun),
        periode: String(ke.periode).trim().toUpperCase(),
        bangun_pagi: src.bangun_pagi || '',
        beribadah: src.beribadah || '',
        berolahraga: src.berolahraga || '',
        makan_sehat: src.makan_sehat || '',
        gemar_belajar: src.gemar_belajar || '',
        bermasyarakat: src.bermasyarakat || '',
        tidur_cepat: src.tidur_cepat || ''
      };
    });

    handleUpsertMany('kaih', newRows, ['siswa_id', 'tahun', 'periode'], kelasId);
    return { copiedCount: newRows.length };
  } finally {
    lock.releaseLock();
  }
}

function handleListKaihPeriode(payload) {
  var kelasId = payload.kelas_id;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetKaih = ss.getSheetByName('kaih');
  var allKaih = getSheetDataAsObjects(sheetKaih).filter(function(k) { return k.kelas_id === kelasId; });
  var map = {};

  for (var i = 0; i < allKaih.length; i++) {
    var k = allKaih[i];
    var tahun = Number(k.tahun);
    var rawPeriode = String(k.periode || '').trim().toUpperCase();
    var periode = rawPeriode.indexOf('JAN') !== -1 ? 'JAN-JUN' : 'JUL-DES';
    if (!tahun || isNaN(tahun)) {
      var match = rawPeriode.match(/\b(20\d\d)\b/);
      tahun = match ? parseInt(match[1], 10) : 2025;
    }
    var key = tahun + '_' + periode;
    if (!map[key]) {
      map[key] = { tahun: tahun, periode: periode, count: 0 };
    }
    map[key].count++;
  }

  var list = [];
  for (var mKey in map) {
    list.push(map[mKey]);
  }
  return list;
}

function migrateKaihPeriode() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetKaih = ss.getSheetByName('kaih');
  if (!sheetKaih) return { migrated: 0, message: 'Sheet kaih tidak ditemukan.' };

  var data = getSheetDataAsObjects(sheetKaih);
  if (data.length === 0) return { migrated: 0, message: 'Sheet kaih kosong.' };

  // Cadangan tab lama dengan nama _kaih_lama
  var oldBackup = ss.getSheetByName('_kaih_lama');
  if (oldBackup) {
    ss.deleteSheet(oldBackup);
  }
  sheetKaih.copyTo(ss).setName('_kaih_lama');

  var newHeaders = [
    'id', 'siswa_id', 'kelas_id', 'tahun', 'periode',
    'bangun_pagi', 'beribadah', 'berolahraga', 'makan_sehat',
    'gemar_belajar', 'bermasyarakat', 'tidur_cepat',
    'created_at', 'updated_at'
  ];

  var newRows = [newHeaders];
  var migratedCount = 0;

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var rawPeriode = String(r.periode || '').trim().toUpperCase();
    var tahun = Number(r.tahun);
    var periode = '';

    if (rawPeriode.indexOf('JAN') !== -1) {
      periode = 'JAN-JUN';
    } else if (rawPeriode.indexOf('JUL') !== -1 || rawPeriode.indexOf('DES') !== -1) {
      periode = 'JUL-DES';
    } else {
      periode = rawPeriode === 'JAN-JUN' || rawPeriode === 'JUL-DES' ? rawPeriode : 'JUL-DES';
    }

    if (!tahun || isNaN(tahun)) {
      var matchYear = rawPeriode.match(/\b(20\d\d)\b/);
      tahun = matchYear ? parseInt(matchYear[1], 10) : 2025;
    }

    newRows.push([
      r.id || Utilities.getUuid(),
      r.siswa_id || '',
      r.kelas_id || '',
      tahun,
      periode,
      r.bangun_pagi || '',
      r.beribadah || '',
      r.berolahraga || '',
      r.makan_sehat || '',
      r.gemar_belajar || '',
      r.bermasyarakat || '',
      r.tidur_cepat || '',
      r.created_at || new Date().toISOString(),
      r.updated_at || new Date().toISOString()
    ]);
    migratedCount++;
  }

  sheetKaih.clear();
  sheetKaih.getRange(1, 1, newRows.length, newHeaders.length).setValues(newRows);
  sheetKaih.setFrozenRows(1);
  sheetKaih.getRange(1, 1, 1, newHeaders.length).setFontWeight('bold').setBackground('#e2e8f0');

  return { ok: true, migrated: migratedCount, backup: '_kaih_lama' };
}

// Handler Pindah Rombel Siswa
function handlePindahRombelSiswa(payload) {
  var siswa_id = payload.siswa_id;
  var rombel_asal_id = payload.rombel_asal_id;
  var rombel_tujuan_id = payload.rombel_tujuan_id;
  var alasan = payload.alasan;

  if (!siswa_id || !rombel_asal_id || !rombel_tujuan_id) {
    throw new Error('Data perpindahan rombel tidak lengkap.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetKS = ss.getSheetByName('kelas_siswa');
  var ksData = getSheetDataAsObjects(sheetKS);

  // Cek kapasitas rombel tujuan (maks 50)
  var targetCount = 0;
  var sourceIndex = -1;
  var maxNoUrut = 0;

  for (var i = 0; i < ksData.length; i++) {
    var item = ksData[i];
    var itemRombel = item.rombel_id || item.kelas_id;
    if (itemRombel === rombel_tujuan_id) {
      targetCount++;
      if (item.no_urut && item.no_urut > maxNoUrut) maxNoUrut = item.no_urut;
    }
    if ((itemRombel === rombel_asal_id) && item.siswa_id === siswa_id) {
      sourceIndex = i + 2; // Row index
    }
  }

  if (targetCount >= 50) {
    throw new Error('Rombel tujuan sudah penuh (50 siswa).');
  }

  if (sourceIndex !== -1) {
    sheetKS.getRange(sourceIndex, 1).setValue(rombel_tujuan_id); // rombel_id
    sheetKS.getRange(sourceIndex, 2).setValue(rombel_tujuan_id); // kelas_id
    sheetKS.getRange(sourceIndex, 4).setValue(maxNoUrut + 1); // no_urut
    sheetKS.getRange(sourceIndex, 14).setValue(new Date().toISOString()); // updated_at
  }

  // Update nilai, kehadiran, catatan ke rombel_tujuan_id
  var scoreSheets = ['kehadiran', 'catatan_wali', 'kaih', 'nilai_ekskul', 'penilaian_kokurikuler'];
  for (var s = 0; s < scoreSheets.length; s++) {
    var sSheet = ss.getSheetByName(scoreSheets[s]);
    if (sSheet && sSheet.getLastRow() > 1) {
      var sRows = getSheetDataAsObjects(sSheet);
      for (var r = 0; r < sRows.length; r++) {
        if (sRows[r].siswa_id === siswa_id && (sRows[r].kelas_id === rombel_asal_id || sRows[r].rombel_id === rombel_asal_id)) {
          var rIdx = r + 2;
          sSheet.getRange(rIdx, 2).setValue(rombel_tujuan_id);
        }
      }
    }
  }

  return { ok: true, message: 'Siswa berhasil dipindahkan ke rombel tujuan.' };
}

// Handler Tambah Rombel
function handleTambahRombel(payload) {
  var tingkatNum = parseInt(payload.tingkat, 10);
  if (!tingkatNum || tingkatNum < 1 || tingkatNum > 6) {
    throw new Error('Tingkat kelas harus antara 1 sampai 6.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetR = ss.getSheetByName('rombel');
  var rData = getSheetDataAsObjects(sheetR);

  var maxCharCode = 64;
  for (var i = 0; i < rData.length; i++) {
    if (parseInt(rData[i].tingkat, 10) === tingkatNum && rData[i].huruf) {
      var code = rData[i].huruf.charCodeAt(0);
      if (code > maxCharCode) maxCharCode = code;
    }
  }
  var nextHuruf = String.fromCharCode(maxCharCode + 1);
  var rombelNama = tingkatNum + nextHuruf;
  var rombelId = 'rombel_' + tingkatNum + nextHuruf.toLowerCase();
  var nowIso = new Date().toISOString();

  sheetR.appendRow([
    rombelId,
    'tingkat_' + tingkatNum,
    nextHuruf,
    rombelNama,
    'ta_2025_1',
    (payload.nama_wali || '').trim(),
    (payload.nip_wali || '').trim(),
    true,
    rData.length + 1,
    nowIso,
    nowIso
  ]);

  // Sync to akun
  var sheetA = ss.getSheetByName('akun');
  var gSalt = Utilities.getUuid();
  var gHash = hashPassword('guru' + rombelNama.toLowerCase(), gSalt);
  sheetA.appendRow([
    'akun_' + rombelId, 'guru', '', rombelNama, payload.nama_wali || ('Wali Kelas ' + rombelNama),
    payload.nip_wali || '', gHash, gSalt, true, false, '', nowIso, nowIso
  ]);

  return { ok: true, rombel: { id: rombelId, nama: rombelNama, tingkat: tingkatNum, huruf: nextHuruf } };
}

// Handler Toggle Rombel Aktif
function handleToggleRombelAktif(payload) {
  var rombel_id = payload.rombel_id;
  var aktif = payload.aktif;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetR = ss.getSheetByName('rombel');
  var rData = getSheetDataAsObjects(sheetR);

  for (var i = 0; i < rData.length; i++) {
    if (rData[i].id === rombel_id || rData[i].nama === rombel_id) {
      sheetR.getRange(i + 2, 8).setValue(aktif ? true : false);
      break;
    }
  }
  return { ok: true };
}

// Handler Kunci TP/LM per Tingkat
function handleKunciTpLmPerTingkat(payload) {
  var props = PropertiesService.getScriptProperties();
  var key = 'KUNCI_TPLM_' + payload.tingkat;
  props.setProperty(key, payload.terkunci ? 'true' : 'false');
  return { ok: true };
}

// Handler Salin Tema ke Rombel Lain
function handleSalinTemaKeRombelLain(payload) {
  var dari_rombel_id = payload.dari_rombel_id;
  var ke_rombel_ids = payload.ke_rombel_ids;
  if (!dari_rombel_id || !ke_rombel_ids || ke_rombel_ids.length === 0) {
    throw new Error('Rombel asal dan tujuan harus diisi.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetT = ss.getSheetByName('tema_kokurikuler');
  var tData = getSheetDataAsObjects(sheetT);

  var srcThemes = [];
  for (var i = 0; i < tData.length; i++) {
    if (tData[i].kelas_id === dari_rombel_id || tData[i].rombel_id === dari_rombel_id) {
      srcThemes.push(tData[i]);
    }
  }

  var nowIso = new Date().toISOString();
  var copiedCount = 0;

  for (var k = 0; k < ke_rombel_ids.length; k++) {
    var targetRombel = ke_rombel_ids[k];
    for (var s = 0; s < srcThemes.length; s++) {
      var src = srcThemes[s];
      sheetT.appendRow([
        Utilities.getUuid(),
        targetRombel,
        targetRombel,
        src.nama,
        src.keterangan || '',
        src.urutan || 1,
        src.tampil_di_rapor !== false,
        nowIso,
        nowIso
      ]);
      copiedCount++;
    }
  }

  return { ok: true, copiedCount: copiedCount };
}



