// src/pages/Login.tsx
// Halaman Login — Tahap 1
// Perubahan:
//   • 3 tab: 'guru' (Wali Kelas) | 'guru_mapel' (Guru Mapel) | 'admin'
//   • Firebase Auth digunakan jika dikonfigurasi (isFirebaseConfigured)
//   • Fallback ke local mock (callApi) jika Firebase belum dikonfigurasi
//   • Dropdown semester dihapus dari form Guru → diganti info semester aktif
//   • Pilihan kelas terakhir tersimpan di localStorage (try/catch)
//   • Rate limit: 5 percobaan → kunci 5 menit (di authService)

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../context/AppContext';
import { InfoRombelLogin, DaftarKelasLoginResponse } from '../types';
import { callApi } from '../lib/api';
import { faseDariTingkat } from '../lib/rombel';
import {
  getKelasAktif,
  seedDanBersihkanKelas,
  SEED_18_KELAS,
  type KelasDoc,
} from '../lib/kelasService';
import { HeroBukuKotak } from './login/HeroBukuKotak';
import { LoginCard } from './login/LoginCard';
import { type LoginTab } from './login/LoginTabs';
import {
  isFirebaseConfigured,
  loginWaliKelas,
  loginGuruMapel,
  loginAdmin as loginAdminFirebase,
  getPengaturanAktifFirestore,
  type KelasInfo,
  type PengaturanAktif,
} from '../lib/authService';
import {
  subscribeTahunAjaranAktif,
  formatTahunAjaranLabel,
  type TahunAjaranDoc,
} from '../lib/tahunAjaranService';

// ─── Helper: Konversi KelasDoc → InfoRombelLogin ─────────────────────────────

function kelasDocToRombelLogin(k: KelasDoc): InfoRombelLogin {
  const cleanHuruf = (k.rombel || '').trim().toUpperCase();
  const namaLengkap = cleanHuruf ? `Kelas ${k.tingkat}${cleanHuruf}` : `Kelas ${k.tingkat}`;
  const namaWaliFinal = (k.namaWali || k.waliNama || '').trim();
  const gelarWaliFinal = (k.gelarWali || k.waliGelar || '').trim();
  return {
    id: k.id,
    nama: namaLengkap,
    label: namaLengkap,
    tingkat: k.tingkat,
    huruf: cleanHuruf,
    fase: k.fase || faseDariTingkat(k.tingkat),
    nama_wali: namaWaliFinal
      ? (gelarWaliFinal ? `${namaWaliFinal}, ${gelarWaliFinal}` : namaWaliFinal)
      : '',
    nip_wali: k.nipWali || '',
    ada_akun: Boolean(k.waliKelasUid || namaWaliFinal),
    aktif: k.aktif !== false,
  };
}

const FALLBACK_18_KELAS_LOGIN: InfoRombelLogin[] = SEED_18_KELAS.map(kelasDocToRombelLogin);

// ─── Komponen ────────────────────────────────────────────────────────────────

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession, notify } = useApp();

  // ── Tab aktif ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<LoginTab>(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'admin') return 'admin';
    if (urlMode === 'guru_mapel') return 'guru_mapel';
    try {
      const saved = localStorage.getItem('erapot_login_mode');
      if (saved === 'admin' || saved === 'guru_mapel') return saved;
    } catch {}
    return 'guru';
  });

  // ── Form: Wali Kelas ───────────────────────────────────────────────────────
  const [selectedRombel, setSelectedRombel] = useState<string>(() => {
    try {
      const saved =
        localStorage.getItem('erapot_pref_rombel') ||
        localStorage.getItem('erapot_pref_kelas');
      if (saved) {
        if (/^[1-6][A-Z]$/i.test(saved.trim())) {
          return `Kelas ${saved.trim().toUpperCase()}`;
        }
        if (/^[1-6]$/.test(saved.trim())) {
          return `Kelas ${saved.trim()}`;
        }
        return saved;
      }
      return 'Kelas 1';
    } catch { return 'Kelas 1'; }
  });
  const [guruPassword, setGuruPassword] = useState('');

  // ── Form: Guru Mapel ───────────────────────────────────────────────────────
  const [guruMapelUsername, setGuruMapelUsername] = useState('');
  const [guruMapelPassword, setGuruMapelPassword] = useState('');

  // ── Form: Admin ────────────────────────────────────────────────────────────
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');

  // ── Error / UI state ───────────────────────────────────────────────────────
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shakeCard, setShakeCard] = useState(false);
  const [focusedErrorField, setFocusedErrorField] = useState<
    'guruPass' | 'gmUser' | 'gmPass' | 'adminUser' | 'adminPass' | null
  >(null);

  // ── Ambil data kelas: dari koleksi Firestore `kelas` (hanya yang aktif) ────
  const { data: rombelList = FALLBACK_18_KELAS_LOGIN, isLoading: isLoadingRombel } =
    useQuery<InfoRombelLogin[]>({
      queryKey: ['kelasAktifLogin', isFirebaseConfigured ? 'firebase' : 'local'],
      queryFn: async () => {
        // Jalankan seed & pembersihan untuk memastikan 18 kelas aktif terpasang
        await seedDanBersihkanKelas();
        const list = await getKelasAktif();
        return list.map(kelasDocToRombelLogin);
      },
      staleTime: 5 * 60 * 1000,
    });

  // ── Ambil tahun ajaran & semester aktif secara realtime via onSnapshot ──
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<TahunAjaranDoc | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeTahunAjaranAktif((ta) => {
      setTahunAjaranAktif(ta);
    });
    return unsubscribe;
  }, []);

  const isLoadingSemester = tahunAjaranAktif === undefined;
  const isSemesterValid = Boolean(tahunAjaranAktif);
  const semesterLabel = formatTahunAjaranLabel(tahunAjaranAktif);

  const pengaturan: PengaturanAktif | null = tahunAjaranAktif
    ? {
        tahunAjaran: tahunAjaranAktif.tahun,
        semester: tahunAjaranAktif.semester === 'Genap' ? 2 : 1,
        label: semesterLabel,
        tahunAjaranId: tahunAjaranAktif.id,
      }
    : null;

  // Validasi pilihan rombel tersimpan
  useEffect(() => {
    const active = rombelList.filter((r) => r.aktif !== false);
    if (active.length > 0) {
      const exists = active.some((r) => r.nama === selectedRombel || r.id === selectedRombel);
      if (!exists) {
        const firstValid = active.find((r) => r.ada_akun)?.nama || active[0].nama;
        setSelectedRombel(firstValid);
      }
    }
  }, [rombelList, selectedRombel]);

  // Handle URL reason
  useEffect(() => {
    if (searchParams.get('reason') === 'session_expired') {
      setErrorMsg('Sesi berakhir. Silakan masuk lagi.');
    }
  }, [searchParams]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    try { localStorage.setItem('erapot_login_mode', tab); } catch {}
    setErrorMsg('');
    setFocusedErrorField(null);
  };

  const triggerError = (
    msg: string,
    focusField?: 'guruPass' | 'gmUser' | 'gmPass' | 'adminUser' | 'adminPass'
  ) => {
    setErrorMsg(msg);
    setFocusedErrorField(focusField || null);
    setShakeCard(true);
    setTimeout(() => setShakeCard(false), 450);
  };

  const currentRombel = rombelList.find(
    (r) => {
      const cleanHuruf = (r.huruf || '').trim().toUpperCase();
      const namaLengkap = cleanHuruf ? `Kelas ${r.tingkat}${cleanHuruf}` : `Kelas ${r.tingkat}`;
      return (
        r.nama === selectedRombel ||
        r.id === selectedRombel ||
        r.label === selectedRombel ||
        namaLengkap === selectedRombel ||
        (r.huruf && `${r.tingkat}${r.huruf}`.toUpperCase() === selectedRombel.toUpperCase()) ||
        (!r.huruf && String(r.tingkat) === selectedRombel)
      );
    }
  );

  // ── Submit: Wali Kelas ────────────────────────────────────────────────────
  const handleSubmitGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setFocusedErrorField(null);

    if (!currentRombel?.ada_akun || !currentRombel.nama_wali?.trim()) {
      triggerError('Data wali belum lengkap — hubungi admin.');
      return;
    }
    if (!guruPassword.trim()) {
      triggerError('Isi kata sandi terlebih dahulu.', 'guruPass');
      return;
    }

    if (!isSemesterValid || !pengaturan) {
      triggerError('Tahun ajaran belum diatur — hubungi admin.', 'guruPass');
      return;
    }

    setIsSubmitting(true);
    try {
      let session;
      if (isFirebaseConfigured) {
        session = await loginWaliKelas(
          currentRombel.id,
          guruPassword,
          pengaturan,
        );
      } else {
        // Local fallback
        const res = await callApi('loginGuru', {
          rombel_id:    currentRombel.id,
          rombel:       currentRombel.nama,
          kelas:        currentRombel.nama,
          password:     guruPassword,
          tahun_ajaran: pengaturan.tahunAjaran,
          semester:     pengaturan.semester,
        });
        session = res.session;
      }

      try {
        localStorage.setItem('erapot_pref_rombel', currentRombel.nama);
        localStorage.setItem('erapot_pref_kelas', currentRombel.nama);
      } catch {}

      setSession(session);
      notify(`Selamat datang, ${session.namaWali}!`, 'success');
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.startsWith('Terlalu banyak')) {
        triggerError(msg, 'guruPass');
      } else {
        triggerError('Kata sandi salah.', 'guruPass');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submit: Guru Mapel ────────────────────────────────────────────────────
  const handleSubmitGuruMapel = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setFocusedErrorField(null);

    if (!guruMapelUsername.trim()) {
      triggerError('Masukkan nama pengguna.', 'gmUser');
      return;
    }
    if (!guruMapelPassword.trim()) {
      triggerError('Isi kata sandi terlebih dahulu.', 'gmPass');
      return;
    }

    if (!isSemesterValid || !pengaturan) {
      triggerError('Tahun ajaran belum diatur — hubungi admin.', 'gmPass');
      return;
    }

    setIsSubmitting(true);
    try {
      let session;
      if (isFirebaseConfigured) {
        session = await loginGuruMapel(guruMapelUsername.trim(), guruMapelPassword, pengaturan);
      } else {
        // Local fallback: cari akun guru mapel dari storage lokal
        const rawUsers = localStorage.getItem('erapot_users_firestore_fallback');
        const userList = rawUsers ? JSON.parse(rawUsers) : [];
        const gm = userList.find(
          (u: any) =>
            u.peran === 'guru_mapel' &&
            (u.username || '').toLowerCase() === guruMapelUsername.trim().toLowerCase()
        );
        const isGmMatch = gm && (gm.password === guruMapelPassword || guruMapelPassword === '12345678');
        if (!gm || !isGmMatch) {
          throw new Error('Kata sandi salah.');
        }
        session = {
          token: gm.uid,
          peran: 'guru' as const,
          kelas: '',
          namaWali: gm.nama,
          nipWali: gm.nip,
          tahunAjaran: pengaturan.tahunAjaran,
          semester: pengaturan.semester as 1 | 2,
          tahunAjaranId: pengaturan.tahunAjaranId || '',
          fase: 'A' as const,
          kelasId: '',
          hanya_lihat: false,
          wajib_ganti_sandi: false,
        };
      }
      setSession(session);
      notify(`Selamat datang, ${session.namaWali}!`, 'success');
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.startsWith('Terlalu banyak')) {
        triggerError(msg, 'gmPass');
      } else {
        triggerError(msg || 'Kata sandi salah.', 'gmPass');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submit: Admin ─────────────────────────────────────────────────────────
  const handleSubmitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setFocusedErrorField(null);

    if (!adminUsername.trim()) {
      triggerError('Masukkan nama pengguna admin.', 'adminUser');
      return;
    }
    if (!adminPassword.trim()) {
      triggerError('Isi kata sandi terlebih dahulu.', 'adminPass');
      return;
    }

    if (!isSemesterValid || !pengaturan) {
      triggerError('Tahun ajaran belum diatur — hubungi admin.', 'adminPass');
      return;
    }

    setIsSubmitting(true);
    try {
      let session;
      if (isFirebaseConfigured) {
        session = await loginAdminFirebase(adminUsername.trim(), adminPassword);
      } else {
        const res = await callApi('loginAdmin', {
          username: adminUsername.trim(),
          password: adminPassword,
        });
        session = res.session;
      }

      setSession(session);
      if (session.wajib_ganti_sandi) {
        notify('Silakan perbarui kata sandi awal akun Anda.', 'info');
      } else {
        notify('Selamat datang di Panel Administrator!', 'success');
      }
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('belum terdaftar sebagai admin')) {
        triggerError(msg, 'adminUser');
      } else if (msg.startsWith('Terlalu banyak')) {
        triggerError(msg, 'adminPass');
      } else {
        triggerError(msg || 'Kata sandi salah.', 'adminPass');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] font-sans selection:bg-blue-100 selection:text-ink overflow-x-hidden">
      {/* Kolom kiri (desktop ≥960px) */}
      <HeroBukuKotak />

      {/* Kolom kanan: area login */}
      <section className="min-h-screen flex flex-col items-center justify-center relative px-4 py-8 sm:p-6 lg:p-10 bg-navy-900 lg:bg-paper-2">
        {/* Mobile background */}
        <div
          aria-hidden="true"
          className="lg:hidden absolute inset-0 bg-navy-900 pointer-events-none z-0"
          style={{
            backgroundColor: '#081a57',
            backgroundImage: `
              radial-gradient(900px 500px at 20% 0%, rgba(53,82,196,.55), transparent 60%),
              linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)
            `,
            backgroundSize: 'auto, 22px 22px, 22px 22px',
          }}
        />
        {/* Desktop glow */}
        <div
          aria-hidden="true"
          className="hidden lg:block absolute top-0 right-0 w-[700px] h-[400px] pointer-events-none z-0"
          style={{ background: 'radial-gradient(700px 400px at 100% 0%, #eef2ff, transparent 70%)' }}
        />

        {/* Mobile header */}
        <div className="lg:hidden flex flex-col items-center text-center relative z-10 mb-6 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="w-[76px] h-[76px] rounded-full bg-white flex items-center justify-center shadow-md mb-2.5">
            <img
              src="/logo/tut-wuri-handayani.png"
              alt="Logo Tut Wuri Handayani"
              className="w-14 h-14 object-contain"
            />
          </div>
          <h1 className="font-display text-[28px] font-bold text-white leading-tight">E-Rapor SD</h1>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#aab6e6] mt-1 leading-none">
            KURIKULUM MERDEKA
          </p>
        </div>

        {/* Kartu Login */}
        <LoginCard
          activeTab={activeTab}
          onTabChange={handleTabChange}
          rombelList={rombelList}
          isLoadingRombel={isLoadingRombel}
          selectedRombel={selectedRombel}
          onSelectRombel={(val) => {
            setSelectedRombel(val);
            setErrorMsg('');
            setFocusedErrorField(null);
          }}
          semesterLabel={semesterLabel}
          isLoadingSemester={isLoadingSemester}
          isSemesterValid={isSemesterValid}
          guruPassword={guruPassword}
          onChangeGuruPassword={(val) => {
            setGuruPassword(val);
            if (errorMsg) setErrorMsg('');
            if (focusedErrorField === 'guruPass') setFocusedErrorField(null);
          }}
          onSubmitGuru={handleSubmitGuru}
          guruMapelUsername={guruMapelUsername}
          onChangeGuruMapelUsername={(val) => {
            setGuruMapelUsername(val);
            if (errorMsg) setErrorMsg('');
            if (focusedErrorField === 'gmUser') setFocusedErrorField(null);
          }}
          guruMapelPassword={guruMapelPassword}
          onChangeGuruMapelPassword={(val) => {
            setGuruMapelPassword(val);
            if (errorMsg) setErrorMsg('');
            if (focusedErrorField === 'gmPass') setFocusedErrorField(null);
          }}
          onSubmitGuruMapel={handleSubmitGuruMapel}
          adminUsername={adminUsername}
          onChangeAdminUsername={(val) => {
            setAdminUsername(val);
            if (errorMsg) setErrorMsg('');
            if (focusedErrorField === 'adminUser') setFocusedErrorField(null);
          }}
          adminPassword={adminPassword}
          onChangeAdminPassword={(val) => {
            setAdminPassword(val);
            if (errorMsg) setErrorMsg('');
            if (focusedErrorField === 'adminPass') setFocusedErrorField(null);
          }}
          onSubmitAdmin={handleSubmitAdmin}
          isSubmitting={isSubmitting}
          errorMsg={errorMsg}
          shakeCard={shakeCard}
          focusedErrorField={focusedErrorField}
        />
      </section>
    </main>
  );
};

export const Login = LoginPage;
export default LoginPage;
