import { describe, it, expect } from 'vitest';
import {
  periodeBawaan,
  teksPeriode,
  periodeSebelumnya,
  daftarPilihanTahun,
  bulanRomawiPeriode,
  tanggalTtdBawaan,
  isKaihLengkap,
  normalisasiKaih,
} from './kaih';

describe('Logika 7 KAIH (src/lib/kaih.ts)', () => {
  it('menghitung periode bawaan dengan benar untuk Ganjil dan Genap', () => {
    expect(periodeBawaan('2025/2026', 1)).toEqual({ tahun: 2025, periode: 'JUL-DES' });
    expect(periodeBawaan('2025/2026', 2)).toEqual({ tahun: 2026, periode: 'JAN-JUN' });
  });

  it('memformat teks periode untuk layar dan PDF', () => {
    expect(teksPeriode(2025, 'JUL-DES')).toBe('JULI-DESEMBER 2025');
    expect(teksPeriode(2026, 'JAN-JUN')).toBe('JANUARI-JUNI 2026');
  });

  it('menghitung periode sebelumnya dengan benar untuk tombol salin', () => {
    expect(periodeSebelumnya(2026, 'JAN-JUN')).toEqual({ tahun: 2025, periode: 'JUL-DES' });
    expect(periodeSebelumnya(2025, 'JUL-DES')).toEqual({ tahun: 2025, periode: 'JAN-JUN' });
  });

  it('menghasilkan rentang pilihan tahun 2 tahun sebelum s.d. 1 tahun sesudah TA', () => {
    const years = daftarPilihanTahun('2025/2026');
    expect(years).toEqual([2023, 2024, 2025, 2026, 2027]);
  });

  it('menghasilkan bulan romawi dan tanggal ttd bawaan sesuai periode', () => {
    expect(bulanRomawiPeriode('JUL-DES')).toBe('XII');
    expect(bulanRomawiPeriode('JAN-JUN')).toBe('VI');
    expect(tanggalTtdBawaan(2025, 'JUL-DES')).toBe('20 Desember 2025');
    expect(tanggalTtdBawaan(2026, 'JAN-JUN')).toBe('20 Juni 2026');
  });

  it('memeriksa kelengkapan 7 kebiasaan', () => {
    const lengkap = {
      bangun_pagi: 'Sudah Terbiasa',
      beribadah: 'Sudah Terbiasa',
      berolahraga: 'Mulai Terbiasa',
      makan_sehat: 'Sudah Terbiasa',
      gemar_belajar: 'Mulai Terbiasa',
      bermasyarakat: 'Sudah Terbiasa',
      tidur_cepat: 'Sudah Terbiasa',
    };
    expect(isKaihLengkap(lengkap)).toBe(true);

    const tidakLengkap = {
      ...lengkap,
      tidur_cepat: '',
    };
    expect(isKaihLengkap(tidakLengkap)).toBe(false);
    expect(isKaihLengkap(null)).toBe(false);
  });

  it('menormalisasi record lama (format string periode) ke format tahun + periode', () => {
    const legacyRec = {
      siswa_id: 'sis_1',
      periode: 'JULI-DESEMBER 2025',
    };
    expect(normalisasiKaih(legacyRec)).toEqual({ tahun: 2025, periode: 'JUL-DES' });

    const legacyRecJan = {
      siswa_id: 'sis_2',
      periode: 'JANUARI-JUNI 2026',
    };
    expect(normalisasiKaih(legacyRecJan)).toEqual({ tahun: 2026, periode: 'JAN-JUN' });
  });
});
