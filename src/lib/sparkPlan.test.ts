import { describe, it, expect, beforeEach } from 'vitest';
import { formatWaliEmail, formatGuruMapelEmail, aturWaliKelas, getLocalKelasList } from './kelasService';
import { loginWaliKelas } from './authService';

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

describe('Firebase Spark Plan Email & Auth Convention', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('formats wali kelas email correctly according to spec', () => {
    // "kelas-{nama kelas huruf kecil tanpa spasi}-v{versi}@erapor.local"
    expect(formatWaliEmail('Kelas 1', 1)).toBe('kelas-1-v1@erapor.local');
    expect(formatWaliEmail('Kelas 1A', 1)).toBe('kelas-1a-v1@erapor.local');
    expect(formatWaliEmail('Kelas 1B', 2)).toBe('kelas-1b-v2@erapor.local');
    expect(formatWaliEmail('Kelas 6B', 3)).toBe('kelas-6b-v3@erapor.local');
    expect(formatWaliEmail('1A', 1)).toBe('kelas-1a-v1@erapor.local');
  });

  it('formats guru mapel email correctly according to spec', () => {
    // "{username}-v{versi}@erapor.local"
    expect(formatGuruMapelEmail('budi', 1)).toBe('budi-v1@erapor.local');
    expect(formatGuruMapelEmail('budi', 2)).toBe('budi-v2@erapor.local');
    expect(formatGuruMapelEmail('Siti Rahma', 1)).toBe('sitirahma-v1@erapor.local');
  });

  it('berhasil membuat dan menyimpan akun wali kelas serta bisa login', async () => {
    const res = await aturWaliKelas('kelas_1a', {
      nama: 'Siti Rahmawati',
      gelar: 'S.Pd',
      nip: '198501012010012001',
      password: 'passwordBaru123',
    });

    expect(res.uid).toBeTruthy();
    expect(res.email).toContain('kelas-1a');

    // Pastikan tersimpan di list kelas
    const list = getLocalKelasList();
    const k1a = list.find((k) => k.id === 'kelas_1a');
    expect(k1a).toBeDefined();
    expect(k1a?.namaWali).toBe('SITI RAHMAWATI');
    expect(k1a?.gelarWali).toBe('S.Pd');

    // Pastikan bisa login dengan password baru
    const session = await loginWaliKelas('kelas_1a', 'passwordBaru123', {
      tahunAjaran: '2025/2026',
      semester: 1,
      label: '2025/2026 Ganjil (aktif)',
    });

    expect(session).toBeDefined();
    expect(session.peran).toBe('guru');
    expect(session.kelasId).toBe('kelas_1a');
    expect(session.namaWali).toContain('SITI RAHMAWATI');
  });
});


