// src/lib/tahap4Perbaikan.test.ts
// Unit testing untuk Tahap 4: Pemeriksaan dan Perbaikan Semua Kelas

import { describe, it, expect, beforeEach } from 'vitest';
import {
  periksaSemuaKelas,
  terapkanPerbaikanSemuaKelas,
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

describe('Tahap 4 — Periksa & Perbaiki Semua Kelas', () => {
  beforeEach(() => {
    localStorage.clear();
    // Seed kelas ke local storage
    localStorage.setItem('erapot_sd_kelas_v2', JSON.stringify(SEED_18_KELAS));
  });

  it('berhasil melakukan pemeriksaan dan mendeteksi status kelas', async () => {
    const hasil = await periksaSemuaKelas();
    expect(hasil.totalKelas).toBe(18);
    expect(Array.isArray(hasil.masalah)).toBe(true);
    expect(Array.isArray(hasil.daftarMasalahFormatted)).toBe(true);
  });

  it('dapat mendeteksi siswa yang belum memiliki field kelasId', async () => {
    const dbMock = {
      siswa: [
        { id: 'siswa_1', nama: 'Budi', kelas: 'Kelas 6A' }, // tanpa kelasId
        { id: 'siswa_2', nama: 'Ani', kelasId: 'kelas_6a', kelas_id: 'kelas_6a' },
      ],
      kelasSiswa: [
        { id: 'ks_1', siswa_id: 'siswa_1', kelas_id: 'kelas_6a' },
        { id: 'ks_2', siswa_id: 'siswa_2', kelas_id: 'kelas_6a' },
      ],
    };
    localStorage.setItem('erapot_sd_local_database_v1', JSON.stringify(dbMock));

    const hasil = await periksaSemuaKelas();
    const masalahSiswa = hasil.masalah.find((m) => m.kategori === 'siswa_kelasId' && m.kelasId === 'kelas_6a');
    expect(masalahSiswa).toBeDefined();
    expect(masalahSiswa?.deskripsi).toContain('siswa belum memiliki field kelasId');
  });

  it('dapat mendeteksi users.kelasId yang tidak sesuai format ID dokumen', async () => {
    // Buat user dengan kelasId '6A' bukannya 'kelas_6a'
    const usersMock = [
      {
        uid: 'uid_wali_6a',
        peran: 'wali_kelas',
        kelasId: '6A', // SALAH! Seharusnya 'kelas_6a'
        aktif: true,
      },
    ];
    localStorage.setItem('erapot_users_firestore_fallback', JSON.stringify(usersMock));

    const kelasList = [...SEED_18_KELAS];
    const k6a = kelasList.find((k) => k.id === 'kelas_6a')!;
    k6a.waliKelasUid = 'uid_wali_6a';
    localStorage.setItem('erapot_sd_kelas_v2', JSON.stringify(kelasList));

    const hasil = await periksaSemuaKelas();
    const masalahUser = hasil.masalah.find((m) => m.kategori === 'users_kelasId' && m.kelasId === 'kelas_6a');
    expect(masalahUser).toBeDefined();
    expect(masalahUser?.deskripsi).toContain("users.kelasId bernilai '6A', seharusnya 'kelas_6a'");
  });

  it('eksekusi perbaikan melaporkan hasil sesuai format yang diharapkan', async () => {
    const hasilPeriksa = await periksaSemuaKelas();
    const hasilEksekusi = await terapkanPerbaikanSemuaKelas(hasilPeriksa);

    expect(hasilEksekusi.totalDiperiksa).toBe(18);
    expect(typeof hasilEksekusi.totalDiperbaiki).toBe('number');
    expect(hasilEksekusi.totalGagal).toBe(0);
    expect(hasilEksekusi.pesanRingkasan).toMatch(/\d+ kelas diperiksa, \d+ diperbaiki, \d+ gagal/);
  });
});
