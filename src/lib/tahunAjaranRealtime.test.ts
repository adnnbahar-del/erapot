import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllTahunAjaran,
  getTahunAjaranAktif,
  setTahunAjaranAktif,
  tambahTahunAjaran,
  nonaktifkanSemuaTahunAjaran,
  formatTahunAjaranLabel,
  subscribeTahunAjaranAktif,
  DEFAULT_TA_LIST,
} from './tahunAjaranService';

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

describe('Tahun Ajaran Realtime & Single Active Rules', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('erapot_tahun_ajaran_list', JSON.stringify(DEFAULT_TA_LIST));
  });

  it('formatTahunAjaranLabel formats correctly or warns if unset', () => {
    expect(formatTahunAjaranLabel(null)).toBe('Tahun ajaran belum diatur — hubungi admin');
    expect(formatTahunAjaranLabel(undefined)).toBe('Tahun ajaran belum diatur — hubungi admin');

    const sample = DEFAULT_TA_LIST[2]; // 2025/2026 Ganjil
    expect(formatTahunAjaranLabel(sample)).toBe('Tahun Ajaran 2025/2026 · Semester Ganjil (aktif)');
  });

  it('strictly ensures only one active document when switching', async () => {
    // Aktifkan ta_2025_2026_genap
    const target = 'ta_2025_2026_genap';
    const updated = await setTahunAjaranAktif(target);
    expect(updated.id).toBe(target);
    expect(updated.aktif).toBe(true);

    const all = await getAllTahunAjaran();
    const activeDocs = all.filter((d) => d.aktif);
    expect(activeDocs.length).toBe(1);
    expect(activeDocs[0].id).toBe(target);
  });

  it('nonaktifkanSemuaTahunAjaran deactivates all documents and returns null for active', async () => {
    await nonaktifkanSemuaTahunAjaran();
    const active = await getTahunAjaranAktif();
    expect(active).toBeNull();

    const label = formatTahunAjaranLabel(active);
    expect(label).toBe('Tahun ajaran belum diatur — hubungi admin');
  });

  it('subscribeTahunAjaranAktif provides active document and handles updates', () => {
    let capturedTa: any = null;
    let capturedMeta: any = null;
    const unsub = subscribeTahunAjaranAktif((ta, meta) => {
      capturedTa = ta;
      capturedMeta = meta;
    });
    expect(capturedTa).not.toBeNull();
    expect(capturedMeta.ganda).toBe(false);
    unsub();
  });
});
