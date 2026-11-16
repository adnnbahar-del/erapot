/**
 * Modul Logika Perhitungan dan Format E-Rapor SD (Kurikulum Merdeka)
 * Mengacu pada aturan formula Excel rapor Tim Kurikulum Disdikbud Tanggamus
 */

export const avg = (xs: (number | null | undefined)[]): number | null => {
  const v = xs.filter((x): x is number => typeof x === 'number' && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export const calcNALingkupMateri = (nilaiSumatifPerLM: (number | null | undefined)[]): number | null => {
  return avg(nilaiSumatifPerLM);
};

export const calcNAAkhirSemester = (pts: number | null | undefined, pas: number | null | undefined): number | null => {
  return avg([pts, pas]);
};

export const calcNilaiRaporRaw = (naLM: number | null | undefined, naAkhir: number | null | undefined): number | null => {
  return avg([naLM, naAkhir]);
};

export const calcNilaiRapor = (naLM: number | null | undefined, naAkhir: number | null | undefined): number | null => {
  const raw = calcNilaiRaporRaw(naLM, naAkhir);
  return raw !== null ? Math.round(raw) : null;
};

/**
 * Format angka rata-rata dengan 2 desimal dan koma, contoh: 85.2222 -> "85,22"
 */
export const formatRataRata = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return val.toFixed(2).replace('.', ',');
};

/**
 * Ubah teks menjadi Proper Case (Huruf Kapital di Awal Tiap Kata)
 * Contoh: "SITI AMINAH" -> "Siti Aminah"
 */
export const toProperCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/(?:^|\s|\/|-|\.)\S/g, (match) => match.toUpperCase())
    .trim();
};

/**
 * Membersihkan spasi ganda, spasi sebelum koma/titik, dan merapikan tanda baca.
 */
export const cleanText = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
};

export interface TPItem {
  deskripsi: string;
  kktp: 0 | 1;
  tampil: 0 | 1;
}

export interface DeskripsiCapaian {
  tercapaiText: string;
  perluBimbinganText: string;
  fullText: string;
}

/**
 * Buat deskripsi capaian kompetensi per mapel per siswa
 * - TP dengan Tampil = 1 dan KKTP = 1 -> "{Nama Proper Case} menunjukkan pemahaman dalam {TP1}, {TP2}, … ."
 * - TP dengan Tampil = 1 dan KKTP = 0 -> "{Nama Proper Case} membutuhkan bimbingan dalam {TPx}, … ."
 * - TP dengan Tampil = 0 tidak dicetak.
 * - Jika salah satu kelompok kosong, kalimat itu tidak dicetak.
 */
export const generateDeskripsiKompetensi = (
  namaSiswa: string,
  tps: TPItem[]
): DeskripsiCapaian => {
  const properName = toProperCase(namaSiswa);
  const activeTPs = tps.filter((tp) => tp.tampil === 1);

  const tercapaiList = activeTPs
    .filter((tp) => tp.kktp === 1)
    .map((tp) => cleanText(tp.deskripsi).replace(/[.,]$/, ''));

  const perluBimbinganList = activeTPs
    .filter((tp) => tp.kktp === 0)
    .map((tp) => cleanText(tp.deskripsi).replace(/[.,]$/, ''));

  let tercapaiText = '';
  if (tercapaiList.length > 0) {
    tercapaiText = `${properName} menunjukkan pemahaman dalam ${tercapaiList.join(', ')}.`;
    tercapaiText = cleanText(tercapaiText);
    if (!tercapaiText.endsWith('.')) tercapaiText += '.';
  }

  let perluBimbinganText = '';
  if (perluBimbinganList.length > 0) {
    perluBimbinganText = `${properName} membutuhkan bimbingan dalam ${perluBimbinganList.join(', ')}.`;
    perluBimbinganText = cleanText(perluBimbinganText);
    if (!perluBimbinganText.endsWith('.')) perluBimbinganText += '.';
  }

  const parts = [tercapaiText, perluBimbinganText].filter(Boolean);
  const fullText = parts.join(' ');

  return {
    tercapaiText,
    perluBimbinganText,
    fullText,
  };
};

export interface SiswaRekapInput {
  id: string;
  nama: string;
  nilaiMapel: (number | null)[];
}

export interface SiswaRekapOutput {
  id: string;
  nama: string;
  jumlah: number | null;
  rataRata: number | null;
  rataRataFormatted: string;
  peringkat: number | null;
  prestasiAkademikText: string;
}

/**
 * Hitung Peringkat dan Rekap Nilai Siswa
 * Menggunakan standard competition ranking (1, 2, 2, 4)
 */
export const calculateRekapDanPeringkat = (
  siswaList: SiswaRekapInput[],
  totalMapel: number
): SiswaRekapOutput[] => {
  const totalSiswa = siswaList.length;

  const intermediate = siswaList.map((s) => {
    const validScores = s.nilaiMapel.filter((n): n is number => typeof n === 'number' && !isNaN(n));
    const sum = validScores.length ? validScores.reduce((a, b) => a + b, 0) : null;
    const avgScore = sum !== null && totalMapel > 0 ? sum / totalMapel : null;

    return {
      id: s.id,
      nama: s.nama,
      jumlah: sum,
      rataRata: avgScore,
      rataRataFormatted: formatRataRata(avgScore),
      originalIndex: 0,
    };
  });

  // Urutkan menurun berdasarkan jumlah nilai
  const sorted = [...intermediate].sort((a, b) => {
    if (a.jumlah === null && b.jumlah === null) return 0;
    if (a.jumlah === null) return 1;
    if (b.jumlah === null) return -1;
    return b.jumlah - a.jumlah;
  });

  // Assign peringkat
  const rankMap = new Map<string, number | null>();
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (current.jumlah === null) {
      rankMap.set(current.id, null);
      continue;
    }

    if (i > 0 && sorted[i - 1].jumlah === current.jumlah) {
      rankMap.set(current.id, rankMap.get(sorted[i - 1].id) ?? currentRank);
    } else {
      currentRank = i + 1;
      rankMap.set(current.id, currentRank);
    }
  }

  return intermediate.map((item) => {
    const rank = rankMap.get(item.id) ?? null;
    let prestasiAkademikText = '-';

    if (rank !== null && item.jumlah !== null && item.rataRata !== null) {
      prestasiAkademikText = `Peringkat ke-${rank} dari ${totalSiswa} siswa dengan jumlah nilai ${item.jumlah} dan rata-rata ${item.rataRataFormatted}`;
    }

    return {
      id: item.id,
      nama: item.nama,
      jumlah: item.jumlah,
      rataRata: item.rataRata,
      rataRataFormatted: item.rataRataFormatted,
      peringkat: rank,
      prestasiAkademikText,
    };
  });
};

/**
 * Deskripsi otomatis Kokurikuler
 */
export const generateDeskripsiKokurikuler = (
  namaSiswa: string,
  dplKuat: string,
  dplPenguatan: string,
  tema: string
): string => {
  if (!dplKuat && !dplPenguatan && !tema) return '';
  return `Ananda ${toProperCase(namaSiswa)} sudah kuat dalam dimensi ${dplKuat} dan perlu penguatan dalam ${dplPenguatan} pada tema ${tema}`;
};
