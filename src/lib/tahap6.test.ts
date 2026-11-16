import { describe, it, expect, beforeEach } from 'vitest';
import { pulihkanDariJson } from './backupService';
import { jalankanMigrasi, hitungDokumen } from './migrasiService';
import { catatLogAktivitas, getLogAktivitas } from './logAktivitasService';

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

describe('Tahap 6 - Log, Backup & Migrasi Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('catatLogAktivitas stores entries and getLogAktivitas retrieves them', async () => {
    await catatLogAktivitas({
      uid: 'user_admin',
      nama: 'Administrator',
      peran: 'admin',
      aksi: 'FINALISASI_NILAI',
      target: 'Kelas 1A',
      nilaiBaru: 'Final',
    });

    const logs = await getLogAktivitas();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].aksi).toBe('FINALISASI_NILAI');
    expect(logs[0].target).toBe('Kelas 1A');
  });

  it('pulihkanDariJson throws on invalid JSON string', async () => {
    const dummyData: any = { siswa: [], formatif: [] };
    await expect(pulihkanDariJson('bukan json valid', dummyData)).rejects.toThrow();
  });

  it('pulihkanDariJson successfully restores valid JSON backup', async () => {
    const dummyCurrent: any = {
      siswa: [],
      formatif: [],
      sekolah: { nama: 'SD Sukaraja' },
    };

    const backupPayload = {
      metadata: {
        versi: '2.0',
        waktuEkspor: new Date().toISOString(),
        tahunAjaranId: 'ta_2025_1',
        tahunAjaranLabel: '2025/2026 Ganjil',
      },
      sekolah: { nama: 'SD Sukaraja Pulih' },
      siswa: [{ id: 's_1', nama: 'Budi' }],
      formatif: [{ siswa_id: 's_1', tp_id: 'tp_1', kktp: 1 }],
    };

    const res = await pulihkanDariJson(JSON.stringify(backupPayload), dummyCurrent);
    expect(res.success).toBe(true);
    expect(res.recordCounts.siswa).toBe(1);
    expect(res.recordCounts.nilaiFormatif).toBe(1);
  });

  it('jalankanMigrasi migrates old rombel to kelas collection and generates users', async () => {
    const appDataMock: any = {
      activeTahunAjaranId: 'ta_2025_1',
      rombel: [
        { id: 'rombel_1a', tingkat: 1, huruf: 'A', nama: '1A', nama_wali: 'SITI NURJANAH, S.Pd', nip_wali: '123' },
        { id: 'rombel_3', tingkat: 3, huruf: '', nama: '3', nama_wali: 'SRI WAHYUNI, S.Pd', nip_wali: '456' },
      ],
      siswa: [{ id: 's_1', nama: 'Siswa Satu' }],
      kelasSiswa: [{ id: 'ks_1', siswa_id: 's_1', kelas_id: 'rombel_1a' }],
      formatif: [{ siswa_id: 's_1', tp_id: 'tp_1', kktp: 1 }],
      sumatifLM: [{ siswa_id: 's_1', lm_id: 'lm_1', nilai: 85 }],
      kehadiran: [{ siswa_id: 's_1', kelas_id: 'rombel_1a', sakit: 1, izin: 0, alpa: 0 }],
      penilaianKokurikuler: [],
      kaih: [],
    };

    const res = await jalankanMigrasi(appDataMock);
    expect(res.sukses).toBe(true);
    expect(res.kelasBaru).toBe(2);
    expect(res.usersBaru).toBe(2);
    expect(res.siswaDimigrasikan).toBe(1);

    const counts = await hitungDokumen();
    expect(counts.kelas).toBe(2);
  });
});
