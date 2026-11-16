// src/lib/excelSiswaService.ts
// Layanan Template Excel, Ekspor & Impor Data Siswa e-Rapor SD
// - Template resmi Excel (.xlsx) dengan Sheet 'Data Siswa' dan 'Petunjuk'
// - Header oranye untuk kolom wajib (*), navy untuk kolom lainnya
// - Dropdown data validation (JK, Agama, Pendidikan, Pendengaran, Penglihatan)
// - Format teks untuk NIS & NISN (mencegah hilangnya angka 0 di depan)
// - Sheet protection & locking untuk No (1–50) dan judul/header
// - Normalisasi nama (Title Case), gender (L/P), tanggal (DD/MM/YYYY)
// - Deteksi header cerdas berdasarkan nama kolom (fleksibel posisi)
// - Otomatis mengabaikan baris contoh yang diawali "CONTOH"
// - Ekspor data siswa kelas saat ini (format identik template)
// - Ekspor berkas baris bermasalah dengan kolom Alasan

import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { JenisKelamin, Siswa, KelasSiswa } from '../types';

export interface SiswaImportRow {
  no?: number;
  nisn: string;
  nis: string;
  nama: string;
  jk: JenisKelamin | string;
  tempat_lahir: string;
  tanggal_lahir: string; // ISO standard YYYY-MM-DD
  tanggal_lahir_raw: string; // format tampilan asli DD/MM/YYYY
  agama: string;
  pendidikan_sebelumnya: string;
  alamat: string;
  nama_ayah: string;
  pekerjaan_ayah: string;
  nama_ibu: string;
  pekerjaan_ibu: string;
  nama_wali: string;
  pekerjaan_wali: string;
  tinggi_badan: string | number;
  berat_badan: string | number;
  pendengaran: string;
  penglihatan: string;
  // Status Validasi
  isValid: boolean;
  errors: string[];
  isExisting?: boolean; // NISN sudah ada di database kelas
  existingSiswaId?: string;
  isExample?: boolean;
}

export interface HasilValidasiImportSiswa {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  existingCount: number;
  exampleCount: number;
  rows: SiswaImportRow[];
  validRows: SiswaImportRow[];
  invalidRows: SiswaImportRow[];
  quotaExceededCount: number;
}

export interface TemplateOptions {
  namaSekolah?: string;
  namaKelas?: string;
  tahunAjaran?: string;
}

// Definisi Kolom Template
export const TEMPLATE_COLUMNS = [
  { key: 'no', header: 'No', width: 6, required: false },
  { key: 'nama', header: 'Nama Lengkap *', width: 32, required: true },
  { key: 'jk', header: 'Jenis Kelamin * (L / P)', width: 22, required: true },
  { key: 'nis', header: 'NIS', width: 14, required: false },
  { key: 'nisn', header: 'NISN (10 digit)', width: 18, required: false },
  { key: 'agama', header: 'Agama', width: 16, required: false },
  { key: 'tempat_lahir', header: 'Tempat Lahir', width: 20, required: false },
  { key: 'tanggal_lahir', header: 'Tanggal Lahir (DD/MM/YYYY)', width: 26, required: false },
  { key: 'pendidikan_sebelumnya', header: 'Pendidikan Sebelumnya', width: 24, required: false },
  { key: 'alamat', header: 'Alamat Peserta Didik', width: 38, required: false },
  { key: 'nama_ayah', header: 'Nama Ayah', width: 22, required: false },
  { key: 'pekerjaan_ayah', header: 'Pekerjaan Ayah', width: 20, required: false },
  { key: 'nama_ibu', header: 'Nama Ibu', width: 22, required: false },
  { key: 'pekerjaan_ibu', header: 'Pekerjaan Ibu', width: 20, required: false },
  { key: 'nama_wali', header: 'Nama Wali', width: 20, required: false },
  { key: 'pekerjaan_wali', header: 'Pekerjaan Wali', width: 20, required: false },
  { key: 'tinggi_badan', header: 'Tinggi Badan (cm)', width: 18, required: false },
  { key: 'berat_badan', header: 'Berat Badan (kg)', width: 18, required: false },
  { key: 'pendengaran', header: 'Pendengaran', width: 16, required: false },
  { key: 'penglihatan', header: 'Penglihatan', width: 16, required: false },
];

/**
 * Normalisasi nama: menghapus spasi ganda dan membuat huruf kapital di awal tiap kata (Title Case).
 */
export function normalizeNama(str: string): string {
  if (!str) return '';
  const clean = str.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean
    .split(' ')
    .map((w) => {
      if (!w) return '';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Normalisasi jenis kelamin:
 * - 'l', 'laki-laki', 'laki', 'pria' -> 'L'
 * - 'p', 'perempuan', 'wanita' -> 'P'
 */
export function normalizeJenisKelamin(val: any): { jk: JenisKelamin | ''; valid: boolean } {
  if (!val) return { jk: '', valid: false };
  const str = String(val).trim().toUpperCase();
  if (str === 'L' || str.startsWith('LAKI') || str === 'PRIA') {
    return { jk: 'L', valid: true };
  }
  if (str === 'P' || str.startsWith('PEREMPUAN') || str === 'WANITA') {
    return { jk: 'P', valid: true };
  }
  return { jk: '', valid: false };
}

/**
 * Normalisasi tanggal lahir dari berbagai format Excel:
 * Mendukung serial number Excel, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD.
 */
export function parseTanggalLahir(val: any): { isoDate: string; displayDate: string; valid: boolean } {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { isoDate: '', displayDate: '', valid: true }; // opsional jika kosong
  }

  // Jika number (Excel serial date)
  if (typeof val === 'number' && !isNaN(val)) {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const yyyy = String(parsed.y);
        const mm = String(parsed.m).padStart(2, '0');
        const dd = String(parsed.d).padStart(2, '0');
        return {
          isoDate: `${yyyy}-${mm}-${dd}`,
          displayDate: `${dd}/${mm}/${yyyy}`,
          valid: true,
        };
      }
    } catch {}
  }

  // Jika Date object JavaScript
  if (val instanceof Date && !isNaN(val.getTime())) {
    const yyyy = String(val.getFullYear());
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      displayDate: `${dd}/${mm}/${yyyy}`,
      valid: true,
    };
  }

  const str = String(val).trim();

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2035) {
      const dd = String(d).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const yyyy = String(y);
      return {
        isoDate: `${yyyy}-${mm}-${dd}`,
        displayDate: `${dd}/${mm}/${yyyy}`,
        valid: true,
      };
    }
  }

  // Format YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2035) {
      const dd = String(d).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const yyyy = String(y);
      return {
        isoDate: `${yyyy}-${mm}-${dd}`,
        displayDate: `${dd}/${mm}/${yyyy}`,
        valid: true,
      };
    }
  }

  return { isoDate: '', displayDate: str, valid: false };
}

/**
 * Membersihkan karakter tidak valid pada nama berkas
 */
export function sanitizeFilenamePart(name: string): string {
  return (name || '').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');
}

/**
 * Menghasilkan dan mengunduh berkas template Excel (.xlsx) untuk Data Siswa
 */
export async function unduhTemplateSiswaExcel(options: TemplateOptions = {}): Promise<void> {
  const namaSekolah = options.namaSekolah || 'SD NEGERI CONTOH';
  const namaKelas = options.namaKelas || 'Kelas 6';
  const tahunAjaran = options.tahunAjaran || '2026/2027';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'e-Rapor SD';
  wb.lastModifiedBy = 'e-Rapor SD';
  wb.created = new Date();
  wb.modified = new Date();

  // ══════════════════════════════════════════════════════════════
  // SHEET 1: Data Siswa
  // ══════════════════════════════════════════════════════════════
  const ws = wb.addWorksheet('Data Siswa', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3, activeCell: 'B4' }],
  });

  // Baris 1: Judul
  ws.mergeCells('A1:T1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `Data Peserta Didik — ${namaSekolah} — ${namaKelas} — ${tahunAjaran}`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  titleCell.protection = { locked: true };
  ws.getRow(1).height = 36;

  // Baris 2: Pemisah kosong
  ws.getRow(2).height = 10;
  for (let c = 1; c <= TEMPLATE_COLUMNS.length; c++) {
    ws.getCell(2, c).protection = { locked: true };
  }

  // Baris 3: Header Kolom
  ws.getRow(3).height = 28;
  TEMPLATE_COLUMNS.forEach((col, idx) => {
    const colNum = idx + 1;
    const cell = ws.getCell(3, colNum);
    cell.value = col.header;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.protection = { locked: true };

    // Warna Header: Oranye untuk wajib (*), Navy untuk lainnya
    if (col.required) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEA580C' }, // Kemdikbud Accent / Orange
      };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    } else {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }, // Kemdikbud Dark / Navy
      };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    }

    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };

    // Atur lebar kolom
    ws.getColumn(colNum).width = col.width;
  });

  // Filter aktif pada rentang A3:T3
  ws.autoFilter = 'A3:T3';

  // ══════════════════════════════════════════════════════════════
  // Baris 4: Baris Contoh (Diabaikan saat impor)
  // ══════════════════════════════════════════════════════════════
  const row4 = ws.getRow(4);
  row4.height = 22;
  const exampleData: Record<string, any> = {
    no: 1,
    nama: 'CONTOH — hapus baris ini sebelum impor',
    jk: 'L',
    nis: '2021001',
    nisn: '0123456789',
    agama: 'Islam',
    tempat_lahir: 'Jakarta',
    tanggal_lahir: '15/05/2014',
    pendidikan_sebelumnya: 'TK / RA',
    alamat: 'Jl. Merdeka No. 10',
    nama_ayah: 'Budi Santoso',
    pekerjaan_ayah: 'Wiraswasta',
    nama_ibu: 'Siti Rahayu',
    pekerjaan_ibu: 'Ibu Rumah Tangga',
    nama_wali: '',
    pekerjaan_wali: '',
    tinggi_badan: 135,
    berat_badan: 32,
    pendengaran: 'Baik',
    penglihatan: 'Baik',
  };

  TEMPLATE_COLUMNS.forEach((col, idx) => {
    const colNum = idx + 1;
    const cell = row4.getCell(colNum);
    cell.value = exampleData[col.key];
    cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
    if (col.key === 'no') {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.protection = { locked: true };
    } else {
      cell.protection = { locked: false };
    }
  });

  // ══════════════════════════════════════════════════════════════
  // Baris 5 s.d. 53: 49 Baris Isian Siswa (Total 50 slot siswa)
  // ══════════════════════════════════════════════════════════════
  for (let r = 5; r <= 53; r++) {
    const row = ws.getRow(r);
    row.height = 20;

    TEMPLATE_COLUMNS.forEach((col, idx) => {
      const colNum = idx + 1;
      const cell = row.getCell(colNum);

      if (col.key === 'no') {
        cell.value = r - 3; // Nomor 2..50
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.protection = { locked: true };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF64748B' } };
      } else {
        cell.protection = { locked: false };
        cell.font = { name: 'Calibri', size: 10 };
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  }

  // Terapkan Validasi Data dan Format Sel pada Semua Baris Data (4 s.d. 53)
  for (let r = 4; r <= 53; r++) {
    const row = ws.getRow(r);

    // D: NIS (Format teks)
    const cellNIS = row.getCell(4);
    cellNIS.numFmt = '@';

    // E: NISN (Format teks, validasi tepat 10 digit)
    const cellNISN = row.getCell(5);
    cellNISN.numFmt = '@';
    cellNISN.dataValidation = {
      type: 'textLength',
      operator: 'equal',
      formulae: [10],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'NISN Tidak Sesuai',
      error: 'NISN harus terdiri dari tepat 10 digit angka.',
    };

    // C: Jenis Kelamin (Dropdown: L, P)
    const cellJK = row.getCell(3);
    cellJK.alignment = { horizontal: 'center', vertical: 'middle' };
    cellJK.dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"L, P"'],
      showErrorMessage: true,
      errorTitle: 'Pilihan Tidak Valid',
      error: 'Pilih L untuk Laki-laki atau P untuk Perempuan.',
    };

    // F: Agama (Dropdown)
    const cellAgama = row.getCell(6);
    cellAgama.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Islam, Kristen, Katolik, Hindu, Buddha, Khonghucu"'],
    };

    // H: Tanggal Lahir (Format tanggal / teks)
    const cellTgl = row.getCell(8);
    cellTgl.numFmt = '@';

    // I: Pendidikan Sebelumnya (Dropdown)
    const cellPendidikan = row.getCell(9);
    cellPendidikan.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"TK / RA, PAUD, Lainnya"'],
    };

    // Q: Tinggi Badan (Validasi angka 60-200)
    const cellTinggi = row.getCell(17);
    cellTinggi.numFmt = '0';
    cellTinggi.alignment = { horizontal: 'center', vertical: 'middle' };
    cellTinggi.dataValidation = {
      type: 'whole',
      operator: 'between',
      formulae: [60, 200],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Tinggi Badan Tidak Valid',
      error: 'Tinggi badan harus berupa angka antara 60 s.d. 200 cm.',
    };

    // R: Berat Badan (Validasi angka 10-120)
    const cellBerat = row.getCell(18);
    cellBerat.numFmt = '0';
    cellBerat.alignment = { horizontal: 'center', vertical: 'middle' };
    cellBerat.dataValidation = {
      type: 'whole',
      operator: 'between',
      formulae: [10, 120],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Berat Badan Tidak Valid',
      error: 'Berat badan harus berupa angka antara 10 s.d. 120 kg.',
    };

    // S: Pendengaran (Dropdown)
    const cellPendengaran = row.getCell(19);
    cellPendengaran.alignment = { horizontal: 'center', vertical: 'middle' };
    cellPendengaran.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Baik, Kurang"'],
    };

    // T: Penglihatan (Dropdown)
    const cellPenglihatan = row.getCell(20);
    cellPenglihatan.alignment = { horizontal: 'center', vertical: 'middle' };
    cellPenglihatan.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Baik, Kurang"'],
    };
  }

  // Kunci sheet tanpa password (sel yang locked: true tidak dapat diubah)
  await ws.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
  });

  // ══════════════════════════════════════════════════════════════
  // SHEET 2: Petunjuk
  // ══════════════════════════════════════════════════════════════
  const wsPetunjuk = wb.addWorksheet('Petunjuk');
  wsPetunjuk.views = [{ showGridLines: true }];

  // Judul Sheet Petunjuk
  wsPetunjuk.mergeCells('A1:D1');
  const petunjukTitle = wsPetunjuk.getCell('A1');
  petunjukTitle.value = 'PETUNJUK PENGISIAN TEMPLATE DATA SISWA E-RAPOR SD';
  petunjukTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E3A8A' } };
  petunjukTitle.alignment = { vertical: 'middle' };
  wsPetunjuk.getRow(1).height = 30;

  const panduanUmum = [
    ['1. Pengisian Data', 'Mulai mengisi data siswa dari baris ke-4. Satu siswa diisi dalam satu baris.'],
    ['2. Kapasitas Maksimal', 'Maksimal 50 peserta didik per rombongan belajar / kelas.'],
    ['3. Kolom Wajib (*)', "Kolom 'Nama Lengkap' dan 'Jenis Kelamin' bertanda bintang (*) dan berwarna oranye WAJIB diisi."],
    ['4. NISN (10 Digit)', 'NISN harus tepat 10 digit angka tanpa spasi. Format sel sudah berupa teks sehingga angka nol (0) di awal tidak akan hilang.'],
    ['5. Tanggal Lahir', 'Format tanggal lahir adalah DD/MM/YYYY (contoh: 15/05/2014).'],
    ['6. Baris Contoh', "Baris ke-4 berisi contoh ('CONTOH — ...') dan akan OTOMATIS DIABAIKAN saat diimpor, atau Anda dapat langsung menghapusnya."],
    ['7. Integritas Header', 'Jangan mengubah urutan, teks header, atau menghapus baris ke-3.'],
    ['8. Cara Impor', 'Setelah selesai mengisi dan menyimpan file Excel ini, buka aplikasi e-Rapor -> Menu Data Siswa -> Klik tombol "Impor Excel".'],
  ];

  let curRow = 3;
  wsPetunjuk.getCell(`A${curRow}`).value = 'A. PANDUAN UMUM';
  wsPetunjuk.getCell(`A${curRow}`).font = { bold: true, color: { argb: 'FF0F172A' } };
  curRow++;

  panduanUmum.forEach(([item, desc]) => {
    wsPetunjuk.getCell(`A${curRow}`).value = item;
    wsPetunjuk.getCell(`A${curRow}`).font = { bold: true, size: 10 };
    wsPetunjuk.mergeCells(`B${curRow}:D${curRow}`);
    wsPetunjuk.getCell(`B${curRow}`).value = desc;
    wsPetunjuk.getCell(`B${curRow}`).font = { size: 10 };
    curRow++;
  });

  curRow += 2;
  wsPetunjuk.getCell(`A${curRow}`).value = 'B. DAFTAR PILIHAN VALID (DROPDOWN)';
  wsPetunjuk.getCell(`A${curRow}`).font = { bold: true, color: { argb: 'FF0F172A' } };
  curRow++;

  const daftarPilihan = [
    ['Jenis Kelamin', 'L, P', 'L = Laki-laki, P = Perempuan'],
    ['Agama', 'Islam, Kristen, Katolik, Hindu, Buddha, Khonghucu', 'Pilih sesuai data akta kelahiran / KK'],
    ['Pendidikan Sebelumnya', 'TK / RA, PAUD, Lainnya', 'Pendidikan anak usia dini sebelum masuk SD'],
    ['Pendengaran', 'Baik, Kurang', 'Kondisi kesehatan pendengaran peserta didik'],
    ['Penglihatan', 'Baik, Kurang', 'Kondisi kesehatan penglihatan peserta didik'],
    ['Tinggi Badan (cm)', 'Angka bulat antara 60 s.d. 200', 'Contoh: 135'],
    ['Berat Badan (kg)', 'Angka bulat antara 10 s.d. 120', 'Contoh: 32'],
  ];

  // Header tabel pilihan
  wsPetunjuk.getCell(`A${curRow}`).value = 'KOLOM';
  wsPetunjuk.getCell(`B${curRow}`).value = 'PILIHAN VALID';
  wsPetunjuk.getCell(`C${curRow}`).value = 'KETERANGAN';
  ['A', 'B', 'C'].forEach((c) => {
    const cl = wsPetunjuk.getCell(`${c}${curRow}`);
    cl.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cl.alignment = { vertical: 'middle', horizontal: c === 'C' ? 'left' : 'center' };
  });
  curRow++;

  daftarPilihan.forEach(([kolom, pilihan, ket]) => {
    wsPetunjuk.getCell(`A${curRow}`).value = kolom;
    wsPetunjuk.getCell(`A${curRow}`).font = { bold: true, size: 10 };
    wsPetunjuk.getCell(`B${curRow}`).value = pilihan;
    wsPetunjuk.getCell(`B${curRow}`).font = { size: 10 };
    wsPetunjuk.getCell(`C${curRow}`).value = ket;
    wsPetunjuk.getCell(`C${curRow}`).font = { size: 10, italic: true };
    curRow++;
  });

  wsPetunjuk.getColumn(1).width = 24;
  wsPetunjuk.getColumn(2).width = 32;
  wsPetunjuk.getColumn(3).width = 45;
  wsPetunjuk.getColumn(4).width = 20;

  // ══════════════════════════════════════════════════════════════
  // Unduh Berkas
  // ══════════════════════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const safeKelas = sanitizeFilenamePart(namaKelas);
  const safeTahun = sanitizeFilenamePart(tahunAjaran);
  const filename = `Template-Data-Siswa-${safeKelas}${safeTahun ? `-${safeTahun}` : ''}.xlsx`;

  saveAs(blob, filename);
}

/**
 * Ekspor Data Siswa kelas saat ini ke berkas Excel berformat identik dengan template
 */
export async function eksporDataSiswaExcel(options: {
  namaSekolah: string;
  namaKelas: string;
  tahunAjaran: string;
  siswaList: Siswa[];
  kelasSiswaList?: KelasSiswa[];
}): Promise<void> {
  const { namaSekolah, namaKelas, tahunAjaran, siswaList, kelasSiswaList = [] } = options;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'e-Rapor SD';
  wb.created = new Date();

  const ws = wb.addWorksheet('Data Siswa', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3, activeCell: 'B4' }],
  });

  // Judul
  ws.mergeCells('A1:T1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `Data Peserta Didik — ${namaSekolah} — ${namaKelas} — ${tahunAjaran}`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  ws.getRow(1).height = 36;
  ws.getRow(2).height = 10;

  // Header
  ws.getRow(3).height = 28;
  TEMPLATE_COLUMNS.forEach((col, idx) => {
    const colNum = idx + 1;
    const cell = ws.getCell(3, colNum);
    cell.value = col.header;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: col.required ? 'FFEA580C' : 'FF1E3A8A' },
    };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getColumn(colNum).width = col.width;
  });

  ws.autoFilter = 'A3:T3';

  // Isi data siswa
  siswaList.forEach((s, idx) => {
    const r = idx + 4;
    const row = ws.getRow(r);
    row.height = 20;

    const ks = kelasSiswaList.find((item) => item.siswa_id === s.id);
    const tgl = parseTanggalLahir(s.tanggal_lahir);

    const values: Record<string, any> = {
      no: idx + 1,
      nama: s.nama || '',
      jk: s.jk || 'L',
      nis: s.nis || '',
      nisn: s.nisn || '',
      agama: s.agama || 'Islam',
      tempat_lahir: s.tempat_lahir || '',
      tanggal_lahir: tgl.displayDate || s.tanggal_lahir || '',
      pendidikan_sebelumnya: s.pendidikan_sebelumnya || '',
      alamat: s.alamat || '',
      nama_ayah: s.nama_ayah || '',
      pekerjaan_ayah: s.pekerjaan_ayah || '',
      nama_ibu: s.nama_ibu || '',
      pekerjaan_ibu: s.pekerjaan_ibu || '',
      nama_wali: s.nama_wali || '',
      pekerjaan_wali: s.pekerjaan_wali || '',
      tinggi_badan: ks?.tinggi_badan ? Number(ks.tinggi_badan) || ks.tinggi_badan : '',
      berat_badan: ks?.berat_badan ? Number(ks.berat_badan) || ks.berat_badan : '',
      pendengaran: ks?.pendengaran || 'Baik',
      penglihatan: ks?.penglihatan || 'Baik',
    };

    TEMPLATE_COLUMNS.forEach((col, cIdx) => {
      const colNum = cIdx + 1;
      const cell = row.getCell(colNum);
      cell.value = values[col.key];
      cell.font = { name: 'Calibri', size: 10 };
      if (col.key === 'nis' || col.key === 'nisn') cell.numFmt = '@';
      if (col.key === 'no' || col.key === 'jk') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeKelas = sanitizeFilenamePart(namaKelas);
  const safeTahun = sanitizeFilenamePart(tahunAjaran);
  saveAs(blob, `Data-Siswa-${safeKelas}${safeTahun ? `-${safeTahun}` : ''}.xlsx`);
}

/**
 * Mengurai dan memvalidasi berkas Excel (.xlsx / .xls / .xlsm)
 * - Deteksi header cerdas berdasarkan nama kolom di baris ke-3 (atau baris mana pun yang memuat 'NAMA')
 * - Otomatis mengabaikan baris contoh yang diawali 'CONTOH'
 * - Normalisasi otomatis (Title Case, L/P, spasi ganda)
 * - Validasi NISN 10 digit, keunikan nomor, rentang angka fisik
 * - Kuota kapasitas maksimal 50 siswa
 */
export function validasiBerkasSiswaExcel(
  binaryOrArrayBuffer: any,
  existingStudents: Siswa[] = [],
  currentEnrolledCount: number = 0,
  maxClassQuota: number = 50,
  allowUpdateExisting: boolean = true
): HasilValidasiImportSiswa {
  const wb = XLSX.read(binaryOrArrayBuffer, {
    type: typeof binaryOrArrayBuffer === 'string' ? 'binary' : 'array',
    raw: false,
    cellDates: false,
  });

  // Cari sheet 'Data Siswa' atau sheet pertama
  let targetSheetName = wb.SheetNames.find((name) =>
    name.toUpperCase().replace(/\s+/g, '').includes('DATASISWA')
  );
  if (!targetSheetName) targetSheetName = wb.SheetNames[0];

  const sheet = wb.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error('Sheet data siswa tidak ditemukan dalam berkas Excel.');
  }

  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  // Cari baris header yang memuat 'NAMA' (biasanya baris ke-3, index 2)
  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = rawRows[r];
    if (
      row &&
      row.some((cell: any) => {
        const str = String(cell || '').trim().toUpperCase();
        return str.includes('NAMA') && !str.includes('AYAH') && !str.includes('IBU') && !str.includes('WALI');
      })
    ) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error("Format berkas Excel tidak sesuai. Kolom 'Nama Lengkap' atau 'Nama' tidak ditemukan.");
  }

  const headers: string[] = rawRows[headerRowIndex].map((h) =>
    String(h || '').trim().toUpperCase()
  );

  // Petakan kolom berdasarkan teks header secara cerdas (posisi independen)
  const colMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    if (h.includes('NISN')) {
      colMap['nisn'] = idx;
    } else if (h.includes('KELAMIN') || h.includes('L/P') || h.includes('JK')) {
      colMap['jk'] = idx;
    } else if (h.includes('NIS') && !h.includes('NISN') && !h.includes('JENIS')) {
      colMap['nis'] = idx;
    } else if (
      h.includes('NAMA') &&
      !h.includes('AYAH') &&
      !h.includes('IBU') &&
      !h.includes('WALI') &&
      !h.includes('SEKOLAH')
    ) {
      colMap['nama'] = idx;
    } else if (h.includes('TEMPAT') && !h.includes('TINGGAL')) {
      colMap['tempat_lahir'] = idx;
    } else if (h.includes('TANGGAL') || h.includes('TGL') || h.includes('LAHIR')) {
      colMap['tanggal_lahir'] = idx;
    } else if (h.includes('AGAMA')) {
      colMap['agama'] = idx;
    } else if (h.includes('PENDIDIKAN')) {
      colMap['pendidikan_sebelumnya'] = idx;
    } else if (h.includes('ALAMAT') && !h.includes('AYAH') && !h.includes('IBU') && !h.includes('WALI') && !h.includes('ORTU')) {
      colMap['alamat'] = idx;
    } else if (h.includes('AYAH') && !h.includes('PEKERJAAN')) {
      colMap['nama_ayah'] = idx;
    } else if (h.includes('PEKERJAAN') && h.includes('AYAH')) {
      colMap['pekerjaan_ayah'] = idx;
    } else if (h.includes('IBU') && !h.includes('PEKERJAAN')) {
      colMap['nama_ibu'] = idx;
    } else if (h.includes('PEKERJAAN') && h.includes('IBU')) {
      colMap['pekerjaan_ibu'] = idx;
    } else if (h.includes('WALI') && !h.includes('PEKERJAAN')) {
      colMap['nama_wali'] = idx;
    } else if (h.includes('PEKERJAAN') && h.includes('WALI')) {
      colMap['pekerjaan_wali'] = idx;
    } else if (h.includes('TINGGI')) {
      colMap['tinggi_badan'] = idx;
    } else if (h.includes('BERAT')) {
      colMap['berat_badan'] = idx;
    } else if (h.includes('PENDENGARAN')) {
      colMap['pendengaran'] = idx;
    } else if (h.includes('PENGLIHATAN')) {
      colMap['penglihatan'] = idx;
    }
  });

  const parsedRows: SiswaImportRow[] = [];
  const existingNisnMap = new Map<string, Siswa>();
  existingStudents.forEach((s) => {
    if (s.nisn?.trim()) existingNisnMap.set(s.nisn.trim(), s);
  });

  const seenNisnInFile = new Map<string, number>(); // nisn -> baris Excel
  const seenNisInFile = new Map<string, number>(); // nis -> baris Excel

  let exampleRowsIgnored = 0;
  let newValidCount = 0;
  let quotaExceededCount = 0;
  const availableSlots = Math.max(0, maxClassQuota - currentEnrolledCount);

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawNama = String(row[colMap['nama']] ?? '').trim();
    const rawJK = String(row[colMap['jk']] ?? '').trim();
    const rawNis = String(row[colMap['nis']] ?? '').trim();
    const rawNisn = String(row[colMap['nisn']] ?? '').trim();
    const rawAgama = String(row[colMap['agama']] ?? '').trim();
    const rawTempat = String(row[colMap['tempat_lahir']] ?? '').trim();
    const rawTgl = row[colMap['tanggal_lahir']];
    const rawPendidikan = String(row[colMap['pendidikan_sebelumnya']] ?? '').trim();
    const rawAlamat = String(row[colMap['alamat']] ?? '').trim();
    const rawAyah = String(row[colMap['nama_ayah']] ?? '').trim();
    const rawPekerjaanAyah = String(row[colMap['pekerjaan_ayah']] ?? '').trim();
    const rawIbu = String(row[colMap['nama_ibu']] ?? '').trim();
    const rawPekerjaanIbu = String(row[colMap['pekerjaan_ibu']] ?? '').trim();
    const rawWali = String(row[colMap['nama_wali']] ?? '').trim();
    const rawPekerjaanWali = String(row[colMap['pekerjaan_wali']] ?? '').trim();
    const rawTinggi = row[colMap['tinggi_badan']];
    const rawBerat = row[colMap['berat_badan']];
    const rawPendengaran = String(row[colMap['pendengaran']] ?? '').trim();
    const rawPenglihatan = String(row[colMap['penglihatan']] ?? '').trim();

    // 1. Abaikan baris contoh secara otomatis
    if (rawNama.toUpperCase().startsWith('CONTOH')) {
      exampleRowsIgnored++;
      continue;
    }

    // 2. Abaikan baris yang sepenuhnya kosong
    if (!rawNama && !rawNis && !rawNisn && !rawJK) {
      continue;
    }

    const rowErrors: string[] = [];

    // Validasi Nama Lengkap (Wajib)
    const cleanNama = normalizeNama(rawNama);
    if (!cleanNama) {
      rowErrors.push('Nama lengkap wajib diisi');
    }

    // Validasi Jenis Kelamin (Wajib, L / P)
    const normJK = normalizeJenisKelamin(rawJK);
    if (!rawJK) {
      rowErrors.push('Jenis kelamin (L/P) wajib diisi');
    } else if (!normJK.valid) {
      rowErrors.push(`Jenis kelamin '${rawJK}' tidak valid (pilih L atau P)`);
    }

    // Validasi NISN (10 Digit & Keunikan)
    let cleanNisn = rawNisn === '0' ? '' : rawNisn;
    let isExisting = false;
    let existingSiswaId: string | undefined = undefined;

    if (cleanNisn) {
      // Hilangkan spasi atau tanda hubung jika ada
      cleanNisn = cleanNisn.replace(/\s+/g, '').replace(/-/g, '');
      if (!/^\d+$/.test(cleanNisn)) {
        rowErrors.push(`NISN '${cleanNisn}' harus berupa angka`);
      } else if (cleanNisn.length !== 10) {
        rowErrors.push(`NISN '${cleanNisn}' harus tepat 10 digit (saat ini ${cleanNisn.length} digit)`);
      } else {
        // Cek duplikasi di dalam file yang diunggah
        const barisSebelumnya = seenNisnInFile.get(cleanNisn);
        if (barisSebelumnya !== undefined) {
          rowErrors.push(`NISN '${cleanNisn}' dobel di berkas (baris ${barisSebelumnya})`);
        } else {
          seenNisnInFile.set(cleanNisn, r + 1);
        }

        // Cek apakah sudah terdaftar di database kelas
        if (existingNisnMap.has(cleanNisn)) {
          isExisting = true;
          existingSiswaId = existingNisnMap.get(cleanNisn)!.id;
          if (!allowUpdateExisting) {
            rowErrors.push(`NISN '${cleanNisn}' sudah terdaftar pada kelas`);
          }
        }
      }
    }

    // Validasi NIS (Keunikan di dalam file jika diisi)
    const cleanNis = rawNis === '0' ? '' : rawNis;
    if (cleanNis) {
      const barisNisSebelumnya = seenNisInFile.get(cleanNis);
      if (barisNisSebelumnya !== undefined) {
        rowErrors.push(`NIS '${cleanNis}' dobel di berkas (baris ${barisNisSebelumnya})`);
      } else {
        seenNisInFile.set(cleanNis, r + 1);
      }
    }

    // Validasi Tanggal Lahir (DD/MM/YYYY)
    const tgl = parseTanggalLahir(rawTgl);
    if (!tgl.valid) {
      rowErrors.push(`Format tanggal lahir salah '${String(rawTgl || '')}' (gunakan DD/MM/YYYY)`);
    }

    // Validasi Tinggi Badan (Rentang 60 - 200)
    let cleanTinggi: string | number = '';
    if (rawTinggi !== undefined && rawTinggi !== null && String(rawTinggi).trim() !== '') {
      const numTinggi = Number(rawTinggi);
      if (isNaN(numTinggi)) {
        rowErrors.push(`Tinggi badan '${rawTinggi}' harus berupa angka`);
      } else if (numTinggi < 60 || numTinggi > 200) {
        rowErrors.push(`Tinggi badan ${numTinggi} cm di luar rentang wajar (60-200 cm)`);
      } else {
        cleanTinggi = Math.round(numTinggi);
      }
    }

    // Validasi Berat Badan (Rentang 10 - 120)
    let cleanBerat: string | number = '';
    if (rawBerat !== undefined && rawBerat !== null && String(rawBerat).trim() !== '') {
      const numBerat = Number(rawBerat);
      if (isNaN(numBerat)) {
        rowErrors.push(`Berat badan '${rawBerat}' harus berupa angka`);
      } else if (numBerat < 10 || numBerat > 120) {
        rowErrors.push(`Berat badan ${numBerat} kg di luar rentang wajar (10-120 kg)`);
      } else {
        cleanBerat = Math.round(numBerat);
      }
    }

    // Validasi Pilihan Pendengaran & Penglihatan
    const cleanPendengaran = rawPendengaran
      ? rawPendengaran.toUpperCase().includes('KURANG')
        ? 'Kurang'
        : 'Baik'
      : 'Baik';

    const cleanPenglihatan = rawPenglihatan
      ? rawPenglihatan.toUpperCase().includes('KURANG')
        ? 'Kurang'
        : 'Baik'
      : 'Baik';

    // Cek Batas Kuota Kelas (Maksimal 50 siswa)
    if (rowErrors.length === 0) {
      if (!isExisting) {
        if (newValidCount >= availableSlots) {
          rowErrors.push(`Melebihi kuota maksimal kelas (50 siswa, sisa slot: ${availableSlots})`);
          quotaExceededCount++;
        } else {
          newValidCount++;
        }
      }
    }

    parsedRows.push({
      no: parsedRows.length + 1,
      nisn: cleanNisn,
      nis: cleanNis,
      nama: cleanNama,
      jk: normJK.jk || 'L',
      tempat_lahir: rawTempat,
      tanggal_lahir: tgl.isoDate || (typeof rawTgl === 'string' ? rawTgl : ''),
      tanggal_lahir_raw: tgl.displayDate || String(rawTgl || ''),
      agama: rawAgama || 'Islam',
      pendidikan_sebelumnya: rawPendidikan || 'TK / RA',
      alamat: rawAlamat,
      nama_ayah: rawAyah,
      pekerjaan_ayah: rawPekerjaanAyah,
      nama_ibu: rawIbu,
      pekerjaan_ibu: rawPekerjaanIbu,
      nama_wali: rawWali,
      pekerjaan_wali: rawPekerjaanWali,
      tinggi_badan: cleanTinggi,
      berat_badan: cleanBerat,
      pendengaran: cleanPendengaran,
      penglihatan: cleanPenglihatan,
      isValid: rowErrors.length === 0,
      errors: rowErrors,
      isExisting,
      existingSiswaId,
    });
  }

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);
  const existingCount = parsedRows.filter((r) => r.isExisting).length;

  return {
    totalRows: parsedRows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    existingCount,
    exampleCount: exampleRowsIgnored,
    rows: parsedRows,
    validRows,
    invalidRows,
    quotaExceededCount,
  };
}

/**
 * Mengunduh berkas Excel daftar baris bermasalah dengan kolom alasan kesalahan
 */
export async function unduhDaftarBarisBermasalah(
  invalidRows: SiswaImportRow[],
  namaKelas: string = 'Kelas'
): Promise<void> {
  if (invalidRows.length === 0) return;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Baris Bermasalah', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }],
  });

  const columnsWithReason = [
    ...TEMPLATE_COLUMNS,
    { key: 'alasan', header: 'ALASAN MASALAH / ERROR', width: 45, required: false },
  ];

  // Header
  ws.getRow(1).height = 28;
  columnsWithReason.forEach((col, idx) => {
    const cell = ws.getCell(1, idx + 1);
    cell.value = col.header;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: col.key === 'alasan' ? 'FFDC2626' : 'FF1E3A8A' },
    };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getColumn(idx + 1).width = col.width;
  });

  // Baris Data Bermasalah
  invalidRows.forEach((r, idx) => {
    const row = ws.getRow(idx + 2);
    row.height = 22;

    const values: Record<string, any> = {
      no: idx + 1,
      nama: r.nama,
      jk: r.jk,
      nis: r.nis,
      nisn: r.nisn,
      agama: r.agama,
      tempat_lahir: r.tempat_lahir,
      tanggal_lahir: r.tanggal_lahir_raw,
      pendidikan_sebelumnya: r.pendidikan_sebelumnya,
      alamat: r.alamat,
      nama_ayah: r.nama_ayah,
      pekerjaan_ayah: r.pekerjaan_ayah,
      nama_ibu: r.nama_ibu,
      pekerjaan_ibu: r.pekerjaan_ibu,
      nama_wali: r.nama_wali,
      pekerjaan_wali: r.pekerjaan_wali,
      tinggi_badan: r.tinggi_badan,
      berat_badan: r.berat_badan,
      pendengaran: r.pendengaran,
      penglihatan: r.penglihatan,
      alasan: r.errors.join('; '),
    };

    columnsWithReason.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = values[col.key];
      cell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: col.key === 'alasan' ? 'FFDC2626' : 'FF0F172A' },
        bold: col.key === 'alasan',
      };
      if (col.key === 'nis' || col.key === 'nisn') cell.numFmt = '@';
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeKelas = sanitizeFilenamePart(namaKelas);
  const timeStamp = new Date().toISOString().slice(0, 10);
  saveAs(blob, `Daftar-Siswa-Bermasalah-${safeKelas}-${timeStamp}.xlsx`);
}
