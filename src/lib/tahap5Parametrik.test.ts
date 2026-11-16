// src/lib/tahap5Parametrik.test.ts
// Pengujian Parametrik Menyeluruh Tahap 5:
// Menguji 18 kelas bawaan + 1 kelas baru (Kelas 6C = total 19 kelas).
// 7 Operasi per kelas:
// 1. Simpan siswa baru ke kelasnya -> BERHASIL
// 2. Simpan siswa ke kelas lain -> DITOLAK
// 3. Input nilai formatif untuk siswanya -> BERHASIL
// 4. Input nilai untuk siswa kelas lain -> DITOLAK
// 5. Ubah nilai saat statusRapor terkunci (final) -> DITOLAK
// 6. Ubah profil wali kelas sendiri (nama, gelar, nip) -> BERHASIL
// 7. Coba eskalasi peran atau ubah kelasId sendiri -> DITOLAK

import { describe, it, expect } from 'vitest';
import { SEED_18_KELAS } from './kelasService';

// Model Evaluator Rules Firestore sesuai firestore.rules
interface MockUser {
  uid: string;
  peran: 'admin' | 'wali_kelas' | 'guru_mapel';
  kelasId?: string;
  kelasIds?: string[];
  mapelIds?: string[];
  aktif: boolean;
  nama?: string;
  gelar?: string;
  nip?: string;
}

interface MockStatusRapor {
  status: 'terbuka' | 'final';
  final: boolean;
}

interface RuleContext {
  auth: { uid: string; email?: string } | null;
  users: Map<string, MockUser>;
  statusRapor: Map<string, MockStatusRapor>;
}

function evaluateRules(
  ctx: RuleContext,
  action: 'create' | 'update' | 'delete' | 'read',
  collectionName: string,
  docId: string,
  requestData: any,
  existingData?: any
): { allowed: boolean; reason?: string } {
  if (!ctx.auth) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  const currentUser = ctx.users.get(ctx.auth.uid);
  const isAdmin =
    currentUser?.peran === 'admin' && currentUser.aktif === true;

  if (isAdmin) {
    return { allowed: true };
  }

  const isWali = (kId?: string) => {
    return (
      Boolean(kId) &&
      currentUser?.peran === 'wali_kelas' &&
      currentUser.aktif === true &&
      currentUser.kelasId === kId
    );
  };

  const getKelas = (data: any) => {
    return data?.kelasId || data?.kelas_id || data?.rombel_id || '';
  };

  const isLocked = (taId?: string, kId?: string) => {
    if (!taId || !kId) return false;
    const sr = ctx.statusRapor.get(`${taId}_${kId}`);
    return sr?.status === 'final' || sr?.final === true;
  };

  // 1. Koleksi Siswa & KelasSiswa
  if (collectionName === 'siswa' || collectionName === 'kelasSiswa') {
    if (action === 'create') {
      const targetKelas = getKelas(requestData);
      if (isWali(targetKelas)) return { allowed: true };
      return { allowed: false, reason: 'permission-denied: bukan wali kelas tujuan' };
    }
    if (action === 'update' || action === 'delete') {
      const currentKelas = getKelas(existingData);
      const targetKelas = getKelas(requestData);
      if (action === 'update' && targetKelas !== currentKelas) {
        return { allowed: false, reason: 'permission-denied: wali tidak boleh memindahkan kelas siswa' };
      }
      if (isWali(currentKelas)) return { allowed: true };
      return { allowed: false, reason: 'permission-denied: bukan wali kelas asal siswa' };
    }
  }

  // 2. Koleksi Nilai (formatif, sumatif, ekskul, dll)
  if (
    collectionName === 'formatif' ||
    collectionName === 'sumatifLM' ||
    collectionName === 'sumatifSemester'
  ) {
    const taId = requestData?.tahun_ajaran_id || existingData?.tahun_ajaran_id || 'ta_2025_1';
    const targetKelas = getKelas(requestData) || getKelas(existingData);

    if (isLocked(taId, targetKelas)) {
      return { allowed: false, reason: 'permission-denied: rapor sudah terkunci' };
    }

    if (action === 'create' || action === 'update' || action === 'delete') {
      if (isWali(targetKelas)) return { allowed: true };
      return { allowed: false, reason: 'permission-denied: bukan wali kelas pengampu nilai' };
    }
  }

  // 3. Koleksi Users (profil diri)
  if (collectionName === 'users') {
    if (action === 'update' && ctx.auth.uid === docId) {
      // Periksa field yang diubah
      const attemptedPeranChange =
        requestData.peran !== undefined && requestData.peran !== existingData?.peran;
      const attemptedKelasIdChange =
        requestData.kelasId !== undefined && requestData.kelasId !== existingData?.kelasId;
      const attemptedAktifChange =
        requestData.aktif !== undefined && requestData.aktif !== existingData?.aktif;

      if (attemptedPeranChange || attemptedKelasIdChange || attemptedAktifChange) {
        return { allowed: false, reason: 'permission-denied: tidak boleh mengubah peran, kelasId, atau status aktif diri sendiri' };
      }

      return { allowed: true };
    }
  }

  return { allowed: false, reason: 'permission-denied: akses tidak diizinkan' };
}

describe('Tahap 5 — Pengujian Parametrik Menyeluruh (18 Kelas Default + Kelas 6C)', () => {
  const daftar19Kelas = [
    ...SEED_18_KELAS.map((k) => k.id),
    'kelas_6c', // Kelas baru dinamis
  ];

  it('memiliki total 19 kelas untuk pengujian', () => {
    expect(daftar19Kelas.length).toBe(19);
    expect(daftar19Kelas).toContain('kelas_6a');
    expect(daftar19Kelas).toContain('kelas_6c');
  });

  daftar19Kelas.forEach((kelasId) => {
    describe(`Parametrik Kelas: ${kelasId}`, () => {
      const waliUid = `uid_wali_${kelasId}`;
      const kelasLain = kelasId === 'kelas_1' ? 'kelas_2' : 'kelas_1';
      const taIdAktif = 'ta_2025_1';

      // Setup state untuk kelas ini
      const setupContext = (): RuleContext => {
        const users = new Map<string, MockUser>();
        users.set(waliUid, {
          uid: waliUid,
          peran: 'wali_kelas',
          kelasId: kelasId,
          aktif: true,
          nama: 'GURU PENGUJI',
          gelar: 'S.Pd',
          nip: '198501012010011001',
        });

        const statusRapor = new Map<string, MockStatusRapor>();
        statusRapor.set(`${taIdAktif}_${kelasId}`, {
          status: 'terbuka',
          final: false,
        });

        return {
          auth: { uid: waliUid, email: `${kelasId}@erapor.local` },
          users,
          statusRapor,
        };
      };

      // Operasi 1: Simpan siswa baru ke kelasnya
      it('Operasi 1: Simpan siswa baru ke kelasnya -> HARUS BERHASIL', () => {
        const ctx = setupContext();
        const payloadSiswa = {
          nama: 'Siswa Percobaan',
          nisn: '1234567890',
          kelasId: kelasId,
          kelas_id: kelasId,
        };

        const res = evaluateRules(ctx, 'create', 'siswa', 'siswa_new_1', payloadSiswa);
        expect(res.allowed).toBe(true);
      });

      // Operasi 2: Simpan siswa ke kelas LAIN
      it('Operasi 2: Simpan siswa ke kelas LAIN -> HARUS DITOLAK (permission-denied)', () => {
        const ctx = setupContext();
        const payloadSiswaLain = {
          nama: 'Siswa Ilegal',
          nisn: '9999999999',
          kelasId: kelasLain,
          kelas_id: kelasLain,
        };

        const res = evaluateRules(ctx, 'create', 'siswa', 'siswa_new_bad', payloadSiswaLain);
        expect(res.allowed).toBe(false);
        expect(res.reason).toContain('permission-denied');
      });

      // Operasi 3: Input nilai formatif untuk siswanya
      it('Operasi 3: Input nilai formatif untuk siswanya -> HARUS BERHASIL', () => {
        const ctx = setupContext();
        const payloadNilai = {
          siswa_id: 'siswa_1',
          mapel_id: 'matematika',
          kelasId: kelasId,
          kelas_id: kelasId,
          tahun_ajaran_id: taIdAktif,
          nilai: 85,
        };

        const res = evaluateRules(ctx, 'create', 'formatif', 'formatif_1', payloadNilai);
        expect(res.allowed).toBe(true);
      });

      // Operasi 4: Input nilai untuk siswa kelas lain
      it('Operasi 4: Input nilai untuk siswa kelas lain -> HARUS DITOLAK', () => {
        const ctx = setupContext();
        const payloadNilaiLain = {
          siswa_id: 'siswa_lain',
          mapel_id: 'matematika',
          kelasId: kelasLain,
          kelas_id: kelasLain,
          tahun_ajaran_id: taIdAktif,
          nilai: 90,
        };

        const res = evaluateRules(ctx, 'create', 'formatif', 'formatif_bad', payloadNilaiLain);
        expect(res.allowed).toBe(false);
        expect(res.reason).toContain('permission-denied');
      });

      // Operasi 5: Kunci rapor kelas tersebut lalu coba ubah nilai
      it('Operasi 5: Kunci rapor kelas tersebut (statusRapor.final = true) lalu coba ubah nilai -> HARUS DITOLAK', () => {
        const ctx = setupContext();
        // Kunci rapor
        ctx.statusRapor.set(`${taIdAktif}_${kelasId}`, {
          status: 'final',
          final: true,
        });

        const payloadUbahNilai = {
          siswa_id: 'siswa_1',
          mapel_id: 'matematika',
          kelasId: kelasId,
          kelas_id: kelasId,
          tahun_ajaran_id: taIdAktif,
          nilai: 95,
        };

        const res = evaluateRules(ctx, 'update', 'formatif', 'formatif_1', payloadUbahNilai, {
          siswa_id: 'siswa_1',
          mapel_id: 'matematika',
          kelasId: kelasId,
          kelas_id: kelasId,
          tahun_ajaran_id: taIdAktif,
          nilai: 85,
        });

        expect(res.allowed).toBe(false);
        expect(res.reason).toContain('permission-denied: rapor sudah terkunci');
      });

      // Operasi 6: Ubah profil wali kelasnya sendiri (nama, gelar, nip)
      it('Operasi 6: Ubah profil wali kelasnya sendiri (nama, gelar, nip) -> HARUS BERHASIL', () => {
        const ctx = setupContext();
        const existingProfile = ctx.users.get(waliUid)!;
        const payloadEdit = {
          ...existingProfile,
          nama: 'GURU PENGUJI BARU',
          gelar: 'M.Pd',
          nip: '198501012010011002',
        };

        const res = evaluateRules(ctx, 'update', 'users', waliUid, payloadEdit, existingProfile);
        expect(res.allowed).toBe(true);
      });

      // Operasi 7: Coba ubah field `peran` atau `kelasId` pada users/{uid} miliknya
      it('Operasi 7: Coba ubah field peran atau kelasId pada users/{uid} miliknya -> HARUS DITOLAK', () => {
        const ctx = setupContext();
        const existingProfile = ctx.users.get(waliUid)!;

        // Coba eskalasi peran jadi admin
        const payloadEskalasi = {
          ...existingProfile,
          peran: 'admin',
        };
        const resPeran = evaluateRules(ctx, 'update', 'users', waliUid, payloadEskalasi, existingProfile);
        expect(resPeran.allowed).toBe(false);
        expect(resPeran.reason).toContain('permission-denied');

        // Coba ganti kelasId ke kelas lain
        const payloadGantiKelas = {
          ...existingProfile,
          kelasId: kelasLain,
        };
        const resKelas = evaluateRules(ctx, 'update', 'users', waliUid, payloadGantiKelas, existingProfile);
        expect(resKelas.allowed).toBe(false);
        expect(resKelas.reason).toContain('permission-denied');
      });
    });
  });
});
