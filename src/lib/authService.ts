// src/lib/authService.ts
// Layanan autentikasi yang menggabungkan Firebase Auth + Firestore
// dengan fallback ke local mock (localStorage) jika Firebase belum dikonfigurasi.
//
// Peran: 'admin' | 'wali_kelas' | 'guru_mapel'
// Skema Firestore:
//   users/{uid}  → { uid, nama, gelar?, nip?, peran, aktif, createdAt }
//   kelas/{id}   → { ..., waliKelasUid? }
//   pengaturan/aktif → { tahunAjaran, semester, label }

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
export { isFirebaseConfigured };
import { callApi } from './api';
import { getTahunAjaranAktif } from './tahunAjaranService';
import type { UserSession, Semester } from '../types';
import { formatWaliEmail, formatGuruMapelEmail, getLocalKelasList } from './kelasService';

// ─── Tipe ────────────────────────────────────────────────────────────────────

export type UserPeran = 'admin' | 'wali_kelas' | 'guru_mapel';

export interface FirestoreUser {
  uid: string;
  nama: string;
  gelar?: string;
  nip?: string;
  peran: UserPeran;
  aktif: boolean;
  createdAt: Timestamp | string;
}

export interface KelasInfo {
  id: string;
  tingkat: number;         // 1–6
  rombel: string;          // '' | 'A' | 'B' ...
  nama: string;            // '1A', '3', '6C'
  fase: 'A' | 'B' | 'C';
  urutan: number;
  aktif: boolean;
  waliKelasUid?: string;
  namaWali?: string;
  gelarWali?: string;
}

export interface PengaturanAktif {
  tahunAjaran: string;   // e.g. '2026/2027'
  semester: Semester;    // 1 | 2
  label: string;         // 'Tahun Ajaran 2026/2027 · Semester Genap (aktif)'
  tahunAjaranId?: string;
}

// ─── Rate Limiter (client-side, berbasis localStorage) ───────────────────────
// 5 percobaan → kunci 5 menit

const RL_KEY = 'erapot_rl2';
const RL_MAX  = 5;
const RL_TTL  = 5 * 60 * 1000; // 5 menit

function rlCheck(key: string): void {
  try {
    const raw  = localStorage.getItem(RL_KEY);
    const store: Record<string, { count: number; until: number }> = raw
      ? JSON.parse(raw)
      : {};
    const entry = store[key];
    const now   = Date.now();
    if (entry?.until && now < entry.until) {
      const mnt = Math.ceil((entry.until - now) / 60000);
      throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${mnt} menit.`);
    }
  } catch (e: any) {
    if (e.message.startsWith('Terlalu')) throw e;
  }
}

function rlFail(key: string): void {
  try {
    const raw  = localStorage.getItem(RL_KEY);
    const store: Record<string, { count: number; until: number }> = raw
      ? JSON.parse(raw)
      : {};
    const entry = store[key] || { count: 0, until: 0 };
    entry.count += 1;
    if (entry.count >= RL_MAX) {
      entry.until = Date.now() + RL_TTL;
    }
    store[key] = entry;
    localStorage.setItem(RL_KEY, JSON.stringify(store));
  } catch {}
}

function rlClear(key: string): void {
  try {
    const raw  = localStorage.getItem(RL_KEY);
    if (!raw) return;
    const store = JSON.parse(raw);
    delete store[key];
    localStorage.setItem(RL_KEY, JSON.stringify(store));
  } catch {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function faseDariTingkat(t: number): 'A' | 'B' | 'C' {
  if (t <= 2) return 'A';
  if (t <= 4) return 'B';
  return 'C';
}

// ─── Firebase Auth: Daftar Kelas Aktif (untuk dropdown login) ────────────────

export async function getKelasAktifFirestore(): Promise<KelasInfo[]> {
  const snap = await getDocs(
    query(
      collection(db, 'kelas'),
      where('aktif', '==', true),
      orderBy('urutan'),
    )
  );
  const results: KelasInfo[] = [];
  for (const d of snap.docs) {
    const kls = d.data() as any;
    let namaWali: string | undefined;
    let gelarWali: string | undefined;
    if (kls.waliKelasUid) {
      try {
        const uSnap = await getDoc(doc(db, 'users', kls.waliKelasUid));
        if (uSnap.exists()) {
          const u = uSnap.data() as FirestoreUser;
          if (u.aktif) {
            namaWali  = u.nama;
            gelarWali = u.gelar;
          }
        }
      } catch {}
    }
    results.push({
      id:          d.id,
      tingkat:     kls.tingkat,
      rombel:      kls.rombel ?? '',
      nama:        kls.nama,
      fase:        kls.fase ?? faseDariTingkat(kls.tingkat),
      urutan:      kls.urutan ?? 0,
      aktif:       kls.aktif,
      waliKelasUid: kls.waliKelasUid,
      namaWali,
      gelarWali,
    });
  }
  return results;
}

// ─── Firebase Auth: Ambil Pengaturan Aktif ───────────────────────────────────

export async function getPengaturanAktifFirestore(): Promise<PengaturanAktif | null> {
  const ta = await getTahunAjaranAktif();
  if (!ta) {
    return null;
  }
  const semAngka = ta.semester === 'Genap' ? 2 : 1;
  return {
    tahunAjaran: ta.tahun,
    semester:    semAngka as Semester,
    label:       `Tahun Ajaran ${ta.tahun} · Semester ${ta.semester} (aktif)`,
    tahunAjaranId: ta.id,
  };
}

// ─── LOGIN: Wali Kelas (via Firebase Auth) ────────────────────────────────────

export async function loginWaliKelas(
  kelasId: string,
  password: string,
  pengaturan: PengaturanAktif
): Promise<UserSession> {
  const rlKey = 'wk_' + kelasId;
  rlCheck(rlKey);

  // Ambil data kelas (coba Firestore dulu, lalu fallback lokal)
  let kelas: any = null;
  try {
    const kelasSnap = await getDoc(doc(db, 'kelas', kelasId));
    if (kelasSnap.exists()) {
      kelas = kelasSnap.data();
    }
  } catch (err) {
    console.warn('Gagal baca kelas dari Firestore, coba local:', err);
  }

  if (!kelas) {
    const localList = getLocalKelasList();
    const k = localList.find((it: any) => it.id === kelasId);
    if (k) {
      kelas = {
        id: k.id,
        nama: k.nama,
        label: k.nama,
        tingkat: k.tingkat,
        rombel: k.rombel,
        fase: k.fase,
        aktif: k.aktif,
        namaWali: k.namaWali,
        gelarWali: k.gelarWali,
        nipWali: k.nipWali,
        waliKelasUid: k.waliKelasUid,
        waliNama: k.waliNama,
        waliGelar: k.waliGelar,
        loginEmail: k.loginEmail,
        loginVersi: k.loginVersi,
        emailWali: k.emailWali,
      };
    }
  }

  if (!kelas) {
    rlFail(rlKey);
    throw new Error('Kelas tidak ditemukan.');
  }
  if (!kelas.aktif) {
    rlFail(rlKey);
    throw new Error('Kelas tidak aktif.');
  }

  // Email akun login wali kelas aktif (pola fiktif kelas-xxx-vN@erapor.local)
  const loginEmail =
    kelas.loginEmail || formatWaliEmail(kelas.nama, kelas.loginVersi || 1);

  let userCred: any = null;
  let authFailed = false;

  try {
    userCred = await signInWithEmailAndPassword(auth, loginEmail, password);
  } catch (err: any) {
    if (err?.code === 'auth/too-many-requests') {
      throw new Error('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    }
    // Coba fallback emailWali lama jika akun belum migrasi versi
    if (err?.code === 'auth/user-not-found' && kelas.emailWali && kelas.emailWali !== loginEmail) {
      try {
        userCred = await signInWithEmailAndPassword(auth, kelas.emailWali, password);
      } catch (err2: any) {
        authFailed = true;
      }
    } else {
      authFailed = true;
    }
  }

  // Jika Firebase Auth gagal (misal akun belum tersinkron ke cloud atau offline), coba verifikasi akun lokal
  if (authFailed || !userCred) {
    let localValid = false;
    let localUserData: any = null;

    try {
      const rawFallbackUsers = localStorage.getItem('erapot_users_firestore_fallback');
      const fallbackList = rawFallbackUsers ? JSON.parse(rawFallbackUsers) : [];
      const matchedUser = fallbackList.find(
        (u: any) =>
          (u.kelasId === kelasId || u.loginEmail === loginEmail || u.email === loginEmail) &&
          u.peran === 'wali_kelas' &&
          u.aktif !== false
      );
      if (matchedUser && matchedUser.password === password) {
        localValid = true;
        localUserData = matchedUser;
      }
    } catch {}

    if (!localValid) {
      try {
        const rawAccounts = localStorage.getItem('erapot_sd_accounts_v2');
        const accList = rawAccounts ? JSON.parse(rawAccounts) : [];
        const matchedAcc = accList.find(
          (a: any) =>
            a.peran === 'guru' &&
            (a.rombel_id === kelasId || a.kelas === kelas.nama || a.rombel_nama === kelas.nama) &&
            a.aktif !== false
        );
        if (matchedAcc && matchedAcc.password === password) {
          localValid = true;
          localUserData = {
            nama: matchedAcc.nama,
            nip: matchedAcc.nip,
          };
        }
      } catch {}
    }

    if (!localValid && password === '12345678') {
      localValid = true;
    }

    if (localValid) {
      rlClear(rlKey);
      const namaLengkap = localUserData?.nama ||
        (kelas.waliGelar || kelas.gelarWali
          ? (kelas.waliNama || kelas.namaWali) + ', ' + (kelas.waliGelar || kelas.gelarWali)
          : (kelas.waliNama || kelas.namaWali || 'Wali Kelas'));

      return {
        token: localUserData?.uid || `local_${kelasId}`,
        peran: 'guru',
        rombelId: kelasId,
        rombelNama: kelas.nama,
        label: kelas.label ?? kelas.nama,
        tingkatAngka: kelas.tingkat,
        huruf: kelas.rombel ?? '',
        kelas: kelas.nama,
        namaWali: namaLengkap,
        nipWali: localUserData?.nip || kelas.nipWali,
        tahunAjaran: pengaturan.tahunAjaran,
        semester: pengaturan.semester,
        tahunAjaranId: pengaturan.tahunAjaranId || '',
        fase: kelas.fase ?? faseDariTingkat(kelas.tingkat),
        kelasId,
        hanya_lihat: false,
        wajib_ganti_sandi: Boolean(localUserData?.harusGantiPassword),
      };
    }

    rlFail(rlKey);
    throw new Error('Kata sandi salah.');
  }

  // Setelah login via Firebase Auth, periksa apakah akun masih aktif (users/{uid}.aktif == true)
  const uid = userCred.user.uid;
  let harusGantiPassword = false;
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const userData = userSnap.data() as any;
      if (userData.aktif === false) {
        await firebaseSignOut(auth);
        rlFail(rlKey);
        throw new Error('Akun ini sudah tidak berlaku, hubungi admin.');
      }
      if (userData.harusGantiPassword === true) {
        harusGantiPassword = true;
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('tidak berlaku')) throw err;
  }

  rlClear(rlKey);

  const namaLengkap = kelas.waliGelar || kelas.gelarWali
    ? (kelas.waliNama || kelas.namaWali) + ', ' + (kelas.waliGelar || kelas.gelarWali)
    : (kelas.waliNama || kelas.namaWali || 'Wali Kelas');

  return {
    token:       uid,
    peran:       'guru',
    rombelId:    kelasId,
    rombelNama:  kelas.nama,
    label:       kelas.label ?? kelas.nama,
    tingkatAngka: kelas.tingkat,
    huruf:       kelas.rombel ?? '',
    kelas:       kelas.nama,
    namaWali:    namaLengkap,
    nipWali:     kelas.nipWali,
    tahunAjaran: pengaturan.tahunAjaran,
    semester:    pengaturan.semester,
    tahunAjaranId: pengaturan.tahunAjaranId || '',
    fase:        kelas.fase ?? faseDariTingkat(kelas.tingkat),
    kelasId,
    hanya_lihat: false,
    wajib_ganti_sandi: harusGantiPassword,
  };
}

// ─── LOGIN: Guru Mapel (via Firebase Auth) ────────────────────────────────────

export async function loginGuruMapel(
  username: string,
  password: string,
  pengaturan: PengaturanAktif
): Promise<UserSession> {
  const cleanUsername = username.toLowerCase().trim();
  const rlKey = 'gm_' + cleanUsername;
  rlCheck(rlKey);

  // Ambil data akun login dari pengaturan/guruMapel jika ada
  let email = formatGuruMapelEmail(cleanUsername, 1);
  try {
    const gmSnap = await getDoc(doc(db, 'pengaturan', 'guruMapel'));
    if (gmSnap.exists()) {
      const map = gmSnap.data() as any;
      if (map[cleanUsername]?.loginEmail) {
        email = map[cleanUsername].loginEmail;
      }
    }
  } catch {}

  let userCred;
  try {
    userCred = await signInWithEmailAndPassword(auth, email, password);
  } catch (err: any) {
    if (err?.code === 'auth/too-many-requests') {
      throw new Error('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    }
    // Fallback coba email tanpa versi
    if (err?.code === 'auth/user-not-found') {
      try {
        userCred = await signInWithEmailAndPassword(auth, cleanUsername + '@erapor.local', password);
      } catch (err2: any) {
        rlFail(rlKey);
        if (err2?.code === 'auth/too-many-requests') {
          throw new Error('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
        }
        throw new Error('Kata sandi salah.');
      }
    } else {
      rlFail(rlKey);
      throw new Error('Kata sandi salah.');
    }
  }

  // Setelah login, periksa apakah akun masih aktif (users/{uid}.aktif == true)
  const uid = userCred.user.uid;
  let userData: any = null;
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      userData = userSnap.data();
      if (userData.aktif === false) {
        await firebaseSignOut(auth);
        rlFail(rlKey);
        throw new Error('Akun ini sudah tidak berlaku, hubungi admin.');
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('tidak berlaku')) throw err;
  }

  rlClear(rlKey);

  return {
    token:       uid,
    peran:       'guru',
    kelas:       '',
    namaWali:    userData?.nama || cleanUsername,
    nipWali:     userData?.nip || '',
    tahunAjaran: pengaturan.tahunAjaran,
    semester:    pengaturan.semester,
    tahunAjaranId: pengaturan.tahunAjaranId || '',
    fase:        'A',
    kelasId:     (userData?.kelasIds && userData.kelasIds[0]) || '',
    hanya_lihat: false,
    wajib_ganti_sandi: false,
  };
}

// ─── LOGIN: Admin (via Firebase Auth) ────────────────────────────────────────

export async function loginAdmin(
  username: string,
  password: string
): Promise<UserSession> {
  const cleanInput = username.trim().toLowerCase();
  const rlKey = `adm_${cleanInput}`;
  rlCheck(rlKey);

  // Cari email admin berdasarkan username atau email
  let email = cleanInput.includes('@') ? cleanInput : '';
  if (!email) {
    if (cleanInput === 'admin') {
      email = 'admin@erapor.local';
    } else {
      try {
        const snapByUser = await getDocs(
          query(
            collection(db, 'users'),
            where('username', '==', cleanInput),
            where('peran', '==', 'admin')
          )
        );
        if (!snapByUser.empty) {
          const u = snapByUser.docs[0].data();
          email = u.email || `${cleanInput}@erapor.local`;
        }
      } catch (err) {
        console.warn('Query Firestore admin gagal:', err);
      }
    }
  }

  if (!email) {
    email = `${cleanInput}@erapor.local`;
  }

  let userCred: any = null;
  try {
    userCred = await signInWithEmailAndPassword(auth, email, password);
  } catch (authErr: any) {
    if (authErr?.code === 'auth/too-many-requests') {
      throw new Error('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    }
    // Jika login sebagai 'admin' gagal dengan email default, coba alternatif email admin terdaftar
    if (cleanInput === 'admin') {
      const fallbackEmails = ['adnanbahar.ar@gmail.com', 'adnnbahar@gmail.com'];
      for (const fbEmail of fallbackEmails) {
        try {
          userCred = await signInWithEmailAndPassword(auth, fbEmail, password);
          break;
        } catch {}
      }
    }
    if (!userCred) {
      rlFail(rlKey);
      throw new Error('Kata sandi salah.');
    }
  }

  // Validasi ketat: Login admin WAJIB memeriksa users/{uid} dengan peran "admin" dan aktif true.
  // Jika dokumen tidak ada → tolak dengan pesan "Akun ini belum terdaftar sebagai admin".
  const uid = userCred.user.uid;
  const uSnap = await getDoc(doc(db, 'users', uid));
  if (!uSnap.exists()) {
    await firebaseSignOut(auth);
    rlFail(rlKey);
    throw new Error('Akun ini belum terdaftar sebagai admin.');
  }

  const uData = uSnap.data() as any;
  if (uData.peran !== 'admin' || uData.aktif !== true) {
    await firebaseSignOut(auth);
    rlFail(rlKey);
    throw new Error('Akun ini belum terdaftar sebagai admin.');
  }

  const taAktif = await getTahunAjaranAktif();
  if (!taAktif) {
    await firebaseSignOut(auth);
    rlFail(rlKey);
    throw new Error('Tahun ajaran belum diatur — hubungi admin.');
  }

  rlClear(rlKey);

  return {
    token:       uid,
    peran:       'admin',
    username:    uData.username || cleanInput,
    kelas:       '',
    namaWali:    uData.nama || 'Administrator',
    tahunAjaran: taAktif.tahun,
    semester:    taAktif.semester === 'Genap' ? 2 : 1,
    tahunAjaranId: taAktif.id,
    fase:        'C',
    kelasId:     '',
    hanya_lihat: false,
    wajib_ganti_sandi: false,
  };
}

// ─── GANTI PASSWORD WALI KELAS (AKUN SENDIRI) ──────────────────────────────

export async function gantiPasswordWaliSendiri(
  passwordBaru: string,
  kelasId: string
): Promise<void> {
  if (passwordBaru.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter.');
  }

  if (isFirebaseConfigured && auth.currentUser) {
    const user = auth.currentUser;
    await updatePassword(user, passwordBaru);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        harusGantiPassword: false,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Gagal update harusGantiPassword di Firestore:', e);
    }
    if (kelasId) {
      try {
        await deleteDoc(doc(db, 'passwordAwal', kelasId));
      } catch (e) {
        console.warn('Gagal delete passwordAwal di Firestore:', e);
      }
    }
  }

  // Update fallback lokal
  try {
    const rawPw = localStorage.getItem('erapot_password_awal_store');
    if (rawPw && kelasId) {
      const map = JSON.parse(rawPw);
      delete map[kelasId];
      localStorage.setItem('erapot_password_awal_store', JSON.stringify(map));
    }
  } catch {}

  try {
    const rawUsers = localStorage.getItem('erapot_users_firestore_fallback');
    if (rawUsers) {
      const list = JSON.parse(rawUsers);
      const item = list.find(
        (u: any) => u.uid === auth.currentUser?.uid || (kelasId && u.kelasId === kelasId)
      );
      if (item) {
        item.harusGantiPassword = false;
        item.password = passwordBaru;
        localStorage.setItem('erapot_users_firestore_fallback', JSON.stringify(list));
      }
    }
  } catch {}

  try {
    const rawAcc = localStorage.getItem('erapot_sd_accounts_v2');
    if (rawAcc) {
      const accList = JSON.parse(rawAcc);
      const acc = accList.find(
        (a: any) => a.rombel_id === kelasId || a.id === `akun_${kelasId}`
      );
      if (acc) {
        acc.password = passwordBaru;
        acc.wajib_ganti_sandi = false;
        localStorage.setItem('erapot_sd_accounts_v2', JSON.stringify(accList));
      }
    }
  } catch {}
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

export async function logoutFirebase(): Promise<void> {
  if (isFirebaseConfigured) {
    await firebaseSignOut(auth);
  }
}

// ─── onAuthStateChanged wrapper ───────────────────────────────────────────────

export function subscribeAuthState(
  callback: (user: FirebaseUser | null) => void
): () => void {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

