import { describe, it, expect } from 'vitest';
import {
  ROMAWI,
  TERBILANG,
  faseDariTingkat,
  idKelas,
  labelKelas,
  emailGuru,
  namaRombel,
  labelRapor,
  hurufBerikutnya,
  parseRombelNama,
  sortKelasList,
  canAccessRombel,
} from './rombel';
import { calculateRekapDanPeringkat } from './rapor';

describe('rombel helper functions (Kelas Tanpa Rombel & Dengan Rombel)', () => {
  it('faseDariTingkat(1..6) returns correct Fase A, B, C', () => {
    expect(faseDariTingkat(1)).toBe('A');
    expect(faseDariTingkat(2)).toBe('A');
    expect(faseDariTingkat(3)).toBe('B');
    expect(faseDariTingkat(4)).toBe('B');
    expect(faseDariTingkat(5)).toBe('C');
    expect(faseDariTingkat(6)).toBe('C');
  });

  it('idKelas(tingkat, huruf) handles both empty and filled huruf', () => {
    expect(idKelas(4, '')).toBe('4');
    expect(idKelas(4, 'A')).toBe('4A');
    expect(idKelas(1, 'b')).toBe('1B');
    expect(idKelas(6, '')).toBe('6');
  });

  it('labelKelas(tingkat, huruf) returns Kelas X or XA', () => {
    expect(labelKelas(4, '')).toBe('Kelas 4');
    expect(labelKelas(4, 'A')).toBe('4A');
    expect(labelKelas(3, '')).toBe('Kelas 3');
    expect(labelKelas(6, 'C')).toBe('6C');
  });

  it('emailGuru(idKelas, domain) generates correct email for single and rombel classes', () => {
    expect(emailGuru('4', 'x.web.app')).toBe('guru-4@x.web.app');
    expect(emailGuru('4A', 'x.web.app')).toBe('guru-4a@x.web.app');
    expect(emailGuru('1b', 'sekolah.sch.id')).toBe('guru-1b@sekolah.sch.id');
  });

  it('labelRapor without huruf (kelas tunggal)', () => {
    expect(labelRapor(4, '')).toBe('IV (Empat)');
    expect(labelRapor(4, '', 'angka')).toBe('4');
    expect(labelRapor(4, '', 'strip')).toBe('IV (Empat)');
    expect(labelRapor(1, '')).toBe('I (Satu)');
  });

  it('labelRapor with huruf (kelas rombel)', () => {
    expect(labelRapor(6, 'B')).toBe('VI B (Enam B)');
    expect(labelRapor(6, 'B', 'angka')).toBe('6B');
    expect(labelRapor(6, 'B', 'strip')).toBe('VI-B');
    expect(labelRapor(1, 'A')).toBe('I A (Satu A)');
    expect(labelRapor(1, 'A', 'angka')).toBe('1A');
    expect(labelRapor(1, 'A', 'strip')).toBe('I-A');
  });

  it('hurufBerikutnya determines the next alphabetical character', () => {
    expect(hurufBerikutnya(['A', 'B', 'C'])).toBe('D');
    expect(hurufBerikutnya(['A', 'B', 'C', 'D'])).toBe('E');
    expect(hurufBerikutnya([])).toBe('A');
  });

  it('parseRombelNama parses both formats correctly', () => {
    expect(parseRombelNama('4')).toEqual({ tingkat: 4, huruf: '' });
    expect(parseRombelNama('Kelas 4')).toEqual({ tingkat: 4, huruf: '' });
    expect(parseRombelNama('4A')).toEqual({ tingkat: 4, huruf: 'A' });
    expect(parseRombelNama('rombel_4a')).toEqual({ tingkat: 4, huruf: 'A' });
    expect(parseRombelNama('rombel_4')).toEqual({ tingkat: 4, huruf: '' });
  });

  it('sortKelasList preserves correct order for mixed single and rombel classes', () => {
    const mixed = ['4B', '1A', '3', '4A', '1B', '2'];
    const sorted = sortKelasList(mixed);
    expect(sorted).toEqual(['1A', '1B', '2', '3', '4A', '4B']);

    const fullMixed = ['6C', '5', '1C', '1A', '4', '6A', '2', '3'];
    expect(sortKelasList(fullMixed)).toEqual(['1A', '1C', '2', '3', '4', '5', '6A', '6C']);
  });

  it('security rules: Guru Kelas 4 can access 4, cannot access 4A or 40, Guru 4A cannot access 4', () => {
    // Guru Kelas 4 (rombelId "4")
    expect(canAccessRombel('guru', '4', '4')).toBe(true);
    expect(canAccessRombel('guru', 'rombel_4', 'rombel_4')).toBe(true);
    expect(canAccessRombel('guru', '4', 'rombel_4')).toBe(true);

    // Guru Kelas 4 CANNOT access 4A or 40
    expect(canAccessRombel('guru', '4', '4A')).toBe(false);
    expect(canAccessRombel('guru', '4', 'rombel_4a')).toBe(false);
    expect(canAccessRombel('guru', '4', '40')).toBe(false);

    // Guru 4A CANNOT access 4
    expect(canAccessRombel('guru', '4A', '4')).toBe(false);
    expect(canAccessRombel('guru', 'rombel_4a', 'rombel_4')).toBe(false);

    // Admin can access all
    expect(canAccessRombel('admin', undefined, '4')).toBe(true);
    expect(canAccessRombel('admin', undefined, '4A')).toBe(true);
  });

  it('peringkat dihitung terpisah untuk kelas mandiri maupun rombel', () => {
    // Siswa di Kelas 4 (tunggal)
    const siswa4 = [
      { id: 's1', nama: 'Budi 4', nilaiMapel: [90, 95] },
      { id: 's2', nama: 'Ani 4', nilaiMapel: [80, 85] },
    ];
    const rekap4 = calculateRekapDanPeringkat(siswa4, 2);
    expect(rekap4.find((s) => s.id === 's1')?.peringkat).toBe(1);
    expect(rekap4.find((s) => s.id === 's2')?.peringkat).toBe(2);
    expect(rekap4.find((s) => s.id === 's1')?.prestasiAkademikText).toContain('Peringkat ke-1 dari 2 siswa');
  });
});
