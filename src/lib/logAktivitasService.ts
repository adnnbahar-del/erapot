// src/lib/logAktivitasService.ts
// Layanan Log Aktivitas Pengguna (Tahap 6 & Tahap 2 Refined)
// Koleksi Firestore: `logAktivitas`
//   { id, waktu, uid, nama, peran, aksi, target, nilaiLama?, nilaiBaru? }

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export interface LogAktivitasItem {
  id: string;
  waktu: string;             // ISO String
  uid: string;
  nama: string;
  peran: string;             // "admin" | "wali_kelas" | "guru_mapel" | "guru"
  aksi: string;              // "Ubah Nilai", "Finalisasi Rapor", "Buka Kunci", "Reset Password", "Tutup Tahun Ajaran", dll.
  target: string;            // misal "Siswa: Ahmad / Mapel: Matematika", "Kelas 1A", "Akun: Budi"
  nilaiLama?: string | null;
  nilaiBaru?: string | null;
  kelasId?: string | null;
}

const LOCAL_STORAGE_LOG_KEY = 'erapot_log_aktivitas_v1';
const MAX_LOCAL_LOGS = 200;

function getLocalLogs(): LogAktivitasItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLogs(list: LogAktivitasItem[]) {
  try {
    const trimmed = list.slice(0, MAX_LOCAL_LOGS);
    localStorage.setItem(LOCAL_STORAGE_LOG_KEY, JSON.stringify(trimmed));
  } catch {}
}

/**
 * Menghapus atau mengubah semua nilai undefined menjadi null sebelum dikirim ke Firestore.
 */
function bersihkanUndefinedField<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    } else {
      clean[key] = null;
    }
  }
  return clean;
}

// ─── Debounce Window 10 Detik untuk Penggabungan Perubahan Beruntun ───────────

interface PendingLogBuffer {
  timer: any;
  item: LogAktivitasItem;
}

const pendingLogsMap = new Map<string, PendingLogBuffer>();

async function commitLogItemToFirestore(item: LogAktivitasItem): Promise<boolean> {
  if (!isFirebaseConfigured) return false;
  try {
    const cleanItem = bersihkanUndefinedField(item);
    await setDoc(doc(db, 'logAktivitas', item.id), cleanItem, { merge: true });
    return true;
  } catch (err) {
    console.warn('Gagal mencatat log ke Firestore, simpan lokal:', err);
    return false;
  }
}

/**
 * Mencatat log aktivitas.
 * Karakteristik:
 * 1. Fire-and-forget (tidak pernah melempar error ke UI).
 * 2. Hanya mencatat jika ada perubahan (nilaiLama !== nilaiBaru).
 * 3. Menggabungkan perubahan beruntun pada kolom/target yang sama dalam jendela 10 detik menjadi 1 entri.
 * 4. Menyimpan ke fallback lokal maksimal 200 entri dan membersihkan entri usang.
 */
export async function catatLogAktivitas(entry: {
  uid?: string;
  nama: string;
  peran: string;
  aksi: string;
  target: string;
  nilaiLama?: string | null;
  nilaiBaru?: string | null;
  kelasId?: string | null;
}): Promise<void> {
  try {
    // 1. Abaikan jika nilaiLama dan nilaiBaru sama persis (tidak ada perubahan nyata)
    if (
      entry.nilaiLama !== undefined &&
      entry.nilaiBaru !== undefined &&
      entry.nilaiLama !== null &&
      entry.nilaiBaru !== null &&
      String(entry.nilaiLama).trim() === String(entry.nilaiBaru).trim()
    ) {
      return;
    }

    const key = `${entry.uid || 'anon'}_${entry.aksi}_${entry.target}`;
    const now = new Date().toISOString();

    // 2. Cek apakah ada log serupa dalam jendela 10 detik
    const existing = pendingLogsMap.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      // Perbarui nilaiBaru dengan yang terbaru, pertahankan nilaiLama awal
      existing.item.nilaiBaru = entry.nilaiBaru ?? null;
      existing.item.waktu = now;

      existing.timer = setTimeout(async () => {
        pendingLogsMap.delete(key);
        const savedToFirestore = await commitLogItemToFirestore(existing.item);
        simpanKeFallbackLokal(existing.item, savedToFirestore);
      }, 10000);
      return;
    }

    const id = 'log_' + Math.random().toString(36).substring(2) + '_' + Date.now();
    const item: LogAktivitasItem = {
      id,
      waktu: now,
      uid: entry.uid || 'anon',
      nama: entry.nama || 'Pengguna',
      peran: entry.peran || 'guru',
      aksi: entry.aksi,
      target: entry.target,
      nilaiLama: entry.nilaiLama ?? null,
      nilaiBaru: entry.nilaiBaru ?? null,
      kelasId: entry.kelasId ?? null,
    };

    // Aksi diskrit / satu kali (seperti Finalisasi, Hapus, Tambah Rombel, dsb.) langsung disimpan seketika
    const isContinuousAction =
      entry.aksi === 'UBAH_NILAI' ||
      entry.aksi === 'UBAH_CATATAN' ||
      entry.aksi === 'UBAH_NILAI_FORMATIF' ||
      entry.aksi === 'UBAH_EKSKUL' ||
      entry.aksi === 'KAIH_CHECK' ||
      entry.aksi === 'KAIH_CATATAN';

    if (!isContinuousAction) {
      const saved = await commitLogItemToFirestore(item);
      simpanKeFallbackLokal(item, saved);
      return;
    }

    // Untuk continuous action: catat ke fallback lokal segera
    simpanKeFallbackLokal(item, false);

    // Jadwalkan commit ke Firestore setelah jendela 10 detik agar perubahan beruntun digabung
    const timer = setTimeout(async () => {
      pendingLogsMap.delete(key);
      const savedToFirestore = await commitLogItemToFirestore(item);
      if (savedToFirestore) {
        tandaiTersinkronLokal(item.id);
      }
    }, 10000);

    pendingLogsMap.set(key, { timer, item });
  } catch (e) {
    // Fire-and-forget: cegah semua unhandled error
    console.warn('[Logger] Kesalahan fire-and-forget catatLogAktivitas:', e);
  }
}

/**
 * Catat log langsung tanpa debounce (untuk aksi sekali seperti Hapus, Tambah Kelas, Kunci Nilai)
 */
export async function catatLogAktivitasInstant(entry: {
  uid?: string;
  nama: string;
  peran: string;
  aksi: string;
  target: string;
  nilaiLama?: string | null;
  nilaiBaru?: string | null;
  kelasId?: string | null;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    const id = 'log_' + Math.random().toString(36).substring(2) + '_' + Date.now();
    const item: LogAktivitasItem = {
      id,
      waktu: now,
      uid: entry.uid || 'anon',
      nama: entry.nama || 'Pengguna',
      peran: entry.peran || 'guru',
      aksi: entry.aksi,
      target: entry.target,
      nilaiLama: entry.nilaiLama ?? null,
      nilaiBaru: entry.nilaiBaru ?? null,
      kelasId: entry.kelasId ?? null,
    };

    const saved = await commitLogItemToFirestore(item);
    simpanKeFallbackLokal(item, saved);
  } catch (e) {
    console.warn('[Logger] Gagal catatLogAktivitasInstant:', e);
  }
}

function simpanKeFallbackLokal(item: LogAktivitasItem, isSavedToCloud: boolean) {
  try {
    const logs = getLocalLogs();
    // Jika item sudah ada, perbarui
    const existingIdx = logs.findIndex((l) => l.id === item.id);
    const logItemWithStatus = {
      ...item,
      _synced: isSavedToCloud,
    };
    if (existingIdx >= 0) {
      logs[existingIdx] = logItemWithStatus as any;
    } else {
      logs.unshift(logItemWithStatus as any);
    }
    saveLocalLogs(logs);
  } catch {}
}

function tandaiTersinkronLokal(id: string) {
  try {
    const logs = getLocalLogs();
    const item = logs.find((l: any) => l.id === id);
    if (item) {
      (item as any)._synced = true;
      saveLocalLogs(logs);
    }
  } catch {}
}

/**
 * Kirim ulang entri log yang belum tersinkron saat aplikasi online.
 * Entri yang sudah terkirim dihapus dari lokal.
 */
let isSyncingLogs = false;
export async function syncLocalLogsToFirestore(): Promise<void> {
  if (!isFirebaseConfigured || isSyncingLogs) return;
  isSyncingLogs = true;
  try {
    const logs = getLocalLogs();
    const unsynced = logs.filter((l: any) => l._synced !== true);
    if (unsynced.length === 0) return;

    for (const item of unsynced) {
      try {
        const clean = bersihkanUndefinedField({
          id: item.id,
          waktu: item.waktu,
          uid: item.uid,
          nama: item.nama,
          peran: item.peran,
          aksi: item.aksi,
          target: item.target,
          nilaiLama: item.nilaiLama ?? null,
          nilaiBaru: item.nilaiBaru ?? null,
          kelasId: item.kelasId ?? null,
        });
        await setDoc(doc(db, 'logAktivitas', item.id), clean, { merge: true });
        (item as any)._synced = true;
      } catch {
        break; // Berhenti jika offline
      }
    }

    // Buang entri yang sudah sukses terkirim dari lokal
    const remaining = logs.filter((l: any) => l._synced !== true);
    saveLocalLogs(remaining);
  } catch {
  } finally {
    isSyncingLogs = false;
  }
}

/** Mengambil riwayat log aktivitas dengan opsi filter */
export async function getLogAktivitas(filter?: {
  tanggal?: string; // YYYY-MM-DD
  kelasId?: string;
  namaUser?: string;
}): Promise<LogAktivitasItem[]> {
  let list: LogAktivitasItem[] = [];

  if (isFirebaseConfigured) {
    try {
      const snap = await getDocs(
        query(collection(db, 'logAktivitas'), orderBy('waktu', 'desc'), limit(300))
      );
      list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LogAktivitasItem));
    } catch (err) {
      console.warn('Gagal ambil log dari Firestore, gunakan lokal:', err);
      list = getLocalLogs();
    }
  } else {
    list = getLocalLogs();
  }

  return list.filter((item) => {
    if (filter?.tanggal && !item.waktu.startsWith(filter.tanggal)) {
      return false;
    }
    if (filter?.kelasId && filter.kelasId !== 'all') {
      if (item.kelasId && item.kelasId !== filter.kelasId && !item.target.includes(filter.kelasId)) {
        return false;
      }
    }
    if (filter?.namaUser && filter.namaUser !== 'all') {
      if (item.nama.toLowerCase() !== filter.namaUser.toLowerCase()) {
        return false;
      }
    }
    return true;
  });
}

