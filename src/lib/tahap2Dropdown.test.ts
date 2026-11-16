// src/lib/tahap2Dropdown.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  seedDanBersihkanKelas,
  getAllKelas,
  getKelasAktif,
  SEED_18_KELAS,
} from './kelasService';

// Polyfill localStorage untuk Node test environment
const memoryStore: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStore[key] || null,
    setItem: (key: string, val: string) => { memoryStore[key] = String(val); },
    removeItem: (key: string) => { delete memoryStore[key]; },
    clear: () => {
      for (const k in memoryStore) delete memoryStore[k];
    },
  };
}

describe('Tahap 2: Seed & Dropdown KELAS Login', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('menghasilkan tepat 18 kelas aktif dengan nama lengkap dan urutan benar', async () => {
    const hasil = await seedDanBersihkanKelas();

    expect(hasil.daftar18Kelas).toHaveLength(18);
    expect(hasil.daftar18Kelas).toEqual([
      'Kelas 1', 'Kelas 1A', 'Kelas 1B',
      'Kelas 2', 'Kelas 2A', 'Kelas 2B',
      'Kelas 3', 'Kelas 3A', 'Kelas 3B',
      'Kelas 4', 'Kelas 4A', 'Kelas 4B',
      'Kelas 5', 'Kelas 5A', 'Kelas 5B',
      'Kelas 6', 'Kelas 6A', 'Kelas 6B',
    ]);

    const aktif = await getKelasAktif();
    expect(aktif).toHaveLength(18);
    expect(aktif.map((k) => k.nama)).toEqual(hasil.daftar18Kelas);
  });

  it('menghapus kelas lama tanpa siswa (1C, 2C, 6C) dan aman dijalankan berulang', async () => {
    // Simulasikan kelas lama ada di localStorage
    const legacy = [
      { id: 'rombel_1c', tingkat: 1, rombel: 'C', nama: 'Kelas 1C', urutan: 103, aktif: true },
      { id: 'rombel_2c', tingkat: 2, rombel: 'C', nama: 'Kelas 2C', urutan: 203, aktif: true },
      { id: 'rombel_6c', tingkat: 6, rombel: 'C', nama: 'Kelas 6C', urutan: 603, aktif: true },
    ];
    localStorage.setItem('erapot_sd_kelas_v2', JSON.stringify(legacy));

    const hasil1 = await seedDanBersihkanKelas();
    expect(hasil1.kelasDihapus).toContain('Kelas 1C');
    expect(hasil1.kelasDihapus).toContain('Kelas 2C');
    expect(hasil1.kelasDihapus).toContain('Kelas 6C');

    // Cek bahwa sekarang hanya ada 18 kelas
    const aktif = await getKelasAktif();
    expect(aktif).toHaveLength(18);
    expect(aktif.some((k) => k.nama === 'Kelas 1C')).toBe(false);

    // Jalankan ulang (idempotent)
    const hasil2 = await seedDanBersihkanKelas();
    expect(hasil2.kelasDihapus).toHaveLength(0);
    const aktif2 = await getKelasAktif();
    expect(aktif2).toHaveLength(18);
  });

  it('jika kelas lama memiliki siswa/nilai, dinonaktifkan (aktif = false), tidak dihapus', async () => {
    // Simulasikan database dengan siswa di kelas 1C
    const mockDb = {
      kelasSiswa: [
        { id: 'ks_1', siswa_id: 's_1', kelas_id: 'rombel_1c', rombel_id: 'rombel_1c' },
        { id: 'ks_2', siswa_id: 's_2', kelas_id: 'rombel_1c', rombel_id: 'rombel_1c' },
      ],
      formatif: [],
      sumatifLM: [],
      sumatifSemester: [],
    };
    localStorage.setItem('erapot_sd_local_database_v1', JSON.stringify(mockDb));

    const legacy = [
      { id: 'rombel_1c', tingkat: 1, rombel: 'C', nama: 'Kelas 1C', urutan: 103, aktif: true },
      { id: 'rombel_2c', tingkat: 2, rombel: 'C', nama: 'Kelas 2C', urutan: 203, aktif: true }, // tidak punya siswa
    ];
    localStorage.setItem('erapot_sd_kelas_v2', JSON.stringify(legacy));

    const hasil = await seedDanBersihkanKelas();

    // 2C dihapus karena 0 siswa
    expect(hasil.kelasDihapus).toContain('Kelas 2C');
    // 1C dinonaktifkan karena ada 2 siswa
    expect(hasil.kelasDinonaktifkan).toEqual([
      { nama: 'Kelas 1C', jumlahSiswa: 2 },
    ]);

    // Daftar aktif tetap tepat 18
    const aktif = await getKelasAktif();
    expect(aktif).toHaveLength(18);
    expect(aktif.some((k) => k.nama === 'Kelas 1C')).toBe(false);

    // Di semua kelas, 1C masih ada tapi aktif = false
    const semua = await getAllKelas();
    const c1 = semua.find((k) => k.id === 'rombel_1c');
    expect(c1).toBeDefined();
    expect(c1?.aktif).toBe(false);
  });
});
