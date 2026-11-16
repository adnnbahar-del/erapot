// src/lib/tutupTahunService.ts
// Layanan Tutup Tahun Ajaran & Kenaikan Kelas (Tahap 5)
// - Cek finalisasi seluruh kelas
// - Pemetaan kelas tujuan (default 1A -> 2A, 6A -> LULUS)
// - Status per siswa (Naik, Tinggal Kelas, Lulus, Mutasi Keluar)
// - Eksekusi atomik batch di Firestore & update state lokal

import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { getAllStatusFinalisasi } from './kunciNilaiService';
import { getAllTahunAjaran, setTahunAjaranAktif, tambahTahunAjaran } from './tahunAjaranService';
import { catatLogAktivitas } from './logAktivitasService';
import type { Siswa, KelasSiswa, Rombel, Kelas } from '../types';

export type StatusKenaikan = 'Naik' | 'Tinggal Kelas' | 'Lulus' | 'Mutasi Keluar';

export interface PemetaanKelas {
  kelasAsalId: string;
  kelasAsalNama: string;
  tingkatAsal: number;
  kelasTujuanId: string; // ID kelas tujuan atau 'LULUS'
  kelasTujuanNama: string;
}

export interface SiswaKenaikanItem {
  siswaId: string;
  nama: string;
  nis: string;
  nisn: string;
  kelasAsalId: string;
  kelasAsalNama: string;
  status: StatusKenaikan;
  kelasTujuanId: string;
}

export interface CekFinalisasiResult {
  semuaFinal: boolean;
  kelasBelumFinal: { id: string; nama: string; nama_wali?: string }[];
  totalKelas: number;
}

/** Menghitung string tahun ajaran berikutnya, misal "2025/2026" -> "2026/2027" */
export function getTahunAjaranBerikutnya(tahunSekarang: string): string {
  const parts = tahunSekarang.split('/');
  if (parts.length === 2) {
    const y1 = parseInt(parts[0], 10);
    const y2 = parseInt(parts[1], 10);
    if (!isNaN(y1) && !isNaN(y2)) {
      return `${y1 + 1}/${y2 + 1}`;
    }
  }
  const now = new Date().getFullYear();
  return `${now}/${now + 1}`;
}

/** Cek apakah seluruh kelas pada semester aktif telah difinalkan */
export async function cekStatusFinalisasiSemuaKelas(
  tahunAjaranId: string,
  kelasList: (Rombel | Kelas)[]
): Promise<CekFinalisasiResult> {
  const finalMap = await getAllStatusFinalisasi(tahunAjaranId);

  const kelasBelumFinal: { id: string; nama: string; nama_wali?: string }[] = [];

  const activeClasses = kelasList.filter((k) => k.aktif !== false);

  activeClasses.forEach((k: any) => {
    const fin = finalMap[k.id];
    if (!fin || fin.status !== 'final') {
      kelasBelumFinal.push({
        id: k.id,
        nama: k.nama || k.tingkat,
        nama_wali: k.nama_wali,
      });
    }
  });

  return {
    semuaFinal: kelasBelumFinal.length === 0,
    kelasBelumFinal,
    totalKelas: activeClasses.length,
  };
}

/** Generate default mapping kelas (misal 1A -> 2A, 1B -> 2B, 6A -> LULUS) */
export function generateDefaultPemetaanKelas(
  kelasList: (Rombel | Kelas)[]
): PemetaanKelas[] {
  const activeClasses = kelasList.filter((k) => k.aktif !== false);

  return activeClasses.map((k: any) => {
    const t = k.angka || k.tingkat_angka || parseInt(String(k.nama || k.tingkat).replace(/\D/g, ''), 10) || 1;
    const h = k.huruf || String(k.nama || '').replace(/\d/g, '').toUpperCase();
    const namaAsal = k.nama || `${t}${h}`;

    if (t >= 6) {
      return {
        kelasAsalId: k.id,
        kelasAsalNama: namaAsal,
        tingkatAsal: t,
        kelasTujuanId: 'LULUS',
        kelasTujuanNama: 'LULUS (Tamat Sekolah)',
      };
    }

    const nextTingkat = t + 1;
    const targetNama = h ? `${nextTingkat}${h}` : String(nextTingkat);
    const targetMatch = activeClasses.find((other: any) => {
      const oT = other.angka || other.tingkat_angka || parseInt(String(other.nama || other.tingkat).replace(/\D/g, ''), 10);
      const oH = other.huruf || String(other.nama || '').replace(/\d/g, '').toUpperCase();
      return oT === nextTingkat && oH === h;
    });

    return {
      kelasAsalId: k.id,
      kelasAsalNama: namaAsal,
      tingkatAsal: t,
      kelasTujuanId: targetMatch ? targetMatch.id : `kelas_${nextTingkat}${h.toLowerCase()}`,
      kelasTujuanNama: targetMatch ? (targetMatch.nama || targetNama) : `Kelas ${targetNama}`,
    };
  });
}

/** Generate status default per siswa */
export function generateDefaultSiswaKenaikan(
  siswaList: Siswa[],
  kelasSiswaList: KelasSiswa[],
  pemetaanKelas: PemetaanKelas[]
): SiswaKenaikanItem[] {
  const result: SiswaKenaikanItem[] = [];

  for (const pem of pemetaanKelas) {
    const siswaInClass = kelasSiswaList
      .filter((ks) => ks.kelas_id === pem.kelasAsalId || ks.rombel_id === pem.kelasAsalId)
      .map((ks) => {
        const s = siswaList.find((item) => item.id === ks.siswa_id);
        return {
          siswa: s,
          kelasSiswa: ks,
        };
      })
      .filter((item): item is { siswa: Siswa; kelasSiswa: KelasSiswa } => Boolean(item.siswa));

    for (const item of siswaInClass) {
      const isKelas6 = pem.tingkatAsal >= 6;
      const defaultStatus: StatusKenaikan = isKelas6 ? 'Lulus' : 'Naik';
      const targetKelas = defaultStatus === 'Lulus' ? 'LULUS' : pem.kelasTujuanId;

      result.push({
        siswaId: item.siswa.id,
        nama: item.siswa.nama,
        nis: item.siswa.nis,
        nisn: item.siswa.nisn,
        kelasAsalId: pem.kelasAsalId,
        kelasAsalNama: pem.kelasAsalNama,
        status: defaultStatus,
        kelasTujuanId: targetKelas,
      });
    }
  }

  return result;
}

/** Eksekusi Tutup Tahun Ajaran dan Kenaikan Kelas */
export async function eksekusiTutupTahunAjaran(input: {
  tahunAjaranSekarangId: string;
  tahunAjaranSekarang: string;
  semesterSekarang: 1 | 2 | 'Ganjil' | 'Genap';
  pemetaanKelas: PemetaanKelas[];
  siswaKenaikan: SiswaKenaikanItem[];
}): Promise<{
  tahunAjaranBaruId: string;
  tahunAjaranBaru: string;
  ringkasan: {
    totalNaik: number;
    totalTinggal: number;
    totalLulus: number;
    totalMutasi: number;
  };
}> {
  const tahunBaru = getTahunAjaranBerikutnya(input.tahunAjaranSekarang);
  const now = new Date().toISOString();

  let totalNaik = 0;
  let totalTinggal = 0;
  let totalLulus = 0;
  let totalMutasi = 0;

  input.siswaKenaikan.forEach((s) => {
    if (s.status === 'Naik') totalNaik++;
    else if (s.status === 'Tinggal Kelas') totalTinggal++;
    else if (s.status === 'Lulus') totalLulus++;
    else if (s.status === 'Mutasi Keluar') totalMutasi++;
  });

  // 1. Buat tahun ajaran baru semester Ganjil dan jadikan aktif
  const newTA = await tambahTahunAjaran({
    tahun: tahunBaru,
    semester: 'Ganjil',
    aktif: true,
  });

  // 2. Tutup tahun ajaran yang lama di Firestore / localStorage
  const { updateStatusTahunAjaran } = await import('./tahunAjaranService');
  await updateStatusTahunAjaran(input.tahunAjaranSekarangId, 'ditutup');

  // 3. Update siswa & kelasSiswa di Firestore jika terhubung
  if (isFirebaseConfigured) {
    try {
      const batch = writeBatch(db);

      for (const item of input.siswaKenaikan) {
        const sRef = doc(db, 'siswa', item.siswaId);
        if (item.status === 'Lulus') {
          batch.update(sRef, {
            status_kelulusan: 'Lulus',
            tahun_lulus: input.tahunAjaranSekarang,
            tanggal_kelulusan: now,
            updated_at: now,
          });
        } else if (item.status === 'Mutasi Keluar') {
          batch.update(sRef, {
            status_mutasi: 'Keluar',
            tanggal_mutasi: now,
            updated_at: now,
          });
        } else {
          // Naik atau Tinggal Kelas: tetapkan kelas baru untuk tahun ajaran baru
          const destClass = item.status === 'Naik' ? item.kelasTujuanId : item.kelasAsalId;
          batch.update(sRef, {
            kelasId: destClass,
            tahunAjaranId: newTA.id,
            updated_at: now,
          });
        }
      }

      await batch.commit();
    } catch (err) {
      console.warn('Gagal commit batch siswa Firestore, fallback lokal:', err);
    }
  }

  // 4. Update data lokal di localStorage (erapot_data)
  try {
    const rawData = localStorage.getItem('erapot_data');
    if (rawData) {
      const appData = JSON.parse(rawData);

      if (Array.isArray(appData.siswa)) {
        appData.siswa.forEach((s: any) => {
          const match = input.siswaKenaikan.find((item) => item.siswaId === s.id);
          if (match) {
            if (match.status === 'Lulus') {
              s.status_kelulusan = 'Lulus';
              s.tahun_lulus = input.tahunAjaranSekarang;
            } else if (match.status === 'Mutasi Keluar') {
              s.status_mutasi = 'Keluar';
            }
          }
        });
      }

      if (Array.isArray(appData.kelasSiswa)) {
        // Tambahkan roster baru untuk tahun ajaran baru bagi siswa yang naik / tinggal kelas
        const newRoster: KelasSiswa[] = [];

        input.siswaKenaikan.forEach((item, idx) => {
          if (item.status === 'Naik' || item.status === 'Tinggal Kelas') {
            const targetClass = item.status === 'Naik' ? item.kelasTujuanId : item.kelasAsalId;
            newRoster.push({
              id: `ks_${newTA.id}_${item.siswaId}`,
              siswa_id: item.siswaId,
              kelas_id: targetClass,
              rombel_id: targetClass,
              tahun_ajaran_id: newTA.id,
              no_urut: idx + 1,
              aktif: true,
              created_at: now,
              updated_at: now,
            });
          }
        });

        appData.kelasSiswa = [...appData.kelasSiswa, ...newRoster];
      }

      appData.activeTahunAjaranId = newTA.id;
      localStorage.setItem('erapot_data', JSON.stringify(appData));
    }
  } catch (err) {
    console.warn('Gagal perbarui data lokal erapot_data:', err);
  }

  catatLogAktivitas({
    nama: 'Administrator',
    peran: 'admin',
    aksi: 'Tutup Tahun Ajaran',
    target: `${input.tahunAjaranSekarang} Semester ${input.semesterSekarang}`,
    nilaiBaru: `Tutup ${input.tahunAjaranSekarang} → Buka ${tahunBaru} Ganjil (${totalNaik} naik, ${totalLulus} lulus)`,
  });

  return {
    tahunAjaranBaruId: newTA.id,
    tahunAjaranBaru: tahunBaru,
    ringkasan: {
      totalNaik,
      totalTinggal,
      totalLulus,
      totalMutasi,
    },
  };
}
