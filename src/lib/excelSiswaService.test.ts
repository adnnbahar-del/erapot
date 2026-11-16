// src/lib/excelSiswaService.test.ts
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseTanggalLahir,
  validasiBerkasSiswaExcel,
} from './excelSiswaService';

describe('Layanan Excel & Impor Siswa (Tahap Bagian B)', () => {
  describe('parseTanggalLahir', () => {
    it('memvalidasi format DD-MM-YYYY', () => {
      const res = parseTanggalLahir('15-05-2014');
      expect(res.valid).toBe(true);
      expect(res.isoDate).toBe('2014-05-15');
      expect(res.displayDate).toBe('15-05-2014');
    });

    it('memvalidasi format DD/MM/YYYY', () => {
      const res = parseTanggalLahir('20/08/2013');
      expect(res.valid).toBe(true);
      expect(res.isoDate).toBe('2013-08-20');
      expect(res.displayDate).toBe('20-08-2013');
    });

    it('memvalidasi format YYYY-MM-DD', () => {
      const res = parseTanggalLahir('2015-12-01');
      expect(res.valid).toBe(true);
      expect(res.isoDate).toBe('2015-12-01');
      expect(res.displayDate).toBe('01-12-2015');
    });

    it('menolak teks tanggal tidak valid atau rusak', () => {
      expect(parseTanggalLahir('bukan-tanggal').valid).toBe(false);
      expect(parseTanggalLahir('32-13-2014').valid).toBe(false);
      expect(parseTanggalLahir('').valid).toBe(false);
    });
  });

  describe('validasiBerkasSiswaExcel', () => {
    function createMockWorkbookBinary(rows: any[][]): string {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
      return XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    }

    it('mengimpor data valid dengan sukses', () => {
      const raw = [
        ['No', 'NISN', 'NIS', 'Nama Lengkap', 'L/P', 'Tempat Lahir', 'Tanggal Lahir (DD-MM-YYYY)', 'Agama', 'Nama Ayah', 'Nama Ibu', 'Alamat'],
        [1, '0135892341', '101', 'Ahmad Rizky Pratama', 'L', 'Tanggamus', '15-05-2014', 'Islam', 'Suryanto', 'Rahayu', 'Jl. Merdeka No. 12'],
        [2, '0135892342', '102', 'Bunga Citra Lestari', 'P', 'Bandar Lampung', '20-08-2014', 'Islam', 'Bambang', 'Siti', 'Jl. Kenanga No. 4'],
      ];

      const binary = createMockWorkbookBinary(raw);
      const hasil = validasiBerkasSiswaExcel(binary, [], 0, 50);

      expect(hasil.totalRows).toBe(2);
      expect(hasil.validCount).toBe(2);
      expect(hasil.invalidCount).toBe(0);
      expect(hasil.validRows[0].nama).toBe('Ahmad Rizky Pratama');
      expect(hasil.validRows[0].jk).toBe('L');
      expect(hasil.validRows[0].tanggal_lahir).toBe('2014-05-15');
    });

    it('menandai baris bermasalah merah: nama kosong, tanggal salah format, NISN dobel, kuota 50', () => {
      const raw = [
        ['No', 'NISN', 'NIS', 'Nama Lengkap', 'L/P', 'Tempat Lahir', 'Tanggal Lahir (DD-MM-YYYY)', 'Agama', 'Nama Ayah', 'Nama Ibu', 'Alamat'],
        // Baris 1: Valid
        [1, '0135892341', '101', 'Siswa Satu', 'L', 'Tanggamus', '15-05-2014', 'Islam', 'Ayah', 'Ibu', 'Alamat'],
        // Baris 2: Nama Kosong
        [2, '0135892342', '102', '', 'P', 'Tanggamus', '15-05-2014', 'Islam', 'Ayah', 'Ibu', 'Alamat'],
        // Baris 3: Tanggal salah format
        [3, '0135892343', '103', 'Siswa Tiga', 'L', 'Tanggamus', 'salah_tanggal', 'Islam', 'Ayah', 'Ibu', 'Alamat'],
        // Baris 4: NISN dobel dengan Baris 1
        [4, '0135892341', '104', 'Siswa Empat', 'L', 'Tanggamus', '15-05-2014', 'Islam', 'Ayah', 'Ibu', 'Alamat'],
        // Baris 5: NISN sudah ada di database existing
        [5, '0999999999', '105', 'Siswa Lima', 'P', 'Tanggamus', '15-05-2014', 'Islam', 'Ayah', 'Ibu', 'Alamat'],
      ];

      const existingInDb: any = [
        { id: 's_exist', nisn: '0999999999', nama: 'Siswa Lama' },
      ];

      const binary = createMockWorkbookBinary(raw);
      const hasil = validasiBerkasSiswaExcel(binary, existingInDb, 0, 50);

      expect(hasil.totalRows).toBe(5);
      expect(hasil.validCount).toBe(1);
      expect(hasil.invalidCount).toBe(4);

      // Cek alasan kesalahan
      const errNamaKosong = hasil.invalidRows.find((r) => r.nisn === '0135892342');
      expect(errNamaKosong?.errors.some((e) => e.includes('Nama lengkap'))).toBe(true);

      const errTglSalah = hasil.invalidRows.find((r) => r.nisn === '0135892343');
      expect(errTglSalah?.errors.some((e) => e.includes('tanggal lahir'))).toBe(true);

      const errNisnDobelBatch = hasil.invalidRows.find((r) => r.nama === 'Siswa Empat');
      expect(errNisnDobelBatch?.errors.some((e) => e.includes('dobel'))).toBe(true);

      const errNisnExistDb = hasil.invalidRows.find((r) => r.nisn === '0999999999');
      expect(errNisnExistDb?.errors.some((e) => e.includes('sudah terdaftar'))).toBe(true);
    });

    it('menolak baris jika melebihi kuota 50 siswa per kelas', () => {
      const raw = [
        ['No', 'NISN', 'NIS', 'Nama Lengkap', 'L/P', 'Tempat Lahir', 'Tanggal Lahir (DD-MM-YYYY)', 'Agama', 'Nama Ayah', 'Nama Ibu', 'Alamat'],
        [1, '0135892341', '101', 'Siswa A', 'L', 'Tanggamus', '15-05-2014', 'Islam', 'Ayah', 'Ibu', 'Alamat'],
        [2, '0135892342', '102', 'Siswa B', 'L', 'Tanggamus', '15-05-2014', 'Islam', 'Ayah', 'Ibu', 'Alamat'],
      ];

      // Kelas sudah terisi 49 siswa, jadi hanya 1 slot tersisa
      const binary = createMockWorkbookBinary(raw);
      const hasil = validasiBerkasSiswaExcel(binary, [], 49, 50);

      expect(hasil.totalRows).toBe(2);
      expect(hasil.validCount).toBe(1);
      expect(hasil.invalidCount).toBe(1);
      expect(hasil.invalidRows[0].errors.some((e) => e.includes('kuota'))).toBe(true);
    });
  });
});

