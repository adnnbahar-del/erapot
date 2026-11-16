export type Periode = 'JAN-JUN' | 'JUL-DES';

export const LABEL_PERIODE: Record<Periode, string> = {
  'JAN-JUN': 'Januari–Juni',
  'JUL-DES': 'Juli–Desember',
};

/** Periode bawaan dari tahun ajaran & semester login. */
export function periodeBawaan(tahunAjaran: string, semester: 1 | 2): { tahun: number; periode: Periode } {
  const [awal, akhir] = tahunAjaran.split('/').map(Number); // "2025/2026" → 2025, 2026
  return semester === 1 ? { tahun: awal, periode: 'JUL-DES' } : { tahun: akhir, periode: 'JAN-JUN' };
}

/** Teks untuk layar & PDF, contoh "JULI-DESEMBER 2025". */
export function teksPeriode(tahun: number, periode: Periode): string {
  return `${periode === 'JAN-JUN' ? 'JANUARI-JUNI' : 'JULI-DESEMBER'} ${tahun}`;
}

/** Periode sebelumnya, untuk tombol salin. */
export function periodeSebelumnya(tahun: number, periode: Periode): { tahun: number; periode: Periode } {
  return periode === 'JUL-DES' ? { tahun, periode: 'JAN-JUN' as Periode } : { tahun: tahun - 1, periode: 'JUL-DES' as Periode };
}

/** Daftar pilihan tahun: dari 2 tahun sebelum s.d. 1 tahun sesudah tahun ajaran aktif (contoh 2023-2027) */
export function daftarPilihanTahun(tahunAjaran: string): number[] {
  const [awal, akhir] = (tahunAjaran || '').split('/').map(Number);
  const start = !isNaN(awal) && awal > 0 ? awal : 2025;
  const end = !isNaN(akhir) && akhir > 0 ? akhir : start + 1;
  const minYear = start - 2;
  const maxYear = end + 1;
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    years.push(y);
  }
  return years;
}

/** Bulan romawi akhir periode untuk nomor surat (JUL-DES -> XII, JAN-JUN -> VI) */
export function bulanRomawiPeriode(periode: Periode): string {
  return periode === 'JUL-DES' ? 'XII' : 'VI';
}

/** Tanggal tanda tangan bawaan untuk periode */
export function tanggalTtdBawaan(tahun: number, periode: Periode): string {
  return periode === 'JUL-DES' ? `20 Desember ${tahun}` : `20 Juni ${tahun}`;
}

/** Cek kelengkapan seluruh 7 kebiasaan pada satu record */
export function isKaihLengkap(rec?: Partial<any> | null): boolean {
  if (!rec) return false;
  const fields = [
    rec.bangun_pagi,
    rec.beribadah,
    rec.berolahraga,
    rec.makan_sehat,
    rec.gemar_belajar,
    rec.bermasyarakat,
    rec.tidur_cepat,
  ];
  return fields.every((f) => typeof f === 'string' && f.trim() !== '');
}

/** Normalisasi data record KAIH (termasuk data lama/baru) ke { tahun, periode } */
export function normalisasiKaih(rec: any): { tahun: number; periode: Periode } {
  let tahun = Number(rec?.tahun);
  const rawPeriode = String(rec?.periode || '').trim().toUpperCase();
  let periode: Periode = 'JUL-DES';

  if (rawPeriode.includes('JAN')) {
    periode = 'JAN-JUN';
  } else if (rawPeriode.includes('JUL') || rawPeriode.includes('DES')) {
    periode = 'JUL-DES';
  }

  if (!tahun || isNaN(tahun)) {
    const match = rawPeriode.match(/\b(20\d\d)\b/);
    if (match) {
      tahun = parseInt(match[1], 10);
    } else {
      tahun = 2025;
    }
  }

  return { tahun, periode };
}
