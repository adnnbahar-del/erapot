/**
 * Logika Kokurikuler (Projek Penguatan Profil Pelajar Pancasila / P5)
 * E-Rapor SD Kurikulum Merdeka
 */

import { TemaKokurikuler, PenilaianKokurikuler, Siswa } from '../types';

export const DPL = [
  'Keimanan dan Ketakwaan',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi',
] as const;

export type DPLType = (typeof DPL)[number];

/**
 * Format deskripsi otomatis kokurikuler:
 * Ananda {NAMA} sudah kuat dalam dimensi {DPL kuat} dan perlu penguatan dalam {DPL penguatan} pada tema {Nama Tema}.
 * {NAMA} ditulis seperti di Data Siswa (huruf kapital/asli) sama dengan Excel.
 */
export function deskripsiOtomatis(nama: string, kuat: string, penguatan: string, tema: string): string {
  if (!kuat || !penguatan || !tema) return '';
  return `Ananda ${nama} sudah kuat dalam dimensi ${kuat} dan perlu penguatan dalam ${penguatan} pada tema ${tema}.`;
}

/**
 * Baris kokurikuler yang dicetak di rapor untuk satu siswa:
 * 1. Ambil tema dengan tampil_di_rapor = true / 'TRUE', urut berdasarkan urutan
 * 2. Untuk tiap tema, cari penilaian siswa itu
 * 3. Lewati jika dpl_kuat atau dpl_penguatan kosong
 * 4. Deskripsi = deskripsi_manual (jika terisi & non-empty) atau deskripsiOtomatis(...)
 */
export function kokurikulerRapor(
  siswa: Pick<Siswa, 'id' | 'nama'>,
  temaList: Pick<TemaKokurikuler, 'id' | 'nama' | 'urutan' | 'tampil_di_rapor'>[],
  penilaianList: Pick<PenilaianKokurikuler, 'tema_id' | 'siswa_id' | 'dpl_kuat' | 'dpl_penguatan' | 'deskripsi_manual'>[]
): { tema: string; deskripsi: string }[] {
  if (!siswa || !temaList || !penilaianList) return [];

  // Filter tema yang tampil di rapor dan urutkan
  const activeThemes = temaList
    .filter((t) => t.tampil_di_rapor === true || String(t.tampil_di_rapor).toUpperCase() === 'TRUE')
    .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

  const results: { tema: string; deskripsi: string }[] = [];

  for (const tema of activeThemes) {
    const pen = penilaianList.find((p) => p.tema_id === tema.id && p.siswa_id === siswa.id);
    if (!pen) continue;

    const kuat = (pen.dpl_kuat || '').trim();
    const penguatan = (pen.dpl_penguatan || '').trim();

    // Lewati jika dpl_kuat atau dpl_penguatan kosong
    if (!kuat || !penguatan) continue;

    const manualDesc = (pen.deskripsi_manual || '').trim();
    const finalDesc = manualDesc ? manualDesc : deskripsiOtomatis(siswa.nama, kuat, penguatan, tema.nama);

    results.push({
      tema: tema.nama,
      deskripsi: finalDesc,
    });
  }

  return results;
}
