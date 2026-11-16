// src/lib/kelasService.ts
// Layanan CRUD kelas di Firestore + fallback localStorage (Tahap 2).
// Koleksi Firestore: `kelas`
//   { id, tingkat, rombel, nama, fase, urutan, aktif, waliKelasUid,
//     namaWali?, gelarWali?, nipWali?, emailWali?,
//     jumlahSiswa?, createdAt, updatedAt }

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { db, auth, getSecondaryAuth, isFirebaseConfigured } from './firebase';
import { faseDariTingkat, hurufBerikutnya } from './rombel';
import { catatLogAktivitas } from './logAktivitasService';
import { getTahunAjaranAktif } from './tahunAjaranService';

// ─── Tipe ────────────────────────────────────────────────────────────────────

export interface KelasDoc {
  id: string;              // mis. 'kelas_1', 'kelas_1a'
  tingkat: number;         // 1–6
  rombel: string;          // '' | 'A' | 'B' ...
  nama: string;            // 'Kelas 1' | 'Kelas 1A' | 'Kelas 2' ...
  fase: 'A' | 'B' | 'C';
  urutan: number;          // 100 (Kelas 1), 101 (Kelas 1A), 102 (Kelas 1B), 200 (Kelas 2)...
  aktif: boolean;
  waliKelasUid?: string;
  namaWali?: string;
  gelarWali?: string;
  nipWali?: string;
  emailWali?: string;
  waliNama?: string;
  waliGelar?: string;
  loginEmail?: string;
  loginVersi?: number;
  jumlahSiswa?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaliKelasInput {
  nama: string;
  gelar?: string;
  nip?: string;
  email?: string;
  password?: string;
}

export interface GuruMapelDoc {
  id: string;
  uid: string;
  nama: string;
  username: string;
  email: string;
  loginEmail?: string;
  loginVersi?: number;
  nip?: string;
  peran: 'guru_mapel';
  aktif: boolean;
  kelasIds: string[];
  mapelIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AkunLamaItem {
  uid: string;
  nama: string;
  gelar?: string;
  nip?: string;
  peran: 'wali_kelas' | 'guru_mapel' | 'admin';
  loginEmail?: string;
  email?: string;
  kelasId?: string;
  kelasIds?: string[];
  mapelIds?: string[];
  loginVersi?: number;
  updatedAt?: string;
  createdAt?: string;
}

/**
 * Format email akun wali kelas berdasarkan nama kelas dan versi.
 * Pola: "kelas-{nama kelas huruf kecil tanpa spasi}-v{versi}@erapor.local"
 * Contoh: "Kelas 1" → "kelas-1-v1@erapor.local", "Kelas 1A" → "kelas-1a-v1@erapor.local"
 */
export function formatWaliEmail(namaKelas: string, versi: number = 1): string {
  const clean = (namaKelas || '')
    .toLowerCase()
    .trim()
    .replace(/^kelas\s*/i, '')
    .replace(/\s+/g, '');
  return `kelas-${clean}-v${versi}@erapor.local`;
}

/**
 * Format email akun guru mapel berdasarkan username dan versi.
 * Pola: "{username}-v{versi}@erapor.local"
 */
export function formatGuruMapelEmail(username: string, versi: number = 1): string {
  const clean = (username || '').toLowerCase().trim().replace(/\s+/g, '');
  return `${clean}-v${versi}@erapor.local`;
}

/**
 * Buat password acak 8 karakter (huruf + angka, tanpa karakter membingungkan seperti O/0, l/1, I).
 */
export function generatePasswordAcak8(): string {
  const digits = '23456789';
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnpqrstuvwxyz';
  const all = digits + uppers + lowers;

  let res = '';
  res += digits[Math.floor(Math.random() * digits.length)];
  res += uppers[Math.floor(Math.random() * uppers.length)];
  res += lowers[Math.floor(Math.random() * lowers.length)];

  while (res.length < 8) {
    res += all[Math.floor(Math.random() * all.length)];
  }

  return res.split('').sort(() => Math.random() - 0.5).join('');
}

// ─── Konstanta Seed Awal (18 Kelas) ─────────────────────────────────────────
// Setiap tingkat berisi: kelas tanpa rombel, rombel A, dan rombel B.
// Urutan: Kelas 1, Kelas 1A, Kelas 1B, Kelas 2, Kelas 2A, Kelas 2B, dst.
// Semua aktif, wali kelas masih kosong.

const TS_INIT = '2026-01-01T00:00:00.000Z';

export const SEED_18_KELAS: KelasDoc[] = [
  // Tingkat 1
  { id: 'kelas_1',  tingkat: 1, rombel: '',  nama: 'Kelas 1',  fase: 'A', urutan: 100, aktif: true, loginEmail: 'kelas-1-v1@erapor.local',  loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_1a', tingkat: 1, rombel: 'A', nama: 'Kelas 1A', fase: 'A', urutan: 101, aktif: true, loginEmail: 'kelas-1a-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_1b', tingkat: 1, rombel: 'B', nama: 'Kelas 1B', fase: 'A', urutan: 102, aktif: true, loginEmail: 'kelas-1b-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },

  // Tingkat 2
  { id: 'kelas_2',  tingkat: 2, rombel: '',  nama: 'Kelas 2',  fase: 'A', urutan: 200, aktif: true, loginEmail: 'kelas-2-v1@erapor.local',  loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_2a', tingkat: 2, rombel: 'A', nama: 'Kelas 2A', fase: 'A', urutan: 201, aktif: true, loginEmail: 'kelas-2a-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_2b', tingkat: 2, rombel: 'B', nama: 'Kelas 2B', fase: 'A', urutan: 202, aktif: true, loginEmail: 'kelas-2b-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },

  // Tingkat 3
  { id: 'kelas_3',  tingkat: 3, rombel: '',  nama: 'Kelas 3',  fase: 'B', urutan: 300, aktif: true, loginEmail: 'kelas-3-v1@erapor.local',  loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_3a', tingkat: 3, rombel: 'A', nama: 'Kelas 3A', fase: 'B', urutan: 301, aktif: true, loginEmail: 'kelas-3a-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_3b', tingkat: 3, rombel: 'B', nama: 'Kelas 3B', fase: 'B', urutan: 302, aktif: true, loginEmail: 'kelas-3b-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },

  // Tingkat 4
  { id: 'kelas_4',  tingkat: 4, rombel: '',  nama: 'Kelas 4',  fase: 'B', urutan: 400, aktif: true, loginEmail: 'kelas-4-v1@erapor.local',  loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_4a', tingkat: 4, rombel: 'A', nama: 'Kelas 4A', fase: 'B', urutan: 401, aktif: true, loginEmail: 'kelas-4a-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_4b', tingkat: 4, rombel: 'B', nama: 'Kelas 4B', fase: 'B', urutan: 402, aktif: true, loginEmail: 'kelas-4b-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },

  // Tingkat 5
  { id: 'kelas_5',  tingkat: 5, rombel: '',  nama: 'Kelas 5',  fase: 'C', urutan: 500, aktif: true, loginEmail: 'kelas-5-v1@erapor.local',  loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_5a', tingkat: 5, rombel: 'A', nama: 'Kelas 5A', fase: 'C', urutan: 501, aktif: true, loginEmail: 'kelas-5a-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_5b', tingkat: 5, rombel: 'B', nama: 'Kelas 5B', fase: 'C', urutan: 502, aktif: true, loginEmail: 'kelas-5b-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },

  // Tingkat 6
  { id: 'kelas_6',  tingkat: 6, rombel: '',  nama: 'Kelas 6',  fase: 'C', urutan: 600, aktif: true, loginEmail: 'kelas-6-v1@erapor.local',  loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_6a', tingkat: 6, rombel: 'A', nama: 'Kelas 6A', fase: 'C', urutan: 601, aktif: true, loginEmail: 'kelas-6a-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
  { id: 'kelas_6b', tingkat: 6, rombel: 'B', nama: 'Kelas 6B', fase: 'C', urutan: 602, aktif: true, loginEmail: 'kelas-6b-v1@erapor.local', loginVersi: 1, createdAt: TS_INIT, updatedAt: TS_INIT },
];

const LOCAL_STORAGE_KELAS_KEY = 'erapot_sd_kelas_v2';
const LOCAL_STORAGE_GURU_MAPEL_KEY = 'erapot_sd_guru_mapel_v2';

function tsNow(): string {
  return new Date().toISOString();
}

/** Format nama kelas: rombel kosong → "Kelas 1", rombel A → "Kelas 1A", dst. */
export function formatNamaKelas(tingkat: number, rombel: string): string {
  const cleanRombel = (rombel || '').trim().toUpperCase();
  return cleanRombel ? `Kelas ${tingkat}${cleanRombel}` : `Kelas ${tingkat}`;
}

/** Urutan kelas: per tingkat, tanpa rombel dulu (100), lalu A (101), B (102)... */
export function hitungUrutanKelas(tingkat: number, rombel: string): number {
  const cleanRombel = (rombel || '').trim().toUpperCase();
  const hurufCode = cleanRombel ? cleanRombel.charCodeAt(0) - 64 : 0;
  return tingkat * 100 + hurufCode;
}

// ─── Helpers LocalStorage ───────────────────────────────────────────────────

export function getLocalKelasList(): KelasDoc[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KELAS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KELAS_KEY, JSON.stringify(SEED_18_KELAS));
      return [...SEED_18_KELAS];
    }
    return JSON.parse(raw);
  } catch {
    return [...SEED_18_KELAS];
  }
}

function saveLocalKelasList(list: KelasDoc[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KELAS_KEY, JSON.stringify(list));
  } catch {}
}

function getLocalGuruMapelList(): GuruMapelDoc[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GURU_MAPEL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalGuruMapelList(list: GuruMapelDoc[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_GURU_MAPEL_KEY, JSON.stringify(list));
  } catch {}
}

// ─── BACA KELAS ─────────────────────────────────────────────────────────────

export async function getAllKelas(): Promise<KelasDoc[]> {
  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(
        query(collection(db, 'kelas'), orderBy('urutan'))
      );
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as KelasDoc));
      }
      // Koleksi kosong di Firestore → seeding otomatis 18 kelas
      await seedDanBersihkanKelas();
      return [...SEED_18_KELAS];
    } catch (err) {
      console.warn('Gagal ambil data kelas dari Firestore, fallback lokal:', err);
    }
  }

  const list = getLocalKelasList();
  return list.sort((a, b) => a.urutan - b.urutan);
}

export interface HasilSinkronisasiKelas {
  kelasBaru: string[];
  kelasDihapus: string[];
  kelasDinonaktifkan: { nama: string; jumlahSiswa: number }[];
  daftar18Kelas: string[];
}

/**
 * Seed & Bersihkan Koleksi Kelas:
 * - Menjamin 18 kelas aktif (Kelas 1, 1A, 1B, s.d. Kelas 6, 6A, 6B).
 * - Kelas lama yang tidak ada di daftar ini (1C, 2C, 6C, dll):
 *   • jika TIDAK punya siswa/nilai -> hapus;
 *   • jika punya siswa/nilai -> jangan dihapus, set aktif = false.
 * - Idempotent (aman dijalankan berulang kali).
 */
export async function seedDanBersihkanKelas(): Promise<HasilSinkronisasiKelas> {
  const kelasBaru: string[] = [];
  const kelasDihapus: string[] = [];
  const kelasDinonaktifkan: { nama: string; jumlahSiswa: number }[] = [];

  const target18Ids = new Set(SEED_18_KELAS.map((k) => k.id));
  const target18Names = new Set(SEED_18_KELAS.map((k) => k.nama.toUpperCase()));

  // Helper periksa siswa & nilai dari database lokal
  const checkLocalStudentsAndGrades = (kelasId: string, kelasNama?: string) => {
    try {
      const raw = localStorage.getItem('erapot_sd_local_database_v1');
      if (!raw) return { count: 0, hasGrades: false };
      const dbObj = JSON.parse(raw);
      const studentCount = (dbObj.kelasSiswa || []).filter(
        (ks: any) =>
          ks.kelas_id === kelasId ||
          ks.rombel_id === kelasId ||
          (kelasNama && (ks.kelas_id === kelasNama || ks.rombel_id === kelasNama))
      ).length;
      const hasGrades =
        (dbObj.formatif || []).some((f: any) => f.kelas_id === kelasId || f.rombel_id === kelasId) ||
        (dbObj.sumatifLM || []).some((s: any) => s.kelas_id === kelasId || s.rombel_id === kelasId) ||
        (dbObj.sumatifSemester || []).some((s: any) => s.kelas_id === kelasId || s.rombel_id === kelasId);
      return { count: studentCount, hasGrades };
    } catch {
      return { count: 0, hasGrades: false };
    }
  };

  // 1. Sinkronisasi & Pembersihan di Firestore jika aktif
  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(collection(db, 'kelas'));
      const existingDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as KelasDoc));

      for (const docItem of existingDocs) {
        const isTarget = target18Ids.has(docItem.id) || target18Names.has(docItem.nama?.toUpperCase());
        if (!isTarget) {
          const { count, hasGrades } = checkLocalStudentsAndGrades(docItem.id, docItem.nama);
          if (count === 0 && !hasGrades) {
            await deleteDoc(doc(db, 'kelas', docItem.id));
            kelasDihapus.push(docItem.nama || docItem.id);
          } else {
            if (docItem.aktif !== false) {
              await updateDoc(doc(db, 'kelas', docItem.id), { aktif: false });
              kelasDinonaktifkan.push({ nama: docItem.nama || docItem.id, jumlahSiswa: count });
            }
          }
        }
      }

      const batch = writeBatch(db);
      for (const target of SEED_18_KELAS) {
        const existing = existingDocs.find(
          (d) => d.id === target.id || d.nama?.toUpperCase() === target.nama.toUpperCase()
        );
        if (!existing) {
          batch.set(doc(db, 'kelas', target.id), target);
          kelasBaru.push(target.nama);
        } else {
          batch.set(
            doc(db, 'kelas', target.id),
            {
              tingkat: target.tingkat,
              rombel: target.rombel,
              nama: target.nama,
              fase: target.fase,
              urutan: target.urutan,
              aktif: true,
              loginEmail: existing.loginEmail || target.loginEmail,
              loginVersi: existing.loginVersi || target.loginVersi || 1,
              updatedAt: tsNow(),
            },
            { merge: true }
          );
        }
      }
      await batch.commit();
    } catch (err) {
      console.warn('Gagal sinkronisasi kelas ke Firestore:', err);
    }
  }

  // 2. Sinkronisasi & Pembersihan di LocalStorage
  const localList = getLocalKelasList();
  const cleanedLocalList: KelasDoc[] = [];

  for (const item of localList) {
    const isTarget = target18Ids.has(item.id) || target18Names.has(item.nama?.toUpperCase());
    if (isTarget) {
      continue;
    }
    const { count, hasGrades } = checkLocalStudentsAndGrades(item.id, item.nama);
    if (count === 0 && !hasGrades) {
      if (!kelasDihapus.includes(item.nama || item.id)) {
        kelasDihapus.push(item.nama || item.id);
      }
    } else {
      item.aktif = false;
      cleanedLocalList.push(item);
      if (!kelasDinonaktifkan.some((k) => k.nama === (item.nama || item.id))) {
        kelasDinonaktifkan.push({ nama: item.nama || item.id, jumlahSiswa: count });
      }
    }
  }

  for (const target of SEED_18_KELAS) {
    const existing = localList.find(
      (d) => d.id === target.id || d.nama?.toUpperCase() === target.nama.toUpperCase()
    );
    if (existing) {
      cleanedLocalList.push({
        ...target,
        waliKelasUid: existing.waliKelasUid,
        namaWali: existing.namaWali,
        gelarWali: existing.gelarWali,
        nipWali: existing.nipWali,
        emailWali: existing.emailWali,
        jumlahSiswa: existing.jumlahSiswa,
        aktif: true,
      });
    } else {
      cleanedLocalList.push({ ...target, aktif: true });
      if (!kelasBaru.includes(target.nama)) {
        kelasBaru.push(target.nama);
      }
    }
  }

  cleanedLocalList.sort((a, b) => {
    if (a.tingkat !== b.tingkat) return a.tingkat - b.tingkat;
    const hA = (a.rombel || '').trim().toUpperCase();
    const hB = (b.rombel || '').trim().toUpperCase();
    if (!hA && hB) return -1;
    if (hA && !hB) return 1;
    return hA.localeCompare(hB);
  });

  saveLocalKelasList(cleanedLocalList);

  // 3. Sinkronkan juga ke database lokal mock (LOCAL_STORAGE_DATA_KEY) jika ada
  try {
    const rawData = localStorage.getItem('erapot_sd_local_database_v1');
    if (rawData) {
      const dbObj = JSON.parse(rawData);
      const active18 = cleanedLocalList.filter((k) => k.aktif);
      dbObj.rombel = active18.map((k) => {
        const urutan = k.tingkat * 100 + (k.rombel ? k.rombel.charCodeAt(0) - 64 : 0);
        return {
          id: k.id,
          tingkat_id: `tingkat_${k.tingkat}`,
          tingkat: k.tingkat,
          tingkat_angka: k.tingkat,
          angka: k.tingkat,
          huruf: k.rombel,
          nama: k.nama,
          label: k.nama,
          tahun_ajaran_id: 'ta_2025_1',
          nama_wali: k.namaWali || '',
          nip_wali: k.nipWali || '',
          aktif: true,
          urutan,
        };
      });
      dbObj.kelas = dbObj.rombel.map((r: any) => ({
        id: r.id,
        sekolah_id: 'sekolah_1',
        tahun_ajaran_id: 'ta_2025_1',
        tingkat: r.nama,
        fase: faseDariTingkat(r.tingkat),
        nama_wali: r.nama_wali,
        nip_wali: r.nip_wali,
        aktif: true,
        urutan: r.urutan,
      }));
      localStorage.setItem('erapot_sd_local_database_v1', JSON.stringify(dbObj));
    }
  } catch {}

  const daftar18Kelas = cleanedLocalList
    .filter((k) => k.aktif)
    .map((k) => k.nama);

  return {
    kelasBaru,
    kelasDihapus,
    kelasDinonaktifkan,
    daftar18Kelas,
  };
}

export async function getKelasAktif(): Promise<KelasDoc[]> {
  const list = await getAllKelas();
  return list.filter((k) => k.aktif !== false).sort((a, b) => a.urutan - b.urutan);
}

export async function getKelasById(id: string): Promise<KelasDoc | null> {
  const list = await getAllKelas();
  return list.find((k) => k.id === id) || null;
}

export function formatNamaDariId(kelasId: string): string {
  const match = (kelasId || '').match(/^kelas_(\d+)([a-zA-Z]*)$/i);
  if (match) {
    const tingkat = match[1];
    const rombel = match[2].toUpperCase();
    return rombel ? `Kelas ${tingkat}${rombel}` : `Kelas ${tingkat}`;
  }
  return kelasId;
}

// ─── TAMBAH KELAS ───────────────────────────────────────────────────────────

export async function tambahKelas(
  tingkat: number,
  rombel: string,
  existingKelas: KelasDoc[]
): Promise<KelasDoc> {
  const cleanRombel = (rombel || '').trim().toUpperCase();
  const nama = formatNamaKelas(tingkat, cleanRombel);

  // Validasi: nama kelas tidak boleh dobel (mis. hanya boleh ada satu "Kelas 2" tanpa rombel)
  const duplikat = existingKelas.some((k) => {
    const kRombel = (k.rombel || '').trim().toUpperCase();
    return k.tingkat === tingkat && kRombel === cleanRombel;
  });
  if (duplikat) throw new Error(`${nama} sudah ada.`);

  const id = cleanRombel
    ? `kelas_${tingkat}${cleanRombel.toLowerCase()}`
    : `kelas_${tingkat}`;
  const urutan = hitungUrutanKelas(tingkat, cleanRombel);
  const fase = faseDariTingkat(tingkat);
  const now = tsNow();

  const data: Omit<KelasDoc, 'id'> = {
    tingkat,
    rombel: cleanRombel,
    nama,
    fase,
    urutan,
    aktif: true,
    createdAt: now,
    updatedAt: now,
  };

  const newDoc: KelasDoc = { id, ...data };

  // Otomatis siapkan akun wali kelas & inisialisasi dokumen via provisionKelas
  const provRes = await provisionKelas(id, nama, undefined, data);
  if (provRes.error) {
    console.warn(`[TAMBAH-KELAS] ${provRes.error}`);
  }

  const current = getLocalKelasList();
  const idx = current.findIndex((k) => k.id === id);
  const finalDoc: KelasDoc = {
    ...newDoc,
    waliKelasUid: provRes.uid || undefined,
    loginEmail: provRes.email || undefined,
  };
  if (idx >= 0) {
    current[idx] = finalDoc;
  } else {
    current.push(finalDoc);
  }
  saveLocalKelasList(current);

  await catatLogAktivitas({
    uid: 'admin',
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'TAMBAH_KELAS',
    target: nama,
    nilaiBaru: id,
  });

  return finalDoc;
}

/** Tambah rombel berikutnya secara otomatis (mis. sudah ada 3A, 3B → tambah 3C) */
export async function tambahRombelBerikutnya(
  tingkat: number,
  existingKelas: KelasDoc[]
): Promise<KelasDoc> {
  const kelasTingkat = existingKelas.filter((k) => k.tingkat === tingkat);
  const hurufAda = kelasTingkat
    .map((k) => (k.rombel || '').trim().toUpperCase())
    .filter(Boolean);

  // Jika belum ada rombel berhuruf (hanya ada kelas tanpa rombel), mulai dari 'A'
  const hurufBaru = hurufAda.length === 0 ? 'A' : hurufBerikutnya(hurufAda);
  return tambahKelas(tingkat, hurufBaru, existingKelas);
}

// ─── EDIT & STATUS KELAS ────────────────────────────────────────────────────

export async function editKelas(
  id: string,
  updates: Partial<Pick<KelasDoc, 'nama' | 'aktif'>>
): Promise<void> {
  const now = tsNow();
  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'kelas', id), { ...updates, updatedAt: now });
    } catch (err) {
      console.warn('Gagal update kelas Firestore:', err);
    }
  }
  const list = getLocalKelasList();
  const idx = list.findIndex((k) => k.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates, updatedAt: now };
    saveLocalKelasList(list);
  }
}

export async function toggleAktifKelas(id: string, aktif: boolean): Promise<void> {
  return editKelas(id, { aktif });
}

// ─── HAPUS KELAS ───────────────────────────────────────────────────────────

export async function hapusKelas(id: string, jumlahSiswa: number = 0): Promise<void> {
  if (jumlahSiswa > 0) {
    throw new Error(
      `Kelas ini masih memiliki ${jumlahSiswa} siswa. Hapus atau pindahkan siswa terlebih dahulu sebelum menghapus kelas.`
    );
  }

  if (isFirebaseConfigured) {
    try {
      const [siswaSnap, siswaAltSnap, ksSnap, ksAltSnap] = await Promise.all([
        getDocs(query(collection(db, 'siswa'), where('kelasId', '==', id))),
        getDocs(query(collection(db, 'siswa'), where('kelas_id', '==', id))),
        getDocs(query(collection(db, 'kelasSiswa'), where('kelasId', '==', id))),
        getDocs(query(collection(db, 'kelasSiswa'), where('kelas_id', '==', id))),
      ]);

      const totalSiswaAda =
        siswaSnap.size + siswaAltSnap.size + ksSnap.size + ksAltSnap.size;

      if (totalSiswaAda > 0) {
        const count = Math.max(siswaSnap.size, siswaAltSnap.size, ksSnap.size, ksAltSnap.size);
        throw new Error(
          `Kelas ini masih memiliki ${count} siswa. Hapus atau pindahkan siswa terlebih dahulu sebelum menghapus kelas.`
        );
      }

      // Ambil data kelas untuk mematikan akun walinya
      const kSnap = await getDoc(doc(db, 'kelas', id));
      const kData = kSnap.data();
      const waliUid = kData?.waliKelasUid;

      const batch = writeBatch(db);
      batch.delete(doc(db, 'kelas', id));
      if (waliUid) {
        batch.update(doc(db, 'users', waliUid), {
          aktif: false,
          updatedAt: tsNow(),
        });
      }
      batch.delete(doc(db, 'passwordAwal', id));
      await batch.commit();
    } catch (err: any) {
      if (err.message && err.message.includes('masih memiliki')) throw err;
      throw err;
    }
  }

  const list = getLocalKelasList();
  const filtered = list.filter((k) => k.id !== id);
  saveLocalKelasList(filtered);

  await catatLogAktivitas({
    uid: 'admin',
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'HAPUS_KELAS',
    target: id,
  });
}

// ─── AKUN OTOMATIS WALI KELAS (MODEL BARU) ──────────────────────────────────

export interface PasswordAwalDoc {
  kelasId: string;
  namaKelas: string;
  loginEmail: string;
  passwordAwal: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Menyiapkan akun Auth + dokumen users + kelas + passwordAwal + statusRapor untuk 1 kelas.
 * Memenuhi spesifikasi TAHAP 3:
 * 1. Buat akun Auth (secondary app, password acak 8 karakter): email kelas-{cleanNama}-v1@erapor.local
 * 2. Tulis users/{uid}: { peran: "wali_kelas", kelasId, aktif: true, harusGantiPassword: true, loginEmail, loginVersi: 1, nama: "", gelar: "", nip: "" }
 * 3. Tulis kelas/{kelasId}: { waliKelasUid: uid, loginEmail, loginVersi: 1, waliNama: "", waliGelar: "" }
 * 4. Tulis passwordAwal/{kelasId}: { kelasId, passwordAwal, createdAt }
 * 5. Tulis statusRapor/{tahunAjaranAktif}_{kelasId}: { kelasId, tahunAjaranId, status: "terbuka", final: false }
 * 6. Semua penulisan Firestore dalam 1 batch setelah Auth berhasil dibuat.
 * 7. Jika pembuatan akun Auth gagal: buat dokumen kelas dengan status "Akun belum dibuat", jangan gagalkan pembuatan kelas.
 */
export async function provisionKelas(
  kelasId: string,
  namaKelas?: string,
  customPassword?: string,
  extraKelasData?: Partial<KelasDoc>
): Promise<{ uid: string; email: string; passwordAwal: string; baru: boolean; error?: string }> {
  const nama = namaKelas || extraKelasData?.nama || formatNamaDariId(kelasId);
  const cleanNama = (nama || kelasId)
    .toLowerCase()
    .trim()
    .replace(/^kelas[\s_-]*/i, '')
    .replace(/\s+/g, '');
  const passwordAwal = customPassword || generatePasswordAcak8();
  const now = tsNow();
  let uid = `uid_wali_${kelasId}_${Date.now()}`;
  let finalEmail = `kelas-${cleanNama}-v1@erapor.local`;
  let attempt = 1;

  // Ambil tahun ajaran aktif untuk inisialisasi statusRapor
  let activeTaId = 'ta_2025_1';
  try {
    const taDoc = await getTahunAjaranAktif();
    if (taDoc?.id) activeTaId = taDoc.id;
  } catch {}

  if (isFirebaseConfigured) {
    // 1. Cek apakah kelas sudah memiliki akun aktif
    try {
      const kSnap = await getDoc(doc(db, 'kelas', kelasId));
      if (kSnap.exists()) {
        const kData = kSnap.data();
        if (kData.waliKelasUid) {
          const uSnap = await getDoc(doc(db, 'users', kData.waliKelasUid));
          if (uSnap.exists() && uSnap.data().aktif === true) {
            // Sudah punya akun aktif
            return {
              uid: kData.waliKelasUid,
              email: kData.loginEmail || finalEmail,
              passwordAwal: '',
              baru: false,
            };
          }
        }
      }
    } catch {}

    let authBerhasil = false;
    let authErrorMsg = '';

    const { secondaryAuth, cleanup } = await getSecondaryAuth();
    try {
      while (attempt <= 20) {
        finalEmail = `kelas-${cleanNama}-v${attempt}@erapor.local`;
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, passwordAwal);
          uid = cred.user.uid;
          authBerhasil = true;
          break;
        } catch (err: any) {
          if (err?.code === 'auth/email-already-in-use') {
            attempt++;
          } else {
            console.error('Secondary Auth error:', err);
            authErrorMsg = err?.message || 'Gagal membuat akun login auth.';
            break;
          }
        }
      }
    } catch (e: any) {
      authErrorMsg = e?.message || 'Gagal inisialisasi secondary auth.';
    } finally {
      await cleanup();
    }

    if (!authBerhasil) {
      // Pembuatan akun Auth gagal: buat dokumen kelas dengan status "Akun belum dibuat", jangan gagalkan kelas
      console.warn(`[provisionKelas] Akun Auth gagal dibuat untuk ${nama}: ${authErrorMsg}`);
      try {
        await setDoc(
          doc(db, 'kelas', kelasId),
          {
            ...extraKelasData,
            id: kelasId,
            nama,
            waliKelasUid: '',
            loginEmail: '',
            loginVersi: 1,
            statusAkun: 'Akun belum dibuat',
            updatedAt: now,
          },
          { merge: true }
        );
      } catch (errSet) {
        console.error('Gagal simpan kelas:', errSet);
      }
      return {
        uid: '',
        email: '',
        passwordAwal: '',
        baru: false,
        error: `Akun login wali kelas untuk ${nama} belum dibuat: ${authErrorMsg}`,
      };
    }

    // Commit atomik via writeBatch
    const batch = writeBatch(db);

    // a. users/{uid}
    batch.set(doc(db, 'users', uid), {
      uid,
      peran: 'wali_kelas',
      kelasId,
      nama: '',
      gelar: '',
      nip: '',
      aktif: true,
      loginEmail: finalEmail,
      loginVersi: attempt,
      harusGantiPassword: true,
      createdAt: now,
      updatedAt: now,
    });

    // b. kelas/{kelasId}
    batch.set(
      doc(db, 'kelas', kelasId),
      {
        ...extraKelasData,
        id: kelasId,
        nama,
        waliKelasUid: uid,
        loginEmail: finalEmail,
        loginVersi: attempt,
        waliNama: '',
        waliGelar: '',
        namaWali: '',
        gelarWali: '',
        nipWali: '',
        statusAkun: 'Siap',
        updatedAt: now,
      },
      { merge: true }
    );

    // c. passwordAwal/{kelasId}
    batch.set(doc(db, 'passwordAwal', kelasId), {
      kelasId,
      namaKelas: nama,
      loginEmail: finalEmail,
      passwordAwal,
      createdAt: now,
    });

    // d. statusRapor/{tahunAjaranAktif}_{kelasId}
    const statusRaporId = `${activeTaId}_${kelasId}`;
    batch.set(
      doc(db, 'statusRapor', statusRaporId),
      {
        id: statusRaporId,
        kelasId,
        tahunAjaranId: activeTaId,
        status: 'terbuka',
        final: false,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();
  }

  // Update fallback lokal
  const localList = getLocalKelasList();
  const idx = localList.findIndex((k) => k.id === kelasId);
  const localKelasItem: KelasDoc = {
    ...(extraKelasData as any),
    id: kelasId,
    tingkat: extraKelasData?.tingkat || (idx >= 0 ? localList[idx].tingkat : 1),
    rombel: extraKelasData?.rombel !== undefined ? extraKelasData.rombel : (idx >= 0 ? localList[idx].rombel : ''),
    nama,
    fase: extraKelasData?.fase || (idx >= 0 ? localList[idx].fase : 'A'),
    urutan: extraKelasData?.urutan || (idx >= 0 ? localList[idx].urutan : 100),
    aktif: true,
    waliKelasUid: uid,
    loginEmail: finalEmail,
    loginVersi: attempt,
    waliNama: '',
    waliGelar: '',
    namaWali: '',
    gelarWali: '',
    nipWali: '',
    statusAkun: 'Siap',
    createdAt: idx >= 0 ? localList[idx].createdAt : now,
    updatedAt: now,
  };

  if (idx >= 0) {
    localList[idx] = localKelasItem;
  } else {
    localList.push(localKelasItem);
  }
  saveLocalKelasList(localList);

  // Simpan ke local password awal store
  try {
    const rawPw = localStorage.getItem('erapot_password_awal_store') || '{}';
    const pwMap = JSON.parse(rawPw);
    pwMap[kelasId] = { kelasId, namaKelas: nama, loginEmail: finalEmail, passwordAwal, createdAt: now };
    localStorage.setItem('erapot_password_awal_store', JSON.stringify(pwMap));
  } catch {}

  // Simpan ke fallback local users & accounts agar offline/mock auth selalu bisa login
  try {
    const rawUsers = localStorage.getItem('erapot_users_firestore_fallback') || '[]';
    const userList = JSON.parse(rawUsers);
    const uIdx = userList.findIndex((u: any) => u.kelasId === kelasId);
    const uRec = {
      uid,
      nama: '',
      gelar: '',
      nip: '',
      loginEmail: finalEmail,
      email: finalEmail,
      password: passwordAwal,
      peran: 'wali_kelas',
      aktif: true,
      kelasId,
      harusGantiPassword: true,
      createdAt: now,
      updatedAt: now,
    };
    if (uIdx >= 0) userList[uIdx] = uRec;
    else userList.push(uRec);
    localStorage.setItem('erapot_users_firestore_fallback', JSON.stringify(userList));
  } catch {}

  try {
    const rawAcc = localStorage.getItem('erapot_sd_accounts_v2') || '[]';
    const accList = JSON.parse(rawAcc);
    const accIdx = accList.findIndex((a: any) => a.peran === 'guru' && (a.rombel_id === kelasId || a.kelas === nama));
    const accRec = {
      id: `akun_${kelasId}`,
      peran: 'guru',
      rombel_id: kelasId,
      rombel_nama: nama,
      kelas: nama,
      nama: '',
      nip: '',
      password: passwordAwal,
      aktif: true,
      wajib_ganti_sandi: true,
    };
    if (accIdx >= 0) accList[accIdx] = accRec;
    else accList.push(accRec);
    localStorage.setItem('erapot_sd_accounts_v2', JSON.stringify(accList));
  } catch {}

  return { uid, email: finalEmail, passwordAwal, baru: true };
}

/**
 * Wrapper backwards-compatible untuk provisionKelas.
 */
export async function siapkanAkunWaliUntukKelas(
  kelasId: string,
  namaKelas?: string,
  customPassword?: string
): Promise<{ uid: string; email: string; passwordAwal: string; baru: boolean; error?: string }> {
  return provisionKelas(kelasId, namaKelas, customPassword);
}

/**
 * Siapkan akun wali kelas untuk SEMUA kelas yang belum memiliki akun.
 * Menampilkan progres callback. Aman dijalankan berulang.
 */
export async function siapkanSemuaAkunWali(
  onProgress?: (selesai: number, total: number, kelasNama: string) => void
): Promise<{
  dibuat: number;
  sudahAda: number;
  total: number;
  hasil: { kelasId: string; nama: string; passwordAwal?: string; baru: boolean }[];
}> {
  const list = await getAllKelas();
  const activeClasses = list.filter((k) => k.aktif !== false);
  let dibuat = 0;
  let sudahAda = 0;
  const hasil: { kelasId: string; nama: string; passwordAwal?: string; baru: boolean }[] = [];

  for (let i = 0; i < activeClasses.length; i++) {
    const k = activeClasses[i];
    onProgress?.(i, activeClasses.length, k.nama);

    let akunAda = false;
    if (k.waliKelasUid && isFirebaseConfigured) {
      try {
        const uSnap = await getDoc(doc(db, 'users', k.waliKelasUid));
        if (uSnap.exists() && uSnap.data().aktif === true) {
          akunAda = true;
        }
      } catch {}
    } else if (k.waliKelasUid) {
      akunAda = true;
    }

    if (akunAda) {
      sudahAda++;
      hasil.push({ kelasId: k.id, nama: k.nama, baru: false });
    } else {
      const res = await siapkanAkunWaliUntukKelas(k.id, k.nama);
      dibuat++;
      hasil.push({ kelasId: k.id, nama: k.nama, passwordAwal: res.passwordAwal, baru: true });
    }
    onProgress?.(i + 1, activeClasses.length, k.nama);
  }

  return { dibuat, sudahAda, total: activeClasses.length, hasil };
}

/**
 * Edit Wali Kelas:
 * - Jika passwordBaru kosong: HANYA update nama/gelar/nip di users & kelas dalam 1 batch.
 * - Jika passwordBaru diisi: Buat akun versi +1 di secondary auth, matikan akun lama, update users & kelas & passwordAwal.
 */
export async function editWaliKelas(
  kelasId: string,
  input: {
    nama: string;
    gelar?: string;
    nip?: string;
    passwordBaru?: string;
  }
): Promise<{ gantiPassword: boolean; passwordBaruTersimpan?: string }> {
  const namaKapital = input.nama.trim().toUpperCase();
  const gelarTrim = (input.gelar || '').trim();
  const nipTrim = (input.nip || '').trim();
  const now = tsNow();

  let kelasData = await getKelasById(kelasId);
  if (!kelasData) throw new Error('Data kelas tidak ditemukan.');

  let currentWaliUid = kelasData.waliKelasUid;

  // Jika kelas belum punya akun sama sekali, buatkan akun baru terlebih dahulu
  if (!currentWaliUid) {
    const acc = await siapkanAkunWaliUntukKelas(kelasId, kelasData.nama, input.passwordBaru);
    currentWaliUid = acc.uid;
    const refreshed = await getKelasById(kelasId);
    if (!refreshed) throw new Error('Data kelas tidak ditemukan.');
    kelasData = refreshed;
  }

  // ── Skenario A: Hanya ubah identitas (tanpa ganti kata sandi) ──────────────
  if (!input.passwordBaru) {
    if (isFirebaseConfigured && currentWaliUid) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', currentWaliUid), {
        nama: namaKapital,
        gelar: gelarTrim,
        nip: nipTrim,
        updatedAt: now,
      });
      batch.set(
        doc(db, 'kelas', kelasId),
        {
          waliNama: namaKapital,
          waliGelar: gelarTrim,
          namaWali: namaKapital,
          gelarWali: gelarTrim,
          nipWali: nipTrim,
          updatedAt: now,
        },
        { merge: true }
      );
      await batch.commit();
    }

    // Update local list
    const list = getLocalKelasList();
    const idx = list.findIndex((k) => k.id === kelasId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        waliNama: namaKapital,
        waliGelar: gelarTrim,
        namaWali: namaKapital,
        gelarWali: gelarTrim,
        nipWali: nipTrim,
        updatedAt: now,
      };
      saveLocalKelasList(list);
    }

    // Update local fallback users & accounts
    try {
      const rawUsers = localStorage.getItem('erapot_users_firestore_fallback') || '[]';
      const userList = JSON.parse(rawUsers);
      const u = userList.find((it: any) => it.uid === kelasData.waliKelasUid || it.kelasId === kelasId);
      if (u) {
        u.nama = namaKapital;
        u.gelar = gelarTrim;
        u.nip = nipTrim;
        u.updatedAt = now;
        localStorage.setItem('erapot_users_firestore_fallback', JSON.stringify(userList));
      }
    } catch {}

    try {
      const rawAcc = localStorage.getItem('erapot_sd_accounts_v2') || '[]';
      const accList = JSON.parse(rawAcc);
      const acc = accList.find((a: any) => a.peran === 'guru' && (a.rombel_id === kelasId || a.kelas === kelasData.nama));
      if (acc) {
        acc.nama = namaKapital + (gelarTrim ? `, ${gelarTrim}` : '');
        acc.nip = nipTrim;
        localStorage.setItem('erapot_sd_accounts_v2', JSON.stringify(accList));
      }
    } catch {}

    return { gantiPassword: false };
  }

  // ── Skenario B: Ubah kata sandi ───────────────────────────────────────────
  const cleanNama = (kelasData.nama || kelasId)
    .toLowerCase()
    .trim()
    .replace(/^kelas\s*/i, '')
    .replace(/\s+/g, '');
  const nextVersi = (kelasData.loginVersi || 1) + 1;
  let newUid = `uid_wali_${kelasId}_${Date.now()}`;
  let finalEmail = `kelas-${cleanNama}-v${nextVersi}@erapor.local`;

  if (isFirebaseConfigured) {
    const { secondaryAuth, cleanup } = await getSecondaryAuth();
    try {
      let created = false;
      let attempt = nextVersi;
      while (attempt < nextVersi + 20) {
        finalEmail = `kelas-${cleanNama}-v${attempt}@erapor.local`;
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, input.passwordBaru);
          newUid = cred.user.uid;
          created = true;
          break;
        } catch (err: any) {
          if (err?.code === 'auth/email-already-in-use') {
            attempt++;
          } else {
            throw err;
          }
        }
      }

      if (!created) {
        throw new Error('Gagal mengganti password: email versi baru sudah digunakan.');
      }

      const batch = writeBatch(db);

      // 1. Nonaktifkan akun lama
      if (currentWaliUid) {
        batch.update(doc(db, 'users', currentWaliUid), {
          aktif: false,
          updatedAt: now,
        });
      }

      // 2. Buat akun baru dengan identitas sama + harusGantiPassword: true
      batch.set(doc(db, 'users', newUid), {
        uid: newUid,
        peran: 'wali_kelas',
        kelasId,
        nama: namaKapital,
        gelar: gelarTrim,
        nip: nipTrim,
        aktif: true,
        loginEmail: finalEmail,
        loginVersi: attempt,
        harusGantiPassword: true,
        createdAt: now,
        updatedAt: now,
      });

      // 3. Update kelas
      batch.set(
        doc(db, 'kelas', kelasId),
        {
          waliKelasUid: newUid,
          loginEmail: finalEmail,
          loginVersi: attempt,
          waliNama: namaKapital,
          waliGelar: gelarTrim,
          namaWali: namaKapital,
          gelarWali: gelarTrim,
          nipWali: nipTrim,
          emailWali: finalEmail,
          updatedAt: now,
        },
        { merge: true }
      );

      // 4. Update passwordAwal/{kelasId}
      batch.set(doc(db, 'passwordAwal', kelasId), {
        kelasId,
        namaKelas: kelasData.nama,
        loginEmail: finalEmail,
        passwordAwal: input.passwordBaru,
        updatedAt: now,
      });

      await batch.commit();
    } finally {
      await cleanup();
    }
  }

  // Update fallback lokal
  const list = getLocalKelasList();
  const idx = list.findIndex((k) => k.id === kelasId);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      waliKelasUid: newUid,
      loginEmail: finalEmail,
      loginVersi: nextVersi,
      waliNama: namaKapital,
      waliGelar: gelarTrim,
      namaWali: namaKapital,
      gelarWali: gelarTrim,
      nipWali: nipTrim,
      emailWali: finalEmail,
      updatedAt: now,
    };
    saveLocalKelasList(list);
  }

  try {
    const rawPw = localStorage.getItem('erapot_password_awal_store') || '{}';
    const pwMap = JSON.parse(rawPw);
    pwMap[kelasId] = {
      kelasId,
      namaKelas: kelasData.nama,
      loginEmail: finalEmail,
      passwordAwal: input.passwordBaru,
      updatedAt: now,
    };
    localStorage.setItem('erapot_password_awal_store', JSON.stringify(pwMap));
  } catch {}

  try {
    const rawUsers = localStorage.getItem('erapot_users_firestore_fallback') || '[]';
    const userList = JSON.parse(rawUsers);
    const oldU = userList.find((u: any) => u.uid === kelasData.waliKelasUid || u.kelasId === kelasId);
    if (oldU) oldU.aktif = false;
    userList.push({
      uid: newUid,
      nama: namaKapital,
      gelar: gelarTrim,
      nip: nipTrim,
      loginEmail: finalEmail,
      email: finalEmail,
      password: input.passwordBaru,
      peran: 'wali_kelas',
      aktif: true,
      kelasId,
      harusGantiPassword: true,
      createdAt: now,
      updatedAt: now,
    });
    localStorage.setItem('erapot_users_firestore_fallback', JSON.stringify(userList));
  } catch {}

  try {
    const rawAcc = localStorage.getItem('erapot_sd_accounts_v2') || '[]';
    const accList = JSON.parse(rawAcc);
    const fullNama = namaKapital + (gelarTrim ? `, ${gelarTrim}` : '');
    const accIdx = accList.findIndex((a: any) => a.peran === 'guru' && (a.rombel_id === kelasId || a.kelas === kelasData.nama));
    if (accIdx >= 0) {
      accList[accIdx].nama = fullNama;
      accList[accIdx].nip = nipTrim;
      accList[accIdx].password = input.passwordBaru;
      accList[accIdx].aktif = true;
      accList[accIdx].wajib_ganti_sandi = true;
    } else {
      accList.push({
        id: `akun_${kelasId}`,
        peran: 'guru',
        rombel_id: kelasId,
        rombel_nama: kelasData.nama,
        kelas: kelasData.nama,
        nama: fullNama,
        nip: nipTrim,
        password: input.passwordBaru,
        aktif: true,
        wajib_ganti_sandi: true,
      });
    }
    localStorage.setItem('erapot_sd_accounts_v2', JSON.stringify(accList));
  } catch {}

  return { gantiPassword: true, passwordBaruTersimpan: input.passwordBaru };
}

/**
 * Ambil semua data password awal untuk keperluan cetak kartu login.
 */
export async function ambilSemuaPasswordAwal(): Promise<Record<string, PasswordAwalDoc>> {
  const result: Record<string, PasswordAwalDoc> = {};
  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(collection(db, 'passwordAwal'));
      snap.docs.forEach((d) => {
        const data = d.data() as PasswordAwalDoc;
        result[d.id] = data;
      });
      return result;
    } catch (e) {
      console.warn('Gagal ambil passwordAwal Firestore:', e);
    }
  }
  try {
    const raw = localStorage.getItem('erapot_password_awal_store');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return result;
}

/**
 * Hapus dokumen passwordAwal untuk kelas tertentu saat wali kelas mengganti password sendiri.
 */
export async function hapusPasswordAwalKelas(kelasId: string): Promise<void> {
  if (isFirebaseConfigured) {
    try {
      await deleteDoc(doc(db, 'passwordAwal', kelasId));
    } catch (e) {
      console.warn('Gagal hapus passwordAwal Firestore:', e);
    }
  }
  try {
    const raw = localStorage.getItem('erapot_password_awal_store');
    if (raw) {
      const map = JSON.parse(raw);
      delete map[kelasId];
      localStorage.setItem('erapot_password_awal_store', JSON.stringify(map));
    }
  } catch {}
}

/**
 * Listener onSnapshot real-time untuk koleksi kelas.
 */
export function subscribeKelasRealtime(
  callback: (kelas: KelasDoc[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured) {
    callback(getLocalKelasList());
    return () => {};
  }
  const q = query(collection(db, 'kelas'), orderBy('urutan'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as KelasDoc));
    callback(list);
  }, (err) => {
    console.warn('Error onSnapshot kelas:', err);
    callback(getLocalKelasList());
  });
}

/**
 * Listener onSnapshot real-time untuk status akun users.
 */
export function subscribeUsersRealtime(
  callback: (users: Record<string, { aktif: boolean; harusGantiPassword?: boolean; nama?: string }>) => void
): Unsubscribe {
  if (!isFirebaseConfigured) {
    callback({});
    return () => {};
  }
  return onSnapshot(collection(db, 'users'), (snap) => {
    const map: Record<string, { aktif: boolean; harusGantiPassword?: boolean; nama?: string }> = {};
    snap.docs.forEach((d) => {
      const u = d.data();
      map[d.id] = {
        aktif: u.aktif !== false,
        harusGantiPassword: u.harusGantiPassword === true,
        nama: u.nama || '',
      };
    });
    callback(map);
  }, () => {
    callback({});
  });
}

// ─── MIGRASI & SINKRONISASI WALI KELAS ───────────────────────────────────────

export interface PratinjauMigrasi {
  kelasAkanDisambungkan: { kelasId: string; kelasNama: string; userNama: string; userEmail: string; userUid: string }[];
  kelasAkanDibuatkanAkun: { kelasId: string; kelasNama: string }[];
  kelasSudahSiap: { kelasId: string; kelasNama: string; waliNama: string }[];
}

export async function cekPratinjauMigrasiWali(): Promise<PratinjauMigrasi> {
  const classes = await getAllKelas();
  const activeClasses = classes.filter((k) => k.aktif !== false);
  let allUsers: any[] = [];
  if (isFirebaseConfigured) {
    try {
      const uSnap = await getDocs(query(collection(db, 'users'), where('peran', '==', 'wali_kelas')));
      allUsers = uSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    } catch {}
  }

  const kelasAkanDisambungkan: { kelasId: string; kelasNama: string; userNama: string; userEmail: string; userUid: string }[] = [];
  const kelasAkanDibuatkanAkun: { kelasId: string; kelasNama: string }[] = [];
  const kelasSudahSiap: { kelasId: string; kelasNama: string; waliNama: string }[] = [];

  for (const k of activeClasses) {
    const userTerhubung = k.waliKelasUid ? allUsers.find((u) => u.uid === k.waliKelasUid) : null;
    if (userTerhubung && userTerhubung.aktif !== false) {
      kelasSudahSiap.push({
        kelasId: k.id,
        kelasNama: k.nama,
        waliNama: k.namaWali || k.waliNama || userTerhubung.nama || '',
      });
      continue;
    }

    const userOrphan = allUsers.find(
      (u) => (u.kelasId === k.id || u.kelasId === k.nama) && u.aktif !== false
    );
    if (userOrphan) {
      kelasAkanDisambungkan.push({
        kelasId: k.id,
        kelasNama: k.nama,
        userNama: userOrphan.nama || '(Nama kosong)',
        userEmail: userOrphan.loginEmail || userOrphan.email || '',
        userUid: userOrphan.uid,
      });
    } else {
      kelasAkanDibuatkanAkun.push({
        kelasId: k.id,
        kelasNama: k.nama,
      });
    }
  }

  return { kelasAkanDisambungkan, kelasAkanDibuatkanAkun, kelasSudahSiap };
}

export async function eksekusiMigrasiWali(
  pratinjau: PratinjauMigrasi,
  onProgress?: (selesai: number, total: number, msg: string) => void
): Promise<{ disambungkan: number; dibuat: number }> {
  let disambungkan = 0;
  let dibuat = 0;
  const total = pratinjau.kelasAkanDisambungkan.length + pratinjau.kelasAkanDibuatkanAkun.length;
  let current = 0;

  // 1. Sambungkan
  for (const item of pratinjau.kelasAkanDisambungkan) {
    onProgress?.(current, total, `Menghubungkan ${item.kelasNama}...`);
    if (isFirebaseConfigured) {
      try {
        const uSnap = await getDoc(doc(db, 'users', item.userUid));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          await setDoc(
            doc(db, 'kelas', item.kelasId),
            {
              waliKelasUid: item.userUid,
              loginEmail: uData.loginEmail || uData.email,
              loginVersi: uData.loginVersi || 1,
              waliNama: uData.nama || '',
              waliGelar: uData.gelar || '',
              namaWali: uData.nama || '',
              gelarWali: uData.gelar || '',
              nipWali: uData.nip || '',
              updatedAt: tsNow(),
            },
            { merge: true }
          );
          disambungkan++;
        }
      } catch (e) {
        console.warn('Gagal menghubungkan:', e);
      }
    }
    current++;
    onProgress?.(current, total, `Selesai ${item.kelasNama}`);
  }

  // 2. Siapkan akun untuk yang belum punya
  for (const item of pratinjau.kelasAkanDibuatkanAkun) {
    onProgress?.(current, total, `Membuat akun ${item.kelasNama}...`);
    try {
      await siapkanAkunWaliUntukKelas(item.kelasId, item.kelasNama);
      dibuat++;
    } catch (e) {
      console.warn('Gagal buat akun:', e);
    }
    current++;
    onProgress?.(current, total, `Selesai ${item.kelasNama}`);
  }

  return { disambungkan, dibuat };
}

// ─── TAHAP 4: PERIKSA & PERBAIKI SEMUA KELAS ─────────────────────────────────

export interface MasalahKelasItem {
  id: string;
  kelasId: string;
  namaKelas: string;
  kategori: 'users_kelasId' | 'siswa_kelasId' | 'statusRapor' | 'wali_akun';
  deskripsi: string;
  detail?: any;
}

export interface HasilPemeriksaanKelas {
  totalKelas: number;
  masalah: MasalahKelasItem[];
  daftarMasalahFormatted: string[];
}

export interface HasilEksekusiPerbaikan {
  totalDiperiksa: number;
  totalDiperbaiki: number;
  totalGagal: number;
  pesanRingkasan: string;
  rincianPerbaikan: string[];
}

export async function periksaSemuaKelas(): Promise<HasilPemeriksaanKelas> {
  const classes = await getAllKelas();
  const activeClasses = classes.filter((k) => k.aktif !== false);
  const masalah: MasalahKelasItem[] = [];
  const daftarMasalahFormatted: string[] = [];

  // Ambil tahun ajaran aktif
  let activeTaId = 'ta_2025_1';
  try {
    const taDoc = await getTahunAjaranAktif();
    if (taDoc?.id) activeTaId = taDoc.id;
  } catch {}

  // 1. Ambil data Firestore secara paralel jika online
  const allUsers: Map<string, any> = new Map();
  const allStatusRapor: Set<string> = new Set();
  let allSiswa: { id: string; docId: string; kelasId?: string; kelas_id?: string; kelas?: string; nama?: string }[] = [];
  let allKelasSiswa: { id: string; docId: string; siswa_id?: string; kelas_id?: string; rombel_id?: string; kelasId?: string }[] = [];

  if (isFirebaseConfigured) {
    try {
      const [uSnap, srSnap, sSnap, ksSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'statusRapor')),
        getDocs(collection(db, 'siswa')),
        getDocs(collection(db, 'kelasSiswa')),
      ]);

      uSnap.docs.forEach((d) => allUsers.set(d.id, { uid: d.id, ...d.data() }));
      srSnap.docs.forEach((d) => allStatusRapor.add(d.id));
      allSiswa = sSnap.docs.map((d) => ({ docId: d.id, id: d.id, ...d.data() }));
      allKelasSiswa = ksSnap.docs.map((d) => ({ docId: d.id, id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('Gagal memuat data komparasi Firestore untuk periksa kelas:', e);
    }
  } else {
    try {
      const rawUsers = localStorage.getItem('erapot_users_firestore_fallback') || '[]';
      JSON.parse(rawUsers).forEach((u: any) => allUsers.set(u.uid, u));

      const rawDb = localStorage.getItem('erapot_sd_local_database_v1');
      if (rawDb) {
        const dbObj = JSON.parse(rawDb);
        allSiswa = (dbObj.siswa || []).map((s: any) => ({ docId: s.id, id: s.id, ...s }));
        allKelasSiswa = (dbObj.kelasSiswa || []).map((ks: any) => ({ docId: ks.id, id: ks.id, ...ks }));
      }
    } catch {}
  }

  // 2. Loop per kelas aktif
  for (const k of activeClasses) {
    // a. Periksa akun wali kelas
    let userWali: any = null;
    if (k.waliKelasUid) {
      userWali = allUsers.get(k.waliKelasUid);
    } else {
      // Cari jika ada user dengan peran wali_kelas yang terhubung
      for (const u of allUsers.values()) {
        if (u.peran === 'wali_kelas' && (u.kelasId === k.id || u.kelasId === k.nama)) {
          userWali = u;
          break;
        }
      }
    }

    if (!userWali) {
      const item: MasalahKelasItem = {
        id: `${k.id}_wali_hilang`,
        kelasId: k.id,
        namaKelas: k.nama,
        kategori: 'wali_akun',
        deskripsi: `${k.nama}: akun wali belum dibuat`,
      };
      masalah.push(item);
      daftarMasalahFormatted.push(`- ${k.nama}: akun wali belum dibuat`);
    } else if (userWali.aktif === false) {
      const item: MasalahKelasItem = {
        id: `${k.id}_wali_nonaktif`,
        kelasId: k.id,
        namaKelas: k.nama,
        kategori: 'wali_akun',
        deskripsi: `${k.nama}: akun wali dinonaktifkan`,
        detail: { waliUid: userWali.uid },
      };
      masalah.push(item);
      daftarMasalahFormatted.push(`- ${k.nama}: akun wali dinonaktifkan`);
    } else {
      // b. Periksa users.kelasId == kelas.id (bukan nama kelas)
      if (userWali.kelasId !== k.id) {
        const item: MasalahKelasItem = {
          id: `${k.id}_user_kelas_id`,
          kelasId: k.id,
          namaKelas: k.nama,
          kategori: 'users_kelasId',
          deskripsi: `${k.nama}: users.kelasId bernilai '${userWali.kelasId || ""}', seharusnya '${k.id}'`,
          detail: { waliUid: userWali.uid, currentKelasId: userWali.kelasId, expectedKelasId: k.id },
        };
        masalah.push(item);
        daftarMasalahFormatted.push(`- ${k.nama}: users.kelasId bernilai '${userWali.kelasId || ""}', seharusnya '${k.id}'`);
      }
    }

    // c. Periksa field kelasId pada semua siswa di kelas ini
    const siswaIdsDiKelas = new Set<string>();
    allKelasSiswa.forEach((ks) => {
      if (
        ks.kelas_id === k.id ||
        ks.rombel_id === k.id ||
        ks.kelasId === k.id ||
        ks.kelas_id === k.nama ||
        ks.rombel_id === k.nama
      ) {
        if (ks.siswa_id) siswaIdsDiKelas.add(ks.siswa_id);
      }
    });

    allSiswa.forEach((s) => {
      if (
        s.kelasId === k.id ||
        s.kelas_id === k.id ||
        s.kelas === k.nama ||
        s.kelas === k.id
      ) {
        siswaIdsDiKelas.add(s.id);
      }
    });

    const siswaBermasalah: any[] = [];
    siswaIdsDiKelas.forEach((sId) => {
      const s = allSiswa.find((item) => item.id === sId || item.docId === sId);
      if (s) {
        if (!s.kelasId || s.kelasId !== k.id) {
          siswaBermasalah.push(s);
        }
      }
    });

    if (siswaBermasalah.length > 0) {
      const item: MasalahKelasItem = {
        id: `${k.id}_siswa_kelas_id`,
        kelasId: k.id,
        namaKelas: k.nama,
        kategori: 'siswa_kelasId',
        deskripsi: `${k.nama}: ${siswaBermasalah.length} siswa belum memiliki field kelasId '${k.id}'`,
        detail: { siswaCount: siswaBermasalah.length, siswaList: siswaBermasalah },
      };
      masalah.push(item);
      daftarMasalahFormatted.push(`- ${k.nama}: ${siswaBermasalah.length} siswa belum memiliki field kelasId`);
    }

    // d. Periksa apakah statusRapor untuk tahun ajaran aktif sudah ada
    const statusRaporId = `${activeTaId}_${k.id}`;
    if (!allStatusRapor.has(statusRaporId)) {
      const item: MasalahKelasItem = {
        id: `${k.id}_status_rapor`,
        kelasId: k.id,
        namaKelas: k.nama,
        kategori: 'statusRapor',
        deskripsi: `${k.nama}: statusRapor belum dibuat`,
        detail: { expectedId: statusRaporId, activeTaId },
      };
      masalah.push(item);
      daftarMasalahFormatted.push(`- ${k.nama}: statusRapor belum dibuat`);
    }
  }

  return {
    totalKelas: activeClasses.length,
    masalah,
    daftarMasalahFormatted,
  };
}

export async function terapkanPerbaikanSemuaKelas(
  pemeriksaan: HasilPemeriksaanKelas,
  onProgress?: (selesai: number, total: number, pesan: string) => void
): Promise<HasilEksekusiPerbaikan> {
  const { totalKelas, masalah } = pemeriksaan;
  const classes = await getAllKelas();
  const kelasMap = new Map(classes.map((k) => [k.id, k]));

  // Ambil tahun ajaran aktif
  let activeTaId = 'ta_2025_1';
  try {
    const taDoc = await getTahunAjaranAktif();
    if (taDoc?.id) activeTaId = taDoc.id;
  } catch {}

  // Kelompokkan masalah per kelasId
  const masalahPerKelas = new Map<string, MasalahKelasItem[]>();
  for (const m of masalah) {
    if (!masalahPerKelas.has(m.kelasId)) {
      masalahPerKelas.set(m.kelasId, []);
    }
    masalahPerKelas.get(m.kelasId)!.push(m);
  }

  const kelasBermasalahList = Array.from(masalahPerKelas.keys());
  let totalDiperbaiki = 0;
  let totalGagal = 0;
  const rincianPerbaikan: string[] = [];
  const now = tsNow();

  for (let i = 0; i < kelasBermasalahList.length; i++) {
    const kId = kelasBermasalahList[i];
    const items = masalahPerKelas.get(kId)!;
    const kelasDoc = kelasMap.get(kId);
    const namaKelas = kelasDoc?.nama || kId;
    onProgress?.(i, kelasBermasalahList.length, `Memperbaiki ${namaKelas}...`);

    try {
      if (isFirebaseConfigured) {
        const batch = writeBatch(db);
        let butuhProvision = false;

        for (const item of items) {
          if (item.kategori === 'wali_akun') {
            butuhProvision = true;
          } else if (item.kategori === 'users_kelasId') {
            const waliUid = item.detail?.waliUid || kelasDoc?.waliKelasUid;
            if (waliUid) {
              batch.update(doc(db, 'users', waliUid), {
                kelasId: kId,
                updatedAt: now,
              });
              batch.set(
                doc(db, 'kelas', kId),
                {
                  waliKelasUid: waliUid,
                  updatedAt: now,
                },
                { merge: true }
              );
            }
          } else if (item.kategori === 'siswa_kelasId') {
            const siswaList = item.detail?.siswaList || [];
            for (const s of siswaList) {
              const docId = s.docId || s.id;
              if (docId) {
                batch.update(doc(db, 'siswa', docId), {
                  kelasId: kId,
                  kelas_id: kId,
                  updatedAt: now,
                });
              }
              const ksId = `ks_${kId}_${s.id}`;
              batch.set(
                doc(db, 'kelasSiswa', ksId),
                {
                  id: ksId,
                  kelasId: kId,
                  kelas_id: kId,
                  rombel_id: kId,
                  siswa_id: s.id,
                  updatedAt: now,
                },
                { merge: true }
              );
            }
          } else if (item.kategori === 'statusRapor') {
            const sId = item.detail?.expectedId || `${activeTaId}_${kId}`;
            batch.set(
              doc(db, 'statusRapor', sId),
              {
                id: sId,
                kelasId: kId,
                tahunAjaranId: activeTaId,
                status: 'terbuka',
                final: false,
                createdAt: now,
                updatedAt: now,
              },
              { merge: true }
            );
          }
        }

        await batch.commit();

        if (butuhProvision) {
          await provisionKelas(kId, namaKelas);
        }
      }

      totalDiperbaiki++;
      rincianPerbaikan.push(`${namaKelas}: ${items.length} masalah berhasil diperbaiki`);
    } catch (err: any) {
      console.error(`Gagal memperbaiki kelas ${kId}:`, err);
      totalGagal++;
      rincianPerbaikan.push(`${namaKelas}: Gagal diperbaiki (${err.message})`);
    }

    onProgress?.(i + 1, kelasBermasalahList.length, `Selesai ${namaKelas}`);
  }

  await catatLogAktivitas({
    uid: 'admin',
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'PERBAIKI_SEMUA_KELAS',
    target: `${totalDiperbaiki} kelas diperbaiki`,
    nilaiBaru: `${totalKelas} kelas diperiksa, ${totalDiperbaiki} diperbaiki, ${totalGagal} gagal`,
  });

  const pesanRingkasan = `${totalKelas} kelas diperiksa, ${totalDiperbaiki} diperbaiki, ${totalGagal} gagal`;
  return {
    totalDiperiksa: totalKelas,
    totalDiperbaiki,
    totalGagal,
    pesanRingkasan,
    rincianPerbaikan,
  };
}

// ─── AMBIL PASSWORD AWAL SPESIFIK ───────────────────────────────────────────

export async function ambilPasswordAwalKelas(kelasId: string): Promise<string | null> {
  if (isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, 'passwordAwal', kelasId));
      if (snap.exists()) {
        return snap.data().passwordAwal || null;
      }
    } catch {}
  }
  try {
    const raw = localStorage.getItem('erapot_password_awal_store');
    if (raw) {
      const map = JSON.parse(raw);
      return map[kelasId]?.passwordAwal || null;
    }
  } catch {}
  return null;
}

export async function aturWaliKelas(
  kelasId: string,
  input: WaliKelasInput
): Promise<{ uid: string; email: string }> {
  const res = await editWaliKelas(kelasId, {
    nama: input.nama,
    gelar: input.gelar,
    nip: input.nip,
    passwordBaru: input.password,
  });
  const kelasData = await getKelasById(kelasId);
  return {
    uid: kelasData?.waliKelasUid || `uid_${kelasId}`,
    email: kelasData?.loginEmail || formatWaliEmail(kelasData?.nama || kelasId),
  };
}

/**
 * Reset kata sandi Wali Kelas per Kelas ID:
 * - Membuat akun Auth baru dengan versi +1 via secondary app
 * - users/{uidLama}.aktif = false
 * - users/{uidBaru} dibuat dengan data yang sama + aktif = true
 * - kelas.loginEmail dan kelas.loginVersi diperbarui
 */
export async function resetPasswordWaliKelasByKelasId(
  kelasId: string,
  passwordBaru: string
): Promise<{ success: boolean; newEmail: string; newVersi: number }> {
  if (passwordBaru.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter.');
  }
  const now = tsNow();

  let kelasData: KelasDoc | null = null;
  if (isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, 'kelas', kelasId));
      if (snap.exists()) {
        kelasData = { id: snap.id, ...snap.data() } as KelasDoc;
      }
    } catch (e) {
      console.warn('Gagal membaca kelas Firestore:', e);
    }
  }
  if (!kelasData) {
    const list = getLocalKelasList();
    kelasData = list.find((k) => k.id === kelasId) || null;
  }
  if (!kelasData) {
    throw new Error('Kelas tidak ditemukan.');
  }

  const oldUid = kelasData.waliKelasUid;
  let teacherNama = kelasData.waliNama || kelasData.namaWali || 'Wali Kelas';
  let teacherGelar = kelasData.waliGelar || kelasData.gelarWali || '';
  let teacherNip = kelasData.nipWali || '';

  if (isFirebaseConfigured && oldUid) {
    try {
      const uSnap = await getDoc(doc(db, 'users', oldUid));
      if (uSnap.exists()) {
        const uData = uSnap.data();
        teacherNama = uData.nama || teacherNama;
        teacherGelar = uData.gelar || teacherGelar;
        teacherNip = uData.nip || teacherNip;
      }
    } catch {}
  }

  const currentVersi = kelasData.loginVersi || 1;
  const newVersi = currentVersi + 1;
  const namaKelas = kelasData.nama || kelasId;
  let targetEmail = formatWaliEmail(namaKelas, newVersi);
  let newUid = `uid_wali_${kelasId}_v${newVersi}_${Date.now()}`;
  let attempt = newVersi;

  if (isFirebaseConfigured) {
    const { secondaryAuth, cleanup } = await getSecondaryAuth();
    try {
      let created = false;
      while (attempt < newVersi + 20) {
        targetEmail = formatWaliEmail(namaKelas, attempt);
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, targetEmail, passwordBaru);
          newUid = cred.user.uid;
          created = true;
          break;
        } catch (err: any) {
          if (err?.code === 'auth/email-already-in-use') {
            attempt++;
          } else {
            throw err;
          }
        }
      }
      if (!created) {
        throw new Error('Gagal membuat akun Auth baru: email sudah digunakan.');
      }

      // 1. users/{uidLama}.aktif = false
      if (oldUid) {
        try {
          await updateDoc(doc(db, 'users', oldUid), {
            aktif: false,
            updatedAt: now,
          });
        } catch (e) {
          console.warn('Gagal menonaktifkan akun lama:', e);
        }
      }

      // 2. users/{uidBaru} dibuat dengan data yang sama + aktif = true
      try {
        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          nama: teacherNama,
          gelar: teacherGelar,
          nip: teacherNip,
          peran: 'wali_kelas',
          kelasId,
          aktif: true,
          loginEmail: targetEmail,
          loginVersi: attempt,
          createdAt: now,
          updatedAt: now,
        });
      } catch (errUser) {
        console.warn('Gagal menulis user baru ke Firestore:', errUser);
      }

      // 3. kelas.loginEmail dan kelas.loginVersi diperbarui
      try {
        await setDoc(
          doc(db, 'kelas', kelasId),
          {
            waliKelasUid: newUid,
            loginEmail: targetEmail,
            loginVersi: attempt,
            emailWali: targetEmail,
            updatedAt: now,
          },
          { merge: true }
        );
      } catch (errKelas: any) {
        console.warn('Gagal update kelas di Firestore:', errKelas);
        throw new Error(`Gagal memperbarui status login kelas di Firestore: ${errKelas.message}`);
      }
    } finally {
      await cleanup();
    }
  }

  // Update fallback lokal
  const list = getLocalKelasList();
  const idx = list.findIndex((k) => k.id === kelasId);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      waliKelasUid: newUid,
      emailWali: targetEmail,
      loginEmail: targetEmail,
      loginVersi: attempt,
      updatedAt: now,
    };
    saveLocalKelasList(list);
  }

  const rawUsers = localStorage.getItem('erapot_users_firestore_fallback');
  const userList = rawUsers ? JSON.parse(rawUsers) : [];
  if (oldUid) {
    const oldU = userList.find((u: any) => u.uid === oldUid);
    if (oldU) oldU.aktif = false;
  }
  userList.push({
    uid: newUid,
    nama: teacherNama,
    gelar: teacherGelar,
    nip: teacherNip,
    email: targetEmail,
    loginEmail: targetEmail,
    password: passwordBaru,
    peran: 'wali_kelas',
    aktif: true,
    kelasId,
    createdAt: now,
    updatedAt: now,
  });
  localStorage.setItem('erapot_users_firestore_fallback', JSON.stringify(userList));

  // Sinkronkan ke akun mock auth (erapot_sd_accounts_v2)
  try {
    const rawAcc = localStorage.getItem('erapot_sd_accounts_v2');
    const accList = rawAcc ? JSON.parse(rawAcc) : [];
    const accIdx = accList.findIndex((a: any) => a.peran === 'guru' && (a.rombel_id === kelasId || a.kelas === namaKelas || a.rombel_nama === namaKelas));
    if (accIdx >= 0) {
      accList[accIdx].password = passwordBaru;
      accList[accIdx].aktif = true;
    }
    localStorage.setItem('erapot_sd_accounts_v2', JSON.stringify(accList));
  } catch {}

  await catatLogAktivitas({
    uid: 'admin',
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'RESET_PASSWORD',
    target: `Kelas ${namaKelas} (${targetEmail})`,
    nilaiBaru: `Versi ${attempt}`,
  });

  return { success: true, newEmail: targetEmail, newVersi: attempt };
}

/**
 * Reset kata sandi pengguna umum (guru mapel atau wali kelas)
 */
export async function resetPasswordUser(uid: string, passwordBaru: string): Promise<void> {
  if (passwordBaru.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter.');
  }

  if (isFirebaseConfigured) {
    const uSnap = await getDoc(doc(db, 'users', uid));
    if (uSnap.exists()) {
      const uData = uSnap.data();
      if (uData.peran === 'wali_kelas' && uData.kelasId) {
        await resetPasswordWaliKelasByKelasId(uData.kelasId, passwordBaru);
        return;
      }
      if (uData.peran === 'guru_mapel') {
        const username = uData.username || uData.nama?.toLowerCase().replace(/\s+/g, '') || uid;
        await resetPasswordGuruMapel(username, passwordBaru, uid);
        return;
      }
    }
  }

  // Update fallback local
  const rawUsers = localStorage.getItem('erapot_users_firestore_fallback');
  if (rawUsers) {
    const list = JSON.parse(rawUsers);
    const item = list.find((u: any) => u.uid === uid || u.id === uid);
    if (item) {
      item.password = passwordBaru;
      localStorage.setItem('erapot_users_firestore_fallback', JSON.stringify(list));
    }
  }
}

export async function resetPasswordWaliKelas(
  email: string,
  passwordBaru?: string,
  uid?: string,
  kelasId?: string
): Promise<void> {
  if (kelasId && passwordBaru) {
    await resetPasswordWaliKelasByKelasId(kelasId, passwordBaru);
    return;
  }
  if (uid && passwordBaru) {
    await resetPasswordUser(uid, passwordBaru);
    return;
  }
  await catatLogAktivitas({
    uid: 'admin',
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'RESET_PASSWORD',
    target: email.trim(),
  });
}

/**
 * Menonaktifkan akun pengguna (aktif = false di Firestore)
 */
export async function nonaktifkanAkunUser(uid: string): Promise<void> {
  const now = tsNow();
  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'users', uid), { aktif: false, updatedAt: now });
    } catch (e) {
      console.warn('Gagal menonaktifkan akun user di Firestore:', e);
    }
  }

  // Local fallback
  const rawUsers = localStorage.getItem('erapot_users_firestore_fallback');
  if (rawUsers) {
    const list = JSON.parse(rawUsers);
    const item = list.find((u: any) => u.uid === uid || u.id === uid);
    if (item) {
      item.aktif = false;
      localStorage.setItem('erapot_users_firestore_fallback', JSON.stringify(list));
    }
  }
}

// ─── GURU MAPEL ─────────────────────────────────────────────────────────────

export async function getAllGuruMapel(): Promise<GuruMapelDoc[]> {
  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('peran', '==', 'guru_mapel'), orderBy('nama'))
      );
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GuruMapelDoc));
      }
    } catch (err) {
      console.warn('Gagal ambil data guru mapel Firestore:', err);
    }
  }
  return getLocalGuruMapelList();
}

export async function tambahGuruMapel(input: {
  nama: string;
  username: string;
  email?: string;
  nip?: string;
  password: string;
  kelasIds: string[];
  mapelIds: string[];
}): Promise<GuruMapelDoc> {
  const now = tsNow();
  let uid = `uid_gm_${Date.now()}`;
  const cleanUsername = input.username.toLowerCase().trim();
  let targetEmail = formatGuruMapelEmail(cleanUsername, 1);
  let attempt = 1;

  if (isFirebaseConfigured) {
    const { secondaryAuth, cleanup } = await getSecondaryAuth();
    try {
      let created = false;
      while (attempt < 20) {
        targetEmail = formatGuruMapelEmail(cleanUsername, attempt);
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, targetEmail, input.password);
          uid = cred.user.uid;
          created = true;
          break;
        } catch (err: any) {
          if (err?.code === 'auth/email-already-in-use') {
            attempt++;
          } else {
            throw err;
          }
        }
      }
      if (!created) {
        throw new Error('Gagal membuat akun guru mapel: email sudah digunakan.');
      }

      try {
        await setDoc(doc(db, 'users', uid), {
          uid,
          nama: input.nama.trim(),
          username: cleanUsername,
          email: targetEmail,
          loginEmail: targetEmail,
          loginVersi: attempt,
          nip: input.nip?.trim() || '',
          peran: 'guru_mapel',
          aktif: true,
          kelasIds: input.kelasIds,
          mapelIds: input.mapelIds,
          createdAt: now,
          updatedAt: now,
        });

        // Simpan lookup ke pengaturan/guruMapel agar login pra-login guru mapel instan
        await setDoc(
          doc(db, 'pengaturan', 'guruMapel'),
          {
            [cleanUsername]: {
              uid,
              loginEmail: targetEmail,
              loginVersi: attempt,
              nama: input.nama.trim(),
              aktif: true,
              updatedAt: now,
            },
          },
          { merge: true }
        );
      } catch (errFs) {
        console.warn('Gagal simpan guru mapel ke Firestore (disimpan di penyimpanan lokal):', errFs);
      }
    } finally {
      await cleanup();
    }
  }

  const newDoc: GuruMapelDoc = {
    id: uid,
    uid,
    nama: input.nama.trim(),
    username: cleanUsername,
    email: targetEmail,
    loginEmail: targetEmail,
    loginVersi: attempt,
    nip: input.nip?.trim() ?? '',
    peran: 'guru_mapel',
    aktif: true,
    kelasIds: input.kelasIds,
    mapelIds: input.mapelIds,
    createdAt: now,
    updatedAt: now,
  };

  const list = getLocalGuruMapelList();
  list.push(newDoc);
  saveLocalGuruMapelList(list);

  // Simpan akun login ke fallback users
  const rawUsers = localStorage.getItem('erapot_users_firestore_fallback');
  const userList = rawUsers ? JSON.parse(rawUsers) : [];
  userList.push({
    ...newDoc,
    password: input.password,
  });
  localStorage.setItem('erapot_users_firestore_fallback', JSON.stringify(userList));

  await catatLogAktivitas({
    uid: 'admin',
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'TAMBAH_GURU_MAPEL',
    target: input.nama.trim(),
    nilaiBaru: `${input.mapelIds.length} mapel, ${input.kelasIds.length} kelas (${targetEmail})`,
  });

  return newDoc;
}

export async function resetPasswordGuruMapel(
  username: string,
  passwordBaru: string,
  currentUid?: string
): Promise<{ success: boolean; newEmail: string; newVersi: number }> {
  if (passwordBaru.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter.');
  }
  const cleanUsername = username.toLowerCase().trim();
  const now = tsNow();

  let oldDoc: GuruMapelDoc | null = null;
  if (currentUid && isFirebaseConfigured) {
    const snap = await getDoc(doc(db, 'users', currentUid));
    if (snap.exists()) {
      oldDoc = { id: snap.id, ...snap.data() } as GuruMapelDoc;
    }
  }
  if (!oldDoc) {
    const all = await getAllGuruMapel();
    oldDoc = all.find((g) => g.username === cleanUsername || g.uid === currentUid) || null;
  }
  if (!oldDoc) {
    throw new Error('Guru mapel tidak ditemukan.');
  }

  const oldUid = oldDoc.uid;
  const currentVersi = oldDoc.loginVersi || 1;
  const newVersi = currentVersi + 1;
  let targetEmail = formatGuruMapelEmail(cleanUsername, newVersi);
  let newUid = `uid_gm_v${newVersi}_${Date.now()}`;
  let attempt = newVersi;

  if (isFirebaseConfigured) {
    const { secondaryAuth, cleanup } = await getSecondaryAuth();
    try {
      let created = false;
      while (attempt < newVersi + 20) {
        targetEmail = formatGuruMapelEmail(cleanUsername, attempt);
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, targetEmail, passwordBaru);
          newUid = cred.user.uid;
          created = true;
          break;
        } catch (err: any) {
          if (err?.code === 'auth/email-already-in-use') {
            attempt++;
          } else {
            throw err;
          }
        }
      }
      if (!created) {
        throw new Error('Gagal membuat akun Auth guru mapel: email sudah digunakan.');
      }

      // Nonaktifkan akun lama
      if (oldUid) {
        try {
          await updateDoc(doc(db, 'users', oldUid), { aktif: false, updatedAt: now });
        } catch {}
      }

      // Buat akun baru di users
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        nama: oldDoc.nama,
        username: cleanUsername,
        nip: oldDoc.nip || '',
        email: targetEmail,
        loginEmail: targetEmail,
        loginVersi: attempt,
        peran: 'guru_mapel',
        aktif: true,
        kelasIds: oldDoc.kelasIds || [],
        mapelIds: oldDoc.mapelIds || [],
        createdAt: now,
        updatedAt: now,
      });

      // Update pengaturan/guruMapel
      await setDoc(
        doc(db, 'pengaturan', 'guruMapel'),
        {
          [cleanUsername]: {
            uid: newUid,
            loginEmail: targetEmail,
            loginVersi: attempt,
            nama: oldDoc.nama,
            aktif: true,
            updatedAt: now,
          },
        },
        { merge: true }
      );
    } finally {
      await cleanup();
    }
  }

  // Update local
  const list = getLocalGuruMapelList();
  const idx = list.findIndex((g) => g.uid === oldUid || g.username === cleanUsername);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      uid: newUid,
      email: targetEmail,
      loginEmail: targetEmail,
      loginVersi: attempt,
      updatedAt: now,
    };
    saveLocalGuruMapelList(list);
  }

  await catatLogAktivitas({
    uid: 'admin',
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'RESET_PASSWORD',
    target: `Guru Mapel ${oldDoc.nama} (${cleanUsername})`,
    nilaiBaru: `${targetEmail} (Versi ${attempt})`,
  });

  return { success: true, newEmail: targetEmail, newVersi: attempt };
}

export async function editGuruMapel(
  uid: string,
  updates: Partial<Pick<GuruMapelDoc, 'nama' | 'nip' | 'aktif' | 'kelasIds' | 'mapelIds'>>
): Promise<void> {
  const now = tsNow();
  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, 'users', uid), { ...updates, updatedAt: now });
    } catch (err) {
      console.warn('Gagal update guru mapel Firestore:', err);
    }
  }

  const list = getLocalGuruMapelList();
  const idx = list.findIndex((g) => g.uid === uid || g.id === uid);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates, updatedAt: now };
    saveLocalGuruMapelList(list);
  }
}

export async function hapusGuruMapel(uid: string): Promise<void> {
  await nonaktifkanAkunUser(uid);
  return editGuruMapel(uid, { aktif: false });
}

// ─── AKUN LAMA (NONAKTIF) ───────────────────────────────────────────────────

export async function getAkunLama(): Promise<AkunLamaItem[]> {
  const result: AkunLamaItem[] = [];
  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('aktif', '==', false))
      );
      snap.docs.forEach((d) => {
        result.push({ uid: d.id, ...d.data() } as AkunLamaItem);
      });
      return result.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } catch (e) {
      console.warn('Gagal ambil data akun lama Firestore:', e);
    }
  }

  // Fallback local
  try {
    const rawUsers = localStorage.getItem('erapot_users_firestore_fallback');
    if (rawUsers) {
      const list = JSON.parse(rawUsers);
      list
        .filter((u: any) => u.aktif === false)
        .forEach((u: any) => result.push(u));
    }
  } catch {}

  return result.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
