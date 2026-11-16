// src/lib/tahunAjaranService.ts
// Layanan pengelolaan Tahun Ajaran & Semester (Tahap 3)
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
  orderBy,
  writeBatch,
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
  } catch {}
}

export function semesterNamaToAngka(sem: SemesterNama | Semester): Semester {
  if (sem === 'Genap' || sem === 2) return 2;
  return 1;
}

export function semesterAngkaToNama(sem: SemesterNama | Semester): SemesterNama {
  if (sem === 2 || sem === 'Genap') return 'Genap';
  return 'Ganjil';
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

/** Ambil tahun ajaran yang sedang aktif */
export async function getTahunAjaranAktif(): Promise<TahunAjaranDoc> {
  const list = await getAllTahunAjaran();
  const aktif = list.find((item) => item.aktif);
  return aktif || list[0] || DEFAULT_TA_LIST[2];
}

/** Menetapkan satu tahun ajaran sebagai aktif, dan menonaktifkan yang lain */
export async function setTahunAjaranAktif(id: string): Promise<TahunAjaranDoc> {
  const now = new Date().toISOString();
  let targetItem: TahunAjaranDoc | undefined;

  if (isFirebaseConfigured) {
    const snap = await getDocs(collection(db, 'tahunAjaran'));
    const batch = writeBatch(db);

    snap.docs.forEach((docItem) => {
      const isTarget = docItem.id === id;
      if (isTarget) {
        targetItem = { ...(docItem.data() as TahunAjaranDoc), id: docItem.id, aktif: true, status: 'berjalan', updatedAt: now };
        batch.update(docItem.ref, { aktif: true, status: 'berjalan', updatedAt: now });
      } else {
        batch.update(docItem.ref, { aktif: false, updatedAt: now });
      }
    });

    if (targetItem) {
      // Sinkronkan dokumen pengaturan/aktif
      const semAngka = semesterNamaToAngka(targetItem.semester);
      batch.set(doc(db, 'pengaturan', 'aktif'), {
        tahunAjaran: targetItem.tahun,
        semester: semAngka,
        tahunAjaranId: targetItem.id,
        label: `${targetItem.tahun} ${targetItem.semester} (aktif)`,
        updatedAt: now,
      }, { merge: true });
    }

    await batch.commit();
  }

  // Selalu sinkronkan ke local storage juga
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
    } catch {}
  }

  if (!targetItem) {
    throw new Error('Tahun ajaran tidak ditemukan.');
  }

  return targetItem;
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
    await setDoc(doc(db, 'tahunAjaran', id), newItem);
  }

  const localList = getLocalTAList();
  const existingIdx = localList.findIndex((it) => it.id === id);
  if (existingIdx >= 0) {
    localList[existingIdx] = newItem;
  } else {
    localList.push(newItem);
  }
  saveLocalTAList(localList);

  if (input.aktif) {
    return await setTahunAjaranAktif(id);
  }

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

