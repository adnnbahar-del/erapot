import { describe, it, expect } from 'vitest';
import {
  avg,
  calcNALingkupMateri,
  calcNAAkhirSemester,
  calcNilaiRapor,
  formatRataRata,
  toProperCase,
  cleanText,
  generateDeskripsiKompetensi,
  calculateRekapDanPeringkat,
  generateDeskripsiKokurikuler,
} from './rapor';

describe('rapor.ts - Logika Perhitungan dan Format Rapor SD', () => {
  it('avg() mengabaikan nilai null, undefined, dan NaN layaknya AVERAGE di Excel', () => {
    expect(avg([80, 90])).toBe(85);
    expect(avg([80, null, 90, undefined])).toBe(85);
    expect(avg([null, undefined])).toBeNull();
    expect(avg([])).toBeNull();
  });

  it('calcNilaiRapor() menghitung rata-rata sumatif LM dan akhir semester dengan pembulatan bulat', () => {
    // Sesuai spesifikasi prompt:
    // sumatif LM [80, 90] + PTS 85 + PAS 75 -> nilai rapor 83 (avg(85, 80) = 82,5 dibulatkan ke 83)
    const naLM = calcNALingkupMateri([80, 90]);
    expect(naLM).toBe(85);

    const naAkhir = calcNAAkhirSemester(85, 75);
    expect(naAkhir).toBe(80);

    const nilaiRapor = calcNilaiRapor(naLM, naAkhir);
    expect(nilaiRapor).toBe(83);
  });

  it('toProperCase() mengubah huruf kapital menjadi huruf awal besar yang rapi', () => {
    expect(toProperCase('SITI AMINAH')).toBe('Siti Aminah');
    expect(toProperCase('adnan bahar')).toBe('Adnan Bahar');
  });

  it('cleanText() membersihkan spasi berlebih dan spasi sebelum koma', () => {
    expect(cleanText('masyarakat ,  sekolah')).toBe('masyarakat, sekolah');
    expect(cleanText('belajar   bersama  . ')).toBe('belajar bersama.');
  });

  it('calculateRekapDanPeringkat() menguji Siswa A dan Siswa B beserta peringkat seri', () => {
    // Sesuai spesifikasi prompt:
    // Siswa A nilai 9 mapel [85,90,89,88,88,81,86,78,82] -> jumlah 767, rata-rata "85,22"
    // Siswa B [88,92,91,89,89,85,90,82,89] -> jumlah 795, peringkat 1; nilai sama mendapat peringkat sama
    const siswaList = [
      { id: '1', nama: 'Siswa A', nilaiMapel: [85, 90, 89, 88, 88, 81, 86, 78, 82] },
      { id: '2', nama: 'Siswa B', nilaiMapel: [88, 92, 91, 89, 89, 85, 90, 82, 89] },
      { id: '3', nama: 'Siswa C (Seri A)', nilaiMapel: [85, 90, 89, 88, 88, 81, 86, 78, 82] }, // Sama dengan A (767)
      { id: '4', nama: 'Siswa D', nilaiMapel: [70, 70, 70, 70, 70, 70, 70, 70, 70] }, // 630
    ];

    const results = calculateRekapDanPeringkat(siswaList, 9);

    const rekapA = results.find((r) => r.id === '1')!;
    expect(rekapA.jumlah).toBe(767);
    expect(rekapA.rataRataFormatted).toBe('85,22');
    expect(rekapA.peringkat).toBe(2);

    const rekapB = results.find((r) => r.id === '2')!;
    expect(rekapB.jumlah).toBe(795);
    expect(rekapB.peringkat).toBe(1);

    const rekapC = results.find((r) => r.id === '3')!;
    expect(rekapC.jumlah).toBe(767);
    expect(rekapC.peringkat).toBe(2); // Seri dengan A

    const rekapD = results.find((r) => r.id === '4')!;
    expect(rekapD.peringkat).toBe(4); // Loncat ke 4 (standard 1, 2, 2, 4)

    expect(rekapB.prestasiAkademikText).toBe(
      'Peringkat ke-1 dari 4 siswa dengan jumlah nilai 795 dan rata-rata 88,33'
    );
  });

  it('generateDeskripsiKompetensi() menghasilkan deskripsi sesuai Kriteria Selesai', () => {
    // Deskripsi Matematika untuk siswa rekaan dengan TP1, TP2, TP4 (KKTP=1, Tampil=1),
    // TP5 (KKTP=0, Tampil=1), TP3 dan TP6 (Tampil=0)
    const tpList = [
      { deskripsi: 'mampu memahami perkalian pecahan dengan bilangan asli dan menghitung hasil perkalian tersebut', kktp: 1 as const, tampil: 1 as const },
      { deskripsi: 'mampu memahami pembagian pecahan dengan bilangan asli dan menghitung hasil pembagian tersebut', kktp: 1 as const, tampil: 1 as const },
      { deskripsi: 'mampu mengubah pecahan menjadi desimal, serta membandingkan dan mengurutkan bilangan desimal (satu angka di belakang koma)', kktp: 1 as const, tampil: 0 as const },
      { deskripsi: 'mampu memahami konsep rasio dan menggunakan bahasa rasio untuk menjelaskan hubungan perbandingan antara dua besaran', kktp: 1 as const, tampil: 1 as const },
      { deskripsi: 'mampu menentukan kesamaan rasio dengan bantuan tabel rasio', kktp: 0 as const, tampil: 1 as const },
      { deskripsi: 'mampu menentukan rasio satuan', kktp: 0 as const, tampil: 0 as const },
    ];

    const { tercapaiText, perluBimbinganText, fullText } = generateDeskripsiKompetensi('SITI AMINAH', tpList);

    expect(tercapaiText).toBe(
      'Siti Aminah menunjukkan pemahaman dalam mampu memahami perkalian pecahan dengan bilangan asli dan menghitung hasil perkalian tersebut, mampu memahami pembagian pecahan dengan bilangan asli dan menghitung hasil pembagian tersebut, mampu memahami konsep rasio dan menggunakan bahasa rasio untuk menjelaskan hubungan perbandingan antara dua besaran.'
    );

    expect(perluBimbinganText).toBe(
      'Siti Aminah membutuhkan bimbingan dalam mampu menentukan kesamaan rasio dengan bantuan tabel rasio.'
    );

    expect(fullText).toBe(`${tercapaiText} ${perluBimbinganText}`);
  });

  it('generateDeskripsiKokurikuler() menghasilkan format deskripsi kokurikuler', () => {
    const desc = generateDeskripsiKokurikuler(
      'ADNAN',
      'Kolaborasi',
      'Kemandirian',
      'Lingkungan Sehat, Saya Kuat'
    );
    expect(desc).toBe(
      'Ananda Adnan sudah kuat dalam dimensi Kolaborasi dan perlu penguatan dalam Kemandirian pada tema Lingkungan Sehat, Saya Kuat'
    );
  });
});
