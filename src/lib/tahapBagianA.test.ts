import { describe, it, expect, beforeEach } from 'vitest';
import {
  SEED_DEFAULT_MAPEL,
  seedDefaultMapel,
  getAllMapel,
  getMapelForSession,
  getMapelForWaliKelasView,
  toggleMapelKelas,
  tambahMapelAdmin,
  updateMapelAdmin,
  deleteMapelAdmin,
  LOCAL_STORAGE_MAPEL_KEY,
} from './mapelService';
import { Mapel } from '../types';

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

describe('Bagian A — Mata Pelajaran Default per Fase Kurikulum Merdeka', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. SEED_DEFAULT_MAPEL memiliki 9 mapel standar Kurikulum Merdeka', () => {
    expect(SEED_DEFAULT_MAPEL).toHaveLength(9);

    const codes = SEED_DEFAULT_MAPEL.map((m) => m.kode);
    expect(codes).toContain('PA_BP');
    expect(codes).toContain('PANCASILA');
    expect(codes).toContain('BINDO');
    expect(codes).toContain('MTK');
    expect(codes).toContain('IPAS');
    expect(codes).toContain('PJOK');
    expect(codes).toContain('SENI');
    expect(codes).toContain('BING');
    expect(codes).toContain('MULOK_LAMPUNG');

    // Cek varian agama untuk PA_BP
    const pabp = SEED_DEFAULT_MAPEL.find((m) => m.kode === 'PA_BP');
    expect(pabp?.varianAgama).toEqual([
      'Islam',
      'Kristen',
      'Katolik',
      'Hindu',
      'Buddha',
      'Khonghucu',
    ]);
  });

  it('2. seedDefaultMapel aman dijalankan berulang kali tanpa dobel (idempotent)', async () => {
    const list1 = await seedDefaultMapel();
    expect(list1).toHaveLength(9);

    // Jalankan kedua kalinya
    const list2 = await seedDefaultMapel();
    expect(list2).toHaveLength(9);

    // Jalankan ketiga kalinya
    const list3 = await seedDefaultMapel();
    expect(list3).toHaveLength(9);
  });

  it('3. IPAS hanya berlaku di Fase B dan C, otomatis dikecualikan di Fase A', async () => {
    const allMapel = await seedDefaultMapel();

    // Sesi Fase A (Kelas 1)
    const mapelFaseA = getMapelForSession(allMapel, {
      fase: 'A',
      kelasId: 'kelas_1',
      peran: 'guru',
    });
    expect(mapelFaseA.find((m) => m.kode === 'IPAS')).toBeUndefined();
    expect(mapelFaseA).toHaveLength(8); // 9 minus IPAS

    // Sesi Fase B (Kelas 4)
    const mapelFaseB = getMapelForSession(allMapel, {
      fase: 'B',
      kelasId: 'kelas_4',
      peran: 'guru',
    });
    expect(mapelFaseB.find((m) => m.kode === 'IPAS')).toBeDefined();
    expect(mapelFaseB).toHaveLength(9);

    // Sesi Fase C (Kelas 6)
    const mapelFaseC = getMapelForSession(allMapel, {
      fase: 'C',
      kelasId: 'kelas_6',
      peran: 'guru',
    });
    expect(mapelFaseC.find((m) => m.kode === 'IPAS')).toBeDefined();
    expect(mapelFaseC).toHaveLength(9);
  });

  it('4. Wali Kelas dapat menonaktifkan mapel pilihan/mulok untuk kelasnya, tapi tidak mapel wajib', async () => {
    const allMapel = await seedDefaultMapel();

    // Nonaktifkan BING untuk kelas_1a
    const bing = allMapel.find((m) => m.kode === 'BING')!;
    await toggleMapelKelas(bing.id, 'kelas_1a', false);

    // Ambil ulang dari local
    const refreshed = await getAllMapel();

    // Cek sesi kelas_1a: BING tidak ada lagi (jadi 7 mapel)
    const mapel1a = getMapelForSession(refreshed, {
      fase: 'A',
      kelasId: 'kelas_1a',
      peran: 'guru',
    });
    expect(mapel1a.find((m) => m.kode === 'BING')).toBeUndefined();
    expect(mapel1a).toHaveLength(7);

    // Cek sesi kelas_1b: BING masih tetap aktif (8 mapel)
    const mapel1b = getMapelForSession(refreshed, {
      fase: 'A',
      kelasId: 'kelas_1b',
      peran: 'guru',
    });
    expect(mapel1b.find((m) => m.kode === 'BING')).toBeDefined();
    expect(mapel1b).toHaveLength(8);

    // Coba nonaktifkan mapel wajib (Matematika) -> harus ditolak
    const mtk = allMapel.find((m) => m.kode === 'MTK')!;
    await expect(toggleMapelKelas(mtk.id, 'kelas_1a', false)).rejects.toThrow(
      'Mata pelajaran wajib tidak dapat dinonaktifkan.'
    );
  });

  it('5. Admin dapat menambah, mengubah, dan menghapus mapel master', async () => {
    await seedDefaultMapel();

    // Tambah Mapel baru (misal Bahasa Sunda / Mulok 2)
    const baru = await tambahMapelAdmin({
      kode: 'SUNDA',
      nama: 'Bahasa Sunda',
      kelompok: 'mulok',
      faseBerlaku: ['A', 'B'],
      urutanRapor: 10,
    });
    expect(baru.id).toBeDefined();
    expect(baru.kode).toBe('SUNDA');

    let all = await getAllMapel();
    expect(all).toHaveLength(10);

    // Ubah Mapel
    const updated = await updateMapelAdmin(baru.id, {
      nama: 'Bahasa & Sastra Sunda',
    });
    expect(updated.nama).toBe('Bahasa & Sastra Sunda');

    // Hapus Mapel
    await deleteMapelAdmin(baru.id);
    all = await getAllMapel();
    expect(all).toHaveLength(9);
    expect(all.find((m) => m.kode === 'SUNDA')).toBeUndefined();
  });
});

