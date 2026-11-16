/**
 * Seed data untuk Emulator Firestore / E-Rapor SD
 * Campuran:
 * - Tingkat 1, 2, 6: Dibagi rombel (A/B/C)
 * - Tingkat 3, 4, 5: Satu kelas (tanpa rombel)
 * - Akun contoh guru: 1A, Kelas 4, 6A
 * - Siswa uji: 5 siswa di 6A, 2 siswa di Kelas 4
 */

import { ModeKelas, idKelas, labelKelas, emailGuru } from '../src/lib/rombel';

export interface SeedTingkat {
  tingkat: number;
  modeKelas: ModeKelas;
  nama: string;
}

export interface SeedRombel {
  id: string;
  tingkat: number;
  huruf: string;
  nama: string;
  label: string;
  namaWali: string;
  nipWali: string;
  adaAkun: boolean;
  emailGuru?: string;
}

export interface SeedSiswa {
  id: string;
  nis: string;
  nisn: string;
  nama: string;
  jk: 'L' | 'P';
  rombelId: string;
  tingkat: number;
}

export const SEED_DOMAIN = 'erapor-sd.web.app';

export const SEED_TINGKAT: SeedTingkat[] = [
  { tingkat: 1, modeKelas: 'rombel', nama: 'Kelas 1' },
  { tingkat: 2, modeKelas: 'rombel', nama: 'Kelas 2' },
  { tingkat: 3, modeKelas: 'tunggal', nama: 'Kelas 3' },
  { tingkat: 4, modeKelas: 'tunggal', nama: 'Kelas 4' },
  { tingkat: 5, modeKelas: 'tunggal', nama: 'Kelas 5' },
  { tingkat: 6, modeKelas: 'rombel', nama: 'Kelas 6' },
];

export const SEED_ROMBEL: SeedRombel[] = [
  // Tingkat 1 (Rombel)
  { id: '1A', tingkat: 1, huruf: 'A', nama: '1A', label: '1A', namaWali: 'Ahmad Fauzi, S.Pd', nipWali: '198501012010011001', adaAkun: true, emailGuru: emailGuru('1A', SEED_DOMAIN) },
  { id: '1B', tingkat: 1, huruf: 'B', nama: '1B', label: '1B', namaWali: 'Dewi Lestari, S.Pd', nipWali: '198703152011012003', adaAkun: false },
  { id: '1C', tingkat: 1, huruf: 'C', nama: '1C', label: '1C', namaWali: 'Budi Santoso, S.Pd', nipWali: '198606202009011002', adaAkun: false },

  // Tingkat 2 (Rombel)
  { id: '2A', tingkat: 2, huruf: 'A', nama: '2A', label: '2A', namaWali: 'Rina Wahyuni, S.Pd', nipWali: '198902142012012004', adaAkun: false },
  { id: '2B', tingkat: 2, huruf: 'B', nama: '2B', label: '2B', namaWali: 'Eko Prasetyo, S.Pd', nipWali: '198411122008011005', adaAkun: false },
  { id: '2C', tingkat: 2, huruf: 'C', nama: '2C', label: '2C', namaWali: 'Sri Handayani, S.Pd', nipWali: '199004252014012006', adaAkun: false },

  // Tingkat 3 (Tunggal / Satu Kelas)
  { id: '3', tingkat: 3, huruf: '', nama: '3', label: 'Kelas 3', namaWali: 'Dian Permata, S.Pd', nipWali: '199108172015012007', adaAkun: false },

  // Tingkat 4 (Tunggal / Satu Kelas)
  { id: '4', tingkat: 4, huruf: '', nama: '4', label: 'Kelas 4', namaWali: 'Siti Nurhayati, S.Pd', nipWali: '198810202011012008', adaAkun: true, emailGuru: emailGuru('4', SEED_DOMAIN) },

  // Tingkat 5 (Tunggal / Satu Kelas)
  { id: '5', tingkat: 5, huruf: '', nama: '5', label: 'Kelas 5', namaWali: 'Hendra Setiawan, S.Pd', nipWali: '198305302007011009', adaAkun: false },

  // Tingkat 6 (Rombel)
  { id: '6A', tingkat: 6, huruf: 'A', nama: '6A', label: '6A', namaWali: 'Bambang Irawan, S.Pd', nipWali: '198207192006041008', adaAkun: true, emailGuru: emailGuru('6A', SEED_DOMAIN) },
  { id: '6B', tingkat: 6, huruf: 'B', nama: '6B', label: '6B', namaWali: 'Nurul Hidayati, S.Pd', nipWali: '198612052010012010', adaAkun: false },
  { id: '6C', tingkat: 6, huruf: 'C', nama: '6C', label: '6C', namaWali: 'Agus Wibowo, S.Pd', nipWali: '198409142008011011', adaAkun: false },
];

export const SEED_SISWA: SeedSiswa[] = [
  // 5 Siswa Uji di 6A
  { id: 's_6a_01', nis: '2021001', nisn: '0123456789', nama: 'ADI PRASETYO', jk: 'L', rombelId: '6A', tingkat: 6 },
  { id: 's_6a_02', nis: '2021002', nisn: '0123456790', nama: 'BELLA ANGGRAINI', jk: 'P', rombelId: '6A', tingkat: 6 },
  { id: 's_6a_03', nis: '2021003', nisn: '0123456791', nama: 'CITRA LESTARI', jk: 'P', rombelId: '6A', tingkat: 6 },
  { id: 's_6a_04', nis: '2021004', nisn: '0123456792', nama: 'DIMAS ARYA PUTRA', jk: 'L', rombelId: '6A', tingkat: 6 },
  { id: 's_6a_05', nis: '2021005', nisn: '0123456793', nama: 'EKA WULANDARI', jk: 'P', rombelId: '6A', tingkat: 6 },

  // 2 Siswa Uji di Kelas 4 (Satu Kelas)
  { id: 's_4_01', nis: '2023001', nisn: '0145678901', nama: 'FAJAR NUGRAHA', jk: 'L', rombelId: '4', tingkat: 4 },
  { id: 's_4_02', nis: '2023002', nisn: '0145678902', nama: 'GITA MAHARANI', jk: 'P', rombelId: '4', tingkat: 4 },
];

export async function seedEmulator() {
  console.log('Seeding emulator data...');
  console.log(`Tingkat: ${SEED_TINGKAT.length} tingkat`);
  console.log(`Rombel: ${SEED_ROMBEL.length} rombel/kelas`);
  console.log(`Siswa: ${SEED_SISWA.length} siswa (${SEED_SISWA.filter(s => s.rombelId === '6A').length} di 6A, ${SEED_SISWA.filter(s => s.rombelId === '4').length} di Kelas 4)`);
  console.log('Akun Guru Aktif:');
  console.log('- 1A: guru-1a@erapor-sd.web.app');
  console.log('- Kelas 4: guru-4@erapor-sd.web.app');
  console.log('- 6A: guru-6a@erapor-sd.web.app');
}
