// src/lib/tahunAjaranService.ts
// Layanan pengelolaan Tahun Ajaran & Semester
// Koleksi Firestore: `tahunAjaran`
//   { id, tahun: "2025/2026", semester: "Ganjil" | "Genap", aktif: boolean, status: "berjalan" | "ditutup", tanggal_rapor?: string, createdAt, updatedAt }

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
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { Semester, SemesterNama, StatusTahunAjaran } from '../types';

export interface TahunAjaranDoc {
  id: string;
  tahun: string;                     // e.g. "2025/2026"
  semester: SemesterNama;            // "Ganjil" | "Genap"
  aktif: boolean;
  status: StatusTahunAjaran;         // "berjalan" | "ditutup"
  tanggal_rapor?: string;            // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

const LOCAL_STORAGE_KEY = 'erapot_tahun_ajaran_list';
const LOCAL_STORAGE_PENGATURAN_KEY = 'erapot_pengaturan';

export const DEFAULT_TA_LIST: TahunAjaranDoc[] = [
  {
    id: 'ta_2024_2025_ganjil',
    tahun: '2024/2025',
    semester: 'Ganjil',
    aktif: false,
    status: 'ditutup',
    tanggal_rapor: '2024-12-21',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ta_2024_2025_genap',
    tahun: '2024/2025',
    semester: 'Genap',
    aktif: false,
    status: 'ditutup',
    tanggal_rapor: '2025-06-21',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ta_2025_2026_ganjil',
    tahun: '2025/2026',
    semester: 'Ganjil',
    aktif: true,
    status: 'berjalan',
    tanggal_rapor: '2025-12-20',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ta_2025_2026_genap',
    tahun: '2025/2026',
    semester: 'Genap',
    aktif: false,
    status: 'berjalan',
    tanggal_rapor: '2026-06-20',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper Local Storage
function getLocalTAList(): TahunAjaranDoc[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_TA_LIST));
      return DEFAULT_TA_LIST;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_TA_LIST;
  }
}

function saveLocalTAList(list: TahunAjaranDoc[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch { }
}

export function semesterNamaToAngka(sem: SemesterNama | Semester): Semester {
  if (sem === 'Genap' || sem === 2) return 2;
  return 1;
}

export function semesterAngkaToNama(sem: SemesterNama | Semester): SemesterNama {
  if (sem === 2 || sem === 'Genap') return 'Genap';
  return 'Ganjil';
}

/**
 * Format teks label tahun ajaran untuk UI:
 * "Tahun Ajaran 2026/2027 · Semester Genap (aktif)"
 */
export function formatTahunAjaranLabel(ta: TahunAjaranDoc | null | undefined): string {
  if (!ta) return 'Tahun ajaran belum diatur — hubungi admin';
  return `Tahun Ajaran ${ta.tahun} · Semester ${ta.semester} (aktif)`;
}

/** Ambil semua daftar tahun ajaran */
export async function getAllTahunAjaran(): Promise<TahunAjaranDoc[]> {
  if (!isFirebaseConfigured) {
    return getLocalTAList();
  }

  try {
    const snap = await getDocs(
      query(collection(db, 'tahunAjaran'), orderBy('tahun', 'desc'))
    );
    if (snap.empty) {
      // Inisialisasi awal ke Firestore jika masih kosong
      const batch = writeBatch(db);
      for (const item of DEFAULT_TA_LIST) {
        batch.set(doc(db, 'tahunAjaran', item.id), item);
      }
      await batch.commit();
      return DEFAULT_TA_LIST;
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TahunAjaranDoc));
  } catch (err) {
    console.warn('Gagal ambil tahun ajaran dari Firestore, fallback lokal:', err);
    return getLocalTAList();
  }
}

/**
 * Ambil dokumen tahun ajaran yang sedang aktif (aktif == true).
 * Mengembalikan null jika tidak ada tahun ajaran yang aktif.
 */
export async function getTahunAjaranAktif(): Promise<TahunAjaranDoc | null> {
  if (!isFirebaseConfigured) {
    const list = getLocalTAList();
    return list.find((item) => item.aktif) || null;
  }

  try {
    const q = query(collection(db, 'tahunAjaran'), where('aktif', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) {
      return null;
    }
    const activeDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TahunAjaranDoc));
    // Jika ada lebih dari satu, urutkan berdasarkan updatedAt terbaru
    activeDocs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return activeDocs[0];
  } catch (err) {
    console.error('Gagal mengambil tahun ajaran aktif dari Firestore:', err);
    return null;
  }
}

export interface SubscribeTahunAjaranAktifMeta {
  ganda: boolean;
  listGanda: TahunAjaranDoc[];
}

/**
 * Berlangganan (realtime listener onSnapshot) ke tahun ajaran yang aktif.
 * Mengembalikan fungsi unsubscribe.
 */
export function subscribeTahunAjaranAktif(
  callback: (ta: TahunAjaranDoc | null, meta: SubscribeTahunAjaranAktifMeta) => void
): () => void {
  if (!isFirebaseConfigured) {
    const local = getLocalTAList();
    const activeDocs = local.filter((it) => it.aktif);
    const primary = activeDocs[0] || null;
    callback(primary, { ganda: activeDocs.length > 1, listGanda: activeDocs });
    return () => { };
  }

  const q = query(collection(db, 'tahunAjaran'), where('aktif', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null, { ganda: false, listGanda: [] });
        return;
      }
      const activeDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TahunAjaranDoc));
      if (activeDocs.length > 1) {
        activeDocs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        callback(activeDocs[0], { ganda: true, listGanda: activeDocs });
      } else {
        callback(activeDocs[0], { ganda: false, listGanda: activeDocs });
      }
    },
    (err) => {
      console.error('Error onSnapshot tahunAjaran:', err);
      callback(null, { ganda: false, listGanda: [] });
    }
  );
}

/**
 * Menetapkan satu tahun ajaran sebagai aktif, dan menonaktifkan yang lain dalam SATU writeBatch.
 * Validasi ketat: Hanya SATU dokumen yang boleh aktif.
 */
export async function setTahunAjaranAktif(id: string): Promise<TahunAjaranDoc> {
  if (!id) {
    throw new Error('ID tahun ajaran wajib diisi.');
  }

  const now = new Date().toISOString();
  let targetItem: TahunAjaranDoc | undefined;

  if (isFirebaseConfigured) {
    const snap = await getDocs(collection(db, 'tahunAjaran'));
    const batch = writeBatch(db);

    snap.docs.forEach((docItem) => {
      const isTarget = docItem.id === id;
      if (isTarget) {
        targetItem = {
          ...(docItem.data() as TahunAjaranDoc),
          id: docItem.id,
          aktif: true,
          status: 'berjalan',
          updatedAt: now,
        };
        batch.update(docItem.ref, { aktif: true, status: 'berjalan', updatedAt: now });
      } else {
        batch.update(docItem.ref, { aktif: false, updatedAt: now });
      }
    });

    if (targetItem) {
      // Sinkronkan dokumen pengaturan/aktif untuk backward compatibility
      const semAngka = semesterNamaToAngka(targetItem.semester);
      batch.set(
        doc(db, 'pengaturan', 'aktif'),
        {
          tahunAjaran: targetItem.tahun,
          semester: semAngka,
          tahunAjaranId: targetItem.id,
          label: `${targetItem.tahun} ${targetItem.semester} (aktif)`,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    await batch.commit();
  }

  // Sinkronkan ke local storage
  const localList = getLocalTAList();
  const updatedList = localList.map((item) => {
    if (item.id === id) {
      targetItem = { ...item, aktif: true, status: 'berjalan', updatedAt: now };
      return targetItem;
    }
    return { ...item, aktif: false, updatedAt: now };
  });
  saveLocalTAList(updatedList);

  if (targetItem) {
    const semAngka = semesterNamaToAngka(targetItem.semester);
    try {
      localStorage.setItem(
        LOCAL_STORAGE_PENGATURAN_KEY,
        JSON.stringify({
          tahun_ajaran_aktif: targetItem.tahun,
          semester_aktif: semAngka,
          tahun_ajaran_id: targetItem.id,
        })
      );
    } catch { }
  }

  if (!targetItem) {
    throw new Error('Tahun ajaran tidak ditemukan.');
  }

  return targetItem;
}

/**
 * Menonaktifkan SEMUA tahun ajaran (dipakai untuk skenario darurat atau pengujian validasi)
 */
export async function nonaktifkanSemuaTahunAjaran(): Promise<void> {
  const now = new Date().toISOString();
  if (isFirebaseConfigured) {
    const snap = await getDocs(collection(db, 'tahunAjaran'));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { aktif: false, updatedAt: now });
    });
    batch.delete(doc(db, 'pengaturan', 'aktif'));
    await batch.commit();
  }

  const local = getLocalTAList().map((it) => ({ ...it, aktif: false, updatedAt: now }));
  saveLocalTAList(local);
  try {
    localStorage.removeItem(LOCAL_STORAGE_PENGATURAN_KEY);
  } catch { }
}

/**
 * Perbaiki jika ada beberapa tahun ajaran aktif ganda:
 * Memilih satu sebagai aktif dan menonaktifkan yang lain.
 */
export async function perbaikiTahunAjaranGanda(pilihanId: string): Promise<TahunAjaranDoc> {
  return await setTahunAjaranAktif(pilihanId);
}

/** Tambah tahun ajaran baru */
export async function tambahTahunAjaran(input: {
  tahun: string;
  semester: SemesterNama;
  aktif?: boolean;
  status?: StatusTahunAjaran;
  tanggal_rapor?: string;
}): Promise<TahunAjaranDoc> {
  const cleanTahun = input.tahun.trim();
  const cleanSem = input.semester;
  const id = `ta_${cleanTahun.replace('/', '_')}_${cleanSem.toLowerCase()}`;
  const now = new Date().toISOString();

  const newItem: TahunAjaranDoc = {
    id,
    tahun: cleanTahun,
    semester: cleanSem,
    aktif: !!input.aktif,
    status: input.status || 'berjalan',
    tanggal_rapor: input.tanggal_rapor || '',
    createdAt: now,
    updatedAt: now,
  };

  if (isFirebaseConfigured) {
    if (input.aktif) {
      // Jika dijadikan aktif, nonaktifkan dokumen lain dalam batch yang sama
      const snap = await getDocs(collection(db, 'tahunAjaran'));
      const batch = writeBatch(db);
      snap.docs.forEach((docItem) => {
        batch.update(docItem.ref, { aktif: false, updatedAt: now });
      });
      batch.set(doc(db, 'tahunAjaran', id), newItem);

      const semAngka = semesterNamaToAngka(cleanSem);
      batch.set(
        doc(db, 'pengaturan', 'aktif'),
        {
          tahunAjaran: cleanTahun,
          semester: semAngka,
          tahunAjaranId: id,
          label: `${cleanTahun} ${cleanSem} (aktif)`,
          updatedAt: now,
        },
        { merge: true }
      );
      await batch.commit();
    } else {
      await setDoc(doc(db, 'tahunAjaran', id), newItem);
    }
  }

  const localList = getLocalTAList();
  const existingIdx = localList.findIndex((it) => it.id === id);
  if (input.aktif) {
    localList.forEach((it) => (it.aktif = false));
  }
  if (existingIdx >= 0) {
    localList[existingIdx] = newItem;
  } else {
    localList.push(newItem);
  }
  saveLocalTAList(localList);

  return newItem;
}

/** Ubah status tahun ajaran ("berjalan" | "ditutup") */
export async function updateStatusTahunAjaran(id: string, status: StatusTahunAjaran): Promise<void> {
  const now = new Date().toISOString();

  if (isFirebaseConfigured) {
    await updateDoc(doc(db, 'tahunAjaran', id), { status, updatedAt: now });
  }

  const list = getLocalTAList();
  const item = list.find((it) => it.id === id);
  if (item) {
    item.status = status;
    item.updatedAt = now;
    saveLocalTAList(list);
  }
}
