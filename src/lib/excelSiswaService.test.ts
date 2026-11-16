// src/lib/excelSiswaService.test.ts
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  normalizeNama,
  normalizeJenisKelamin,
  parseTanggalLahir,
  sanitizeFilenamePart,
  validasiBerkasSiswaExcel,
  TEMPLATE_COLUMNS,
} from './excelSiswaService';
import { Siswa } from '../types';

describe('Excel Siswa Service - Normalisasi & Utility', () => {
  it('normalisasi nama: menghapus spasi ganda dan membuat Title Case', () => {
    expect(normalizeNama('ahmad  fahri')).toBe('Ahmad Fahri');
    expect(normalizeNama('AHMAD   FAHRI PRATAMA')).toBe('Ahmad Fahri Pratama');
    expect(normalizeNama('  siti   nurhaliza  ')).toBe('Siti Nurhaliza');
    expect(normalizeNama('')).toBe('');
  });

  it('normalisasi jenis kelamin: mengenali L/laki-laki dan P/perempuan', () => {
    expect(normalizeJenisKelamin('L')).toEqual({ jk: 'L', valid: true });
    expect(normalizeJenisKelamin('l')).toEqual({ jk: 'L', valid: true });
    expect(normalizeJenisKelamin('Laki-laki')).toEqual({ jk: 'L', valid: true });
    expect(normalizeJenisKelamin('PRIA')).toEqual({ jk: 'L', valid: true });

    expect(normalizeJenisKelamin('P')).toEqual({ jk: 'P', valid: true });
    expect(normalizeJenisKelamin('p')).toEqual({ jk: 'P', valid: true });
    expect(normalizeJenisKelamin('Perempuan')).toEqual({ jk: 'P', valid: true });
    expect(normalizeJenisKelamin('Wanita')).toEqual({ jk: 'P', valid: true });

    expect(normalizeJenisKelamin('X')).toEqual({ jk: '', valid: false });
    expect(normalizeJenisKelamin('')).toEqual({ jk: '', valid: false });
  });

  it('parse tanggal lahir: mendukung DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, dan Excel serial', () => {
    const res1 = parseTanggalLahir('15/05/2014');
    expect(res1.valid).toBe(true);
    expect(res1.isoDate).toBe('2014-05-15');
    expect(res1.displayDate).toBe('15/05/2014');

    const res2 = parseTanggalLahir('01-12-2015');
    expect(res2.valid).toBe(true);
    expect(res2.isoDate).toBe('2015-12-01');

    const res3 = parseTanggalLahir('2014-08-20');
    expect(res3.valid).toBe(true);
    expect(res3.isoDate).toBe('2014-08-20');

    // Tanggal salah format
    const resBad = parseTanggalLahir('invalid-date');
    expect(resBad.valid).toBe(false);
  });

  it('sanitize filename: menghilangkan karakter terlarang', () => {
    expect(sanitizeFilenamePart('Kelas 6/A')).toBe('Kelas-6-A');
    expect(sanitizeFilenamePart('2026/2027')).toBe('2026-2027');
    expect(sanitizeFilenamePart('SDN 1 *Unggulan*')).toBe('SDN-1-Unggulan-');
  });
});

describe('Excel Siswa Service - Template & Validasi Impor', () => {
  it('template memiliki 20 kolom sesuai spesifikasi A s.d. T', () => {
    expect(TEMPLATE_COLUMNS.length).toBe(20);
    expect(TEMPLATE_COLUMNS[0].key).toBe('no');
    expect(TEMPLATE_COLUMNS[1].key).toBe('nama');
    expect(TEMPLATE_COLUMNS[1].required).toBe(true);
    expect(TEMPLATE_COLUMNS[2].key).toBe('jk');
    expect(TEMPLATE_COLUMNS[2].required).toBe(true);
    expect(TEMPLATE_COLUMNS[3].key).toBe('nis');
    expect(TEMPLATE_COLUMNS[4].key).toBe('nisn');
    expect(TEMPLATE_COLUMNS[19].key).toBe('penglihatan');
  });

  it('mengabaikan baris contoh yang diawali "CONTOH", menolak NISN 9 digit, dan mempertahankan NISN dengan awalan 0', async () => {
    // Siapkan Workbook Excel menggunakan ExcelJS
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data Siswa');

    // Baris 1: Judul
    ws.addRow(['Data Peserta Didik — SDN 1 Contoh — Kelas 6 — 2026/2027']);
    // Baris 2: Kosong
    ws.addRow([]);
    // Baris 3: Header
    ws.addRow(TEMPLATE_COLUMNS.map((c) => c.header));

    // Baris 4: Baris Contoh (harus diabaikan otomatis)
    ws.addRow([
      1,
      'CONTOH — hapus baris ini sebelum impor',
      'L',
      '2021001',
      '0123456789',
      'Islam',
      'Jakarta',
      '15/05/2014',
    ]);

    // Baris 5: Siswa 1 Valid (NISN diawali 0: '0123456789')
    ws.addRow([
      2,
      'Ahmad   Fahri',
      'L',
      '2021002',
      '0123456789',
      'Islam',
      'Bandung',
      '10/04/2014',
    ]);

    // Baris 6: Siswa 2 Valid
    ws.addRow([
      3,
      'Siti Nurhaliza',
      'P',
      '2021003',
      '0123456780',
      'Islam',
      'Surabaya',
      '25/11/2014',
    ]);

    // Baris 7: Siswa 3 Valid
    ws.addRow([
      4,
      'Budi Pratama',
      'Laki-laki',
      '2021004',
      '0123456781',
      'Islam',
      'Semarang',
      '05/01/2015',
    ]);

    // Baris 8: Siswa Salah (NISN hanya 9 digit)
    ws.addRow([
      5,
      'Doni Salah NISN',
      'L',
      '2021005',
      '123456789', // 9 digit!
      'Islam',
      'Medan',
      '12/03/2014',
    ]);

    const buffer = await wb.xlsx.writeBuffer();

    // Jalankan validasi
    const result = validasiBerkasSiswaExcel(buffer, [], 0, 50);

    // Verifikasi:
    // 1. Baris contoh diabaikan: exampleCount = 1
    expect(result.exampleCount).toBe(1);

    // 2. Total baris data terbaca (selain contoh): 4 baris
    expect(result.totalRows).toBe(4);

    // 3. Hanya 3 siswa valid, 1 bermasalah
    expect(result.validCount).toBe(3);
    expect(result.invalidCount).toBe(1);

    // 4. Periksa NISN berawalan 0 tidak hilang
    const siswa1 = result.validRows.find((s) => s.nama === 'Ahmad Fahri');
    expect(siswa1).toBeDefined();
    expect(siswa1?.nisn).toBe('0123456789');
    expect(siswa1?.jk).toBe('L');

    // 5. Periksa normalisasi nama
    expect(siswa1?.nama).toBe('Ahmad Fahri');

    // 6. Periksa baris salah tertolak dengan alasan jelas
    const siswaSalah = result.invalidRows.find((s) => s.nama === 'Doni Salah Nisn');
    expect(siswaSalah).toBeDefined();
    expect(siswaSalah?.errors.some((e) => e.includes('10 digit'))).toBe(true);
  });

  it('deteksi header fleksibel pada baris yang memuat nama kolom walau posisi bergeser', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data Siswa');

    // Header dengan susunan terbalik: NISN, Nama Lengkap, Jenis Kelamin
    ws.addRow(['INFORMASI SEKOLAH']);
    ws.addRow(['NISN', 'Nama Lengkap *', 'Jenis Kelamin *', 'NIS']);
    ws.addRow(['0123456788', 'citra lestari', 'P', '2021099']);

    const buffer = await wb.xlsx.writeBuffer();
    const result = validasiBerkasSiswaExcel(buffer, [], 0, 50);

    expect(result.validCount).toBe(1);
    expect(result.validRows[0].nama).toBe('Citra Lestari');
    expect(result.validRows[0].jk).toBe('P');
    expect(result.validRows[0].nisn).toBe('0123456788');
    expect(result.validRows[0].nis).toBe('2021099');
  });

  it('mendeteksi duplikasi NISN dalam berkas yang diunggah', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data Siswa');

    ws.addRow(TEMPLATE_COLUMNS.map((c) => c.header));
    ws.addRow([1, 'Siswa Satu', 'L', '', '0123456789']);
    ws.addRow([2, 'Siswa Dua Dobel', 'P', '', '0123456789']); // NISN sama persis

    const buffer = await wb.xlsx.writeBuffer();
    const result = validasiBerkasSiswaExcel(buffer, [], 0, 50);

    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.invalidRows[0].errors.some((e) => e.includes('dobel di berkas'))).toBe(true);
  });

  it('ekspor dan impor ulang siswa yang sudah ada: ditandai isExisting dan tidak membuat duplikasi jika diperbarui', async () => {
    const existing: Siswa[] = [
      {
        id: 's_existing_1',
        nama: 'Ahmad Fahri',
        nis: '2021001',
        nisn: '0123456789',
        jk: 'L',
        tempat_lahir: 'Jakarta',
        tanggal_lahir: '2014-05-15',
        agama: 'Islam',
        pendidikan_sebelumnya: 'TK / RA',
        alamat: 'Jl. Merdeka',
        nama_ayah: 'Budi',
        nama_ibu: 'Siti',
        pekerjaan_ayah: '',
        pekerjaan_ibu: '',
      },
    ];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data Siswa');
    ws.addRow(TEMPLATE_COLUMNS.map((c) => c.header));
    // Siswa dengan NISN yang sudah terdaftar
    ws.addRow([1, 'Ahmad Fahri', 'L', '2021001', '0123456789']);

    const buffer = await wb.xlsx.writeBuffer();

    // Mode izinkan perbarui
    const resAllow = validasiBerkasSiswaExcel(buffer, existing, 1, 50, true);
    expect(resAllow.validCount).toBe(1);
    expect(resAllow.validRows[0].isExisting).toBe(true);
    expect(resAllow.validRows[0].existingSiswaId).toBe('s_existing_1');

    // Mode jangan perbarui (tolak siswa yang sudah ada)
    const resDisallow = validasiBerkasSiswaExcel(buffer, existing, 1, 50, false);
    expect(resDisallow.invalidCount).toBe(1);
    expect(resDisallow.invalidRows[0].errors.some((e) => e.includes('sudah terdaftar'))).toBe(true);
  });

  it('validasi batas kapasitas kuota maksimal 50 siswa per kelas', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data Siswa');
    ws.addRow(TEMPLATE_COLUMNS.map((c) => c.header));

    // Tambah 3 baris
    ws.addRow([1, 'Siswa Satu', 'L', '', '0123456701']);
    ws.addRow([2, 'Siswa Dua', 'L', '', '0123456702']);
    ws.addRow([3, 'Siswa Tiga Melebihi Kuota', 'L', '', '0123456703']);

    const buffer = await wb.xlsx.writeBuffer();

    // Jika kelas saat ini sudah terisi 48 siswa, dan batas 50, maka hanya 2 yang boleh masuk
    const res = validasiBerkasSiswaExcel(buffer, [], 48, 50);
    expect(res.validCount).toBe(2);
    expect(res.invalidCount).toBe(1);
    expect(res.quotaExceededCount).toBe(1);
    expect(res.invalidRows[0].errors.some((e) => e.includes('kuota'))).toBe(true);
  });
});
