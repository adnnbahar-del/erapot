/**
 * E-RAPOR SD (KURIKULUM MERDEKA) - SETUP & SEED SCRIPT
 * Dijalankan sekali saat inisialisasi spreadsheet database
 */

var SCHEMAS = {
  tingkat: [
    'id', 'angka', 'romawi', 'fase', 'created_at', 'updated_at'
  ],
  rombel: [
    'id', 'tingkat_id', 'huruf', 'nama', 'tahun_ajaran_id', 'nama_wali', 'nip_wali', 'aktif', 'urutan',
    'created_at', 'updated_at'
  ],
  sekolah: [
    'id', 'nama', 'npsn', 'nss', 'alamat', 'kode_pos', 'desa', 'kecamatan', 'kabupaten', 'provinsi',
    'website', 'email', 'kepala_sekolah', 'nip_kepala_sekolah', 'tempat_rapor', 'format_kelas_rapor', 'ttd_kepsek_url', 'stempel_url',
    'created_at', 'updated_at'
  ],
  tahun_ajaran: [
    'id', 'tahun', 'semester', 'tanggal_rapor', 'aktif', 'created_at', 'updated_at'
  ],
  kelas: [
    'id', 'sekolah_id', 'tahun_ajaran_id', 'tingkat', 'fase', 'nama_wali', 'nip_wali', 'terakhir_masuk',
    'created_at', 'updated_at'
  ],
  siswa: [
    'id', 'nis', 'nisn', 'nama', 'jk', 'tempat_lahir', 'tanggal_lahir', 'agama', 'pendidikan_sebelumnya', 'alamat',
    'nama_ayah', 'nama_ibu', 'pekerjaan_ayah', 'pekerjaan_ibu', 'alamat_ortu_jalan', 'alamat_ortu_desa',
    'alamat_ortu_kecamatan', 'alamat_ortu_kabupaten', 'alamat_ortu_provinsi',
    'nama_wali', 'pekerjaan_wali', 'alamat_wali', 'telepon', 'created_at', 'updated_at'
  ],
  kelas_siswa: [
    'rombel_id', 'kelas_id', 'siswa_id', 'no_urut', 'tinggi_badan', 'berat_badan', 'pendengaran', 'penglihatan', 'gigi',
    'kesehatan_lain', 'prestasi_kesenian', 'prestasi_olahraga', 'prestasi_sains', 'created_at', 'updated_at'
  ],
  mapel: [
    'id', 'tingkat_id', 'tahun_ajaran_id', 'kelas_id', 'nama', 'singkatan', 'jenis', 'urutan', 'created_at', 'updated_at'
  ],
  tujuan_pembelajaran: [
    'id', 'mapel_id', 'urutan', 'deskripsi', 'diubah_oleh', 'created_at', 'updated_at'
  ],
  lingkup_materi: [
    'id', 'mapel_id', 'urutan', 'nama', 'diubah_oleh', 'created_at', 'updated_at'
  ],
  nilai_formatif: [
    'siswa_id', 'tp_id', 'kktp', 'tampil', 'created_at', 'updated_at'
  ],
  nilai_sumatif_lm: [
    'siswa_id', 'lm_id', 'nilai', 'created_at', 'updated_at'
  ],
  nilai_sumatif_semester: [
    'siswa_id', 'mapel_id', 'pts', 'pas', 'created_at', 'updated_at'
  ],
  ekstrakurikuler: [
    'id', 'sekolah_id', 'nama', 'created_at', 'updated_at'
  ],
  nilai_ekskul: [
    'siswa_id', 'kelas_id', 'ekskul_id', 'urutan', 'deskripsi', 'created_at', 'updated_at'
  ],
  tema_kokurikuler: [
    'id', 'kelas_id', 'nama', 'keterangan', 'urutan', 'tampil_di_rapor', 'created_at', 'updated_at'
  ],
  penilaian_kokurikuler: [
    'id', 'tema_id', 'siswa_id', 'dpl_kuat', 'dpl_penguatan', 'deskripsi_manual', 'created_at', 'updated_at'
  ],
  kaih: [
    'siswa_id', 'kelas_id', 'bangun_pagi', 'beribadah', 'berolahraga', 'makan_sehat', 'gemar_belajar',
    'bermasyarakat', 'tidur_cepat', 'periode', 'created_at', 'updated_at'
  ],
  kehadiran: [
    'siswa_id', 'kelas_id', 'sakit', 'izin', 'alpa', 'created_at', 'updated_at'
  ],
  catatan_wali: [
    'siswa_id', 'kelas_id', 'catatan', 'keputusan_naik', 'created_at', 'updated_at'
  ],
  mutasi: [
    'id', 'siswa_id', 'jenis', 'tanggal', 'kelas', 'alasan', 'sekolah_asal', 'tahun_pelajaran',
    'created_at', 'updated_at'
  ],
  _config: [
    'kunci', 'nilai', 'created_at', 'updated_at'
  ]
};

function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  for (var sheetName in SCHEMAS) {
    var headers = SCHEMAS[sheetName];
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // Set header jika masih kosong
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      // Pastikan header baris 1 sesuai
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    // Bekukan baris header
    sheet.setFrozenRows(1);

    // Style header baris 1
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0d2370');
    headerRange.setFontColor('#ffffff');

    // Beri note pada sel 'id'
    var idColIdx = headers.indexOf('id');
    if (idColIdx !== -1) {
      sheet.getRange(1, idColIdx + 1).setNote('PENTING: Jangan ubah ID secara manual.');
    }

    // Format kolom teks '@' untuk NIS, NISN, NIP, NPSN
    var textCols = ['nis', 'nisn', 'npsn', 'nss', 'nip_kepala_sekolah', 'nip_wali', 'telepon'];
    for (var i = 0; i < textCols.length; i++) {
      var colIdx = headers.indexOf(textCols[i]);
      if (colIdx !== -1) {
        sheet.getRange(2, colIdx + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
      }
    }

    // Proteksi baris header agar tidak terhapus tidak sengaja
    try {
      var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
      var alreadyProtected = false;
      for (var p = 0; p < protections.length; p++) {
        if (protections[p].getRange().getRow() === 1) {
          alreadyProtected = true;
          break;
        }
      }
      if (!alreadyProtected) {
        var prot = headerRange.protect();
        prot.setDescription('Header ' + sheetName);
        prot.setWarningOnly(true);
      }
    } catch (e) {
      // Abaikan jika permission tidak mengizinkan proteksi
    }

    // Sembunyikan sheet _config
    if (sheetName === '_config') {
      sheet.hideSheet();
    }
  }

  // Set password admin default (admin123)
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_HASH')) {
    var salt = Utilities.getUuid();
    var hash = hashPassword('admin123', salt);
    props.setProperty('ADMIN_HASH', hash);
    props.setProperty('ADMIN_SALT', salt);
  }

  // Jalankan migrasi data jika ada tab kokurikuler lama
  migrateKokurikuler();

  Logger.log('setupDatabase() selesai. Semua tab database berhasil disiapkan.');
}

/**
 * Migrasi data dari tab lama kokurikuler ke penilaian_kokurikuler
 */
function migrateKokurikuler() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var oldSheet = ss.getSheetByName('kokurikuler');
  if (!oldSheet) return;

  var targetSheet = ss.getSheetByName('penilaian_kokurikuler');
  if (!targetSheet) return;

  var oldData = getSheetDataAsObjects(oldSheet);
  if (oldData && oldData.length > 0) {
    var nowIso = new Date().toISOString();
    var newRows = [];

    for (var i = 0; i < oldData.length; i++) {
      var r = oldData[i];
      if (r.tema_id && r.siswa_id) {
        newRows.push({
          id: Utilities.getUuid(),
          tema_id: r.tema_id,
          siswa_id: r.siswa_id,
          dpl_kuat: r.dpl_kuat || '',
          dpl_penguatan: r.dpl_penguatan || '',
          deskripsi_manual: '',
          created_at: r.created_at || nowIso,
          updated_at: r.updated_at || nowIso
        });
      }
    }

    if (newRows.length > 0) {
      handleUpsertMany('penilaian_kokurikuler', newRows, ['tema_id', 'siswa_id']);
    }
  }

  // Ubah nama tab lama menjadi _kokurikuler_lama (jangan dihapus)
  try {
    oldSheet.setName('_kokurikuler_lama');
  } catch (e) {
    Logger.log('Tidak dapat mengubah nama sheet kokurikuler: ' + e.message);
  }
}

function seedData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nowIso = new Date().toISOString();

  // 1. Data Sekolah
  var sheetSekolah = ss.getSheetByName('sekolah');
  if (sheetSekolah.getLastRow() <= 1) {
    sheetSekolah.appendRow([
      'sekolah_1',
      'SD NEGERI 1 SUKARAJA',
      '10817923',
      '101120601001',
      'Jalan Pasar Sukaraja',
      '35387',
      'Sukaraja',
      'Semaka',
      'Kabupaten Tanggamus',
      'Lampung',
      'https://sdn1sukaraja.sch.id',
      'sdn1sukaraja@gmail.com',
      'NGADINO, S.Pd',
      '197005092000071001',
      'Sukaraja, 20 Desember 2025',
      '',
      '',
      nowIso,
      nowIso
    ]);
  }

  // 2. Tahun Ajaran
  var sheetTA = ss.getSheetByName('tahun_ajaran');
  if (sheetTA.getLastRow() <= 1) {
    sheetTA.appendRow(['ta_2025_1', '2025/2026', 1, '2025-12-20', true, nowIso, nowIso]);
    sheetTA.appendRow(['ta_2025_2', '2025/2026', 2, '2026-06-20', false, nowIso, nowIso]);
  }

  // 3. Tingkat 1 - 6
  var sheetTingkat = ss.getSheetByName('tingkat');
  if (sheetTingkat && sheetTingkat.getLastRow() <= 1) {
    var tingkatList = [
      ['tingkat_1', 1, 'I', 'A'],
      ['tingkat_2', 2, 'II', 'A'],
      ['tingkat_3', 3, 'III', 'B'],
      ['tingkat_4', 4, 'IV', 'B'],
      ['tingkat_5', 5, 'V', 'C'],
      ['tingkat_6', 6, 'VI', 'C']
    ];
    for (var t = 0; t < tingkatList.length; t++) {
      sheetTingkat.appendRow(tingkatList[t].concat([nowIso, nowIso]));
    }
  }

  // 4. Rombel 1A - 6C (18 Rombel)
  var sheetRombel = ss.getSheetByName('rombel');
  if (sheetRombel && sheetRombel.getLastRow() <= 1) {
    var rombelData = [
      [1, 'A', 'SITI NURJANAH, S.Pd', '198501012010012001'],
      [1, 'B', 'RIKA MUSLIKHAH, S.Pd', '198603122010012002'],
      [1, 'C', 'NURUL HIDAYAH, S.Pd', '198705152011012003'],
      [2, 'A', 'AHMAD FAUZI, S.Pd', '198802022011011002'],
      [2, 'B', 'FITRI HANDAYANI, S.Pd', '198904102012022004'],
      [2, 'C', 'AGUS SETIAWAN, S.Pd', '199001052013011005'],
      [3, 'A', 'SRI WAHYUNI, S.Pd', '199003032014022003'],
      [3, 'B', 'EKO PRASETYO, S.Pd', '199106202015031006'],
      [3, 'C', 'DIAN ANGGRAENI, S.Pd', '199208182016022007'],
      [4, 'A', 'BAMBANG HERMANTO, S.Pd', '199204042017011004'],
      [4, 'B', 'LESTARI NINGSIH, S.Pd', '199307122018012008'],
      [4, 'C', 'HENDRA WIJAYA, S.Pd', '199402252019031009'],
      [5, 'A', 'DEWI KARTIKA, S.Pd', '199405052020022005'],
      [5, 'B', 'ARIF WIBOWO, S.Pd', '199509142021021010'],
      [5, 'C', 'TRI SURYANI, S.Pd', '199511282022032011'],
      [6, 'A', 'ADNAN BAHAR, S.Pd', '199601262023211006'],
      [6, 'B', 'WAHYU HIDAYAT, S.Pd', '199604172023211007'],
      [6, 'C', 'RATNA SARI, S.Pd', '199708222024212008']
    ];
    for (var r = 0; r < rombelData.length; r++) {
      var rd = rombelData[r];
      var rNama = rd[0] + rd[1];
      var rId = 'rombel_' + rd[0] + rd[1].toLowerCase();
      sheetRombel.appendRow([
        rId, 'tingkat_' + rd[0], rd[1], rNama, 'ta_2025_1', rd[2], rd[3], true, r + 1, nowIso, nowIso
      ]);
    }
  }

  // 5. Kelas I - VI (Backward Compatibility)
  var sheetKelas = ss.getSheetByName('kelas');
  if (sheetKelas && sheetKelas.getLastRow() <= 1) {
    var kelasList = [
      ['rombel_1a', 'sekolah_1', 'ta_2025_1', '1A', 'A', 'SITI NURJANAH, S.Pd', '198501012010012001', ''],
      ['rombel_2a', 'sekolah_1', 'ta_2025_1', '2A', 'A', 'AHMAD FAUZI, S.Pd', '198802022011011002', ''],
      ['rombel_3a', 'sekolah_1', 'ta_2025_1', '3A', 'B', 'SRI WAHYUNI, S.Pd', '199003032014022003', ''],
      ['rombel_4a', 'sekolah_1', 'ta_2025_1', '4A', 'B', 'BAMBANG HERMANTO, S.Pd', '199204042017011004', ''],
      ['rombel_5a', 'sekolah_1', 'ta_2025_1', '5A', 'C', 'DEWI KARTIKA, S.Pd', '199405052020022005', ''],
      ['rombel_6a', 'sekolah_1', 'ta_2025_1', '6A', 'C', 'ADNAN BAHAR, S.Pd', '199601262023211006', '']
    ];
    for (var k = 0; k < kelasList.length; k++) {
      var row = kelasList[k].concat([nowIso, nowIso]);
      sheetKelas.appendRow(row);
    }
  }

  // 4. Mapel Kelas VI
  var sheetMapel = ss.getSheetByName('mapel');
  var mapelKelas6 = [
    { id: 'mapel_pai', nama: 'Pendidikan Agama Islam dan Budi Pekerti', singkatan: 'PAIBP', jenis: 'intra', urutan: 1 },
    { id: 'mapel_pancasila', nama: 'Pendidikan Pancasila', singkatan: 'PP', jenis: 'intra', urutan: 2 },
    { id: 'mapel_indo', nama: 'Bahasa Indonesia', singkatan: 'BIND', jenis: 'intra', urutan: 3 },
    { id: 'mapel_mtk', nama: 'Matematika', singkatan: 'MTK', jenis: 'intra', urutan: 4 },
    { id: 'mapel_ipas', nama: 'Ilmu Pengetahuan Alam dan Sosial', singkatan: 'IPAS', jenis: 'intra', urutan: 5 },
    { id: 'mapel_pjok', nama: 'Pendidikan Jasmani Olahraga dan Kesehatan', singkatan: 'PJOK', jenis: 'intra', urutan: 6 },
    { id: 'mapel_seni', nama: 'Seni Budaya (Seni Rupa, Musik, Teater, Tari)', singkatan: 'SENI', jenis: 'intra', urutan: 7 },
    { id: 'mapel_inggris', nama: 'Bahasa Inggris', singkatan: 'BING', jenis: 'intra', urutan: 8 },
    { id: 'mapel_mulok', nama: 'Muatan Lokal Bahasa dan Aksara Lampung', singkatan: 'MULOK', jenis: 'mulok', urutan: 9 }
  ];

  if (sheetMapel.getLastRow() <= 1) {
    for (var m = 0; m < mapelKelas6.length; m++) {
      var item = mapelKelas6[m];
      sheetMapel.appendRow([item.id, 'kelas_6', item.nama, item.singkatan, item.jenis, item.urutan, nowIso, nowIso]);
    }
  }

  // 5. Tujuan Pembelajaran (TP) Matematika Kelas VI
  var sheetTP = ss.getSheetByName('tujuan_pembelajaran');
  var tpMatematika = [
    'mampu memahami perkalian pecahan dengan bilangan asli dan menghitung hasil perkalian tersebut',
    'mampu memahami pembagian pecahan dengan bilangan asli dan menghitung hasil pembagian tersebut',
    'mampu mengubah pecahan menjadi desimal, serta membandingkan dan mengurutkan bilangan desimal (satu angka di belakang koma)',
    'mampu memahami konsep rasio dan menggunakan bahasa rasio untuk menjelaskan hubungan perbandingan antara dua besaran',
    'mampu menentukan kesamaan rasio dengan bantuan tabel rasio',
    'mampu menentukan rasio satuan'
  ];

  if (sheetTP.getLastRow() <= 1) {
    for (var t = 0; t < tpMatematika.length; t++) {
      sheetTP.appendRow(['tp_mtk_' + (t + 1), 'mapel_mtk', t + 1, tpMatematika[t], nowIso, nowIso]);
    }
  }

  // 6. Lingkup Materi (LM) Matematika Kelas VI
  var sheetLM = ss.getSheetByName('lingkup_materi');
  var lmMatematika = ['Pecahan', 'Rasio'];
  if (sheetLM.getLastRow() <= 1) {
    for (var l = 0; l < lmMatematika.length; l++) {
      sheetLM.appendRow(['lm_mtk_' + (l + 1), 'mapel_mtk', l + 1, lmMatematika[l], nowIso, nowIso]);
    }
  }

  // 7. Ekstrakurikuler
  var sheetEkskul = ss.getSheetByName('ekstrakurikuler');
  if (sheetEkskul.getLastRow() <= 1) {
    sheetEkskul.appendRow(['ekskul_pramuka', 'sekolah_1', 'Pramuka', nowIso, nowIso]);
  }

  // 8. Tema Kokurikuler Kelas VI
  var sheetTema = ss.getSheetByName('tema_kokurikuler');
  if (sheetTema.getLastRow() <= 1) {
    sheetTema.appendRow([
      'tema_1',
      'kelas_6',
      'Lingkungan Sehat, Saya Kuat',
      'Projek pembiasaan gaya hidup bersih dan sehat',
      1,
      true,
      nowIso,
      nowIso
    ]);
    sheetTema.appendRow([
      'tema_2',
      'kelas_6',
      'Teman Sejati Tanpa Perundungan',
      'Projek penguatan persahabatan dan pencegahan bullying',
      2,
      true,
      nowIso,
      nowIso
    ]);
  }

  // PERHATIAN: DATA SISWA TETAP KOSONG SESUAI SPESIFIKASI
  // Sheet 'siswa', 'kelas_siswa', dan nilai tidak diisi data siswa apa pun.

  Logger.log('seedData() selesai. Data master sekolah, kurikulum, dan kelas berhasil diisi (tanpa data siswa).');
}

/**
 * Migrasi data lama (kelas I-VI) ke rombel A (1A-6A)
 */
function migrateKeRombel() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var summary = {
    sheets_backed_up: 0,
    rombel_created: 18,
    siswa_migrated: 0,
    nilai_migrated: 0,
    mapel_migrated: 0
  };

  // 1. Cadangkan tab yang diubah
  var sheetsToBackup = ['kelas', 'kelas_siswa', 'mapel', 'tema_kokurikuler', 'nilai_formatif', 'nilai_sumatif_lm', 'nilai_sumatif_semester', 'kaih', 'kehadiran', 'catatan_wali', 'nilai_ekskul'];
  for (var i = 0; i < sheetsToBackup.length; i++) {
    var sName = sheetsToBackup[i];
    var srcSheet = ss.getSheetByName(sName);
    if (srcSheet) {
      var backupName = '_' + sName + '_lama';
      if (!ss.getSheetByName(backupName)) {
        try {
          srcSheet.copyTo(ss).setName(backupName);
          summary.sheets_backed_up++;
        } catch(e) {}
      }
    }
  }

  // 2. Setup tingkat & rombel
  setupDatabase();

  // 3. Mapping kelas lama I-VI ke rombel 1A-6A
  var mapping = {
    'kelas_1': 'rombel_1a',
    'kelas_2': 'rombel_2a',
    'kelas_3': 'rombel_3a',
    'kelas_4': 'rombel_4a',
    'kelas_5': 'rombel_5a',
    'kelas_6': 'rombel_6a',
    'I': 'rombel_1a',
    'II': 'rombel_2a',
    'III': 'rombel_3a',
    'IV': 'rombel_4a',
    'V': 'rombel_5a',
    'VI': 'rombel_6a'
  };

  // Migrasikan kelas_siswa
  var sheetKS = ss.getSheetByName('kelas_siswa');
  if (sheetKS && sheetKS.getLastRow() > 1) {
    var dataKS = getSheetDataAsObjects(sheetKS);
    for (var k = 0; k < dataKS.length; k++) {
      var rowKS = dataKS[k];
      if (rowKS.kelas_id && mapping[rowKS.kelas_id]) {
        rowKS.rombel_id = mapping[rowKS.kelas_id];
        rowKS.kelas_id = mapping[rowKS.kelas_id];
        summary.siswa_migrated++;
      }
    }
    var headersKS = SCHEMAS.kelas_siswa;
    var rowsToSet = [];
    for (var r = 0; r < dataKS.length; r++) {
      var arr = [];
      for (var h = 0; h < headersKS.length; h++) {
        arr.push(dataKS[r][headersKS[h]] !== undefined ? dataKS[r][headersKS[h]] : '');
      }
      rowsToSet.push(arr);
    }
    if (rowsToSet.length > 0) {
      sheetKS.getRange(2, 1, rowsToSet.length, headersKS.length).setValues(rowsToSet);
    }
  }

  // Migrasikan tab nilai, kehadiran, catatan, dll
  var scoreSheets = ['kehadiran', 'catatan_wali', 'kaih', 'nilai_ekskul', 'penilaian_kokurikuler', 'tema_kokurikuler'];
  for (var s = 0; s < scoreSheets.length; s++) {
    var sheetScore = ss.getSheetByName(scoreSheets[s]);
    if (sheetScore && sheetScore.getLastRow() > 1) {
      var sData = getSheetDataAsObjects(sheetScore);
      var modified = false;
      for (var d = 0; d < sData.length; d++) {
        if (sData[d].kelas_id && mapping[sData[d].kelas_id]) {
          sData[d].rombel_id = mapping[sData[d].kelas_id];
          sData[d].kelas_id = mapping[sData[d].kelas_id];
          modified = true;
          summary.nilai_migrated++;
        }
      }
      if (modified && SCHEMAS[scoreSheets[s]]) {
        var hArr = SCHEMAS[scoreSheets[s]];
        var rowArr = [];
        for (var idx = 0; idx < sData.length; idx++) {
          var itemArr = [];
          for (var col = 0; col < hArr.length; col++) {
            itemArr.push(sData[idx][hArr[col]] !== undefined ? sData[idx][hArr[col]] : '');
          }
          rowArr.push(itemArr);
        }
        sheetScore.getRange(2, 1, rowArr.length, hArr.length).setValues(rowArr);
      }
    }
  }

  // 4. Mapel dipindahkan ke tingkat
  var sheetMapel = ss.getSheetByName('mapel');
  if (sheetMapel && sheetMapel.getLastRow() > 1) {
    var dataM = getSheetDataAsObjects(sheetMapel);
    var headersM = SCHEMAS.mapel;
    var rowsM = [];
    for (var m = 0; m < dataM.length; m++) {
      var mRow = dataM[m];
      if (!mRow.tingkat_id) {
        var tNum = 6;
        if (mRow.kelas_id) {
          tNum = parseInt(mRow.kelas_id.replace(/\D/g, '') || '6', 10) || 6;
        }
        mRow.tingkat_id = 'tingkat_' + tNum;
        summary.mapel_migrated++;
      }
      var arrM = [];
      for (var colM = 0; colM < headersM.length; colM++) {
        arrM.push(mRow[headersM[colM]] !== undefined ? mRow[headersM[colM]] : '');
      }
      rowsM.push(arrM);
    }
    if (rowsM.length > 0) {
      sheetMapel.getRange(2, 1, rowsM.length, headersM.length).setValues(rowsM);
    }
  }

  return summary;
}

