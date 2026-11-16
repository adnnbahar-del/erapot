// src/lib/kunciNilaiService.ts
// Layanan Kunci Nilai & Finalisasi Rapor (Tahap 4)
// Koleksi Firestore: `finalisasiRapor`
//   { id: `${kelasId}_${tahunAjaranId}`, kelasId, kelasNama, tahunAjaranId, status: "final" | "terbuka", tanggalFinal, difinalkanOlehNama, alasanBukaKunci, dibukaOlehNama, tanggalBukaKunci }

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { catatLogAktivitas } from './logAktivitasService';

export interface FinalisasiRaporDoc {
  id: string; // `${kelasId}_${tahunAjaranId}`
  kelasId: string;
  kelasNama: string;
  tahunAjaranId: string;
  status: 'final' | 'terbuka';
  tanggalFinal?: string;
  difinalkanOlehUid?: string;
  difinalkanOlehNama?: string;
  alasanBukaKunci?: string;
  dibukaOlehUid?: string;
  dibukaOlehNama?: string;
  tanggalBukaKunci?: string;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_STORAGE_KEY = 'erapot_finalisasi_rapor_list';

function getLocalFinalisasiList(): FinalisasiRaporDoc[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalFinalisasiList(list: FinalisasiRaporDoc[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export function generateFinalisasiId(kelasId: string, tahunAjaranId: string): string {
  const cK = String(kelasId).trim().toLowerCase();
  const cT = String(tahunAjaranId).trim().toLowerCase();
  return `fin_${cK}_${cT}`;
}

/** Ambil status finalisasi untuk kelas & tahun ajaran tertentu */
export async function getStatusFinalisasi(
  kelasId: string,
  tahunAjaranId: string
): Promise<FinalisasiRaporDoc | null> {
  const docId = generateFinalisasiId(kelasId, tahunAjaranId);

  if (isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, 'finalisasiRapor', docId));
      if (snap.exists()) {
        return snap.data() as FinalisasiRaporDoc;
      }
    } catch (err) {
      console.warn('Gagal ambil status finalisasi Firestore, fallback lokal:', err);
    }
  }

  const list = getLocalFinalisasiList();
  const found = list.find((item) => item.id === docId);
  return found || null;
}

/** Ambil seluruh data finalisasi untuk suatu tahun ajaran (dipakai Admin) */
export async function getAllStatusFinalisasi(
  tahunAjaranId: string
): Promise<Record<string, FinalisasiRaporDoc>> {
  const result: Record<string, FinalisasiRaporDoc> = {};

  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(
        query(collection(db, 'finalisasiRapor'), where('tahunAjaranId', '==', tahunAjaranId))
      );
      snap.docs.forEach((d) => {
        const item = d.data() as FinalisasiRaporDoc;
        result[item.kelasId] = item;
      });
      return result;
    } catch (err) {
      console.warn('Gagal ambil semua finalisasi Firestore, fallback lokal:', err);
    }
  }

  const list = getLocalFinalisasiList();
  list.filter((it) => it.tahunAjaranId === tahunAjaranId).forEach((item) => {
    result[item.kelasId] = item;
  });

  return result;
}

/** Finalkan rapor kelas (Wali Kelas) */
export async function finalkanRaporKelas(input: {
  kelasId: string;
  kelasNama: string;
  tahunAjaranId: string;
  userUid?: string;
  userNama?: string;
}): Promise<FinalisasiRaporDoc> {
  const docId = generateFinalisasiId(input.kelasId, input.tahunAjaranId);
  const now = new Date().toISOString();

  const record: FinalisasiRaporDoc = {
    id: docId,
    kelasId: input.kelasId,
    kelasNama: input.kelasNama,
    tahunAjaranId: input.tahunAjaranId,
    status: 'final',
    tanggalFinal: now,
    difinalkanOlehUid: input.userUid || '',
    difinalkanOlehNama: input.userNama || 'Wali Kelas',
    createdAt: now,
    updatedAt: now,
  };

  if (isFirebaseConfigured) {
    await setDoc(doc(db, 'finalisasiRapor', docId), record, { merge: true });
  }

  const list = getLocalFinalisasiList();
  const idx = list.findIndex((it) => it.id === docId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...record };
  } else {
    list.push(record);
  }
  saveLocalFinalisasiList(list);

  catatLogAktivitas({
    uid: input.userUid,
    nama: input.userNama || 'Wali Kelas',
    peran: 'wali_kelas',
    aksi: 'Finalisasi Rapor',
    target: `Kelas ${input.kelasNama}`,
    kelasId: input.kelasId,
    nilaiBaru: `Status: Final pada ${now}`,
  });

  return record;
}

/** Buka kunci rapor kelas (Hanya Admin - wajib mengisi alasan) */
export async function bukaKunciRaporKelas(input: {
  kelasId: string;
  tahunAjaranId: string;
  alasan: string;
  adminUid?: string;
  adminNama?: string;
}): Promise<FinalisasiRaporDoc> {
  if (!input.alasan || !input.alasan.trim()) {
    throw new Error('Alasan pembukaan kunci wajib diisi.');
  }

  const docId = generateFinalisasiId(input.kelasId, input.tahunAjaranId);
  const now = new Date().toISOString();

  const patch: Partial<FinalisasiRaporDoc> = {
    status: 'terbuka',
    alasanBukaKunci: input.alasan.trim(),
    dibukaOlehUid: input.adminUid || '',
    dibukaOlehNama: input.adminNama || 'Administrator',
    tanggalBukaKunci: now,
    updatedAt: now,
  };

  if (isFirebaseConfigured) {
    await updateDoc(doc(db, 'finalisasiRapor', docId), patch);
  }

  catatLogAktivitas({
    uid: input.adminUid,
    nama: input.adminNama || 'Administrator',
    peran: 'admin',
    aksi: 'Buka Kunci',
    target: `Kelas ${input.kelasId}`,
    kelasId: input.kelasId,
    nilaiBaru: `Alasan: ${input.alasan.trim()}`,
  });

  const list = getLocalFinalisasiList();
  const item = list.find((it) => it.id === docId);
  if (item) {
    Object.assign(item, patch);
    saveLocalFinalisasiList(list);
    return item;
  }

  const created: FinalisasiRaporDoc = {
    id: docId,
    kelasId: input.kelasId,
    kelasNama: '',
    tahunAjaranId: input.tahunAjaranId,
    status: 'terbuka',
    alasanBukaKunci: input.alasan.trim(),
    dibukaOlehUid: input.adminUid || '',
    dibukaOlehNama: input.adminNama || 'Administrator',
    tanggalBukaKunci: now,
    createdAt: now,
    updatedAt: now,
  };
  list.push(created);
  saveLocalFinalisasiList(list);
  return created;
}

