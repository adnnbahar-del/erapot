import { describe, it, expect, beforeEach } from 'vitest';
import {
  SEED_18_KELAS,
  formatNamaKelas,
  hitungUrutanKelas,
  tambahKelas,
  tambahRombelBerikutnya,
  getAllKelas,
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

describe('Tahap 2 — Kelas, Rombel & Wali Kelas Dinamis (18 Kelas Seed & Naming Rules)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('SEED_18_KELAS memiliki tepat 18 kelas dengan urutan per tingkat: tanpa rombel, A, B', () => {
    expect(SEED_18_KELAS.length).toBe(18);

    const expectedNames = [
      'Kelas 1', 'Kelas 1A', 'Kelas 1B',
      'Kelas 2', 'Kelas 2A', 'Kelas 2B',
      'Kelas 3', 'Kelas 3A', 'Kelas 3B',
      'Kelas 4', 'Kelas 4A', 'Kelas 4B',
      'Kelas 5', 'Kelas 5A', 'Kelas 5B',
      'Kelas 6', 'Kelas 6A', 'Kelas 6B',
    ];

    const names = SEED_18_KELAS.map((k) => k.nama);
    expect(names).toEqual(expectedNames);

    // Semua kelas aktif dan wali kelas masih kosong
    SEED_18_KELAS.forEach((k) => {
      expect(k.aktif).toBe(true);
      expect(k.waliKelasUid).toBeUndefined();
      expect(k.namaWali).toBeUndefined();
    });
  });

  it('formatNamaKelas menghasilkan "Kelas [tingkat]" jika rombel kosong dan "Kelas [tingkat][rombel]" jika ada rombel', () => {
    expect(formatNamaKelas(1, '')).toBe('Kelas 1');
    expect(formatNamaKelas(1, 'A')).toBe('Kelas 1A');
    expect(formatNamaKelas(3, 'b')).toBe('Kelas 3B');
    expect(formatNamaKelas(6, '')).toBe('Kelas 6');
    expect(formatNamaKelas(6, 'C')).toBe('Kelas 6C');
  });

  it('hitungUrutanKelas menjamin kelas tanpa rombel lebih dulu daripada rombel berhuruf', () => {
    const urutan1 = hitungUrutanKelas(1, '');
    const urutan1A = hitungUrutanKelas(1, 'A');
    const urutan1B = hitungUrutanKelas(1, 'B');
    const urutan2 = hitungUrutanKelas(2, '');

    expect(urutan1).toBeLessThan(urutan1A);
    expect(urutan1A).toBeLessThan(urutan1B);
    expect(urutan1B).toBeLessThan(urutan2);
  });

  it('tambahKelas menolak duplikat nama kelas pada tingkat yang sama', async () => {
    const existing = await getAllKelas();

    // Mencoba menambahkan Kelas 2 tanpa rombel lagi
    await expect(tambahKelas(2, '', existing)).rejects.toThrow('Kelas 2 sudah ada.');

    // Mencoba menambahkan Kelas 3A lagi
    await expect(tambahKelas(3, 'A', existing)).rejects.toThrow('Kelas 3A sudah ada.');
  });

  it('tambahRombelBerikutnya otomatis menambah huruf berikutnya (3A, 3B -> 3C)', async () => {
    const existing = await getAllKelas();
    const newClass = await tambahRombelBerikutnya(3, existing);

    expect(newClass.tingkat).toBe(3);
    expect(newClass.rombel).toBe('C');
    expect(newClass.nama).toBe('Kelas 3C');
  });
});

