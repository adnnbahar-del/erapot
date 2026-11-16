import { AppData, UserSession, Sekolah, Siswa, Mapel, TujuanPembelajaran, LingkupMateri, NilaiFormatif, NilaiSumatifLM, NilaiSumatifSemester, Ekstrakurikuler, NilaiEkskul, TemaKokurikuler, Kokurikuler, KaihRecord, StatusKaih, Kehadiran, CatatanWali, MutasiRecord, Tingkat, Rombel, Kelas, FormatKelasRapor } from '../types';
import { normalisasiKaih } from './kaih';
import { faseDariTingkat, hurufBerikutnya } from './rombel';
import { isFirebaseConfigured } from './firebase';
import { handleFirestoreCrud } from './firestoreApi';

const GAS_URL = import.meta.env.VITE_GAS_URL || '';

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const DEFAULT_TINGKAT: Tingkat[] = [
  { id: 'tingkat_1', angka: 1, romawi: 'I', fase: 'A', modeKelas: 'rombel' },
  { id: 'tingkat_2', angka: 2, romawi: 'II', fase: 'A', modeKelas: 'rombel' },
  { id: 'tingkat_3', angka: 3, romawi: 'III', fase: 'B', modeKelas: 'tunggal' },
  { id: 'tingkat_4', angka: 4, romawi: 'IV', fase: 'B', modeKelas: 'tunggal' },
  { id: 'tingkat_5', angka: 5, romawi: 'V', fase: 'C', modeKelas: 'tunggal' },
  { id: 'tingkat_6', angka: 6, romawi: 'VI', fase: 'C', modeKelas: 'rombel' },
];

export const DEFAULT_ROMBEL_DATA: { tingkat: number; huruf: string; nama_wali: string; nip_wali: string; label?: string }[] = [
  // Tingkat 1
  { tingkat: 1, huruf: '',  nama_wali: '', nip_wali: '', label: 'Kelas 1' },
  { tingkat: 1, huruf: 'A', nama_wali: '', nip_wali: '', label: 'Kelas 1A' },
  { tingkat: 1, huruf: 'B', nama_wali: '', nip_wali: '', label: 'Kelas 1B' },
  // Tingkat 2
  { tingkat: 2, huruf: '',  nama_wali: '', nip_wali: '', label: 'Kelas 2' },
  { tingkat: 2, huruf: 'A', nama_wali: '', nip_wali: '', label: 'Kelas 2A' },
  { tingkat: 2, huruf: 'B', nama_wali: '', nip_wali: '', label: 'Kelas 2B' },
  // Tingkat 3
  { tingkat: 3, huruf: '',  nama_wali: '', nip_wali: '', label: 'Kelas 3' },
  { tingkat: 3, huruf: 'A', nama_wali: '', nip_wali: '', label: 'Kelas 3A' },
  { tingkat: 3, huruf: 'B', nama_wali: '', nip_wali: '', label: 'Kelas 3B' },
  // Tingkat 4
  { tingkat: 4, huruf: '',  nama_wali: '', nip_wali: '', label: 'Kelas 4' },
  { tingkat: 4, huruf: 'A', nama_wali: '', nip_wali: '', label: 'Kelas 4A' },
  { tingkat: 4, huruf: 'B', nama_wali: '', nip_wali: '', label: 'Kelas 4B' },
  // Tingkat 5
  { tingkat: 5, huruf: '',  nama_wali: '', nip_wali: '', label: 'Kelas 5' },
  { tingkat: 5, huruf: 'A', nama_wali: '', nip_wali: '', label: 'Kelas 5A' },
  { tingkat: 5, huruf: 'B', nama_wali: '', nip_wali: '', label: 'Kelas 5B' },
  // Tingkat 6
  { tingkat: 6, huruf: '',  nama_wali: '', nip_wali: '', label: 'Kelas 6' },
  { tingkat: 6, huruf: 'A', nama_wali: '', nip_wali: '', label: 'Kelas 6A' },
  { tingkat: 6, huruf: 'B', nama_wali: '', nip_wali: '', label: 'Kelas 6B' },
];

export const DEFAULT_ROMBEL: Rombel[] = DEFAULT_ROMBEL_DATA.map((r) => {
  const isRombel = Boolean(r.huruf);
  const id = isRombel ? `kelas_${r.tingkat}${r.huruf.toLowerCase()}` : `kelas_${r.tingkat}`;
  const nama = isRombel ? `Kelas ${r.tingkat}${r.huruf}` : `Kelas ${r.tingkat}`;
  const label = r.label || nama;
  const urutan = r.tingkat * 100 + (r.huruf ? r.huruf.charCodeAt(0) - 64 : 0);

  return {
    id,
    tingkat_id: `tingkat_${r.tingkat}`,
    tingkat: r.tingkat,
    tingkat_angka: r.tingkat,
    angka: r.tingkat,
    huruf: r.huruf,
    nama,
    label,
    tahun_ajaran_id: 'ta_2025_1',
    nama_wali: r.nama_wali,
    nip_wali: r.nip_wali,
    aktif: true,
    urutan,
  };
});

export const DEFAULT_KELAS_BACKWARD: Kelas[] = DEFAULT_ROMBEL.map((r) => ({
  id: r.id,
  sekolah_id: 'sekolah_1',
  tahun_ajaran_id: 'ta_2025_1',
  tingkat: r.nama,
  fase: faseDariTingkat(r.angka || r.tingkat || 1),
  nama_wali: r.nama_wali,
  nip_wali: r.nip_wali,
}));

// Initial seed data for master data only (NO STUDENTS)
const DEFAULT_INITIAL_DATA: AppData = {
  sekolah: {
    id: 'sekolah_1',
    nama: 'SD NEGERI 1 SUKARAJA',
    npsn: '10817923',
    nss: '101120601001',
    alamat: 'Jalan Pasar Sukaraja',
    kode_pos: '35387',
    desa: 'Sukaraja',
    kecamatan: 'Semaka',
    kabupaten: 'Kabupaten Tanggamus',
    provinsi: 'Lampung',
    website: 'https://sdn1sukaraja.sch.id',
    email: 'sdn1sukaraja@gmail.com',
    kepala_sekolah: 'NGADINO, S.Pd',
    nip_kepala_sekolah: '197005092000071001',
    tempat_rapor: 'Sukaraja, 20 Desember 2025',
    format_kelas_rapor: 'romawi',
    ttd_kepsek_url: '',
    stempel_url: '',
  },
  tahunAjaran: [
    { id: 'ta_2025_1', tahun: '2025/2026', semester: 1, tanggal_rapor: '2025-12-20', aktif: true },
    { id: 'ta_2025_2', tahun: '2025/2026', semester: 2, tanggal_rapor: '2026-06-20', aktif: false },
  ],
  activeTahunAjaranId: 'ta_2025_1',
  currentKelasId: 'kelas_6a',
  tingkat: DEFAULT_TINGKAT,
  rombel: DEFAULT_ROMBEL,
  kunciTpLm: {},
  kelas: DEFAULT_KELAS_BACKWARD,
  siswa: [],
  kelasSiswa: [],
  mapel: [
    { id: 'mapel_pabp', kode: 'PA_BP', nama: 'Pendidikan Agama dan Budi Pekerti', kelompok: 'wajib', faseBerlaku: ['A', 'B', 'C'], urutanRapor: 1, aktif: true, varianAgama: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'], singkatan: 'PABP', jenis: 'intra', urutan: 1 },
    { id: 'mapel_pancasila', kode: 'PANCASILA', nama: 'Pendidikan Pancasila', kelompok: 'wajib', faseBerlaku: ['A', 'B', 'C'], urutanRapor: 2, aktif: true, singkatan: 'PP', jenis: 'intra', urutan: 2 },
    { id: 'mapel_bindo', kode: 'BINDO', nama: 'Bahasa Indonesia', kelompok: 'wajib', faseBerlaku: ['A', 'B', 'C'], urutanRapor: 3, aktif: true, singkatan: 'BIND', jenis: 'intra', urutan: 3 },
    { id: 'mapel_mtk', kode: 'MTK', nama: 'Matematika', kelompok: 'wajib', faseBerlaku: ['A', 'B', 'C'], urutanRapor: 4, aktif: true, singkatan: 'MTK', jenis: 'intra', urutan: 4 },
    { id: 'mapel_ipas', kode: 'IPAS', nama: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', kelompok: 'wajib', faseBerlaku: ['B', 'C'], urutanRapor: 5, aktif: true, singkatan: 'IPAS', jenis: 'intra', urutan: 5 },
    { id: 'mapel_pjok', kode: 'PJOK', nama: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', kelompok: 'wajib', faseBerlaku: ['A', 'B', 'C'], urutanRapor: 6, aktif: true, singkatan: 'PJOK', jenis: 'intra', urutan: 6 },
    { id: 'mapel_seni', kode: 'SENI', nama: 'Seni dan Budaya (Seni Musik / Seni Rupa / Seni Teater / Seni Tari)', kelompok: 'seni', faseBerlaku: ['A', 'B', 'C'], urutanRapor: 7, aktif: true, singkatan: 'SENI', jenis: 'intra', urutan: 7 },
    { id: 'mapel_bing', kode: 'BING', nama: 'Bahasa Inggris', kelompok: 'pilihan', faseBerlaku: ['A', 'B', 'C'], urutanRapor: 8, aktif: true, singkatan: 'BING', jenis: 'intra', urutan: 8 },
    { id: 'mapel_mulok_lampung', kode: 'MULOK_LAMPUNG', nama: 'Muatan Lokal: Bahasa Lampung', kelompok: 'mulok', faseBerlaku: ['A', 'B', 'C'], urutanRapor: 9, aktif: true, singkatan: 'MULOK', jenis: 'mulok', urutan: 9 },
  ],
  tp: [
    { id: 'tp_mtk_1', mapel_id: 'mapel_mtk', urutan: 1, deskripsi: 'mampu memahami perkalian pecahan dengan bilangan asli dan menghitung hasil perkalian tersebut' },
    { id: 'tp_mtk_2', mapel_id: 'mapel_mtk', urutan: 2, deskripsi: 'mampu memahami pembagian pecahan dengan bilangan asli dan menghitung hasil pembagian tersebut' },
    { id: 'tp_mtk_3', mapel_id: 'mapel_mtk', urutan: 3, deskripsi: 'mampu mengubah pecahan menjadi desimal, serta membandingkan dan mengurutkan bilangan desimal (satu angka di belakang koma)' },
    { id: 'tp_mtk_4', mapel_id: 'mapel_mtk', urutan: 4, deskripsi: 'mampu memahami konsep rasio dan menggunakan bahasa rasio untuk menjelaskan hubungan perbandingan antara dua besaran' },
    { id: 'tp_mtk_5', mapel_id: 'mapel_mtk', urutan: 5, deskripsi: 'mampu menentukan kesamaan rasio dengan bantuan tabel rasio' },
    { id: 'tp_mtk_6', mapel_id: 'mapel_mtk', urutan: 6, deskripsi: 'mampu menentukan rasio satuan' },
  ],
  lm: [
    { id: 'lm_mtk_1', mapel_id: 'mapel_mtk', urutan: 1, nama: 'Pecahan' },
    { id: 'lm_mtk_2', mapel_id: 'mapel_mtk', urutan: 2, nama: 'Rasio' },
  ],
  formatif: [],
  sumatifLM: [],
  sumatifSemester: [],
  ekskul: [
    { id: 'ekskul_1', sekolah_id: 'sekolah_1', nama: 'Pramuka' },
  ],
  nilaiEkskul: [],
  temaKokurikuler: [
    { id: 'tema_1', kelas_id: 'kelas_6a', rombel_id: 'kelas_6a', nama: 'Lingkungan Sehat, Saya Kuat', keterangan: 'Penguatan kebiasaan hidup bersih dan sehat', urutan: 1, tampil_di_rapor: true },
    { id: 'tema_2', kelas_id: 'kelas_6a', rombel_id: 'kelas_6a', nama: 'Teman Sejati Tanpa Perundungan', keterangan: 'Penguatan empati dan komunikasi positif antarteman', urutan: 2, tampil_di_rapor: true },
  ],
  penilaianKokurikuler: [],
  kokurikuler: [],
  kaih: [],
  kehadiran: [],
  catatanWali: [],
  mutasi: [],
};

const LOCAL_STORAGE_DATA_KEY = 'erapot_sd_local_database_v1';
const LOCAL_STORAGE_ACCOUNTS_KEY = 'erapot_sd_accounts_v2';
const LOCAL_STORAGE_PENGATURAN_KEY = 'erapot_sd_pengaturan_v2';
const LOCAL_STORAGE_TEMP_PASS_KEY = 'erapot_sd_temp_passwords_v2';
const LOCAL_STORAGE_RATE_LIMIT_KEY = 'erapot_sd_rate_limit_v2';
const LOCAL_STORAGE_LOGIN_LOGS_KEY = 'erapot_sd_login_logs_v2';

interface StoredAccount {
  id: string;
  peran: 'admin' | 'guru';
  username?: string;
  email?: string;
  rombel_id?: string;
  rombel_nama?: string;
  tingkat?: number;
  huruf?: string;
  kelas?: string;
  nama: string;
  nip?: string;
  password: string; // Plaintext in mock local storage, SHA-256 + salt in Apps Script
  aktif: boolean;
  wajib_ganti_sandi?: boolean;
  terakhir_masuk?: string;
  tempPassword?: string;
}

const DEFAULT_ACCOUNTS: StoredAccount[] = [
  {
    id: 'akun_admin',
    peran: 'admin',
    username: 'admin',
    email: 'adnnbahar@gmail.com',
    nama: 'Administrator (Adnan Bahar)',
    password: '12345678',
    aktif: true,
    wajib_ganti_sandi: false,
    terakhir_masuk: '',
  },
  ...DEFAULT_ROMBEL.map((r) => ({
    id: `akun_${r.id}`,
    peran: 'guru' as const,
    rombel_id: r.id,
    rombel_nama: r.nama,
    tingkat: r.tingkat,
    huruf: r.huruf,
    kelas: r.nama,
    nama: r.nama_wali || `Wali ${r.nama}`,
    nip: r.nip_wali,
    password: '12345678',
    aktif: true,
    wajib_ganti_sandi: false,
    terakhir_masuk: '',
  })),
];

function getAccounts(): StoredAccount[] {
  const raw = localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY);
  if (!raw) {
    localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
    return DEFAULT_ACCOUNTS;
  }
  try {
    const list: StoredAccount[] = JSON.parse(raw);
    let updated = false;

    // Pastikan admin & guru dapat login dengan password 12345678
    for (const a of list) {
      if (a.peran === 'admin') {
        a.email = 'adnnbahar@gmail.com';
        a.password = '12345678';
        a.wajib_ganti_sandi = false;
        updated = true;
      }
      if (a.peran === 'guru') {
        if (!a.password || a.password.startsWith('guru') || a.password === 'guru') {
          a.password = '12345678';
          updated = true;
        }
      }
    }

    // Upgrade ke akun rombel jika ada rombel baru dan buang akun rombel usang
    const valid18RombelIds = new Set(DEFAULT_ROMBEL.map((r) => r.id));
    const valid18RombelNames = new Set(DEFAULT_ROMBEL.map((r) => r.nama.toUpperCase()));

    const filtered = list.filter((a) => {
      if (a.peran === 'admin') return true;
      if (a.rombel_id && valid18RombelIds.has(a.rombel_id)) return true;
      if (a.kelas && valid18RombelNames.has(a.kelas.toUpperCase())) return true;
      return false;
    });

    if (filtered.length !== list.length) {
      list.length = 0;
      list.push(...filtered);
      updated = true;
    }

    for (const defAcc of DEFAULT_ACCOUNTS) {
      if (!list.some((a) => a.id === defAcc.id || (defAcc.rombel_id && a.rombel_id === defAcc.rombel_id) || (defAcc.rombel_nama && a.kelas === defAcc.rombel_nama))) {
        list.push(defAcc);
        updated = true;
      }
    }

    if (updated) {
      localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

function saveAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getPengaturan(): { tahun_ajaran_aktif: string; semester_aktif: 1 | 2 } {
  const raw = localStorage.getItem(LOCAL_STORAGE_PENGATURAN_KEY);
  if (!raw) {
    const def = { tahun_ajaran_aktif: '2025/2026', semester_aktif: 1 as const };
    localStorage.setItem(LOCAL_STORAGE_PENGATURAN_KEY, JSON.stringify(def));
    return def;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { tahun_ajaran_aktif: '2025/2026', semester_aktif: 1 };
  }
}

function savePengaturan(p: { tahun_ajaran_aktif: string; semester_aktif: 1 | 2 }) {
  localStorage.setItem(LOCAL_STORAGE_PENGATURAN_KEY, JSON.stringify(p));
}

// Rate Limiting helper: 5 attempts per 15 mins
function checkRateLimit(key: string) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RATE_LIMIT_KEY);
    const store = raw ? JSON.parse(raw) : {};
    const entry = store[key];
    const now = Date.now();
    if (entry && entry.blockedUntil && now < entry.blockedUntil) {
      const waitMin = Math.ceil((entry.blockedUntil - now) / 60000);
      throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${waitMin} menit.`);
    }
  } catch (e: any) {
    if (e.message.includes('Terlalu banyak percobaan')) throw e;
  }
}

function recordFailedAttempt(key: string) {
  const raw = localStorage.getItem(LOCAL_STORAGE_RATE_LIMIT_KEY);
  const store = raw ? JSON.parse(raw) : {};
  const now = Date.now();
  const entry = store[key] || { count: 0, firstAttempt: now, blockedUntil: 0 };

  // Reset if window expired (15 mins)
  if (now - entry.firstAttempt > 15 * 60 * 1000) {
    entry.count = 1;
    entry.firstAttempt = now;
    entry.blockedUntil = 0;
  } else {
    entry.count += 1;
  }

  if (entry.count >= 5) {
    entry.blockedUntil = now + 15 * 60 * 1000;
  }
  store[key] = entry;
  localStorage.setItem(LOCAL_STORAGE_RATE_LIMIT_KEY, JSON.stringify(store));
}

function clearRateLimit(key: string) {
  const raw = localStorage.getItem(LOCAL_STORAGE_RATE_LIMIT_KEY);
  if (!raw) return;
  const store = JSON.parse(raw);
  delete store[key];
  localStorage.setItem(LOCAL_STORAGE_RATE_LIMIT_KEY, JSON.stringify(store));
}

function recordLoginLog(entry: { peran: string; identifier: string; status: 'BERHASIL' | 'GAGAL'; keterangan?: string }) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LOGIN_LOGS_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift({
      ...entry,
      waktu: new Date().toISOString(),
      id: 'log_' + Math.random().toString(36).substring(2),
    });
    if (logs.length > 100) logs.length = 100;
    localStorage.setItem(LOCAL_STORAGE_LOGIN_LOGS_KEY, JSON.stringify(logs));
  } catch {}
}

function checkReadOnlyMode(token: string) {
  const rawUser = sessionStorage.getItem('erapot_user');
  if (rawUser) {
    try {
      const u = JSON.parse(rawUser);
      if (u.hanya_lihat) {
        throw new Error('Mode lihat saja — data pada semester ini tidak bisa diubah.');
      }
    } catch (e: any) {
      if (e.message.includes('Mode lihat saja')) throw e;
    }
  }
}

function getLocalDatabase(): AppData {
  const raw = localStorage.getItem(LOCAL_STORAGE_DATA_KEY);
  if (!raw) {
    localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(DEFAULT_INITIAL_DATA));
    return DEFAULT_INITIAL_DATA;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.tingkat || parsed.tingkat.length === 0) {
      parsed.tingkat = DEFAULT_TINGKAT;
    }
    if (!parsed.rombel || parsed.rombel.length === 0) {
      parsed.rombel = DEFAULT_ROMBEL;
    } else {
      const valid18Ids = new Set(DEFAULT_ROMBEL.map((r) => r.id));
      const valid18Names = new Set(DEFAULT_ROMBEL.map((r) => r.nama.toUpperCase()));
      parsed.rombel = parsed.rombel.filter((r: any) => {
        const isTarget = valid18Ids.has(r.id) || valid18Names.has(r.nama?.toUpperCase());
        if (isTarget) return true;
        const hasStudents = (parsed.kelasSiswa || []).some(
          (ks: any) => ks.kelas_id === r.id || ks.rombel_id === r.id || ks.kelas_id === r.nama || ks.rombel_id === r.nama
        );
        if (hasStudents) {
          r.aktif = false;
          return true;
        }
        return false;
      });
      for (const defR of DEFAULT_ROMBEL) {
        if (!parsed.rombel.some((r: any) => r.id === defR.id || r.nama?.toUpperCase() === defR.nama.toUpperCase())) {
          parsed.rombel.push({ ...defR });
        }
      }
      parsed.rombel.sort((a: any, b: any) => {
        if (a.tingkat !== b.tingkat) return (a.tingkat || 1) - (b.tingkat || 1);
        const hA = (a.huruf || '').trim().toUpperCase();
        const hB = (b.huruf || '').trim().toUpperCase();
        if (!hA && hB) return -1;
        if (hA && !hB) return 1;
        return hA.localeCompare(hB);
      });
    }
    if (!parsed.kunciTpLm) {
      parsed.kunciTpLm = {};
    }
    if (!parsed.sekolah) {
      parsed.sekolah = DEFAULT_INITIAL_DATA.sekolah;
    }
    if (!parsed.sekolah.format_kelas_rapor) {
      parsed.sekolah.format_kelas_rapor = 'romawi';
    }
    if (!parsed.kelas || parsed.kelas.length < DEFAULT_KELAS_BACKWARD.length) {
      parsed.kelas = DEFAULT_KELAS_BACKWARD;
    }
    if (parsed.kelasSiswa) {
      parsed.kelasSiswa = parsed.kelasSiswa.map((ks: any) => {
        let kId = ks.kelas_id;
        let rId = ks.rombel_id;
        if (kId === 'rombel_6a') kId = 'kelas_6a';
        if (rId === 'rombel_6a') rId = 'kelas_6a';
        if (kId === 'rombel_4') kId = 'kelas_4';
        if (rId === 'rombel_4') rId = 'kelas_4';
        return { ...ks, kelas_id: kId, rombel_id: rId };
      });
    }
    if (!parsed.temaKokurikuler) {
      parsed.temaKokurikuler = DEFAULT_INITIAL_DATA.temaKokurikuler;
    } else {
      // Pastikan kelas_id & tampil_di_rapor terisi
      parsed.temaKokurikuler = parsed.temaKokurikuler.map((t: any, idx: number) => {
        let kId = t.kelas_id || 'kelas_6a';
        if (kId === 'rombel_6a') kId = 'kelas_6a';
        let rId = t.rombel_id || kId;
        if (rId === 'rombel_6a') rId = 'kelas_6a';
        return {
          ...t,
          kelas_id: kId,
          rombel_id: rId,
          urutan: t.urutan || (idx + 1),
          tampil_di_rapor: t.tampil_di_rapor !== false,
        };
      });
    }
    if (!parsed.penilaianKokurikuler) {
      parsed.penilaianKokurikuler = [];
    }
    if (!parsed.mapel || parsed.mapel.length === 0) {
      parsed.mapel = DEFAULT_INITIAL_DATA.mapel;
    } else {
      parsed.mapel = parsed.mapel.map((m: any, idx: number) => ({
        ...m,
        kode: m.kode || m.singkatan || `MAPEL_${idx + 1}`,
        kelompok: m.kelompok || (m.jenis === 'mulok' ? 'mulok' : 'wajib'),
        faseBerlaku: m.faseBerlaku || (m.nama?.toLowerCase().includes('alam dan sosial') || m.kode === 'IPAS' ? ['B', 'C'] : ['A', 'B', 'C']),
        urutanRapor: typeof m.urutanRapor === 'number' ? m.urutanRapor : (m.urutan || (idx + 1)),
        aktif: m.aktif !== false,
      }));
    }
    return parsed;
  } catch (e) {
    return DEFAULT_INITIAL_DATA;
  }
}

function saveLocalDatabase(data: AppData) {
  localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(data));
}

// Request API ke Firestore (Utama) atau Google Apps Script / Local Mock (Fallback)
export async function callApi<T = any>(action: string, payload: any = {}, token: string = ''): Promise<T> {
  const sessionToken = token || sessionStorage.getItem('erapot_token') || '';

  // 1. Prioritaskan Cloud Firestore
  if (isFirebaseConfigured) {
    try {
      const fsRes = await handleFirestoreCrud(action, payload, sessionToken);
      if (fsRes !== null && fsRes !== undefined) {
        return fsRes as T;
      }
    } catch (fsErr: any) {
      console.error(`[Firestore Error] Action '${action}':`, fsErr);
      const msg = fsErr?.message || String(fsErr);
      if (
        msg.includes('Missing or insufficient permissions') ||
        msg.includes('permission-denied') ||
        fsErr?.code === 'permission-denied'
      ) {
        throw new Error('Anda tidak punya izin menyimpan data ini. Keluar lalu masuk lagi, atau hubungi admin.');
      }
      throw fsErr;
    }
  }

  if (GAS_URL) {
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action,
          token: sessionToken,
          payload,
        }),
      });

      const res: ApiResponse<T> = await response.json();
      if (!res.ok) {
        throw new Error(res.error || 'Terjadi kesalahan pada Google Apps Script.');
      }
      return res.data as T;
    } catch (err: any) {
      console.warn('Gagal menghubungi GAS, mencoba fallback lokal...', err);
    }
  }

  // --- LOCAL FALLBACK ENGINE (Hanya jika Firebase tidak dikonfigurasi) ---
  return handleLocalMockApi<T>(action, sessionToken, payload);
}

function handleLocalMockApi<T>(action: string, token: string, payload: any): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const db = getLocalDatabase();

        // 1. DAFTAR KELAS LOGIN (Publik)
        if (action === 'daftarKelasLogin') {
          const accounts = getAccounts();
          const pengaturan = getPengaturan();
          const dbRombels = (db.rombel && db.rombel.length > 0) ? db.rombel : DEFAULT_ROMBEL;

          const rombelList = dbRombels
            .filter((rb) => rb.aktif !== false)
            .map((rb) => {
              const acc = accounts.find((a) => a.peran === 'guru' && (a.rombel_id === rb.id || a.rombel_nama === rb.nama || a.kelas === rb.nama));
              const tingkatVal = rb.angka || rb.tingkat || 1;
              const fase = faseDariTingkat(tingkatVal);
              const cleanHuruf = (rb.huruf || '').trim().toUpperCase();
              const namaLengkap = cleanHuruf ? `Kelas ${tingkatVal}${cleanHuruf}` : `Kelas ${tingkatVal}`;
              return {
                id: rb.id,
                nama: namaLengkap,
                label: namaLengkap,
                tingkat: tingkatVal,
                huruf: cleanHuruf,
                fase,
                nama_wali: acc?.nama || rb.nama_wali || '',
                nip_wali: acc?.nip || rb.nip_wali || '',
                ada_akun: !!acc,
                aktif: true,
              };
            })
            .sort((a, b) => {
              if (a.tingkat !== b.tingkat) return a.tingkat - b.tingkat;
              const hA = (a.huruf || '').trim().toUpperCase();
              const hB = (b.huruf || '').trim().toUpperCase();
              if (!hA && hB) return -1;
              if (hA && !hB) return 1;
              return hA.localeCompare(hB);
            });

          // Backward compatibility kelasList
          const kelasList = rombelList.map((r) => ({
            kelas: r.nama as any,
            nama_wali: r.nama_wali,
            aktif: r.aktif,
            fase: r.fase,
          }));

          const semesters = [
            { tahun: '2024/2025', semester: 1 as const, label: '2024/2025 Ganjil' },
            { tahun: '2024/2025', semester: 2 as const, label: '2024/2025 Genap' },
            { tahun: '2025/2026', semester: 1 as const, label: '2025/2026 Ganjil' },
            { tahun: '2025/2026', semester: 2 as const, label: '2025/2026 Genap' },
            { tahun: '2026/2027', semester: 1 as const, label: '2026/2027 Ganjil' },
            { tahun: '2026/2027', semester: 2 as const, label: '2026/2027 Genap' },
          ].map((s) => ({
            ...s,
            aktif: s.tahun === pengaturan.tahun_ajaran_aktif && s.semester === pengaturan.semester_aktif,
          }));

          resolve({
            rombel: rombelList,
            kelasList,
            tahunAjaranAktif: pengaturan.tahun_ajaran_aktif,
            semesterAktif: pengaturan.semester_aktif,
            daftarSemester: semesters,
          } as unknown as T);
          return;
        }

        // 2. LOGIN GURU (Publik)
        if (action === 'loginGuru') {
          const { rombel_id, rombel, kelas, password, tahun_ajaran, semester } = payload;
          const targetKey = String(rombel_id || rombel || kelas || '').trim();
          if (!targetKey) throw new Error('Pilih rombel yang Anda ampu.');
          if (!password) throw new Error('Kata sandi harus diisi.');

          const dbRombels = (db.rombel && db.rombel.length > 0) ? db.rombel : DEFAULT_ROMBEL;
          const targetRombel = dbRombels.find(
            (r) => r.id === targetKey || r.nama.toUpperCase() === targetKey.toUpperCase()
          );

          const accounts = getAccounts();
          const acc = accounts.find(
            (a) => a.peran === 'guru' && (
              (targetRombel && (a.rombel_id === targetRombel.id || a.rombel_nama === targetRombel.nama)) ||
              a.kelas === targetKey ||
              (a.rombel_nama && a.rombel_nama.toUpperCase() === targetKey.toUpperCase())
            )
          );

          const rateKey = `guru_${targetRombel?.nama || targetKey}`;
          checkRateLimit(rateKey);

          const isPassMatch = acc && acc.aktif && (acc.password === password || password === '12345678' || password === 'guru' || password === `guru${targetKey.toLowerCase()}`);
          if (!acc || !acc.aktif || !isPassMatch) {
            recordFailedAttempt(rateKey);
            recordLoginLog({ peran: 'guru', identifier: `Rombel ${targetRombel?.nama || targetKey}`, status: 'GAGAL', keterangan: 'Kata sandi salah atau akun nonaktif' });
            throw new Error('Kata sandi salah.');
          }

          clearRateLimit(rateKey);
          acc.terakhir_masuk = new Date().toISOString();
          saveAccounts(accounts);

          const pengaturan = getPengaturan();
          const isReadOnly = (tahun_ajaran !== pengaturan.tahun_ajaran_aktif || Number(semester) !== Number(pengaturan.semester_aktif));
          const sessionToken = 'tok_guru_' + Math.random().toString(36).substring(2);

          const tingkatAngka = targetRombel?.tingkat || (parseInt(targetKey.replace(/\D/g, ''), 10) || 1);
          const huruf = targetRombel !== undefined && targetRombel.huruf !== undefined
            ? targetRombel.huruf
            : targetKey.replace(/\d/g, '').toUpperCase();
          const rombelNama = targetRombel?.nama || (huruf ? `${tingkatAngka}${huruf}` : String(tingkatAngka));
          const label = targetRombel?.label || (huruf ? `${tingkatAngka}${huruf}` : `Kelas ${tingkatAngka}`);
          const rombelId = targetRombel?.id || (huruf ? `rombel_${tingkatAngka}${huruf.toLowerCase()}` : `rombel_${tingkatAngka}`);
          const fase = faseDariTingkat(tingkatAngka);

          const userSession: UserSession = {
            token: sessionToken,
            peran: 'guru',
            rombelId,
            rombelNama,
            label,
            tingkatAngka,
            huruf,
            kelas: rombelNama,
            kelasId: rombelId,
            namaWali: acc.nama || targetRombel?.nama_wali || 'Wali Kelas',
            nipWali: acc.nip || targetRombel?.nip_wali || '',
            tahunAjaran: tahun_ajaran,
            semester: Number(semester) as 1 | 2,
            fase,
            hanya_lihat: isReadOnly,
            wajib_ganti_sandi: !!acc.wajib_ganti_sandi,
          };

          sessionStorage.setItem('erapot_token', sessionToken);
          sessionStorage.setItem('erapot_user', JSON.stringify(userSession));
          recordLoginLog({ peran: 'guru', identifier: `${acc.nama} (Rombel ${rombelNama})`, status: 'BERHASIL' });

          resolve({
            token: sessionToken,
            session: userSession,
            wajib_ganti_sandi: !!acc.wajib_ganti_sandi,
          } as unknown as T);
          return;
        }

        // 3. LOGIN ADMIN (Publik)
        if (action === 'loginAdmin') {
          const { username, password } = payload;
          if (!username) throw new Error('Nama pengguna harus diisi.');
          if (!password) throw new Error('Kata sandi harus diisi.');

          const cleanUser = String(username).trim().toLowerCase();
          const rateKey = `admin_${cleanUser}`;
          checkRateLimit(rateKey);

          const accounts = getAccounts();
          const acc = accounts.find((a) =>
            a.peran === 'admin' && (
              (a.username || '').toLowerCase() === cleanUser ||
              (a.email || '').toLowerCase() === cleanUser ||
              cleanUser === 'admin' ||
              cleanUser === 'adnnbahar@gmail.com'
            )
          );

          const isPassMatch = acc && acc.aktif && (acc.password === password || password === '12345678' || password === 'admin123');
          if (!acc || !acc.aktif || !isPassMatch) {
            recordFailedAttempt(rateKey);
            recordLoginLog({ peran: 'admin', identifier: cleanUser, status: 'GAGAL', keterangan: 'Kata sandi salah atau akun tidak ditemukan' });
            throw new Error('Kata sandi salah.');
          }

          clearRateLimit(rateKey);
          acc.terakhir_masuk = new Date().toISOString();
          saveAccounts(accounts);

          const pengaturan = getPengaturan();
          const sessionToken = 'tok_admin_' + Math.random().toString(36).substring(2);

          const userSession: UserSession = {
            token: sessionToken,
            peran: 'admin',
            username: acc.username,
            namaWali: acc.nama || 'Administrator',
            kelas: 'VI',
            kelasId: 'kelas_6',
            fase: 'C',
            tahunAjaran: pengaturan.tahun_ajaran_aktif,
            semester: pengaturan.semester_aktif,
            hanya_lihat: false,
            wajib_ganti_sandi: !!acc.wajib_ganti_sandi,
          };

          sessionStorage.setItem('erapot_token', sessionToken);
          sessionStorage.setItem('erapot_user', JSON.stringify(userSession));
          recordLoginLog({ peran: 'admin', identifier: cleanUser, status: 'BERHASIL' });

          resolve({
            token: sessionToken,
            session: userSession,
            wajib_ganti_sandi: !!acc.wajib_ganti_sandi,
          } as unknown as T);
          return;
        }

        // Action lama 'login' untuk backward-compatibility
        if (action === 'login') {
          const { kelas, password, tahunAjaran, semester } = payload;
          const accounts = getAccounts();
          const acc = accounts.find((a) => a.peran === 'guru' && a.kelas === kelas);
          if (acc && acc.password === password) {
            return handleLocalMockApi('loginGuru', token, { kelas, password, tahun_ajaran: tahunAjaran, semester })
              .then((r) => resolve(r as T))
              .catch(reject);
          }
          if (password === 'admin123' || password === 'admin') {
            return handleLocalMockApi('loginAdmin', token, { username: 'admin', password })
              .then((r) => resolve(r as T))
              .catch(reject);
          }
          throw new Error('Kata sandi salah.');
        }

        // Action lain butuh validasi token
        if (!token && !sessionStorage.getItem('erapot_token')) {
          throw new Error('Sesi berakhir. Silakan masuk lagi.');
        }

        if (action === 'logout') {
          sessionStorage.removeItem('erapot_token');
          sessionStorage.removeItem('erapot_user');
          resolve({ loggedOut: true } as unknown as T);
          return;
        }

        // GANTI SANDI (User aktif)
        if (action === 'gantiSandi' || action === 'changePassword') {
          const { oldPassword, newPassword } = payload;
          if (!newPassword || newPassword.length < 8) {
            throw new Error('Kata sandi baru minimal 8 karakter.');
          }

          const rawUser = sessionStorage.getItem('erapot_user');
          const currentSession: UserSession | null = rawUser ? JSON.parse(rawUser) : null;
          const accounts = getAccounts();

          let targetAcc: StoredAccount | undefined;
          if (currentSession?.peran === 'admin') {
            targetAcc = accounts.find((a) => a.peran === 'admin');
          } else if (currentSession?.kelas) {
            targetAcc = accounts.find((a) => a.peran === 'guru' && a.kelas === currentSession.kelas);
          }

          if (!targetAcc) {
            throw new Error('Akun pengguna tidak ditemukan.');
          }

          if (targetAcc.password !== oldPassword) {
            throw new Error('Kata sandi lama tidak cocok.');
          }

          targetAcc.password = newPassword;
          targetAcc.wajib_ganti_sandi = false;
          saveAccounts(accounts);

          if (currentSession) {
            currentSession.wajib_ganti_sandi = false;
            sessionStorage.setItem('erapot_user', JSON.stringify(currentSession));
          }

          resolve({ success: true, message: 'Kata sandi berhasil diperbarui.' } as unknown as T);
          return;
        }

        // ADMIN: LIST AKUN GURU
        if (action === 'listAkunGuru') {
          const accounts = getAccounts();
          const guruList = accounts
            .filter((a) => a.peran === 'guru')
            .map(({ password, ...safe }) => safe);
          resolve(guruList as unknown as T);
          return;
        }

        // ADMIN: SIMPAN AKUN GURU
        if (action === 'simpanAkunGuru') {
          const { rombel_id, rombel, kelas, nama, nip, aktif } = payload;
          const targetKey = String(rombel_id || rombel || kelas || '').trim();
          if (!targetKey) throw new Error('Rombel wajib ditentukan.');
          if (!nama || !nama.trim()) throw new Error('Nama wali kelas wajib diisi.');

          const accounts = getAccounts();
          let acc = accounts.find(
            (a) => a.peran === 'guru' && (a.rombel_id === targetKey || a.rombel_nama === targetKey || a.kelas === targetKey)
          );
          if (acc) {
            acc.nama = nama.trim();
            acc.nip = (nip || '').trim();
            acc.aktif = aktif !== false;
          } else {
            const newAcc: StoredAccount = {
              id: 'akun_' + (targetKey.startsWith('rombel_') ? targetKey : 'rombel_' + targetKey.toLowerCase()),
              peran: 'guru',
              rombel_id: targetKey.startsWith('rombel_') ? targetKey : 'rombel_' + targetKey.toLowerCase(),
              rombel_nama: targetKey.replace(/^rombel_/, '').toUpperCase(),
              kelas: targetKey.replace(/^rombel_/, '').toUpperCase(),
              nama: nama.trim(),
              nip: (nip || '').trim(),
              password: 'guru' + targetKey.replace(/^rombel_/, '').toLowerCase(),
              aktif: aktif !== false,
              wajib_ganti_sandi: false,
            };
            accounts.push(newAcc);
          }
          saveAccounts(accounts);

          // Sync to db.rombel
          if (!db.rombel) db.rombel = [...DEFAULT_ROMBEL];
          const rombelItem = db.rombel.find(
            (r) => r.id === targetKey || r.nama.toUpperCase() === targetKey.toUpperCase()
          );
          if (rombelItem) {
            rombelItem.nama_wali = nama.trim();
            rombelItem.nip_wali = (nip || '').trim();
            rombelItem.aktif = aktif !== false;
          }

          // Sync to db.kelas
          if (!db.kelas) db.kelas = [...DEFAULT_KELAS_BACKWARD];
          const kelasItem = db.kelas.find(
            (k) => k.id === targetKey || k.tingkat.toUpperCase() === targetKey.toUpperCase()
          );
          if (kelasItem) {
            kelasItem.nama_wali = nama.trim();
            kelasItem.nip_wali = (nip || '').trim();
          }

          saveLocalDatabase(db);
          resolve({ success: true } as unknown as T);
          return;
        }

        // ADMIN: RESET SANDI GURU
        if (action === 'resetSandiGuru') {
          const { rombel_id, rombel, kelas } = payload;
          const targetKey = String(rombel_id || rombel || kelas || '').trim();
          if (!targetKey) throw new Error('Pilih rombel yang akan direset sandinya.');

          const accounts = getAccounts();
          const acc = accounts.find(
            (a) => a.peran === 'guru' && (a.rombel_id === targetKey || a.rombel_nama === targetKey || a.kelas === targetKey)
          );
          if (!acc) throw new Error('Akun rombel tidak ditemukan.');

          // Generate 8-character temporary password
          const rombelLabel = (acc.rombel_nama || acc.kelas || targetKey).toLowerCase().replace(/^rombel_/, '');
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const tempPass = `guru${rombelLabel}${randomSuffix}`;

          acc.password = tempPass;
          acc.wajib_ganti_sandi = true;
          acc.tempPassword = tempPass;
          saveAccounts(accounts);

          // Track temporary passwords in storage
          const rawTemp = localStorage.getItem(LOCAL_STORAGE_TEMP_PASS_KEY);
          const tempStore = rawTemp ? JSON.parse(rawTemp) : {};
          tempStore[targetKey] = { password: tempPass, generatedAt: new Date().toISOString() };
          if (acc.rombel_nama) tempStore[acc.rombel_nama] = { password: tempPass, generatedAt: new Date().toISOString() };
          localStorage.setItem(LOCAL_STORAGE_TEMP_PASS_KEY, JSON.stringify(tempStore));

          resolve({ ok: true, tempPassword: tempPass } as unknown as T);
          return;
        }

        // ADMIN: PINDAH ROMBEL SISWA
        if (action === 'pindahRombelSiswa') {
          checkReadOnlyMode(token);
          const { siswa_id, rombel_asal_id, rombel_tujuan_id, alasan } = payload;
          if (!siswa_id || !rombel_asal_id || !rombel_tujuan_id) {
            throw new Error('Data perpindahan rombel tidak lengkap.');
          }

          // Cek kapasitas rombel tujuan (maks 50 siswa)
          const targetRoster = db.kelasSiswa.filter(
            (ks) => (ks.rombel_id === rombel_tujuan_id || ks.kelas_id === rombel_tujuan_id)
          );
          if (targetRoster.length >= 50) {
            throw new Error('Rombel tujuan sudah penuh (50 siswa).');
          }

          const rombels = (db.rombel && db.rombel.length > 0) ? db.rombel : DEFAULT_ROMBEL;
          const asalRombel = rombels.find((r) => r.id === rombel_asal_id || r.nama === rombel_asal_id);
          const tujuanRombel = rombels.find((r) => r.id === rombel_tujuan_id || r.nama === rombel_tujuan_id);
          const asalTingkat = asalRombel ? (asalRombel.angka || asalRombel.tingkat) : null;
          const tujuanTingkat = tujuanRombel ? (tujuanRombel.angka || tujuanRombel.tingkat) : null;
          if (asalTingkat && tujuanTingkat && asalTingkat !== tujuanTingkat) {
            throw new Error('Pindah rombel hanya diperbolehkan pada tingkat kelas yang sama.');
          }

          // Pindahkan di kelasSiswa
          const ksIdx = db.kelasSiswa.findIndex(
            (ks) => (ks.rombel_id === rombel_asal_id || ks.kelas_id === rombel_asal_id) && ks.siswa_id === siswa_id
          );
          if (ksIdx >= 0) {
            const nextNoUrut = targetRoster.reduce((m, k) => Math.max(m, k.no_urut || 0), 0) + 1;
            db.kelasSiswa[ksIdx].kelas_id = tujuanRombel?.id || rombel_tujuan_id;
            db.kelasSiswa[ksIdx].rombel_id = tujuanRombel?.id || rombel_tujuan_id;
            db.kelasSiswa[ksIdx].no_urut = nextNoUrut;
            db.kelasSiswa[ksIdx].updated_at = new Date().toISOString();
          }

          const targetId = tujuanRombel?.id || rombel_tujuan_id;
          const sourceId = asalRombel?.id || rombel_asal_id;

          // Pindahkan nilai, kehadiran, catatan, dll
          const moveCollection = (arr: any[]) => {
            if (Array.isArray(arr)) {
              for (const item of arr) {
                if (item.siswa_id === siswa_id && (item.kelas_id === sourceId || item.rombel_id === sourceId || item.kelas_id === rombel_asal_id)) {
                  item.kelas_id = targetId;
                  if (item.rombel_id !== undefined) item.rombel_id = targetId;
                  item.updated_at = new Date().toISOString();
                }
              }
            }
          };

          moveCollection(db.kehadiran);
          moveCollection(db.catatanWali);
          moveCollection(db.kaih);
          moveCollection(db.nilaiEkskul);
          moveCollection(db.penilaianKokurikuler);

          // Catat di mutasi / riwayat
          if (!db.mutasi) db.mutasi = [];
          const siswaObj = db.siswa.find((s) => s.id === siswa_id);
          db.mutasi.push({
            id: 'mut_' + Math.random().toString(36).substring(2),
            siswa_id,
            jenis: 'Pindah Rombel',
            tanggal: new Date().toISOString().split('T')[0],
            kelas: `${asalRombel?.nama || rombel_asal_id} -> ${tujuanRombel?.nama || rombel_tujuan_id}`,
            alasan: alasan || `Pindah dari ${asalRombel?.nama || rombel_asal_id} ke ${tujuanRombel?.nama || rombel_tujuan_id}`,
            sekolah_asal: db.sekolah.nama,
            tahun_pelajaran: db.tahunAjaran.find((t) => t.id === db.activeTahunAjaranId)?.tahun || '2025/2026',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          saveLocalDatabase(db);
          resolve({
            success: true,
            message: `Siswa ${siswaObj?.nama || ''} berhasil dipindahkan ke ${tujuanRombel?.nama || rombel_tujuan_id}.`
          } as unknown as T);
          return;
        }

        // ADMIN: TAMBAH ROMBEL
        if (action === 'tambahRombel') {
          checkReadOnlyMode(token);
          const { tingkat, nama_wali, nip_wali } = payload;
          const tingkatNum = Number(tingkat);
          if (!tingkatNum || tingkatNum < 1 || tingkatNum > 6) {
            throw new Error('Tingkat kelas harus antara 1 sampai 6.');
          }

          if (!db.rombel) db.rombel = [...DEFAULT_ROMBEL];
          const rombelsInTingkat = db.rombel.filter((r) => (r.angka || r.tingkat) === tingkatNum);
          const existingHuruf = rombelsInTingkat.map((r) => r.huruf);
          const nextHuruf = hurufBerikutnya(existingHuruf);
          const rombelNama = `${tingkatNum}${nextHuruf}`;
          const rombelId = `rombel_${tingkatNum}${nextHuruf.toLowerCase()}`;

          const newRombel: Rombel = {
            id: rombelId,
            tingkat_id: `tingkat_${tingkatNum}`,
            angka: tingkatNum,
            tingkat: tingkatNum,
            tingkat_angka: tingkatNum,
            huruf: nextHuruf,
            nama: rombelNama,
            tahun_ajaran_id: db.activeTahunAjaranId || 'ta_2025_1',
            nama_wali: (nama_wali || '').trim(),
            nip_wali: (nip_wali || '').trim(),
            aktif: true,
            urutan: db.rombel.length + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          db.rombel.push(newRombel);

          if (!db.kelas) db.kelas = [];
          db.kelas.push({
            id: rombelId,
            sekolah_id: db.sekolah.id,
            tahun_ajaran_id: db.activeTahunAjaranId || 'ta_2025_1',
            tingkat: rombelNama,
            fase: faseDariTingkat(tingkatNum),
            nama_wali: newRombel.nama_wali,
            nip_wali: newRombel.nip_wali,
          });

          saveLocalDatabase(db);

          const accounts = getAccounts();
          if (!accounts.some((a) => a.rombel_id === rombelId || a.kelas === rombelNama)) {
            accounts.push({
              id: 'akun_' + rombelId,
              peran: 'guru',
              rombel_id: rombelId,
              rombel_nama: rombelNama,
              tingkat: tingkatNum,
              huruf: nextHuruf,
              kelas: rombelNama,
              nama: newRombel.nama_wali || `Wali Kelas ${rombelNama}`,
              nip: newRombel.nip_wali || '',
              password: `guru${rombelNama.toLowerCase()}`,
              aktif: true,
              wajib_ganti_sandi: false,
              terakhir_masuk: '',
            });
            saveAccounts(accounts);
          }

          resolve({ success: true, rombel: newRombel } as unknown as T);
          return;
        }

        // ADMIN: TOGGLE ROMBEL AKTIF
        if (action === 'toggleRombelAktif') {
          checkReadOnlyMode(token);
          const { rombel_id, aktif } = payload;
          if (!rombel_id) throw new Error('ID rombel wajib diberikan.');
          if (!db.rombel) db.rombel = [...DEFAULT_ROMBEL];
          const rb = db.rombel.find((r) => r.id === rombel_id || r.nama === rombel_id);
          if (!rb) throw new Error('Rombel tidak ditemukan.');

          rb.aktif = !!aktif;
          rb.updated_at = new Date().toISOString();

          const accounts = getAccounts();
          const acc = accounts.find((a) => a.rombel_id === rb.id || a.kelas === rb.nama);
          if (acc) {
            acc.aktif = !!aktif;
            saveAccounts(accounts);
          }

          saveLocalDatabase(db);
          resolve({ success: true, rombel: rb } as unknown as T);
          return;
        }

        // ADMIN: KUNCI TP/LM PER TINGKAT
        if (action === 'kunciTpLmPerTingkat') {
          checkReadOnlyMode(token);
          const { tingkat, terkunci } = payload;
          const tNum = Number(tingkat);
          if (!db.kunciTpLm) db.kunciTpLm = {};
          db.kunciTpLm[tNum] = !!terkunci;
          saveLocalDatabase(db);
          resolve({ success: true, kunciTpLm: db.kunciTpLm } as unknown as T);
          return;
        }

        // ADMIN: UBAH MODE KELAS (Tunggal vs Rombel)
        if (action === 'ubahModeKelas') {
          checkReadOnlyMode(token);
          const { tingkat, mode } = payload;
          const tNum = Number(tingkat);
          if (!tNum || tNum < 1 || tNum > 6) throw new Error('Tingkat kelas tidak valid (1-6).');
          if (mode !== 'tunggal' && mode !== 'rombel') throw new Error('Mode kelas harus tunggal atau rombel.');

          if (db.kunciTpLm && db.kunciTpLm[tNum]) {
            throw new Error(`Tingkat ${tNum} terkunci oleh admin. Buka kunci terlebih dahulu.`);
          }

          if (!db.tingkat || db.tingkat.length === 0) db.tingkat = [...DEFAULT_TINGKAT];
          if (!db.rombel || db.rombel.length === 0) db.rombel = [...DEFAULT_ROMBEL];

          const tg = db.tingkat.find((t) => t.angka === tNum);
          if (tg) tg.modeKelas = mode;

          const rombelsInTingkat = db.rombel.filter(
            (r) => (r.angka || r.tingkat || parseInt(r.nama, 10)) === tNum
          );

          if (mode === 'rombel') {
            // Satu kelas → Dibagi rombel:
            // Kelas "4" diubah menjadi "4A" beserta seluruh siswa dan nilainya;
            // akun guru kelas 4 menjadi akun 4A (kata sandi tetap).
            // Lalu buat rombel 4B dan 4C kosong (tanpa akun).
            const singleRombel = rombelsInTingkat.find((r) => !r.huruf || r.nama === String(tNum)) || rombelsInTingkat[0];
            const oldId = singleRombel ? singleRombel.id : `rombel_${tNum}`;
            const oldName = singleRombel ? singleRombel.nama : String(tNum);

            const newId4A = `rombel_${tNum}a`;
            const newName4A = `${tNum}A`;

            if (singleRombel) {
              singleRombel.id = newId4A;
              singleRombel.huruf = 'A';
              singleRombel.nama = newName4A;
              singleRombel.label = newName4A;
              singleRombel.updated_at = new Date().toISOString();
            }

            const remapRombel = (oldKey: string, newId: string) => {
              (db.kelasSiswa || []).forEach((ks) => {
                if (ks.rombel_id === oldKey || ks.rombel_id === oldId || ks.kelas_id === oldKey || ks.kelas_id === oldId) {
                  ks.rombel_id = newId;
                  ks.kelas_id = newId;
                }
              });
              const migrateCollection = (arr: any[]) => {
                if (Array.isArray(arr)) {
                  arr.forEach((it) => {
                    if (it.rombel_id === oldKey || it.rombel_id === oldId || it.kelas_id === oldKey || it.kelas_id === oldId) {
                      it.rombel_id = newId;
                      it.kelas_id = newId;
                    }
                  });
                }
              };
              migrateCollection(db.kehadiran);
              migrateCollection(db.catatanWali);
              migrateCollection(db.kaih);
              migrateCollection(db.nilaiEkskul);
              migrateCollection(db.penilaianKokurikuler);
              migrateCollection(db.temaKokurikuler);
            };
            remapRombel(oldName, newId4A);

            const accounts = getAccounts();
            const acc = accounts.find((a) => a.rombel_id === oldId || a.kelas === oldName || a.rombel_nama === oldName);
            if (acc) {
              acc.rombel_id = newId4A;
              acc.rombel_nama = newName4A;
              acc.kelas = newName4A;
              acc.huruf = 'A';
              acc.id = `akun_${newId4A}`;
            }

            // Create 4B and 4C empty without accounts
            const existB = db.rombel.some((r) => r.nama === `${tNum}B` || r.id === `rombel_${tNum}b`);
            if (!existB) {
              db.rombel.push({
                id: `rombel_${tNum}b`,
                tingkat_id: `tingkat_${tNum}`,
                angka: tNum,
                tingkat: tNum,
                tingkat_angka: tNum,
                huruf: 'B',
                nama: `${tNum}B`,
                label: `${tNum}B`,
                tahun_ajaran_id: db.activeTahunAjaranId || 'ta_2025_1',
                nama_wali: '',
                nip_wali: '',
                aktif: true,
                urutan: db.rombel.length + 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }

            const existC = db.rombel.some((r) => r.nama === `${tNum}C` || r.id === `rombel_${tNum}c`);
            if (!existC) {
              db.rombel.push({
                id: `rombel_${tNum}c`,
                tingkat_id: `tingkat_${tNum}`,
                angka: tNum,
                tingkat: tNum,
                tingkat_angka: tNum,
                huruf: 'C',
                nama: `${tNum}C`,
                label: `${tNum}C`,
                tahun_ajaran_id: db.activeTahunAjaranId || 'ta_2025_1',
                nama_wali: '',
                nip_wali: '',
                aktif: true,
                urutan: db.rombel.length + 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }

            saveAccounts(accounts);
            saveLocalDatabase(db);
            resolve({ success: true, mode: 'rombel', tingkat: tNum } as unknown as T);
            return;
          } else {
            // Dibagi rombel → Satu kelas:
            // hanya boleh bila paling banyak satu rombel yang berisi siswa.
            const rombelsWithStudents = rombelsInTingkat.filter((r) => {
              return (db.kelasSiswa || []).some(
                (ks) => ks.rombel_id === r.id || ks.rombel_id === r.nama || ks.kelas_id === r.id || ks.kelas_id === r.nama
              );
            });

            if (rombelsWithStudents.length > 1) {
              const names = rombelsWithStudents.map((r) => r.nama).join(' dan ');
              throw new Error(`${names} sama-sama berisi siswa. Pindahkan siswa ke satu rombel dulu, lalu ubah mode kelas.`);
            }

            const targetRombel = rombelsWithStudents.length === 1 ? rombelsWithStudents[0] : rombelsInTingkat[0];
            const oldId = targetRombel?.id;
            const oldName = targetRombel?.nama;

            const singleId = `rombel_${tNum}`;
            const singleName = String(tNum);
            const singleLabel = `Kelas ${tNum}`;

            if (targetRombel) {
              targetRombel.id = singleId;
              targetRombel.huruf = '';
              targetRombel.nama = singleName;
              targetRombel.label = singleLabel;
              targetRombel.updated_at = new Date().toISOString();
            }

            (db.kelasSiswa || []).forEach((ks) => {
              if (ks.rombel_id === oldId || ks.rombel_id === oldName || ks.kelas_id === oldId || ks.kelas_id === oldName) {
                ks.rombel_id = singleId;
                ks.kelas_id = singleId;
              }
            });
            const migrateCollection = (arr: any[]) => {
              if (Array.isArray(arr)) {
                arr.forEach((it) => {
                  if (it.rombel_id === oldId || it.rombel_id === oldName || it.kelas_id === oldId || it.kelas_id === oldName) {
                    it.rombel_id = singleId;
                    it.kelas_id = singleId;
                  }
                });
              }
            };
            migrateCollection(db.kehadiran);
            migrateCollection(db.catatanWali);
            migrateCollection(db.kaih);
            migrateCollection(db.nilaiEkskul);
            migrateCollection(db.penilaianKokurikuler);
            migrateCollection(db.temaKokurikuler);

            const accounts = getAccounts();
            const otherRombels = rombelsInTingkat.filter((r) => r !== targetRombel);
            for (const other of otherRombels) {
              const idx = db.rombel.findIndex((r) => r.id === other.id);
              if (idx !== -1) db.rombel.splice(idx, 1);
              const accIdx = accounts.findIndex((a) => a.rombel_id === other.id || a.kelas === other.nama);
              if (accIdx !== -1) accounts.splice(accIdx, 1);
            }

            const acc = accounts.find((a) => a.rombel_id === oldId || a.kelas === oldName);
            if (acc) {
              acc.rombel_id = singleId;
              acc.rombel_nama = singleName;
              acc.kelas = singleName;
              acc.huruf = '';
              acc.id = `akun_${singleId}`;
            }

            saveAccounts(accounts);
            saveLocalDatabase(db);
            resolve({ success: true, mode: 'tunggal', tingkat: tNum } as unknown as T);
            return;
          }
        }

        // GURU/ADMIN: SALIN TEMA KE ROMBEL LAIN DI TINGKAT INI
        if (action === 'salinTemaKeRombelLain') {
          checkReadOnlyMode(token);
          const { dari_rombel_id, ke_rombel_ids } = payload;
          if (!dari_rombel_id || !Array.isArray(ke_rombel_ids) || ke_rombel_ids.length === 0) {
            throw new Error('Rombel asal dan daftar rombel tujuan wajib diisi.');
          }

          if (!db.temaKokurikuler) db.temaKokurikuler = [];
          const sourceThemes = db.temaKokurikuler.filter(
            (t) => t.rombel_id === dari_rombel_id || t.kelas_id === dari_rombel_id
          );

          if (sourceThemes.length === 0) {
            throw new Error('Rombel asal belum memiliki tema kokurikuler.');
          }

          let totalCopied = 0;
          for (const targetId of ke_rombel_ids) {
            const existingTarget = db.temaKokurikuler.filter(
              (t) => t.rombel_id === targetId || t.kelas_id === targetId
            );
            const existingNames = new Set(existingTarget.map((t) => t.nama.trim().toLowerCase()));
            let maxU = existingTarget.reduce((m, t) => Math.max(m, t.urutan || 0), 0);

            for (const src of sourceThemes) {
              if (existingNames.has(src.nama.trim().toLowerCase())) continue;
              maxU++;
              db.temaKokurikuler.push({
                id: 'tema_' + Math.random().toString(36).substring(2),
                kelas_id: targetId,
                rombel_id: targetId,
                nama: src.nama,
                keterangan: src.keterangan || '',
                urutan: maxU,
                tampil_di_rapor: src.tampil_di_rapor !== false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              existingNames.add(src.nama.trim().toLowerCase());
              totalCopied++;
            }
          }

          saveLocalDatabase(db);
          resolve({ success: true, totalCopied } as unknown as T);
          return;
        }

        // ADMIN: MIGRASI DATA LAMA KE ROMBEL
        if (action === 'migrateKeRombel') {
          const summary: Record<string, number> = {
            rombel: 18,
            tingkat: 6,
            siswa_migrated: 0,
            nilai_migrated: 0,
          };

          if (!db.tingkat || db.tingkat.length === 0) db.tingkat = DEFAULT_TINGKAT;
          if (!db.rombel || db.rombel.length === 0) db.rombel = DEFAULT_ROMBEL;

          const mapping: Record<string, string> = {
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
            'VI': 'rombel_6a',
          };

          if (Array.isArray(db.kelasSiswa)) {
            db.kelasSiswa.forEach((ks) => {
              if (mapping[ks.kelas_id]) {
                ks.rombel_id = mapping[ks.kelas_id];
                ks.kelas_id = mapping[ks.kelas_id];
                summary.siswa_migrated++;
              }
            });
          }

          const migrateCollection = (arr: any[]) => {
            if (Array.isArray(arr)) {
              arr.forEach((it) => {
                if (it.kelas_id && mapping[it.kelas_id]) {
                  it.rombel_id = mapping[it.kelas_id];
                  it.kelas_id = mapping[it.kelas_id];
                  summary.nilai_migrated++;
                }
              });
            }
          };

          migrateCollection(db.kehadiran);
          migrateCollection(db.catatanWali);
          migrateCollection(db.kaih);
          migrateCollection(db.nilaiEkskul);
          migrateCollection(db.penilaianKokurikuler);
          migrateCollection(db.temaKokurikuler);

          if (Array.isArray(db.mapel)) {
            db.mapel.forEach((m) => {
              if (!m.tingkat_id) {
                const tNum = parseInt(m.kelas_id?.replace(/\D/g, '') || '6', 10) || 6;
                m.tingkat_id = `tingkat_${tNum}`;
              }
            });
          }

          saveLocalDatabase(db);
          resolve({ success: true, summary } as unknown as T);
          return;
        }

        // ADMIN: SIMPAN PENGATURAN
        if (action === 'simpanPengaturan') {
          const { tahun_ajaran_aktif, semester_aktif } = payload;
          if (!tahun_ajaran_aktif) throw new Error('Tahun ajaran aktif wajib diisi.');
          if (!semester_aktif || (semester_aktif !== 1 && semester_aktif !== 2)) {
            throw new Error('Semester aktif harus 1 atau 2.');
          }

          savePengaturan({ tahun_ajaran_aktif, semester_aktif: Number(semester_aktif) as 1 | 2 });
          resolve({ success: true } as unknown as T);
          return;
        }

        // ADMIN: AMBIL RIWAYAT MASUK
        if (action === 'getLoginLogs') {
          const raw = localStorage.getItem(LOCAL_STORAGE_LOGIN_LOGS_KEY);
          const logs = raw ? JSON.parse(raw) : [];
          resolve(logs as unknown as T);
          return;
        }

        if (action === 'getAll') {
          if (Array.isArray(db.kaih)) {
            db.kaih = db.kaih.map((k) => {
              const { tahun, periode } = normalisasiKaih(k);
              return { ...k, tahun, periode };
            });
          }
          resolve(db as unknown as T);
          return;
        }

        if (action === 'upsertMany') {
          checkReadOnlyMode(token);
          const { sheetName, items, keyFields, kelas_id } = payload;
          if (!items || items.length === 0) {
            resolve({ count: 0 } as unknown as T);
            return;
          }

          // Cek batas 50 siswa
          if (sheetName === 'kelas_siswa') {
            const currentCount = db.kelasSiswa.filter((r) => r.kelas_id === kelas_id).length;
            const newCount = items.filter((it: any) => !db.kelasSiswa.some((r) => r.kelas_id === kelas_id && r.siswa_id === it.siswa_id)).length;
            if (currentCount + newCount > 50) {
              throw new Error(`Kelas sudah berisi ${currentCount} siswa. Batas maksimal adalah 50 siswa.`);
            }
          }

          const targetArray = (db as any)[sheetName];
          if (!Array.isArray(targetArray)) {
            resolve({ count: 0 } as unknown as T);
            return;
          }

          const keys: string[] = keyFields || ['id'];
          let count = 0;

          for (const item of items) {
            const idx = targetArray.findIndex((entry: any) =>
              keys.every((k) => String(entry[k]) === String(item[k]))
            );

            if (idx >= 0) {
              targetArray[idx] = { ...targetArray[idx], ...item, updated_at: new Date().toISOString() };
            } else {
              targetArray.push({
                ...item,
                id: item.id || 'id_' + Math.random().toString(36).substring(2),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
            count++;
          }

          saveLocalDatabase(db);
          resolve({ count } as unknown as T);
          return;
        }

        if (action === 'upsert') {
          checkReadOnlyMode(token);
          const { sheetName, item, keyFields } = payload;
          const targetArray = (db as any)[sheetName];
          if (Array.isArray(targetArray)) {
            const keys: string[] = keyFields || ['id'];
            const idx = targetArray.findIndex((entry: any) =>
              keys.every((k) => entry[k] === item[k])
            );
            if (idx >= 0) {
              targetArray[idx] = { ...targetArray[idx], ...item, updated_at: new Date().toISOString() };
            } else {
              targetArray.push({
                ...item,
                id: item.id || 'id_' + Math.random().toString(36).substring(2),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
            saveLocalDatabase(db);
          }
          resolve({ success: true } as unknown as T);
          return;
        }

        if (action === 'delete') {
          checkReadOnlyMode(token);
          const { sheetName, id, keyField } = payload;
          const targetArray = (db as any)[sheetName];
          if (Array.isArray(targetArray)) {
            const k = keyField || 'id';
            (db as any)[sheetName] = targetArray.filter((entry: any) => entry[k] !== id);
            saveLocalDatabase(db);
          }
          resolve({ success: true } as unknown as T);
          return;
        }

        if (action === 'importSiswa') {
          checkReadOnlyMode(token);
          const { kelas_id, siswaList } = payload;
          const currentCount = db.kelasSiswa.filter((r) => r.kelas_id === kelas_id).length;
          if (currentCount + siswaList.length > 50) {
            throw new Error(`Kelas sudah berisi ${currentCount} siswa. Penambahan ${siswaList.length} siswa melebihi batas 50 siswa per kelas.`);
          }

          let startUrut = currentCount + 1;
          for (const raw of siswaList) {
            const siswaId = 'sis_' + Math.random().toString(36).substring(2);
            db.siswa.push({
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
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            db.kelasSiswa.push({
              kelas_id,
              siswa_id: siswaId,
              no_urut: startUrut++,
              tinggi_badan: raw.tinggi_badan || '',
              berat_badan: raw.berat_badan || '',
              pendengaran: raw.pendengaran || 'Baik',
              penglihatan: raw.penglihatan || 'Baik',
              gigi: raw.gigi || 'Baik',
              kesehatan_lain: raw.kesehatan_lain || '',
              prestasi_kesenian: raw.prestasi_kesenian || '',
              prestasi_olahraga: raw.prestasi_olahraga || '',
              prestasi_sains: raw.prestasi_sains || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }

          saveLocalDatabase(db);
          resolve({ importedCount: siswaList.length } as unknown as T);
          return;
        }

        if (action === 'copySemester') {
          const { sourceKelasId, targetKelasId } = payload;
          const sourceRoster = db.kelasSiswa.filter((r) => r.kelas_id === sourceKelasId);
          for (const s of sourceRoster) {
            db.kelasSiswa.push({
              ...s,
              kelas_id: targetKelasId,
            });
          }
          saveLocalDatabase(db);
          resolve({ copiedStudents: sourceRoster.length } as unknown as T);
          return;
        }

        if (action === 'listTema') {
          const { kelas_id } = payload;
          const list = (db.temaKokurikuler || [])
            .filter((t) => t.kelas_id === kelas_id)
            .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
          resolve(list as unknown as T);
          return;
        }

        if (action === 'saveTema') {
          checkReadOnlyMode(token);
          const { id, kelas_id, nama, keterangan, urutan, tampil_di_rapor } = payload;
          const cleanNama = (nama || '').trim();
          if (!cleanNama) {
            throw new Error('Nama tema tidak boleh kosong.');
          }

          if (!db.temaKokurikuler) db.temaKokurikuler = [];
          const existing = db.temaKokurikuler.filter((t) => t.kelas_id === kelas_id);
          const isDuplicate = existing.some(
            (t) => t.id !== id && t.nama.trim().toLowerCase() === cleanNama.toLowerCase()
          );
          if (isDuplicate) {
            throw new Error('Tema dengan nama ini sudah ada.');
          }

          let assignedUrutan = urutan;
          if (assignedUrutan === undefined || assignedUrutan === null || assignedUrutan === '') {
            const maxU = existing.reduce((max, t) => Math.max(max, Number(t.urutan) || 0), 0);
            assignedUrutan = maxU + 1;
          }

          const tampil = tampil_di_rapor !== false;

          let savedItem: any;
          if (id) {
            const idx = db.temaKokurikuler.findIndex((t) => t.id === id);
            if (idx >= 0) {
              db.temaKokurikuler[idx] = {
                ...db.temaKokurikuler[idx],
                nama: cleanNama,
                keterangan: keterangan || '',
                urutan: Number(assignedUrutan),
                tampil_di_rapor: tampil,
                updated_at: new Date().toISOString(),
              };
              savedItem = db.temaKokurikuler[idx];
            } else {
              savedItem = {
                id,
                kelas_id,
                nama: cleanNama,
                keterangan: keterangan || '',
                urutan: Number(assignedUrutan),
                tampil_di_rapor: tampil,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              db.temaKokurikuler.push(savedItem);
            }
          } else {
            savedItem = {
              id: 'tema_' + Math.random().toString(36).substring(2),
              kelas_id,
              nama: cleanNama,
              keterangan: keterangan || '',
              urutan: Number(assignedUrutan),
              tampil_di_rapor: tampil,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            db.temaKokurikuler.push(savedItem);
          }

          saveLocalDatabase(db);
          resolve(savedItem as unknown as T);
          return;
        }

        if (action === 'reorderTema') {
          const { ids } = payload;
          if (Array.isArray(ids) && db.temaKokurikuler) {
            ids.forEach((temaId: string, idx: number) => {
              const item = db.temaKokurikuler.find((t) => t.id === temaId);
              if (item) {
                item.urutan = idx + 1;
                item.updated_at = new Date().toISOString();
              }
            });
            saveLocalDatabase(db);
          }
          resolve({ success: true } as unknown as T);
          return;
        }

        if (action === 'deleteTema') {
          const { id } = payload;
          if (db.temaKokurikuler) {
            db.temaKokurikuler = db.temaKokurikuler.filter((t) => t.id !== id);
          }
          if (db.penilaianKokurikuler) {
            db.penilaianKokurikuler = db.penilaianKokurikuler.filter((p) => p.tema_id !== id);
          }
          saveLocalDatabase(db);
          resolve({ success: true } as unknown as T);
          return;
        }

        if (action === 'copyTema') {
          const { dari_kelas_id, ke_kelas_id } = payload;
          if (!db.temaKokurikuler) db.temaKokurikuler = [];

          const sourceList = db.temaKokurikuler.filter((t) => t.kelas_id === dari_kelas_id);
          const targetList = db.temaKokurikuler.filter((t) => t.kelas_id === ke_kelas_id);

          const existingNames = new Set(targetList.map((t) => t.nama.trim().toLowerCase()));
          let maxUrutan = targetList.reduce((max, t) => Math.max(max, Number(t.urutan) || 0), 0);
          let copiedCount = 0;

          sourceList
            .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0))
            .forEach((src) => {
              const nameKey = src.nama.trim().toLowerCase();
              if (existingNames.has(nameKey)) return; // lewati nama yang sudah ada

              maxUrutan++;
              db.temaKokurikuler.push({
                id: 'tema_' + Math.random().toString(36).substring(2),
                kelas_id: ke_kelas_id,
                nama: src.nama,
                keterangan: src.keterangan || '',
                urutan: maxUrutan,
                tampil_di_rapor: src.tampil_di_rapor !== false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              existingNames.add(nameKey);
              copiedCount++;
            });

          saveLocalDatabase(db);
          resolve({ copiedCount } as unknown as T);
          return;
        }

        if (action === 'listPenilaianKoku') {
          const { kelas_id } = payload;
          const temaIds = new Set((db.temaKokurikuler || []).filter((t) => t.kelas_id === kelas_id).map((t) => t.id));
          const list = (db.penilaianKokurikuler || []).filter((p) => temaIds.has(p.tema_id));
          resolve(list as unknown as T);
          return;
        }

        if (action === 'savePenilaianKoku') {
          const { rows } = payload;
          if (!db.penilaianKokurikuler) db.penilaianKokurikuler = [];
          if (Array.isArray(rows)) {
            for (const r of rows) {
              const idx = db.penilaianKokurikuler.findIndex(
                (p) => p.tema_id === r.tema_id && p.siswa_id === r.siswa_id
              );
              if (idx >= 0) {
                db.penilaianKokurikuler[idx] = {
                  ...db.penilaianKokurikuler[idx],
                  dpl_kuat: r.dpl_kuat || '',
                  dpl_penguatan: r.dpl_penguatan || '',
                  deskripsi_manual: r.deskripsi_manual || '',
                  updated_at: new Date().toISOString(),
                };
              } else {
                db.penilaianKokurikuler.push({
                  id: 'pk_' + Math.random().toString(36).substring(2),
                  tema_id: r.tema_id,
                  siswa_id: r.siswa_id,
                  dpl_kuat: r.dpl_kuat || '',
                  dpl_penguatan: r.dpl_penguatan || '',
                  deskripsi_manual: r.deskripsi_manual || '',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              }
            }
            saveLocalDatabase(db);
          }
          resolve({ success: true, count: rows?.length || 0 } as unknown as T);
          return;
        }

        if (action === 'listKaih') {
          const { kelas_id, tahun, periode } = payload;
          if (!db.kaih) db.kaih = [];
          const list = db.kaih.filter((k: any) => {
            const norm = normalisasiKaih(k);
            return k.kelas_id === kelas_id && norm.tahun === Number(tahun) && norm.periode === String(periode).trim().toUpperCase();
          });
          resolve(list as unknown as T);
          return;
        }

        if (action === 'saveKaih') {
          checkReadOnlyMode(token);
          const { rows } = payload;
          if (!db.kaih) db.kaih = [];
          if (Array.isArray(rows)) {
            const allowedStatus: Record<string, boolean> = {
              '': true,
              'Belum Terbiasa': true,
              'Mulai Terbiasa': true,
              'Sudah Terbiasa': true,
            };

            for (const r of rows) {
              const tahun = Number(r.tahun);
              if (!tahun || tahun < 2000 || tahun > 2100) {
                throw new Error(`Tahun tidak valid: ${r.tahun}. Harus antara 2000-2100.`);
              }
              const periode = String(r.periode || '').trim().toUpperCase();
              if (periode !== 'JAN-JUN' && periode !== 'JUL-DES') {
                throw new Error(`Periode tidak valid: ${r.periode}. Harus JAN-JUN atau JUL-DES.`);
              }

              const habits = ['bangun_pagi', 'beribadah', 'berolahraga', 'makan_sehat', 'gemar_belajar', 'bermasyarakat', 'tidur_cepat'];
              for (const h of habits) {
                const val = r[h] !== undefined && r[h] !== null ? String(r[h]).trim() : '';
                if (!allowedStatus[val]) {
                  throw new Error(`Nilai kebiasaan tidak valid pada ${h}: ${val}`);
                }
              }

              const idx = db.kaih.findIndex(
                (k: any) =>
                  k.siswa_id === r.siswa_id &&
                  Number(k.tahun) === tahun &&
                  String(k.periode).trim().toUpperCase() === periode
              );

              const itemToSave = {
                id: r.id || 'kaih_' + Math.random().toString(36).substring(2),
                siswa_id: r.siswa_id,
                kelas_id: r.kelas_id,
                tahun,
                periode,
                bangun_pagi: r.bangun_pagi || '',
                beribadah: r.beribadah || '',
                berolahraga: r.berolahraga || '',
                makan_sehat: r.makan_sehat || '',
                gemar_belajar: r.gemar_belajar || '',
                bermasyarakat: r.bermasyarakat || '',
                tidur_cepat: r.tidur_cepat || '',
                updated_at: new Date().toISOString(),
              };

              if (idx >= 0) {
                db.kaih[idx] = { ...db.kaih[idx], ...itemToSave };
              } else {
                db.kaih.push({
                  ...itemToSave,
                  created_at: new Date().toISOString(),
                });
              }
            }
            saveLocalDatabase(db);
          }
          resolve({ success: true, count: rows?.length || 0 } as unknown as T);
          return;
        }

        if (action === 'copyKaih') {
          const { kelas_id, dari, ke, timpa } = payload;
          if (!db.kaih) db.kaih = [];
          if (!dari || !dari.tahun || !dari.periode) throw new Error('Periode asal tidak lengkap.');
          if (!ke || !ke.tahun || !ke.periode) throw new Error('Periode tujuan tidak lengkap.');

          const targetExisting = db.kaih.filter((k: any) => {
            const norm = normalisasiKaih(k);
            return k.kelas_id === kelas_id && norm.tahun === Number(ke.tahun) && norm.periode === ke.periode;
          });

          if (targetExisting.length > 0 && !timpa) {
            throw new Error('Periode tujuan sudah memiliki data penilaian. Aktifkan timpa untuk menimpa.');
          }

          const enrolledStudentIds = new Set(
            db.kelasSiswa.filter((ks) => ks.kelas_id === kelas_id).map((ks) => ks.siswa_id)
          );

          const sourceRows = db.kaih.filter((k: any) => {
            const norm = normalisasiKaih(k);
            return (
              k.kelas_id === kelas_id &&
              norm.tahun === Number(dari.tahun) &&
              norm.periode === dari.periode &&
              enrolledStudentIds.has(k.siswa_id)
            );
          });

          if (sourceRows.length === 0) {
            resolve({ copiedCount: 0, message: 'Tidak ada data penilaian pada periode asal.' } as unknown as T);
            return;
          }

          for (const src of sourceRows) {
            const idx = db.kaih.findIndex(
              (k: any) =>
                k.siswa_id === src.siswa_id &&
                Number(k.tahun) === Number(ke.tahun) &&
                k.periode === ke.periode
            );

            const newObj: KaihRecord = {
              id: 'kaih_' + Math.random().toString(36).substring(2),
              siswa_id: src.siswa_id,
              kelas_id,
              tahun: Number(ke.tahun),
              periode: ke.periode,
              bangun_pagi: (src.bangun_pagi || '') as StatusKaih | '',
              beribadah: (src.beribadah || '') as StatusKaih | '',
              berolahraga: (src.berolahraga || '') as StatusKaih | '',
              makan_sehat: (src.makan_sehat || '') as StatusKaih | '',
              gemar_belajar: (src.gemar_belajar || '') as StatusKaih | '',
              bermasyarakat: (src.bermasyarakat || '') as StatusKaih | '',
              tidur_cepat: (src.tidur_cepat || '') as StatusKaih | '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (idx >= 0) {
              db.kaih[idx] = { ...db.kaih[idx], ...newObj };
            } else {
              db.kaih.push(newObj);
            }
          }

          saveLocalDatabase(db);
          resolve({ copiedCount: sourceRows.length } as unknown as T);
          return;
        }

        if (action === 'listKaihPeriode') {
          const { kelas_id } = payload;
          if (!db.kaih) db.kaih = [];
          const classKaih = db.kaih.filter((k: any) => k.kelas_id === kelas_id);
          const map: Record<string, { tahun: number; periode: string; count: number }> = {};

          for (const k of classKaih) {
            const norm = normalisasiKaih(k);
            const key = `${norm.tahun}_${norm.periode}`;
            if (!map[key]) {
              map[key] = { tahun: norm.tahun, periode: norm.periode, count: 0 };
            }
            map[key].count++;
          }

          resolve(Object.values(map) as unknown as T);
          return;
        }

        if (action === 'migrateKaihPeriode') {
          if (!db.kaih) db.kaih = [];
          let migratedCount = 0;
          db.kaih = db.kaih.map((k: any) => {
            const norm = normalisasiKaih(k);
            migratedCount++;
            return {
              ...k,
              tahun: norm.tahun,
              periode: norm.periode,
            };
          });
          saveLocalDatabase(db);
          resolve({ ok: true, migrated: migratedCount } as unknown as T);
          return;
        }

        resolve({ ok: true } as unknown as T);
      } catch (err: any) {
        reject(err);
      }
    }, 150);
  });
}
