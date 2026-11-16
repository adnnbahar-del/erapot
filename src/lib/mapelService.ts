// src/lib/mapelService.ts
// Layanan Mata Pelajaran Kurikulum Merdeka default per Fase (Tahap Bagian A)
// Koleksi Firestore: `mapel`
//   { id, kode, nama, kelompok: 'wajib'|'seni'|'pilihan'|'mulok', faseBerlaku: ['A','B','C'], urutanRapor, aktif, varianAgama?, kelasNonaktif? }

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Mapel, Fase, KelompokMapel } from '../types';
import { catatLogAktivitas } from './logAktivitasService';

export const LOCAL_STORAGE_MAPEL_KEY = 'erapot_mapel_master';

export const SEED_DEFAULT_MAPEL: Mapel[] = [
  {
    id: 'mapel_pabp',
    kode: 'PA_BP',
    nama: 'Pendidikan Agama dan Budi Pekerti',
    kelompok: 'wajib',
    faseBerlaku: ['A', 'B', 'C'],
    urutanRapor: 1,
    aktif: true,
    varianAgama: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'],
    singkatan: 'PABP',
    jenis: 'intra',
    urutan: 1,
  },
  {
    id: 'mapel_pancasila',
    kode: 'PANCASILA',
    nama: 'Pendidikan Pancasila',
    kelompok: 'wajib',
    faseBerlaku: ['A', 'B', 'C'],
    urutanRapor: 2,
    aktif: true,
    singkatan: 'PP',
    jenis: 'intra',
    urutan: 2,
  },
  {
    id: 'mapel_bindo',
    kode: 'BINDO',
    nama: 'Bahasa Indonesia',
    kelompok: 'wajib',
    faseBerlaku: ['A', 'B', 'C'],
    urutanRapor: 3,
    aktif: true,
    singkatan: 'BIND',
    jenis: 'intra',
    urutan: 3,
  },
  {
    id: 'mapel_mtk',
    kode: 'MTK',
    nama: 'Matematika',
    kelompok: 'wajib',
    faseBerlaku: ['A', 'B', 'C'],
    urutanRapor: 4,
    aktif: true,
    singkatan: 'MTK',
    jenis: 'intra',
    urutan: 4,
  },
  {
    id: 'mapel_ipas',
    kode: 'IPAS',
    nama: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
    kelompok: 'wajib',
    faseBerlaku: ['B', 'C'], // B & C saja!
    urutanRapor: 5,
    aktif: true,
    singkatan: 'IPAS',
    jenis: 'intra',
    urutan: 5,
  },
  {
    id: 'mapel_pjok',
    kode: 'PJOK',
    nama: 'Pendidikan Jasmani, Olahraga, dan Kesehatan',
    kelompok: 'wajib',
    faseBerlaku: ['A', 'B', 'C'],
    urutanRapor: 6,
    aktif: true,
    singkatan: 'PJOK',
    jenis: 'intra',
    urutan: 6,
  },
  {
    id: 'mapel_seni',
    kode: 'SENI',
    nama: 'Seni dan Budaya (Seni Musik / Seni Rupa / Seni Teater / Seni Tari)',
    kelompok: 'seni',
    faseBerlaku: ['A', 'B', 'C'],
    urutanRapor: 7,
    aktif: true,
    singkatan: 'SENI',
    jenis: 'intra',
    urutan: 7,
  },
  {
    id: 'mapel_bing',
    kode: 'BING',
    nama: 'Bahasa Inggris',
    kelompok: 'pilihan',
    faseBerlaku: ['A', 'B', 'C'],
    urutanRapor: 8,
    aktif: true,
    singkatan: 'BING',
    jenis: 'intra',
    urutan: 8,
  },
  {
    id: 'mapel_mulok_lampung',
    kode: 'MULOK_LAMPUNG',
    nama: 'Muatan Lokal: Bahasa Lampung',
    kelompok: 'mulok',
    faseBerlaku: ['A', 'B', 'C'],
    urutanRapor: 9,
    aktif: true,
    singkatan: 'MULOK',
    jenis: 'mulok',
    urutan: 9,
  },
];

// Helper LocalStorage
export function getLocalMapelList(): Mapel[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MAPEL_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_MAPEL_KEY, JSON.stringify(SEED_DEFAULT_MAPEL));
      return [...SEED_DEFAULT_MAPEL];
    }
    const parsed: Mapel[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(LOCAL_STORAGE_MAPEL_KEY, JSON.stringify(SEED_DEFAULT_MAPEL));
      return [...SEED_DEFAULT_MAPEL];
    }
    return parsed;
  } catch {
    return [...SEED_DEFAULT_MAPEL];
  }
}

export function saveLocalMapelList(list: Mapel[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_MAPEL_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Seeding default mapel — aman dijalankan berulang kali, tidak menyebabkan dobel.
 */
export async function seedDefaultMapel(): Promise<Mapel[]> {
  const current = getLocalMapelList();
  let changed = false;
  const merged: Mapel[] = [...current];

  for (const seed of SEED_DEFAULT_MAPEL) {
    const existingIndex = merged.findIndex(
      (m) =>
        (m.kode && seed.kode && m.kode.toUpperCase() === seed.kode.toUpperCase()) ||
        m.id === seed.id ||
        (m.nama && m.nama.toLowerCase() === seed.nama.toLowerCase())
    );

    if (existingIndex === -1) {
      merged.push({ ...seed });
      changed = true;
    } else {
      // Pastikan field penting ada
      const target = merged[existingIndex];
      let itemChanged = false;
      if (!target.kode) { target.kode = seed.kode; itemChanged = true; }
      if (!target.kelompok) { target.kelompok = seed.kelompok; itemChanged = true; }
      if (!target.faseBerlaku || target.faseBerlaku.length === 0) {
        target.faseBerlaku = seed.faseBerlaku;
        itemChanged = true;
      }
      if (typeof target.urutanRapor !== 'number') {
        target.urutanRapor = seed.urutanRapor;
        itemChanged = true;
      }
      if (typeof target.aktif !== 'boolean') {
        target.aktif = true;
        itemChanged = true;
      }
      if (seed.varianAgama && (!target.varianAgama || target.varianAgama.length === 0)) {
        target.varianAgama = seed.varianAgama;
        itemChanged = true;
      }
      if (itemChanged) {
        merged[existingIndex] = { ...target };
        changed = true;
      }
    }
  }

  merged.sort((a, b) => (a.urutanRapor || a.urutan || 0) - (b.urutanRapor || b.urutan || 0));

  if (changed) {
    saveLocalMapelList(merged);
  }

  // Jika terhubung ke Firestore, simpan/sync ke Firestore
  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(query(collection(db, 'mapel')));
      const existingFirestoreDocs = new Map(snap.docs.map((d) => [d.id, d.data()]));

      const batch = writeBatch(db);
      let firestoreChanged = false;

      for (const m of merged) {
        if (!existingFirestoreDocs.has(m.id)) {
          batch.set(doc(db, 'mapel', m.id), m);
          firestoreChanged = true;
        }
      }

      if (firestoreChanged) {
        await batch.commit();
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi mapel ke Firestore, fallback local:', err);
    }
  }

  return merged;
}

/**
 * Mengambil semua mata pelajaran untuk Admin (diurutkan berdasarkan urutanRapor).
 */
export async function getAllMapel(): Promise<Mapel[]> {
  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(query(collection(db, 'mapel'), orderBy('urutanRapor')));
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mapel));
        saveLocalMapelList(list);
        return list;
      }
    } catch (err) {
      console.warn('Gagal ambil mapel dari Firestore, membaca local:', err);
    }
  }

  // Fallback local + seed jika kosong
  return seedDefaultMapel();
}

/**
 * Mengambil daftar mapel yang aktif untuk sesi kelas tertentu berdasarkan fasenya.
 */
export function getMapelForSession(
  allMapel: Mapel[],
  session: { fase?: Fase; kelasId?: string; peran?: string }
): Mapel[] {
  if (!allMapel || !Array.isArray(allMapel)) return [];
  if (session.peran === 'admin') {
    return [...allMapel].sort(
      (a, b) => (a.urutanRapor || a.urutan || 0) - (b.urutanRapor || b.urutan || 0)
    );
  }

  const fase = session.fase || 'A';
  const kelasId = session.kelasId || '';

  return allMapel
    .filter((m) => {
      // Harus aktif secara global
      if (m.aktif === false) return false;

      // Filter fase
      if (m.faseBerlaku && Array.isArray(m.faseBerlaku) && m.faseBerlaku.length > 0) {
        if (!m.faseBerlaku.includes(fase)) return false;
      }

      // Filter apakah dinonaktifkan untuk kelas ini
      if (m.kelasNonaktif && Array.isArray(m.kelasNonaktif) && kelasId) {
        if (m.kelasNonaktif.includes(kelasId)) return false;
      }

      return true;
    })
    .sort((a, b) => (a.urutanRapor || a.urutan || 0) - (b.urutanRapor || b.urutan || 0));
}

/**
 * Mengambil daftar mapel relevan fase untuk dilihat Wali Kelas di halaman Intrakurikuler
 * (termasuk yang dinonaktifkan di kelasnya, agar bisa diaktifkan/dinonaktifkan kembali).
 */
export function getMapelForWaliKelasView(
  allMapel: Mapel[],
  fase: Fase
): Mapel[] {
  if (!allMapel || !Array.isArray(allMapel)) return [];

  return allMapel
    .filter((m) => {
      // Tetap harus aktif dari Admin
      if (m.aktif === false) return false;

      // Harus berlaku di fase kelas ini
      if (m.faseBerlaku && Array.isArray(m.faseBerlaku) && m.faseBerlaku.length > 0) {
        if (!m.faseBerlaku.includes(fase)) return false;
      }

      return true;
    })
    .sort((a, b) => (a.urutanRapor || a.urutan || 0) - (b.urutanRapor || b.urutan || 0));
}

/**
 * Wali kelas menonaktifkan/mengaktifkan mapel pilihan atau mulok di kelasnya.
 */
export async function toggleMapelKelas(
  mapelId: string,
  kelasId: string,
  aktifDiKelas: boolean
): Promise<Mapel[]> {
  const current = getLocalMapelList();
  const targetIndex = current.findIndex((m) => m.id === mapelId);
  if (targetIndex === -1) throw new Error('Mata pelajaran tidak ditemukan.');

  const target = { ...current[targetIndex] };

  // Hanya boleh untuk kelompok pilihan atau mulok
  if (target.kelompok === 'wajib' || target.kelompok === 'seni') {
    throw new Error('Mata pelajaran wajib tidak dapat dinonaktifkan.');
  }

  const nonaktifSet = new Set(target.kelasNonaktif || []);
  if (aktifDiKelas) {
    nonaktifSet.delete(kelasId);
  } else {
    nonaktifSet.add(kelasId);
  }

  target.kelasNonaktif = Array.from(nonaktifSet);
  target.updated_at = new Date().toISOString();
  current[targetIndex] = target;

  saveLocalMapelList(current);

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'mapel', mapelId), target, { merge: true });
    } catch (err) {
      console.warn('Gagal simpan toggle mapel kelas ke Firestore:', err);
    }
  }

  await catatLogAktivitas({
    uid: kelasId,
    nama: `Wali ${kelasId}`,
    peran: 'guru',
    aksi: 'Ubah Status Mapel Kelas',
    target: `${target.nama} (${aktifDiKelas ? 'Diaktifkan' : 'Dinonaktifkan'})`,
    kelasId,
  });

  return current;
}

/**
 * Tambah Mata Pelajaran baru (Admin).
 */
export async function tambahMapelAdmin(data: {
  kode: string;
  nama: string;
  kelompok: KelompokMapel;
  faseBerlaku: Fase[];
  urutanRapor: number;
  aktif?: boolean;
  varianAgama?: string[];
}): Promise<Mapel> {
  const cleanKode = data.kode.trim().toUpperCase();
  const cleanNama = data.nama.trim();

  if (!cleanKode) throw new Error('Kode mata pelajaran wajib diisi.');
  if (!cleanNama) throw new Error('Nama mata pelajaran wajib diisi.');
  if (!data.faseBerlaku || data.faseBerlaku.length === 0) {
    throw new Error('Pilih minimal satu fase yang berlaku (A, B, atau C).');
  }

  const current = getLocalMapelList();
  const duplikat = current.some(
    (m) => m.kode?.toUpperCase() === cleanKode || m.nama.toLowerCase() === cleanNama.toLowerCase()
  );
  if (duplikat) {
    throw new Error(`Mata pelajaran dengan kode "${cleanKode}" atau nama "${cleanNama}" sudah ada.`);
  }

  const id = `mapel_${cleanKode.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  const newMapel: Mapel = {
    id,
    kode: cleanKode,
    nama: cleanNama,
    kelompok: data.kelompok,
    faseBerlaku: data.faseBerlaku,
    urutanRapor: data.urutanRapor || current.length + 1,
    aktif: data.aktif !== false,
    varianAgama: data.varianAgama || [],
    singkatan: cleanKode,
    jenis: data.kelompok === 'mulok' ? 'mulok' : 'intra',
    urutan: data.urutanRapor || current.length + 1,
    created_at: now,
    updated_at: now,
  };

  current.push(newMapel);
  current.sort((a, b) => (a.urutanRapor || 0) - (b.urutanRapor || 0));
  saveLocalMapelList(current);

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'mapel', id), newMapel);
    } catch (err) {
      console.warn('Gagal simpan mapel baru ke Firestore:', err);
    }
  }

  await catatLogAktivitas({
    uid: 'admin',
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'Tambah Mata Pelajaran',
    target: `${newMapel.nama} (${newMapel.kode})`,
  });

  return newMapel;
}

/**
 * Update Mata Pelajaran (Admin).
 */
export async function updateMapelAdmin(
  id: string,
  patch: Partial<Mapel>
): Promise<Mapel> {
  const current = getLocalMapelList();
  const idx = current.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error('Mata pelajaran tidak ditemukan.');

  const updated: Mapel = {
    ...current[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (patch.kode) updated.kode = patch.kode.trim().toUpperCase();
  if (patch.nama) updated.nama = patch.nama.trim();

  current[idx] = updated;
  current.sort((a, b) => (a.urutanRapor || a.urutan || 0) - (b.urutanRapor || b.urutan || 0));
  saveLocalMapelList(current);

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, 'mapel', id), updated, { merge: true });
    } catch (err) {
      console.warn('Gagal update mapel di Firestore:', err);
    }
  }

  await catatLogAktivitas({
    uid: 'admin',
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'Ubah Mata Pelajaran',
    target: updated.nama,
  });

  return updated;
}

/**
 * Hapus Mata Pelajaran (Admin).
 */
export async function deleteMapelAdmin(id: string): Promise<void> {
  const current = getLocalMapelList();
  const target = current.find((m) => m.id === id);
  const filtered = current.filter((m) => m.id !== id);

  saveLocalMapelList(filtered);

  if (isFirebaseConfigured) {
    try {
      await deleteDoc(doc(db, 'mapel', id));
    } catch (err) {
      console.warn('Gagal hapus mapel dari Firestore:', err);
    }
  }

  if (target) {
    await catatLogAktivitas({
      uid: 'admin',
      nama: 'Administrator',
      peran: 'admin',
      aksi: 'Hapus Mata Pelajaran',
      target: target.nama,
    });
  }
}

