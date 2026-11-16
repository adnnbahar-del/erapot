import { describe, it, expect, beforeEach } from 'vitest';
import {
  finalkanRaporKelas,
  getStatusFinalisasi,
  bukaKunciRaporKelas,
  getAllStatusFinalisasi,
  generateFinalisasiId,
} from './kunciNilaiService';

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

describe('Tahap 4 — Kunci Nilai & Finalisasi Rapor Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generateFinalisasiId creates normalized composite key', () => {
    const id = generateFinalisasiId('kelas_1A', 'TA_2025_1');
    expect(id).toBe('fin_kelas_1a_ta_2025_1');
  });

  it('finalkanRaporKelas sets status to final with timestamp and user info', async () => {
    const res = await finalkanRaporKelas({
      kelasId: 'kelas_1a',
      kelasNama: 'Kelas 1A',
      tahunAjaranId: 'ta_2025_1',
      userUid: 'uid_wali_1',
      userNama: 'Siti Nurjanah, S.Pd',
    });

    expect(res.status).toBe('final');
    expect(res.kelasId).toBe('kelas_1a');
    expect(res.tanggalFinal).toBeDefined();
    expect(res.difinalkanOlehNama).toBe('Siti Nurjanah, S.Pd');

    const status = await getStatusFinalisasi('kelas_1a', 'ta_2025_1');
    expect(status?.status).toBe('final');
  });

  it('bukaKunciRaporKelas throws error if reason is empty', async () => {
    // First finalize
    await finalkanRaporKelas({
      kelasId: 'kelas_2a',
      kelasNama: 'Kelas 2A',
      tahunAjaranId: 'ta_2025_1',
    });

    // Attempt to unlock with empty reason
    await expect(
      bukaKunciRaporKelas({
        kelasId: 'kelas_2a',
        tahunAjaranId: 'ta_2025_1',
        alasan: '   ',
        adminNama: 'Admin',
      })
    ).rejects.toThrow('Alasan pembukaan kunci wajib diisi.');
  });

  it('bukaKunciRaporKelas unlocks class when mandatory reason is provided', async () => {
    // Finalize
    await finalkanRaporKelas({
      kelasId: 'kelas_3a',
      kelasNama: 'Kelas 3A',
      tahunAjaranId: 'ta_2025_1',
      userNama: 'Wali Kelas 3A',
    });

    // Unlock
    const unlocked = await bukaKunciRaporKelas({
      kelasId: 'kelas_3a',
      tahunAjaranId: 'ta_2025_1',
      alasan: 'Perbaikan nilai susulan siswa',
      adminUid: 'admin_1',
      adminNama: 'Adnan Bahar',
    });

    expect(unlocked.status).toBe('terbuka');
    expect(unlocked.alasanBukaKunci).toBe('Perbaikan nilai susulan siswa');
    expect(unlocked.dibukaOlehNama).toBe('Adnan Bahar');
    expect(unlocked.tanggalBukaKunci).toBeDefined();

    const status = await getStatusFinalisasi('kelas_3a', 'ta_2025_1');
    expect(status?.status).toBe('terbuka');
  });

  it('getAllFinalisasiStatus returns map of finalization statuses for academic year', async () => {
    await finalkanRaporKelas({
      kelasId: 'kelas_1a',
      kelasNama: 'Kelas 1A',
      tahunAjaranId: 'ta_2025_1',
    });
    await finalkanRaporKelas({
      kelasId: 'kelas_1b',
      kelasNama: 'Kelas 1B',
      tahunAjaranId: 'ta_2025_1',
    });

    const statusMap = await getAllStatusFinalisasi('ta_2025_1');
    expect(statusMap['kelas_1a']).toBeDefined();
    expect(statusMap['kelas_1a'].status).toBe('final');
    expect(statusMap['kelas_1b']).toBeDefined();
    expect(statusMap['kelas_1b'].status).toBe('final');
  });
});
