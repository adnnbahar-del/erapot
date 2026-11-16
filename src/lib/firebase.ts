// src/lib/firebase.ts
// Inisialisasi Firebase App, Auth, dan Firestore.
// Semua konfigurasi dibaca dari env variables (VITE_FIREBASE_*).
// Mendukung secondary app untuk registrasi akun oleh Admin tanpa logout akun Admin utama.

import { initializeApp, getApps, getApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signOut, connectAuthEmulator, type Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '',
};

export const isEmulatorActive: boolean = import.meta.env.VITE_USE_EMULATOR === 'true';

export const isFirebaseConfigured: boolean =
  Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'demo-key' &&
    (typeof process === 'undefined' || process.env.NODE_ENV !== 'test')
  );

// Hindari inisialisasi duplikat saat HMR (Vite hot-reload)
const app: FirebaseApp = getApps().length === 0
  ? initializeApp(
      firebaseConfig.apiKey
        ? firebaseConfig
        : {
            apiKey: 'AIzaSyA00000000000000000000000000000000',
            projectId: 'e-rapot-sd',
          }
    )
  : getApp();

export const auth: Auth = getAuth(app);

// Inisialisasi Firestore dengan ignoreUndefinedProperties: true untuk keamanan data
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    });
  } catch {
    return getFirestore(app);
  }
})();

// Hubungkan ke emulator HANYA jika VITE_USE_EMULATOR === 'true' di .env.local
if (isEmulatorActive && typeof window !== 'undefined' && !(window as any).__firebaseEmulatorConnected) {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    (window as any).__firebaseEmulatorConnected = true;
    console.info('[Firebase] Terhubung ke Firebase Emulator (Auth: 9099, Firestore: 8080)');
  } catch (e) {
    console.warn('[Firebase] Gagal menghubungkan ke emulator:', e);
  }
}

/**
 * Mendapatkan instance Secondary Firebase App & Auth khusus untuk pembuatan akun
 * oleh Admin agar sesi login Admin di app utama tidak tertimpa/ter-logout.
 */
export async function getSecondaryAuth(): Promise<{ secondaryAuth: Auth; cleanup: () => Promise<void> }> {
  const secondaryAppName = `SecondaryAuth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  const cleanup = async () => {
    try {
      await signOut(secondaryAuth);
    } catch {}
    try {
      await deleteApp(secondaryApp);
    } catch {}
  };

  return { secondaryAuth, cleanup };
}

export default app;
