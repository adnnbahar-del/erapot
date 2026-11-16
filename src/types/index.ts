export type TingkatKelas = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
export type Fase = 'A' | 'B' | 'C';
export type JenisKelamin = 'L' | 'P';
export type Semester = 1 | 2;
export type SemesterNama = 'Ganjil' | 'Genap';
export type StatusTahunAjaran = 'berjalan' | 'ditutup';
export type StatusKaih = 'Belum Terbiasa' | 'Mulai Terbiasa' | 'Sudah Terbiasa';
export type FormatKelasRapor = 'romawi' | 'angka' | 'strip';
export type ModeKelas = 'tunggal' | 'rombel';

export interface Tingkat {
  id: string; // 'tingkat_1' .. 'tingkat_6'
  angka: number; // 1 .. 6
  tingkat?: number; // alias for angka
  romawi: TingkatKelas; // 'I' .. 'VI'
  fase: Fase; // 'A' | 'B' | 'C'
  modeKelas?: ModeKelas; // 'tunggal' | 'rombel'
}

export interface Rombel {
  id: string; // e.g. 'rombel_1a' or '4'
  tingkat_id: string; // 'tingkat_1'
  tingkat?: number; // alias for angka
  tingkat_angka?: number; // alias for angka
  angka: number; // 1 .. 6
  huruf: string; // '' for tunggal, or 'A' | 'B' | 'C' | 'D' ...
  nama: string; // '1A' or '4'
  label?: string; // '1A' or 'Kelas 4'
  tahun_ajaran_id: string;
  nama_wali: string;
  nip_wali: string;
  aktif: boolean;
  urutan: number;
  terakhir_masuk?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Sekolah {
  id: string;
  nama: string;
  npsn: string;
  nss: string;
  alamat: string;
  kode_pos: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  website: string;
  email: string;
  kepala_sekolah: string;
  nip_kepala_sekolah: string;
  tempat_rapor: string;
  format_kelas_rapor?: FormatKelasRapor; // 'romawi' (default: "I A (Satu A)"), 'angka' ("1A"), 'strip' ("I-A")
  logo_url?: string;
  ttd_kepsek_url?: string;
  stempel_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TahunAjaran {
  id: string;
  tahun: string; // e.g. "2025/2026"
  semester: Semester | SemesterNama; // 1 or 2, or "Ganjil" | "Genap"
  semesterNama?: SemesterNama;
  status?: StatusTahunAjaran; // "berjalan" | "ditutup"
  tanggal_rapor?: string; // YYYY-MM-DD
  aktif: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Kelas {
  id: string;
  sekolah_id?: string;
  tahun_ajaran_id: string;
  tingkat: TingkatKelas | string;
  fase: Fase;
  nama_wali: string;
  nip_wali: string;
  terakhir_masuk?: string;
  tingkat_id?: string;
  angka?: number;
  huruf?: string;
  nama?: string;
  aktif?: boolean;
  urutan?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Siswa {
  id: string;
  kelasId?: string;
  kelas_id?: string;
  nis: string;
  nisn: string;
  nama: string;
  jk: JenisKelamin;
  tempat_lahir: string;
  tanggal_lahir: string;
  agama: string;
  pendidikan_sebelumnya: string;
  alamat: string;
  nama_ayah: string;
  nama_ibu: string;
  pekerjaan_ayah: string;
  pekerjaan_ibu: string;
  alamat_ortu_jalan?: string;
  alamat_ortu_desa?: string;
  alamat_ortu_kecamatan?: string;
  alamat_ortu_kabupaten?: string;
  alamat_ortu_provinsi?: string;
  nama_wali?: string;
  pekerjaan_wali?: string;
  alamat_wali?: string;
  telepon?: string;
  created_at?: string;
  updated_at?: string;
}

export interface KelasSiswa {
  id?: string;
  kelasId?: string;
  kelas_id: string;
  rombel_id?: string;
  siswa_id: string;
  no_urut: number;
  aktif?: boolean;
  tahun_ajaran_id?: string;
  tinggi_badan?: string;
  berat_badan?: string;
  pendengaran?: string;
  penglihatan?: string;
  gigi?: string;
  kesehatan_lain?: string;
  prestasi_kesenian?: string;
  prestasi_olahraga?: string;
  prestasi_sains?: string;
  created_at?: string;
  updated_at?: string;
}

export type KelompokMapel = 'wajib' | 'seni' | 'pilihan' | 'mulok';

export interface Mapel {
  id: string;
  kode?: string;
  nama: string;
  kelompok?: KelompokMapel;
  faseBerlaku?: Fase[];
  urutanRapor?: number;
  aktif?: boolean;
  varianAgama?: string[];
  kelasNonaktif?: string[];
  // Backward compatibility fields
  kelas_id?: string;
  tingkat_id?: string;
  tahun_ajaran_id?: string;
  singkatan?: string;
  jenis?: 'intra' | 'mulok';
  urutan?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TujuanPembelajaran {
  id: string;
  mapel_id: string;
  urutan: number;
  deskripsi: string;
  diubah_oleh?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LingkupMateri {
  id: string;
  mapel_id: string;
  urutan: number;
  nama: string;
  diubah_oleh?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NilaiFormatif {
  siswa_id: string;
  kelasId?: string;
  kelas_id?: string;
  tp_id: string;
  kktp: 0 | 1;
  tampil: 0 | 1;
  created_at?: string;
  updated_at?: string;
}

export interface NilaiSumatifLM {
  siswa_id: string;
  kelasId?: string;
  kelas_id?: string;
  lm_id: string;
  nilai: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface NilaiSumatifSemester {
  siswa_id: string;
  kelasId?: string;
  kelas_id?: string;
  mapel_id: string;
  pts: number | null;
  pas: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Ekstrakurikuler {
  id: string;
  sekolah_id: string;
  nama: string;
  created_at?: string;
  updated_at?: string;
}

export interface NilaiEkskul {
  siswa_id: string;
  kelasId?: string;
  kelas_id: string;
  rombel_id?: string;
  ekskul_id: string;
  urutan: number;
  deskripsi: string;
  created_at?: string;
  updated_at?: string;
}

export interface TemaKokurikuler {
  id: string;
  kelasId?: string;
  kelas_id: string;
  rombel_id?: string;
  nama: string;
  keterangan?: string;
  urutan: number;
  tampil_di_rapor: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PenilaianKokurikuler {
  id?: string;
  kelasId?: string;
  kelas_id?: string;
  tema_id: string;
  siswa_id: string;
  dpl_kuat: string;
  dpl_penguatan: string;
  deskripsi_manual?: string;
  created_at?: string;
  updated_at?: string;
}

// Deprecated model kept for backward compatibility if needed
export interface Kokurikuler {
  siswa_id: string;
  kelasId?: string;
  kelas_id: string;
  rombel_id?: string;
  dpl_kuat: string;
  dpl_penguatan: string;
  tema_id: string;
  created_at?: string;
  updated_at?: string;
}

export type PeriodeKaih = 'JAN-JUN' | 'JUL-DES';

export interface KaihRecord {
  id?: string;
  siswa_id: string;
  kelasId?: string;
  kelas_id: string;
  rombel_id?: string;
  tahun: number;
  periode: PeriodeKaih | string;
  bangun_pagi?: StatusKaih | '';
  beribadah?: StatusKaih | '';
  berolahraga?: StatusKaih | '';
  makan_sehat?: StatusKaih | '';
  gemar_belajar?: StatusKaih | '';
  bermasyarakat?: StatusKaih | '';
  tidur_cepat?: StatusKaih | '';
  created_at?: string;
  updated_at?: string;
}

export interface Kehadiran {
  siswa_id: string;
  kelasId?: string;
  kelas_id: string;
  rombel_id?: string;
  sakit: number;
  izin: number;
  alpa: number;
  created_at?: string;
  updated_at?: string;
}

export interface CatatanWali {
  siswa_id: string;
  kelasId?: string;
  kelas_id: string;
  rombel_id?: string;
  catatan: string;
  keputusan_naik?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MutasiRecord {
  id: string;
  siswa_id: string;
  kelasId?: string;
  kelas_id?: string;
  jenis: 'keluar' | 'masuk' | 'Pindah Rombel' | string;
  tanggal: string;
  kelas: string;
  alasan: string;
  sekolah_asal?: string;
  tahun_pelajaran?: string;
  created_at?: string;
  updated_at?: string;
}

// Aggregated state for a class session
export interface AppData {
  sekolah: Sekolah;
  tahunAjaran: TahunAjaran[];
  activeTahunAjaranId: string;
  tingkat?: Tingkat[];
  rombel?: Rombel[];
  kelas: Kelas[];
  accounts?: any[];
  currentKelasId: string;
  siswa: Siswa[];
  kelasSiswa: KelasSiswa[];
  mapel: Mapel[];
  tp: TujuanPembelajaran[];
  lm: LingkupMateri[];
  formatif: NilaiFormatif[];
  sumatifLM: NilaiSumatifLM[];
  sumatifSemester: NilaiSumatifSemester[];
  ekskul: Ekstrakurikuler[];
  nilaiEkskul: NilaiEkskul[];
  temaKokurikuler: TemaKokurikuler[];
  penilaianKokurikuler: PenilaianKokurikuler[];
  kokurikuler?: Kokurikuler[];
  kaih: KaihRecord[];
  kehadiran: Kehadiran[];
  catatanWali: CatatanWali[];
  mutasi: MutasiRecord[];
  kunciTpLm?: Record<number, boolean>;
}

export type UserRole = 'admin' | 'guru';

// ─── Peran Firebase (Tahap 1) ────────────────────────────────────────────────
export type UserPeranFirebase = 'admin' | 'wali_kelas' | 'guru_mapel';

/** Profil pengguna di Firestore koleksi `users` */
export interface FirestoreUserProfile {
  uid: string;
  nama: string;
  gelar?: string;
  nip?: string;
  username?: string;
  email?: string;
  peran: UserPeranFirebase;
  aktif: boolean;
  kelasId?: string;
  /** ID kelas yang diajar (untuk guru_mapel) */
  kelasIds?: string[];
  /** ID mapel yang diajar (untuk guru_mapel) */
  mapelIds?: string[];
  harusGantiPassword?: boolean;
  loginEmail?: string;
  loginVersi?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface UserSession {
  token: string;
  peran: UserRole;
  username?: string;
  rombelId?: string;
  rombelNama?: string; // e.g. '1A' or '4'
  label?: string; // e.g. '1A' or 'Kelas 4'
  tingkatAngka?: number; // 1 .. 6
  huruf?: string; // 'A' | 'B' | 'C' ... or ''
  kelas: string; // e.g. '1A' or '4'
  namaWali: string;
  nipWali?: string;
  tahunAjaran: string; // e.g. "2025/2026"
  semester: Semester; // 1 or 2
  fase: Fase;
  kelasId: string; // alias to rombelId
  hanya_lihat?: boolean;
  wajib_ganti_sandi?: boolean;
  tahunAjaranId?: string;
  isArsip?: boolean;
}

export interface AkunUser {
  id: string;
  peran: UserRole;
  username?: string;
  rombel_id?: string;
  kelas?: string;
  nama: string;
  nip?: string;
  aktif: boolean;
  wajib_ganti_sandi?: boolean;
  terakhir_masuk?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PengaturanSekolah {
  tahun_ajaran_aktif: string;
  semester_aktif: Semester;
}

export interface InfoKelasLogin {
  kelas: TingkatKelas | string;
  nama_wali: string;
  nip_wali?: string;
  fase: Fase;
  aktif: boolean;
}

export interface InfoRombelLogin {
  id: string;
  nama: string; // '1A' or '4'
  label?: string; // '1A' or 'Kelas 4'
  tingkat: number; // 1 .. 6
  huruf: string; // 'A' or ''
  fase: Fase;
  nama_wali: string;
  nip_wali?: string;
  ada_akun: boolean;
  aktif: boolean;
}

export interface DaftarKelasLoginResponse {
  rombel?: InfoRombelLogin[];
  kelasList: InfoKelasLogin[];
  tahunAjaranAktif: string;
  semesterAktif: Semester;
  daftarSemester: {
    tahun: string;
    semester: Semester;
    label: string;
    aktif: boolean;
  }[];
}

