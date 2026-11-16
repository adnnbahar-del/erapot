import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllTahunAjaran,
  getTahunAjaranAktif,
  setTahunAjaranAktif,
  tambahTahunAjaran,
  updateStatusTahunAjaran,
  semesterNamaToAngka,
  semesterAngkaToNama,
  DEFAULT_TA_LIST,
} from './tahunAjaranService';

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

describe('Tahap 3 — Tahun Ajaran & Semester Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getAllTahunAjaran returns academic years with valid schema', async () => {
    const list = await getAllTahunAjaran();
    expect(list.length).toBeGreaterThan(0);

    const first = list[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('tahun');
    expect(first).toHaveProperty('semester');
    expect(first).toHaveProperty('status');
    expect(first).toHaveProperty('aktif');
  });

  it('strictly single active: setTahunAjaranAktif activates one and deactivates all others', async () => {
    const targetId = 'ta_2025_2026_genap';
    await setTahunAjaranAktif(targetId);

    const list = await getAllTahunAjaran();
    const activeList = list.filter((ta) => ta.aktif);

    expect(activeList.length).toBe(1);
    expect(activeList[0].id).toBe(targetId);
    expect(activeList[0].status).toBe('berjalan');

    const others = list.filter((ta) => ta.id !== targetId);
    others.forEach((ta) => {
      expect(ta.aktif).toBe(false);
    });
  });

  it('updateStatusTahunAjaran updates status to "berjalan" or "ditutup"', async () => {
    const targetId = 'ta_2025_2026_ganjil';
    await updateStatusTahunAjaran(targetId, 'ditutup');

    const list = await getAllTahunAjaran();
    const found = list.find((ta) => ta.id === targetId);

    expect(found?.status).toBe('ditutup');
  });

  it('tambahTahunAjaran adds new period and honors single active if requested', async () => {
    const newDoc = await tambahTahunAjaran({
      tahun: '2026/2027',
      semester: 'Ganjil',
      tanggal_rapor: '2026-12-19',
      aktif: true,
      status: 'berjalan',
    });

    expect(newDoc.tahun).toBe('2026/2027');
    expect(newDoc.semester).toBe('Ganjil');
    expect(newDoc.aktif).toBe(true);

    const active = await getTahunAjaranAktif();
    expect(active.id).toBe(newDoc.id);

    const list = await getAllTahunAjaran();
    const others = list.filter((ta) => ta.id !== newDoc.id);
    others.forEach((ta) => {
      expect(ta.aktif).toBe(false);
    });
  });

  it('semester conversion helpers work bidirectionally', () => {
    expect(semesterNamaToAngka('Ganjil')).toBe(1);
    expect(semesterNamaToAngka('Genap')).toBe(2);
    expect(semesterAngkaToNama(1)).toBe('Ganjil');
    expect(semesterAngkaToNama(2)).toBe('Genap');
  });
});

