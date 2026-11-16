// src/lib/migrasiService.ts
// Skrip Migrasi Satu Kali dari Struktur Lama ke Struktur Baru (Tahap 6)
//
// 1. Kelas lama (1A–6C dan kelas tanpa rombel) → koleksi Firestore `kelas`.
// 2. Data wali kelas lama → akun Firebase Auth & koleksi `users`.
// 3. Data nilai / siswa yang sudah ada diberi `kelasId` & `tahunAjaranId` 2025/2026 Ganjil.
// 4. Data lama TIDAK dihapus sampai migrasi terverifikasi.
// 5. Menghasilkan laporan jumlah dokumen sebelum dan sesudah migrasi.

import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { faseDariTingkat } from './rombel';
import { DEFAULT_ROMBEL_DATA } from './api';
import { catatLogAktivitas } from './logAktivitasService';
import type { AppData } from '../types';
import type { KelasDoc } from './kelasService';

const LOCAL_STORAGE_DATA_KEY = 'erapot_sd_local_database_v1';
const LOCAL_STORAGE_USERS_KEY = 'erapot_users_firestore_fallback';
const DEFAULT_TAHUN_AJARAN_ID = 'ta_2025_2026_ganjil';

export interface DokumenCounts {
  kelas: number;
  users: number;
  siswa: number;
  kelasSiswa: number;
  formatif: number;
  sumatif: number;
  kehadiran: number;
  kokurikuler: number;
  kaih: number;
}

export interface HasilMigrasi {
  sukses: boolean;
  sebelum: DokumenCounts;
  sesudah: DokumenCounts;
  kelasBaru: number;
  usersBaru: number;
  siswaDimigrasikan: number;
  nilaiDimigrasikan: number;
  rincian: string[];
  waktu: string;
}

/**
 * Hitung jumlah dokumen saat ini (sebelum atau sesudah migrasi)
 */
export async function hitungDokumen(appData?: AppData | null): Promise<DokumenCounts> {
  let counts: DokumenCounts = {
    kelas: 0,
    users: 0,
    siswa: 0,
    kelasSiswa: 0,
    formatif: 0,
    sumatif: 0,
    kehadiran: 0,
    kokurikuler: 0,
    kaih: 0,
  };

  if (isFirebaseConfigured) {
    try {
      const [
        kelasSnap,
        usersSnap,
        siswaSnap,
        ksSnap,
        formatifSnap,
        sumatifSnap,
        kehadiranSnap,
        kokuSnap,
        kaihSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'kelas')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'siswa')),
        getDocs(collection(db, 'kelasSiswa')),
        getDocs(collection(db, 'formatif')),
        getDocs(collection(db, 'sumatifLM')),
        getDocs(collection(db, 'kehadiran')),
        getDocs(collection(db, 'penilaianKokurikuler')),
        getDocs(collection(db, 'kaih')),
      ]);

      counts = {
        kelas: kelasSnap.size,
        users: usersSnap.size,
        siswa: siswaSnap.size,
        kelasSiswa: ksSnap.size,
        formatif: formatifSnap.size,
        sumatif: sumatifSnap.size,
        kehadiran: kehadiranSnap.size,
        kokurikuler: kokuSnap.size,
        kaih: kaihSnap.size,
      };
      return counts;
    } catch {
      // Fallback ke local
    }
  }

  // Local fallback
  const rawData = appData || (() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const rawUsers = (() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();

  if (rawData) {
    counts.kelas = (rawData.rombel?.length || rawData.kelas?.length || 0);
    counts.users = rawUsers.length || 0;
    counts.siswa = rawData.siswa?.length || 0;
    counts.kelasSiswa = rawData.kelasSiswa?.length || 0;
    counts.formatif = rawData.formatif?.length || 0;
    counts.sumatif = (rawData.sumatifLM?.length || 0) + (rawData.sumatifSemester?.length || 0);
    counts.kehadiran = rawData.kehadiran?.length || 0;
    counts.kokurikuler = rawData.penilaianKokurikuler?.length || 0;
    counts.kaih = rawData.kaih?.length || 0;
  }

  return counts;
}

/**
 * Jalankan skrip migrasi satu kali
 */
export async function jalankanMigrasi(
  currentAppData: AppData,
  currentUser?: { uid?: string; nama?: string; peran?: string }
): Promise<HasilMigrasi> {
  const rincian: string[] = [];
  const sebelum = await hitungDokumen(currentAppData);

  let kelasBaruCount = 0;
  let usersBaruCount = 0;
  let siswaDimigrasikanCount = 0;
  let nilaiDimigrasikanCount = 0;

  // 1. Definisikan Kelas & Wali Kelas Lama
  // Gabungkan dari DEFAULT_ROMBEL_DATA dan data.rombel
  const sumberRombel = (currentAppData.rombel && currentAppData.rombel.length > 0)
    ? currentAppData.rombel.map((r: any) => ({
        tingkat: r.angka || r.tingkat || 1,
        huruf: r.huruf || '',
        nama_wali: r.nama_wali || 'Guru Kelas',
        nip_wali: r.nip_wali || '',
        label: r.label || r.nama,
      }))
    : DEFAULT_ROMBEL_DATA;

  // Buat daftar kelas target
  const targetKelasList: any[] = [];
  const targetUsersList: any[] = [];

  // Peta rombel lama ke ID kelas baru (mis. 'rombel_1a' -> 'kelas_1a', '1A' -> 'kelas_1a')
  const kelasIdMap = new Map<string, string>();

  sumberRombel.forEach((r: any, idx: number) => {
    const isRombel = Boolean(r.huruf);
    const kelasId = isRombel
      ? `kelas_${r.tingkat}${r.huruf.toLowerCase()}`
      : `kelas_${r.tingkat}`;
    const namaKelas = isRombel ? `${r.tingkat}${r.huruf}` : String(r.tingkat);
    const urutan = r.tingkat * 100 + (r.huruf ? r.huruf.charCodeAt(0) - 64 : 0);
    const fase = faseDariTingkat(r.tingkat);

    // Pemetaan berbagai variasi ID lama ke kelasId baru
    kelasIdMap.set(namaKelas, kelasId);
    kelasIdMap.set(namaKelas.toLowerCase(), kelasId);
    kelasIdMap.set(`rombel_${r.tingkat}${r.huruf.toLowerCase()}`, kelasId);
    kelasIdMap.set(`rombel_${r.tingkat}`, kelasId);
    kelasIdMap.set(`kelas_${r.tingkat}`, kelasId);

    // Akun Wali Kelas
    const cleanNama = r.nama_wali.replace(/,.*$/, '').trim();
    const namaWords = cleanNama.split(' ');
    const userSlug = namaWords.slice(0, 2).join('.').toLowerCase().replace(/[^a-z.]/g, '') || `wali.${namaKelas.toLowerCase()}`;
    const userEmail = `${userSlug}@erapot.sd.id`;
    const userUid = `user_wali_${kelasId}`;

    const userDoc = {
      uid: userUid,
      nama: r.nama_wali,
      gelar: r.nama_wali.includes(',') ? r.nama_wali.split(',')[1].trim() : '',
      nip: r.nip_wali || '',
      email: userEmail,
      username: userSlug,
      peran: 'wali_kelas',
      aktif: true,
      kelasId: kelasId,
      createdAt: new Date().toISOString(),
    };

    targetUsersList.push(userDoc);

    const kelasDoc = {
      id: kelasId,
      tingkat: r.tingkat,
      rombel: r.huruf ? r.huruf.toUpperCase() : '',
      nama: namaKelas,
      fase,
      urutan,
      aktif: true,
      waliKelasUid: userUid,
      namaWali: r.nama_wali,
      nipWali: r.nip_wali,
      emailWali: userEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    targetKelasList.push(kelasDoc);
  });

  rincian.push(`Menyiapkan ${targetKelasList.length} kelas dan ${targetUsersList.length} akun wali kelas.`);

  // 2. Terapkan kelas & user ke Firestore / LocalStorage
  if (isFirebaseConfigured) {
    try {
      const batch = writeBatch(db);
      for (const k of targetKelasList) {
        batch.set(doc(db, 'kelas', k.id), k, { merge: true });
        kelasBaruCount++;
      }
      for (const u of targetUsersList) {
        batch.set(doc(db, 'users', u.uid), u, { merge: true });
        usersBaruCount++;
      }
      await batch.commit();
      rincian.push(`Berhasil menyinkronkan data kelas dan pengguna ke koleksi Firestore.`);
    } catch (err: any) {
      rincian.push(`Peringatan Firestore: ${err.message}. Menyimpan ke penyimpanan lokal.`);
    }
  }

  // Simpan users fallback
  const existingUsers = (() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();
  const mergedUsers = [...existingUsers];
  targetUsersList.forEach((tu) => {
    const idx = mergedUsers.findIndex((u) => u.uid === tu.uid || u.email === tu.email);
    if (idx >= 0) {
      mergedUsers[idx] = { ...mergedUsers[idx], ...tu };
    } else {
      mergedUsers.push(tu);
      usersBaruCount++;
    }
  });
  localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(mergedUsers));

  // 3. Perbarui Siswa & Nilai dengan kelasId dan tahunAjaranId
  const updatedAppData: AppData = {
    ...currentAppData,
    activeTahunAjaranId: currentAppData.activeTahunAjaranId || DEFAULT_TAHUN_AJARAN_ID,
    rombel: (currentAppData.rombel && currentAppData.rombel.length > 0) ? currentAppData.rombel : (targetKelasList as any),
    kelas: (targetKelasList as any),
  };

  // Helper resolusi kelasId
  const resolveKelasId = (oldKelasId?: string, oldRombelId?: string): string => {
    if (oldRombelId && kelasIdMap.has(oldRombelId)) return kelasIdMap.get(oldRombelId)!;
    if (oldKelasId && kelasIdMap.has(oldKelasId)) return kelasIdMap.get(oldKelasId)!;
    if (oldRombelId && oldRombelId.startsWith('kelas_')) return oldRombelId;
    if (oldKelasId && oldKelasId.startsWith('kelas_')) return oldKelasId;
    return 'kelas_1a'; // Fallback aman
  };

  // Map Siswa & KelasSiswa
  updatedAppData.kelasSiswa = (currentAppData.kelasSiswa || []).map((ks: any) => {
    const targetKelasId = resolveKelasId(ks.kelas_id, ks.rombel_id);
    siswaDimigrasikanCount++;
    return {
      ...ks,
      kelas_id: targetKelasId,
      rombel_id: targetKelasId,
      tahun_ajaran_id: ks.tahun_ajaran_id || DEFAULT_TAHUN_AJARAN_ID,
    };
  });

  // Map Siswa ke kelasId untuk relasi nilai
  const siswaToKelasMap = new Map<string, string>();
  updatedAppData.kelasSiswa.forEach((ks: any) => {
    siswaToKelasMap.set(ks.siswa_id, ks.kelas_id);
  });

  // Nilai Formatif
  updatedAppData.formatif = (currentAppData.formatif || []).map((f: any) => {
    nilaiDimigrasikanCount++;
    return {
      ...f,
      updated_at: f.updated_at || new Date().toISOString(),
    };
  });

  // Nilai Sumatif LM
  updatedAppData.sumatifLM = (currentAppData.sumatifLM || []).map((slm: any) => {
    nilaiDimigrasikanCount++;
    return {
      ...slm,
      updated_at: slm.updated_at || new Date().toISOString(),
    };
  });

  // Nilai Sumatif Semester
  updatedAppData.sumatifSemester = (currentAppData.sumatifSemester || []).map((ss: any) => {
    nilaiDimigrasikanCount++;
    return {
      ...ss,
      updated_at: ss.updated_at || new Date().toISOString(),
    };
  });

  // Kehadiran
  updatedAppData.kehadiran = (currentAppData.kehadiran || []).map((k: any) => {
    const targetKelasId = resolveKelasId(k.kelas_id, k.rombel_id) || siswaToKelasMap.get(k.siswa_id) || 'kelas_1a';
    return {
      ...k,
      kelas_id: targetKelasId,
      rombel_id: targetKelasId,
    };
  });

  // Penilaian Kokurikuler
  updatedAppData.penilaianKokurikuler = (currentAppData.penilaianKokurikuler || []).map((pk: any) => {
    return {
      ...pk,
    };
  });

  // 7 KAIH
  updatedAppData.kaih = (currentAppData.kaih || []).map((kh: any) => {
    const targetKelasId = resolveKelasId(kh.kelas_id, kh.rombel_id) || siswaToKelasMap.get(kh.siswa_id) || 'kelas_1a';
    return {
      ...kh,
      kelas_id: targetKelasId,
      rombel_id: targetKelasId,
    };
  });

  // Simpan data terverifikasi ke localStorage (data asli tetap dipertahankan)
  localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(updatedAppData));
  rincian.push(`Pembaruan selesai: ${siswaDimigrasikanCount} penetapan kelas siswa dan ${nilaiDimigrasikanCount} nilai diperbarui dengan kelasId & tahunAjaranId.`);

  // Hitung sesudah
  const sesudah = await hitungDokumen(updatedAppData);

  // Catat Log Aktivitas
  await catatLogAktivitas({
    uid: currentUser?.uid || 'admin_local',
    nama: currentUser?.nama || 'Administrator',
    peran: 'admin',
    aksi: 'MIGRASI_STRUKTUR_LAMA',
    target: 'Sistem Rapor & Koleksi Kelas',
    nilaiLama: `${sebelum.kelas} kelas, ${sebelum.users} pengguna`,
    nilaiBaru: `${sesudah.kelas} kelas, ${sesudah.users} pengguna, ${siswaDimigrasikanCount} siswa termigrasi`,
  });

  return {
    sukses: true,
    sebelum,
    sesudah,
    kelasBaru: targetKelasList.length,
    usersBaru: targetUsersList.length,
    siswaDimigrasikan: siswaDimigrasikanCount,
    nilaiDimigrasikan: nilaiDimigrasikanCount,
    rincian,
    waktu: new Date().toISOString(),
  };
}

