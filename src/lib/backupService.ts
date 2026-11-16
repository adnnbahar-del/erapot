// src/lib/backupService.ts
// Layanan Ekspor & Impor (Cadangan & Pemulihan Data) - Tahap 6
// Mendukung:
// 1. Ekspor data per semester ke berkas Excel (.xlsx) dengan sheet:
//    - Siswa
//    - Nilai Formatif
//    - Nilai Sumatif
//    - Kehadiran
//    - Kokurikuler
//    - 7 KAIH
// 2. Ekspor basis data per semester ke JSON
// 3. Impor/Pemulihan data dari berkas JSON dengan konfirmasi & logging

import * as XLSX from 'xlsx';
import type { AppData, Siswa, KelasSiswa, NilaiFormatif, NilaiSumatifLM, NilaiSumatifSemester, Kehadiran, PenilaianKokurikuler, KaihRecord, Mapel, TujuanPembelajaran, LingkupMateri, TemaKokurikuler } from '../types';
import { catatLogAktivitas } from './logAktivitasService';
import { db, isFirebaseConfigured } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

const LOCAL_STORAGE_DATA_KEY = 'erapot_sd_local_database_v1';

export interface BackupMetadata {
  versi: string;
  waktuEkspor: string;
  tahunAjaranId: string;
  tahunAjaranLabel: string;
  keterangan: string;
}

export interface BackupPayload {
  metadata: BackupMetadata;
  sekolah: any;
  tahunAjaran: any[];
  kelas: any[];
  rombel: any[];
  siswa: Siswa[];
  kelasSiswa: KelasSiswa[];
  mapel: Mapel[];
  tp: TujuanPembelajaran[];
  lm: LingkupMateri[];
  formatif: NilaiFormatif[];
  sumatifLM: NilaiSumatifLM[];
  sumatifSemester: NilaiSumatifSemester[];
  kehadiran: Kehadiran[];
  penilaianKokurikuler: PenilaianKokurikuler[];
  temaKokurikuler: TemaKokurikuler[];
  kaih: KaihRecord[];
}

/**
 * Filter data untuk semester/tahun ajaran yang dipilih
 */
function filterDataSemester(data: AppData, tahunAjaranId: string) {
  const isMatchTA = (itemTaId?: string) => !itemTaId || itemTaId === tahunAjaranId;

  // Kelas siswa di semester ini
  const activeKelasSiswa = (data.kelasSiswa || []).filter((ks) => isMatchTA(ks.tahun_ajaran_id));
  const activeSiswaIds = new Set(activeKelasSiswa.map((ks) => ks.siswa_id));

  // Siswa terkait
  const siswaList = (data.siswa || []).filter((s) => activeSiswaIds.size === 0 || activeSiswaIds.has(s.id));

  // Map siswa ID ke nama & rombel untuk lookup cepat
  const siswaMap = new Map<string, { nama: string; nis: string; nisn: string; kelasNama: string }>();
  (data.siswa || []).forEach((s) => {
    const ks = activeKelasSiswa.find((k) => k.siswa_id === s.id);
    let kelasNama = '-';
    if (ks) {
      const rombel = (data.rombel || []).find((r) => r.id === ks.rombel_id || r.id === ks.kelas_id);
      kelasNama = rombel ? rombel.nama : ks.kelas_id;
    }
    siswaMap.set(s.id, { nama: s.nama, nis: s.nis, nisn: s.nisn, kelasNama });
  });

  // Map TP dan Mapel
  const mapelMap = new Map((data.mapel || []).map((m) => [m.id, m.nama]));
  const tpMap = new Map((data.tp || []).map((t) => [t.id, t.deskripsi]));
  const lmMap = new Map((data.lm || []).map((l) => [l.id, l.nama]));
  const temaMap = new Map((data.temaKokurikuler || []).map((t) => [t.id, t.nama]));

  return {
    activeKelasSiswa,
    activeSiswaIds,
    siswaList,
    siswaMap,
    mapelMap,
    tpMap,
    lmMap,
    temaMap,
  };
}

/**
 * 1. Ekspor data satu semester ke Excel (.xlsx)
 */
export async function eksporSemesterExcel(
  data: AppData,
  tahunAjaranId: string,
  tahunAjaranLabel: string,
  currentUser?: { uid?: string; nama?: string; peran?: string }
): Promise<void> {
  const {
    activeKelasSiswa,
    siswaList,
    siswaMap,
    mapelMap,
    tpMap,
    lmMap,
    temaMap,
  } = filterDataSemester(data, tahunAjaranId);

  const wb = XLSX.utils.book_new();

  // 1. Sheet Siswa
  const sheetSiswaData = siswaList.map((s, idx) => {
    const lookup = siswaMap.get(s.id);
    return {
      No: idx + 1,
      'ID Siswa': s.id,
      NIS: s.nis || '',
      NISN: s.nisn || '',
      'Nama Siswa': s.nama,
      'Jenis Kelamin': s.jk === 'L' ? 'Laki-laki' : 'Perempuan',
      'Tempat Lahir': s.tempat_lahir || '',
      'Tanggal Lahir': s.tanggal_lahir || '',
      Agama: s.agama || '',
      Alamat: s.alamat || '',
      'Nama Ayah': s.nama_ayah || '',
      'Nama Ibu': s.nama_ibu || '',
      'Kelas / Rombel': lookup?.kelasNama || '-',
    };
  });
  const wsSiswa = XLSX.utils.json_to_sheet(sheetSiswaData.length > 0 ? sheetSiswaData : [{ Info: 'Tidak ada data siswa' }]);
  XLSX.utils.book_append_sheet(wb, wsSiswa, 'Siswa');

  // 2. Sheet Nilai Formatif
  const sheetFormatifData = (data.formatif || []).map((f, idx) => {
    const s = siswaMap.get(f.siswa_id);
    return {
      No: idx + 1,
      'ID Siswa': f.siswa_id,
      'Nama Siswa': s?.nama || f.siswa_id,
      'Kelas / Rombel': s?.kelasNama || '-',
      'TP ID': f.tp_id,
      'Deskripsi TP': tpMap.get(f.tp_id) || f.tp_id,
      KKTP: f.kktp === 1 ? 'Tercapai (1)' : 'Perlu Bimbingan (0)',
      'Tampil di Rapor': f.tampil === 1 ? 'Ya (1)' : 'Tidak (0)',
    };
  });
  const wsFormatif = XLSX.utils.json_to_sheet(sheetFormatifData.length > 0 ? sheetFormatifData : [{ Info: 'Tidak ada nilai formatif' }]);
  XLSX.utils.book_append_sheet(wb, wsFormatif, 'Nilai Formatif');

  // 3. Sheet Nilai Sumatif (Gabungan LM + Semester)
  const sumatifMap = new Map<string, { lmNilai?: number | null; pts?: number | null; pas?: number | null }>();
  (data.sumatifLM || []).forEach((slm) => {
    const key = `${slm.siswa_id}_${slm.lm_id}`;
    sumatifMap.set(key, { lmNilai: slm.nilai });
  });

  const sheetSumatifData = (data.sumatifLM || []).map((slm, idx) => {
    const s = siswaMap.get(slm.siswa_id);
    return {
      No: idx + 1,
      'ID Siswa': slm.siswa_id,
      'Nama Siswa': s?.nama || slm.siswa_id,
      'Kelas / Rombel': s?.kelasNama || '-',
      'LM ID': slm.lm_id,
      'Lingkup Materi': lmMap.get(slm.lm_id) || slm.lm_id,
      'Nilai LM': slm.nilai ?? '',
    };
  });
  const wsSumatif = XLSX.utils.json_to_sheet(sheetSumatifData.length > 0 ? sheetSumatifData : [{ Info: 'Tidak ada nilai sumatif' }]);
  XLSX.utils.book_append_sheet(wb, wsSumatif, 'Nilai Sumatif');

  // 4. Sheet Kehadiran
  const sheetKehadiranData = (data.kehadiran || []).map((k, idx) => {
    const s = siswaMap.get(k.siswa_id);
    return {
      No: idx + 1,
      'ID Siswa': k.siswa_id,
      'Nama Siswa': s?.nama || k.siswa_id,
      'Kelas / Rombel': s?.kelasNama || k.rombel_id || k.kelas_id || '-',
      'Sakit (Hari)': k.sakit || 0,
      'Izin (Hari)': k.izin || 0,
      'Alpa (Hari)': k.alpa || 0,
    };
  });
  const wsKehadiran = XLSX.utils.json_to_sheet(sheetKehadiranData.length > 0 ? sheetKehadiranData : [{ Info: 'Tidak ada data kehadiran' }]);
  XLSX.utils.book_append_sheet(wb, wsKehadiran, 'Kehadiran');

  // 5. Sheet Kokurikuler
  const sheetKokuData = (data.penilaianKokurikuler || []).map((pk, idx) => {
    const s = siswaMap.get(pk.siswa_id);
    return {
      No: idx + 1,
      'ID Siswa': pk.siswa_id,
      'Nama Siswa': s?.nama || pk.siswa_id,
      'Kelas / Rombel': s?.kelasNama || '-',
      'Tema ID': pk.tema_id,
      'Nama Tema': temaMap.get(pk.tema_id) || pk.tema_id,
      'DPL Sangat Berkembang (Kuat)': pk.dpl_kuat || '',
      'DPL Sedang Berkembang (Penguatan)': pk.dpl_penguatan || '',
      'Catatan Tambahan': pk.deskripsi_manual || '',
    };
  });
  const wsKoku = XLSX.utils.json_to_sheet(sheetKokuData.length > 0 ? sheetKokuData : [{ Info: 'Tidak ada penilaian kokurikuler' }]);
  XLSX.utils.book_append_sheet(wb, wsKoku, 'Kokurikuler');

  // 6. Sheet 7 KAIH
  const sheetKaihData = (data.kaih || []).map((kh, idx) => {
    const s = siswaMap.get(kh.siswa_id);
    return {
      No: idx + 1,
      'ID Siswa': kh.siswa_id,
      'Nama Siswa': s?.nama || kh.siswa_id,
      'Kelas / Rombel': s?.kelasNama || kh.rombel_id || kh.kelas_id || '-',
      Tahun: kh.tahun || 2025,
      Periode: kh.periode || 'JUL-DES',
      'Bangun Pagi': kh.bangun_pagi || '-',
      Beribadah: kh.beribadah || '-',
      Berolahraga: kh.berolahraga || '-',
      'Makan Sehat': kh.makan_sehat || '-',
      'Gemar Belajar': kh.gemar_belajar || '-',
      Bermasyarakat: kh.bermasyarakat || '-',
      'Tidur Cepat': kh.tidur_cepat || '-',
    };
  });
  const wsKaih = XLSX.utils.json_to_sheet(sheetKaihData.length > 0 ? sheetKaihData : [{ Info: 'Tidak ada data 7 KAIH' }]);
  XLSX.utils.book_append_sheet(wb, wsKaih, '7 KAIH');

  // Tulis berkas Excel
  const safeLabel = tahunAjaranLabel.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `Backup_ERapor_${safeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  simpanTanggalBackupTerakhir();
  // Catat Log Aktivitas
  await catatLogAktivitas({
    uid: currentUser?.uid || 'admin_local',
    nama: currentUser?.nama || 'Administrator',
    peran: 'admin',
    aksi: 'EKSPOR_EXCEL',
    target: `Semester ${tahunAjaranLabel}`,
    nilaiBaru: filename,
  });
}

/**
 * 2. Ekspor data satu semester ke JSON
 */
export async function eksporSemesterJson(
  data: AppData,
  tahunAjaranId: string,
  tahunAjaranLabel: string,
  currentUser?: { uid?: string; nama?: string; peran?: string }
): Promise<void> {
  const payload: BackupPayload = {
    metadata: {
      versi: '2.0-kurikulum-merdeka',
      waktuEkspor: new Date().toISOString(),
      tahunAjaranId,
      tahunAjaranLabel,
      keterangan: 'Cadangan data semester E-Rapor SD (Kurikulum Merdeka)',
    },
    sekolah: data.sekolah,
    tahunAjaran: data.tahunAjaran || [],
    kelas: data.kelas || [],
    rombel: data.rombel || [],
    siswa: data.siswa || [],
    kelasSiswa: (data.kelasSiswa || []).filter((ks) => !ks.tahun_ajaran_id || ks.tahun_ajaran_id === tahunAjaranId),
    mapel: data.mapel || [],
    tp: data.tp || [],
    lm: data.lm || [],
    formatif: data.formatif || [],
    sumatifLM: data.sumatifLM || [],
    sumatifSemester: data.sumatifSemester || [],
    kehadiran: data.kehadiran || [],
    penilaianKokurikuler: data.penilaianKokurikuler || [],
    temaKokurikuler: data.temaKokurikuler || [],
    kaih: data.kaih || [],
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeLabel = tahunAjaranLabel.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `Backup_ERapor_${safeLabel}_${new Date().toISOString().slice(0, 10)}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  simpanTanggalBackupTerakhir();
  // Catat Log Aktivitas
  await catatLogAktivitas({
    uid: currentUser?.uid || 'admin_local',
    nama: currentUser?.nama || 'Administrator',
    peran: 'admin',
    aksi: 'EKSPOR_JSON',
    target: `Semester ${tahunAjaranLabel}`,
    nilaiBaru: filename,
  });
}

/**
 * 3. Impor & Pulihkan Basis Data dari JSON
 */
export async function pulihkanDariJson(
  jsonString: string,
  currentData: AppData,
  currentUser?: { uid?: string; nama?: string; peran?: string }
): Promise<{ success: boolean; message: string; recordCounts: Record<string, number> }> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error('Berkas bukan merupakan format JSON yang valid.');
  }

  // Validasi struktur minimal
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Format data berkas JSON tidak sesuai.');
  }

  // Jika berkas merupakan BackupPayload versi 2.0 atau format AppData langsung
  const incomingData: Partial<AppData> = parsed.metadata ? parsed : parsed;

  const mergedData: AppData = {
    sekolah: incomingData.sekolah || currentData.sekolah,
    tahunAjaran: incomingData.tahunAjaran || currentData.tahunAjaran || [],
    activeTahunAjaranId: incomingData.activeTahunAjaranId || currentData.activeTahunAjaranId,
    currentKelasId: incomingData.currentKelasId || currentData.currentKelasId,
    tingkat: incomingData.tingkat || currentData.tingkat || [],
    rombel: incomingData.rombel || currentData.rombel || [],
    kelas: incomingData.kelas || currentData.kelas || [],
    siswa: incomingData.siswa || currentData.siswa || [],
    kelasSiswa: incomingData.kelasSiswa || currentData.kelasSiswa || [],
    mapel: incomingData.mapel || currentData.mapel || [],
    tp: incomingData.tp || currentData.tp || [],
    lm: incomingData.lm || currentData.lm || [],
    formatif: incomingData.formatif || currentData.formatif || [],
    sumatifLM: incomingData.sumatifLM || currentData.sumatifLM || [],
    sumatifSemester: incomingData.sumatifSemester || currentData.sumatifSemester || [],
    ekskul: incomingData.ekskul || currentData.ekskul || [],
    nilaiEkskul: incomingData.nilaiEkskul || currentData.nilaiEkskul || [],
    temaKokurikuler: incomingData.temaKokurikuler || currentData.temaKokurikuler || [],
    penilaianKokurikuler: incomingData.penilaianKokurikuler || currentData.penilaianKokurikuler || [],
    kaih: incomingData.kaih || currentData.kaih || [],
    kehadiran: incomingData.kehadiran || currentData.kehadiran || [],
    catatanWali: incomingData.catatanWali || currentData.catatanWali || [],
    mutasi: incomingData.mutasi || currentData.mutasi || [],
    kunciTpLm: incomingData.kunciTpLm || currentData.kunciTpLm || {},
  };

  // Simpan ke local storage
  localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(mergedData));

  // Simpan ke Firestore jika aktif
  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'system', 'appDataBackup'), {
        restoredAt: new Date().toISOString(),
        restoredBy: currentUser?.nama || 'Admin',
        dataSnippet: {
          siswaCount: mergedData.siswa.length,
          formatifCount: mergedData.formatif.length,
        },
      }, { merge: true });
    } catch {
      // Non-blocking
    }
  }

  const recordCounts: Record<string, number> = {
    siswa: mergedData.siswa?.length || 0,
    kelasSiswa: mergedData.kelasSiswa?.length || 0,
    nilaiFormatif: mergedData.formatif?.length || 0,
    nilaiSumatif: (mergedData.sumatifLM?.length || 0) + (mergedData.sumatifSemester?.length || 0),
    kehadiran: mergedData.kehadiran?.length || 0,
    penilaianKokurikuler: mergedData.penilaianKokurikuler?.length || 0,
    kaih: mergedData.kaih?.length || 0,
  };

  // Catat Log Aktivitas
  await catatLogAktivitas({
    uid: currentUser?.uid || 'admin_local',
    nama: currentUser?.nama || 'Administrator',
    peran: 'admin',
    aksi: 'PEMULIHAN_DATA_JSON',
    target: 'Basis Data Sistem',
    nilaiLama: `${currentData.siswa?.length || 0} siswa`,
    nilaiBaru: `${recordCounts.siswa} siswa (${JSON.stringify(recordCounts)})`,
  });

  return {
    success: true,
    message: 'Data berhasil dipulihkan dari berkas cadangan JSON.',
    recordCounts,
  };
}



// ─── PENGINGAT CADANGAN DATA (14 HARI) & EKSPOR LENGKAP SPARK PLAN ─────────────

export function simpanTanggalBackupTerakhir(): void {
  const now = new Date().toISOString();
  try {
    localStorage.setItem('erapot_last_backup_date', now);
  } catch {}
  if (isFirebaseConfigured) {
    try {
      setDoc(doc(db, 'pengaturan', 'system'), { lastBackupDate: now }, { merge: true }).catch(() => {});
    } catch {}
  }
}

export async function getTanggalBackupTerakhir(): Promise<string | null> {
  if (isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, 'pengaturan', 'system'));
      if (snap.exists() && snap.data().lastBackupDate) {
        return snap.data().lastBackupDate;
      }
    } catch {}
  }
  return localStorage.getItem('erapot_last_backup_date');
}

/**
 * Ekspor SEMUA koleksi ke 1 file JSON (Spark Plan Full Backup)
 */
export async function eksporSemuaKoleksiJson(
  data: AppData,
  currentUser?: { uid?: string; nama?: string; peran?: string }
): Promise<void> {
  const allData: Record<string, any> = {
    metadata: {
      versi: '2.0-full-backup',
      waktuEkspor: new Date().toISOString(),
      keterangan: 'Cadangan penuh seluruh koleksi data E-Rapor SD Kurikulum Merdeka (Spark Plan)',
    },
    sekolah: data.sekolah,
    tahunAjaran: data.tahunAjaran || [],
    kelas: data.kelas || [],
    rombel: data.rombel || [],
    siswa: data.siswa || [],
    kelasSiswa: data.kelasSiswa || [],
    mapel: data.mapel || [],
    tp: data.tp || [],
    lm: data.lm || [],
    formatif: data.formatif || [],
    sumatifLM: data.sumatifLM || [],
    sumatifSemester: data.sumatifSemester || [],
    kehadiran: data.kehadiran || [],
    penilaianKokurikuler: data.penilaianKokurikuler || [],
    temaKokurikuler: data.temaKokurikuler || [],
    kaih: data.kaih || [],
    catatanWali: data.catatanWali || [],
    ekskul: data.ekskul || [],
    nilaiEkskul: data.nilaiEkskul || [],
  };

  // Ambil koleksi Firestore tambahan jika aktif
  if (isFirebaseConfigured) {
    const collectionsToFetch = [
      'users', 'kelas', 'siswa', 'kelasSiswa', 'mapel', 'tp', 'lm',
      'formatif', 'sumatifLM', 'sumatifSemester', 'kehadiran',
      'penilaianKokurikuler', 'temaKokurikuler', 'kaih', 'catatanWali', 'tahunAjaran'
    ];
    for (const colName of collectionsToFetch) {
      try {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          allData[colName] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      } catch {}
    }
  }

  const jsonStr = JSON.stringify(allData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `Backup_Lengkap_ERapor_SemuaKoleksi_${new Date().toISOString().slice(0, 10)}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  simpanTanggalBackupTerakhir();

  await catatLogAktivitas({
    uid: currentUser?.uid || 'admin',
    nama: currentUser?.nama || 'Administrator',
    peran: 'admin',
    aksi: 'EKSPOR_JSON',
    target: 'Semua Koleksi (Full Backup)',
    nilaiBaru: filename,
  });
}

/**
 * Ekspor SEMUA koleksi ke 1 file Excel (.xlsx) dengan banyak sheet (Spark Plan)
 */
export async function eksporSemuaKoleksiExcel(
  data: AppData,
  currentUser?: { uid?: string; nama?: string; peran?: string }
): Promise<void> {
  const wb = XLSX.utils.book_new();

  const addSheet = (sheetName: string, rows: any[]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: `Tidak ada data ${sheetName}` }]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  };

  // 1. Siswa
  const siswaRows = (data.siswa || []).map((s, idx) => ({
    No: idx + 1,
    ID: s.id,
    NIS: s.nis,
    NISN: s.nisn,
    Nama: s.nama,
    'Jenis Kelamin': s.jk || (s as any).jenis_kelamin || '-',
    'Tempat Lahir': s.tempat_lahir,
    'Tanggal Lahir': s.tanggal_lahir,
    Agama: s.agama,
    Alamat: s.alamat,
    'Nama Ayah': s.nama_ayah,
    'Nama Ibu': s.nama_ibu,
  }));
  addSheet('Siswa', siswaRows);

  // 2. Kelas & Rombel
  const kelasRows = (data.kelas || data.rombel || []).map((k: any, idx) => ({
    No: idx + 1,
    ID: k.id,
    Nama: k.nama || k.tingkat,
    Fase: k.fase || '-',
    'Wali Kelas': k.nama_wali || k.waliNama || '-',
    NIP: k.nip_wali || k.nipWali || '-',
  }));
  addSheet('Kelas', kelasRows);

  // 3. Mata Pelajaran
  const mapelRows = (data.mapel || []).map((m, idx) => ({
    No: idx + 1,
    ID: m.id,
    Kode: m.kode || '-',
    Nama: m.nama,
    Kelompok: m.kelompok,
    Fase: Array.isArray(m.faseBerlaku) ? m.faseBerlaku.join(', ') : (m as any).fase || 'Semua',
    Aktif: m.aktif !== false ? 'Ya' : 'Tidak',
  }));
  addSheet('Mata Pelajaran', mapelRows);

  // 4. Formatif
  const formatifRows = (data.formatif || []).map((f, idx) => ({
    No: idx + 1,
    'ID Siswa': f.siswa_id,
    'ID TP': f.tp_id,
    KKTP: f.kktp,
    'Tampil Rapor': f.tampil,
  }));
  addSheet('Nilai Formatif', formatifRows);

  // 5. Sumatif LM
  const sumatifLMRows = (data.sumatifLM || []).map((s, idx) => ({
    No: idx + 1,
    'ID Siswa': s.siswa_id,
    'ID LM': s.lm_id,
    Nilai: s.nilai,
  }));
  addSheet('Nilai Sumatif LM', sumatifLMRows);

  // 6. Sumatif Semester
  const sumatifSemRows = (data.sumatifSemester || []).map((s, idx) => ({
    No: idx + 1,
    'ID Siswa': s.siswa_id,
    'ID Mapel': s.mapel_id,
    'Nilai PTS': s.pts,
    'Nilai PAS': s.pas,
  }));
  addSheet('Nilai Sumatif Akhir', sumatifSemRows);

  // 7. Kehadiran
  const kehadiranRows = (data.kehadiran || []).map((k, idx) => ({
    No: idx + 1,
    'ID Siswa': k.siswa_id,
    Sakit: k.sakit,
    Izin: k.izin,
    'Tanpa Keterangan': k.alpa,
  }));
  addSheet('Kehadiran', kehadiranRows);

  // 8. 7 KAIH
  const kaihRows = (data.kaih || []).map((kh, idx) => ({
    No: idx + 1,
    'ID Siswa': kh.siswa_id,
    'Bangun Pagi': kh.bangun_pagi || '-',
    Beribadah: kh.beribadah || '-',
    Berolahraga: kh.berolahraga || '-',
    'Makan Sehat': kh.makan_sehat || '-',
    'Gemar Belajar': kh.gemar_belajar || '-',
    Bermasyarakat: kh.bermasyarakat || '-',
    'Tidur Cepat': kh.tidur_cepat || '-',
  }));
  addSheet('7 KAIH', kaihRows);

  // 9. Kokurikuler
  const kokuRows = (data.penilaianKokurikuler || []).map((pk, idx) => ({
    No: idx + 1,
    'ID Siswa': pk.siswa_id,
    'ID Tema': pk.tema_id,
    'DPL Kuat': pk.dpl_kuat,
    'DPL Penguatan': pk.dpl_penguatan,
    Catatan: pk.deskripsi_manual,
  }));
  addSheet('Kokurikuler', kokuRows);

  const filename = `Backup_Lengkap_ERapor_SemuaKoleksi_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  simpanTanggalBackupTerakhir();

  await catatLogAktivitas({
    uid: currentUser?.uid || 'admin',
    nama: currentUser?.nama || 'Administrator',
    peran: 'admin',
    aksi: 'EKSPOR_EXCEL',
    target: 'Semua Koleksi (Full Backup)',
    nilaiBaru: filename,
  });
}
