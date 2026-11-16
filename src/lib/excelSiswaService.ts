// src/lib/excelSiswaService.ts
// Layanan Template Excel & Impor Siswa (Tahap Bagian B)
// - Pembuatan template resmi Excel (.xlsx) dengan Sheet 'Data Siswa' dan 'Petunjuk Pengisian'
// - Validasi baris impor (NISN ganda, tanggal salah format, kolom wajib kosong, batas 50 siswa)
// - Ekspor baris bermasalah ke berkas Excel terpisah

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { JenisKelamin, Siswa } from '../types';

export interface SiswaImportRow {
  no?: number;
  nisn: string;
  nis: string;
  nama: string;
  jk: JenisKelamin | string;
  tempat_lahir: string;
  tanggal_lahir: string; // standard YYYY-MM-DD
  tanggal_lahir_raw: string; // tampilan asli di excel
  agama: string;
  nama_ayah: string;
  nama_ibu: string;
  alamat: string;
  // Validasi
  isValid: boolean;
  errors: string[];
}

export interface HasilValidasiImportSiswa {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: SiswaImportRow[];
  validRows: SiswaImportRow[];
  invalidRows: SiswaImportRow[];
  quotaExceededCount: number;
}

/**
 * Normalisasi tanggal lahir dari berbagai format Excel:
 * Mendukung serial number Excel, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD.
 * Mengembalikan objek { isoDate: 'YYYY-MM-DD', displayDate: 'DD-MM-YYYY', valid: boolean }
 */
export function parseTanggalLahir(val: any): { isoDate: string; displayDate: string; valid: boolean } {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { isoDate: '', displayDate: '', valid: false };
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
          displayDate: `${dd}-${mm}-${yyyy}`,
          valid: true,
        };
      }
    } catch {}
  }

  const str = String(val).trim();

  // Format DD-MM-YYYY atau DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2030) {
      const dd = String(d).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const yyyy = String(y);
      return {
        isoDate: `${yyyy}-${mm}-${dd}`,
        displayDate: `${dd}-${mm}-${yyyy}`,
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
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2030) {
      const dd = String(d).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const yyyy = String(y);
      return {
        isoDate: `${yyyy}-${mm}-${dd}`,
        displayDate: `${dd}-${mm}-${yyyy}`,
        valid: true,
      };
    }
  }

  return { isoDate: '', displayDate: str, valid: false };
}

/**
 * Membuat dan mengunduh berkas template Excel (.xlsx) untuk Data Siswa
 */
export function unduhTemplateSiswaExcel(namaKelas: string = 'Kelas'): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: DATA SISWA
  const headerData = [
    [
      'No',
      'NISN',
      'NIS',
      'Nama Lengkap',
      'L/P',
      'Tempat Lahir',
      'Tanggal Lahir (DD-MM-YYYY)',
      'Agama',
      'Nama Ayah',
      'Nama Ibu',
      'Alamat',
    ],
    // Contoh baris 1
    [
      1,
      '0135892341',
      '2021001',
      'Ahmad Rizky Pratama',
      'L',
      'Tanggamus',
      '15-05-2014',
      'Islam',
      'Suryanto',
      'Rahayu',
      'Jl. Merdeka No. 12, Pekon Sukaraja',
    ],
    // Contoh baris 2
    [
      2,
      '0135892342',
      '2021002',
      'Bunga Citra Lestari',
      'P',
      'Bandar Lampung',
      '20-08-2014',
      'Islam',
      'Bambang',
      'Siti Aminah',
      'Jl. Kenanga No. 4, Dusun Melati',
    ],
  ];

  const wsData = XLSX.utils.aoa_to_sheet(headerData);

  // Atur lebar kolom agar rapi
  wsData['!cols'] = [
    { wch: 6 },  // No
    { wch: 16 }, // NISN
    { wch: 14 }, // NIS
    { wch: 30 }, // Nama Lengkap
    { wch: 6 },  // L/P
    { wch: 18 }, // Tempat Lahir
    { wch: 28 }, // Tanggal Lahir (DD-MM-YYYY)
    { wch: 14 }, // Agama
    { wch: 22 }, // Nama Ayah
    { wch: 22 }, // Nama Ibu
    { wch: 40 }, // Alamat
  ];

  XLSX.utils.book_append_sheet(wb, wsData, 'Data Siswa');

  // Sheet 2: PETUNJUK PENGISIAN
  const petunjukData = [
    ['PETUNJUK PENGISIAN TEMPLATE DATA SISWA E-RAPOR SD'],
    [''],
    ['KOLOM', 'KEWAJIBAN', 'ATURAN / CONTOH PENGISIAN'],
    ['No', 'Opsional', 'Nomor urut peserta didik (1, 2, 3...)'],
    ['NISN', 'Wajib / Dianjurkan', '10 digit angka unik nasional (contoh: 0135892341). Tidak boleh ada NISN ganda.'],
    ['NIS', 'Opsional', 'Nomor Induk Siswa lokal sekolah (contoh: 2021001).'],
    ['Nama Lengkap', 'WAJIB', 'Nama lengkap peserta didik sesuai Akta Kelahiran / KK. Tidak boleh kosong.'],
    ['L/P', 'WAJIB', "Jenis kelamin: Isi 'L' untuk Laki-laki atau 'P' untuk Perempuan."],
    ['Tempat Lahir', 'Dianjurkan', 'Kota atau Kabupaten tempat lahir (contoh: Tanggamus).'],
    ['Tanggal Lahir (DD-MM-YYYY)', 'WAJIB', "Format tanggal: DD-MM-YYYY (contoh: 15-05-2014). Tanggal lahir harus valid."],
    ['Agama', 'Dianjurkan', 'Pilihan agama: Islam, Kristen, Katolik, Hindu, Buddha, atau Khonghucu.'],
    ['Nama Ayah', 'Dianjurkan', 'Nama ayah kandung / wali peserta didik.'],
    ['Nama Ibu', 'Dianjurkan', 'Nama ibu kandung peserta didik.'],
    ['Alamat', 'Dianjurkan', 'Alamat tempat tinggal lengkap / dusun / pekon / jalan.'],
    [''],
    ['KETENTUAN PENTING:'],
    ['1. Maksimal kapasitas peserta didik per kelas adalah 50 siswa.'],
    ['2. Baris contoh nomor 1 dan 2 dapat Anda hapus atau ganti dengan data siswa asli.'],
    ['3. Jangan mengubah atau menghapus susunan judul kolom pada baris pertama Sheet Data Siswa.'],
    ['4. Saat mengimpor, sistem akan otomatis memverifikasi NISN dobel, format tanggal lahir, dan kelengkapan data.'],
  ];

  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukData);
  wsPetunjuk['!cols'] = [
    { wch: 30 },
    { wch: 20 },
    { wch: 75 },
  ];

  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk Pengisian');

  // Tulis ke file binary dan unduh
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Template_Data_Siswa_${namaKelas.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Mengurai dan memvalidasi berkas Excel (.xlsx / .xls / .xlsm)
 */
export function validasiBerkasSiswaExcel(
  binaryData: any,
  existingStudents: Siswa[] = [],
  currentEnrolledCount: number = 0,
  maxClassQuota: number = 50
): HasilValidasiImportSiswa {
  const wb = XLSX.read(binaryData, { type: 'binary' });

  // Cari sheet 'DATA SISWA' atau sheet pertama
  let targetSheetName = wb.SheetNames.find(
    (name) => name.toUpperCase().replace(/\s+/g, '').includes('DATASISWA')
  );
  if (!targetSheetName) targetSheetName = wb.SheetNames[0];

  const sheet = wb.Sheets[targetSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Cari baris header yang memuat 'NAMA'
  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
    const row = rawRows[r];
    if (
      row &&
      row.some((cell: any) =>
        String(cell || '').toUpperCase().includes('NAMA')
      )
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

  // Petakan kolom secara cerdas berdasarkan teks header
  const colMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    if (h.includes('NISN')) colMap['nisn'] = idx;
    else if (h.includes('NIS') && !h.includes('NISN')) colMap['nis'] = idx;
    else if (h.includes('NAMA') && !h.includes('AYAH') && !h.includes('IBU') && !h.includes('WALI') && !h.includes('SEKOLAH')) colMap['nama'] = idx;
    else if (h.includes('L/P') || h.includes('JK') || h.includes('KELAMIN')) colMap['jk'] = idx;
    else if (h.includes('TEMPAT LAHIR') || (h.includes('TEMPAT') && !h.includes('TINGGAL'))) colMap['tempat_lahir'] = idx;
    else if (h.includes('TANGGAL LAHIR') || h.includes('TGL LAHIR') || h.includes('LAHIR')) colMap['tanggal_lahir'] = idx;
    else if (h.includes('AGAMA')) colMap['agama'] = idx;
    else if (h.includes('AYAH') && !h.includes('PEKERJAAN')) colMap['nama_ayah'] = idx;
    else if (h.includes('IBU') && !h.includes('PEKERJAAN')) colMap['nama_ibu'] = idx;
    else if (h.includes('ALAMAT')) colMap['alamat'] = idx;
  });

  const parsedRows: SiswaImportRow[] = [];
  const existingNisnSet = new Set(
    existingStudents.map((s) => s.nisn?.trim()).filter(Boolean)
  );
  const seenNisnInBatch = new Map<string, number>(); // nisn -> row index

  const availableSlots = Math.max(0, maxClassQuota - currentEnrolledCount);
  let validSoFar = 0;
  let quotaExceededCount = 0;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawNama = row[colMap['nama'] !== undefined ? colMap['nama'] : 3];
    const rawNisn = String(row[colMap['nisn'] !== undefined ? colMap['nisn'] : 1] || '').trim();
    const rawNis = String(row[colMap['nis'] !== undefined ? colMap['nis'] : 2] || '').trim();
    const rawJK = String(row[colMap['jk'] !== undefined ? colMap['jk'] : 4] || '').trim().toUpperCase();
    const rawTempat = String(row[colMap['tempat_lahir'] !== undefined ? colMap['tempat_lahir'] : 5] || '').trim();
    const rawTgl = row[colMap['tanggal_lahir'] !== undefined ? colMap['tanggal_lahir'] : 6];
    const rawAgama = String(row[colMap['agama'] !== undefined ? colMap['agama'] : 7] || 'Islam').trim();
    const rawAyah = String(row[colMap['nama_ayah'] !== undefined ? colMap['nama_ayah'] : 8] || '').trim();
    const rawIbu = String(row[colMap['nama_ibu'] !== undefined ? colMap['nama_ibu'] : 9] || '').trim();
    const rawAlamat = String(row[colMap['alamat'] !== undefined ? colMap['alamat'] : 10] || '').trim();

    // Lewati baris kosong seutuhnya
    if (
      (!rawNama || String(rawNama).trim() === '' || String(rawNama).trim() === '0') &&
      !rawNisn &&
      !rawNis
    ) {
      continue;
    }

    const rowErrors: string[] = [];

    // 1. Validasi Nama Lengkap (Wajib)
    const cleanNama = String(rawNama || '').trim();
    if (!cleanNama || cleanNama === '0') {
      rowErrors.push('Nama lengkap wajib diisi');
    }

    // 2. Validasi L/P
    let parsedJK: JenisKelamin = 'L';
    if (rawJK.startsWith('P') || rawJK.includes('PEREMPUAN') || rawJK === 'WANITA') {
      parsedJK = 'P';
    } else if (rawJK.startsWith('L') || rawJK.includes('LAKI') || rawJK === 'PRIA') {
      parsedJK = 'L';
    } else if (!rawJK) {
      rowErrors.push('Jenis kelamin (L/P) belum diisi');
    } else {
      rowErrors.push(`Jenis kelamin '${rawJK}' tidak valid (gunakan L atau P)`);
    }

    // 3. Validasi Tanggal Lahir (DD-MM-YYYY)
    const tglParsed = parseTanggalLahir(rawTgl);
    if (!tglParsed.valid) {
      rowErrors.push(`Format tanggal lahir salah '${String(rawTgl || '')}' (harus DD-MM-YYYY)`);
    }

    // 4. Validasi NISN (10 Digit & Keunikan)
    const cleanNisn = rawNisn === '0' ? '' : rawNisn;
    if (cleanNisn) {
      // Periksa digit angka
      if (!/^\d+$/.test(cleanNisn)) {
        rowErrors.push(`NISN '${cleanNisn}' harus berupa angka`);
      } else if (cleanNisn.length !== 10) {
        rowErrors.push(`NISN '${cleanNisn}' harus 10 digit (saat ini ${cleanNisn.length} digit)`);
      }

      // Periksa duplikasi dalam batch unggahan
      if (seenNisnInBatch.has(cleanNisn)) {
        rowErrors.push(`NISN '${cleanNisn}' dobel di baris ${seenNisnInBatch.get(cleanNisn)! + 1}`);
      } else {
        seenNisnInBatch.set(cleanNisn, parsedRows.length);
      }

      // Periksa duplikasi dengan database siswa yang sudah ada
      if (existingNisnSet.has(cleanNisn)) {
        rowErrors.push(`NISN '${cleanNisn}' sudah terdaftar pada database sekolah`);
      }
    }

    // 5. Validasi Kapasitas / Kuota 50 Siswa
    if (rowErrors.length === 0) {
      if (validSoFar >= availableSlots) {
        rowErrors.push(`Melebihi batas kuota kelas (maksimal 50 siswa, sisa slot: ${availableSlots})`);
        quotaExceededCount++;
      } else {
        validSoFar++;
      }
    }

    parsedRows.push({
      no: parsedRows.length + 1,
      nisn: cleanNisn,
      nis: rawNis === '0' ? '' : rawNis,
      nama: cleanNama,
      jk: parsedJK,
      tempat_lahir: rawTempat,
      tanggal_lahir: tglParsed.isoDate || (typeof rawTgl === 'string' ? rawTgl : ''),
      tanggal_lahir_raw: tglParsed.displayDate || String(rawTgl || ''),
      agama: rawAgama || 'Islam',
      nama_ayah: rawAyah,
      nama_ibu: rawIbu,
      alamat: rawAlamat,
      isValid: rowErrors.length === 0,
      errors: rowErrors,
    });
  }

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  return {
    totalRows: parsedRows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    rows: parsedRows,
    validRows,
    invalidRows,
    quotaExceededCount,
  };
}

/**
 * Mengunduh daftar baris bermasalah ke berkas Excel (.xlsx) dengan kolom Alasan Masalah
 */
export function unduhDaftarBarisBermasalah(invalidRows: SiswaImportRow[]): void {
  if (invalidRows.length === 0) return;

  const header = [
    'No',
    'NISN',
    'NIS',
    'Nama Lengkap',
    'L/P',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Agama',
    'Nama Ayah',
    'Nama Ibu',
    'Alamat',
    'ALASAN MASALAH / ERROR',
  ];

  const rowsData = invalidRows.map((r, i) => [
    i + 1,
    r.nisn,
    r.nis,
    r.nama,
    r.jk,
    r.tempat_lahir,
    r.tanggal_lahir_raw,
    r.agama,
    r.nama_ayah,
    r.nama_ibu,
    r.alamat,
    r.errors.join('; '),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rowsData]);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 },
    { wch: 6 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 22 },
    { wch: 35 },
    { wch: 50 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Baris Bermasalah');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const timeStamp = new Date().toISOString().slice(0, 10);
  saveAs(blob, `Daftar_Siswa_Bermasalah_${timeStamp}.xlsx`);
}

