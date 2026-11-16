// src/lib/inisialisasiService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { inisialisasiDataDefault, SISWA_SAMPEL_DEFAULT } from './inisialisasiService';
import { SEED_18_KELAS } from './kelasService';
import { SEED_DEFAULT_MAPEL } from './mapelService';

// Polyfill localStorage in Node test environment
const memoryStore: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStore[key] || null,
    setItem: (key: string, val: string) => {
      memoryStore[key] = String(val);
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    clear: () => {
      for (const k in memoryStore) delete memoryStore[k];
    },
  };
}

describe('inisialisasiService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('menginisialisasi 18 kelas, 9 mapel, tahun ajaran, dan data siswa dengan benar', async () => {
    const hasil = await inisialisasiDataDefault({
      uid: 'admin_test',
      nama: 'Admin Penguji',
      peran: 'admin',
    });

    expect(hasil.sukses).toBe(true);
    expect(hasil.totalKelas).toBe(18);
    expect(hasil.totalMapel).toBe(9);
    expect(hasil.totalSiswa).toBe(SISWA_SAMPEL_DEFAULT.length);

    // Verifikasi database lokal
    const raw = localStorage.getItem('erapot_sd_local_database_v1');
    expect(raw).toBeTruthy();
    const db = JSON.parse(raw!);

    expect(db.sekolah.nama).toBe('SD NEGERI 1 SUKARAJA');
    expect(db.mapel.length).toBe(SEED_DEFAULT_MAPEL.length);
    expect(db.siswa.length).toBe(SISWA_SAMPEL_DEFAULT.length);

    // Verifikasi Kelas 1B kosong
    const siswa1B = db.kelasSiswa.filter((ks: any) => ks.kelas_id === 'kelas_1b');
    expect(siswa1B.length).toBe(0);

    // Verifikasi Kelas 6A punya 5 siswa
    const siswa6A = db.kelasSiswa.filter((ks: any) => ks.kelas_id === 'kelas_6a');
    expect(siswa6A.length).toBe(5);
  });

  it('aman dijalankan berulang kali (idempotent)', async () => {
    await inisialisasiDataDefault();
    const hasilKedua = await inisialisasiDataDefault();

    expect(hasilKedua.sukses).toBe(true);
    expect(hasilKedua.totalKelas).toBe(18);
    expect(hasilKedua.totalMapel).toBe(9);

    const raw = localStorage.getItem('erapot_sd_local_database_v1');
    const db = JSON.parse(raw!);

    expect(db.siswa.length).toBe(SISWA_SAMPEL_DEFAULT.length);
  });
});
