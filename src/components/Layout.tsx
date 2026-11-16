import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { callApi } from '../lib/api';
import { gantiPasswordWaliSendiri } from '../lib/authService';
import {
  LayoutDashboard,
  Users,
  Building2,
  GraduationCap,
  BookOpen,
  Award,
  Compass,
  Target,
  Layers,
  Edit3,
  CheckSquare,
  Calculator,
  Medal,
  TableProperties,
  HeartHandshake,
  CalendarCheck,
  FileText,
  Printer,
  FileCheck2,
  GitCompare,
  BookMarked,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Lock,
  Database,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Archive,
  RotateCcw,
  CalendarX2,
  UserX,
} from 'lucide-react';

interface MenuItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

interface MenuGroup {
  group: string;
  items: MenuItem[];
}

const GURU_MENU_GROUPS: MenuGroup[] = [
  {
    group: 'Utama',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Profil Saya', path: '/profil-saya', icon: Users },
    ],
  },
  {
    group: 'Informasi Umum',
    items: [
      { name: 'Data Siswa', path: '/data-siswa', icon: GraduationCap },
    ],
  },
  {
    group: 'Kurikulum',
    items: [
      { name: 'Intrakurikuler', path: '/intrakurikuler', icon: BookOpen },
      { name: 'Ekstrakurikuler', path: '/ekstrakurikuler', icon: Award },
      { name: 'Kokurikuler', path: '/kokurikuler', icon: Compass },
      { name: 'Tujuan Pembelajaran', path: '/tujuan-pembelajaran', icon: Target },
      { name: 'Lingkup Materi', path: '/lingkup-materi', icon: Layers },
    ],
  },
  {
    group: 'Penilaian',
    items: [
      { name: 'Input Nilai', path: '/input-nilai', icon: Edit3 },
      { name: 'Asesmen Formatif', path: '/asesmen-formatif', icon: CheckSquare },
      { name: 'Asesmen Sumatif', path: '/asesmen-sumatif', icon: Calculator },
      { name: 'Penilaian', path: '/penilaian', icon: Medal },
      { name: 'Nilai Akhir', path: '/nilai-akhir', icon: TableProperties },
      { name: 'Input 7 KAIH', path: '/input-7-kaih', icon: HeartHandshake },
      { name: 'Rekap Kehadiran', path: '/rekap-kehadiran', icon: CalendarCheck },
    ],
  },
  {
    group: 'Cetak',
    items: [
      { name: 'Sampul', path: '/cetak/sampul', icon: FileText },
      { name: 'Rapor', path: '/cetak/rapor', icon: Printer },
      { name: 'Cetak 7 KAIH', path: '/cetak/7-kaih', icon: FileCheck2 },
      { name: 'Mutasi', path: '/cetak/mutasi', icon: GitCompare },
      { name: 'Buku Induk', path: '/cetak/buku-induk', icon: BookMarked },
    ],
  },
  {
    group: 'Arsip',
    items: [
      { name: 'Arsip Semester', path: '/arsip', icon: Archive },
    ],
  },
];

const ADMIN_MENU_GROUPS: MenuGroup[] = [
  {
    group: 'Utama',
    items: [
      { name: 'Dashboard Sekolah', path: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Profil Saya', path: '/profil-saya', icon: Users },
    ],
  },
  {
    group: 'Pengaturan',
    items: [
      { name: 'Data Sekolah', path: '/data-sekolah', icon: Building2 },
      { name: 'Tahun Ajaran & Semester', path: '/admin/tahun-ajaran', icon: Calendar },
      { name: 'Kelas & Wali Kelas', path: '/admin/kelas-wali', icon: ShieldCheck },
      { name: 'Guru Mapel', path: '/admin/guru-mapel', icon: BookOpen },
      { name: 'Akun Lama', path: '/admin/akun-lama', icon: UserX },
      { name: 'Kunci Nilai', path: '/admin/kunci-nilai', icon: Lock },
      { name: 'Tutup Tahun Ajaran', path: '/admin/tutup-tahun', icon: CalendarX2 },
    ],
  },
  {
    group: 'Data Master',
    items: [
      { name: 'Mata Pelajaran', path: '/intrakurikuler', icon: BookOpen },
      { name: 'Ekstrakurikuler', path: '/ekstrakurikuler', icon: Award },
      { name: 'Tema Kokurikuler', path: '/kokurikuler', icon: Compass },
    ],
  },
  {
    group: 'Cetak & Data',
    items: [
      { name: 'Cetak Rapor Semua', path: '/admin/cetak-semua', icon: Printer },
      { name: 'Cadangan Data', path: '/admin/backup', icon: Database },
      { name: 'Log Aktivitas', path: '/admin/log-aktivitas', icon: Clock },
      { name: 'Riwayat Masuk', path: '/admin/riwayat-masuk', icon: Clock },
    ],
  },
];

export const Layout: React.FC = () => {
  const { session, setSession, isSaving, saveStatusText, flushSaveQueue, confirmModal, notify } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal State for Forced Admin Password Change
  const [forcedNewPass, setForcedNewPass] = useState('');
  const [forcedConfirmPass, setForcedConfirmPass] = useState('');
  const [showForcedPass, setShowForcedPass] = useState(false);
  const [forcedPassError, setForcedPassError] = useState('');
  const [isChangingForcedPass, setIsChangingForcedPass] = useState(false);

  const isAdmin = session?.peran === 'admin';
  const menuGroups = isAdmin ? ADMIN_MENU_GROUPS : GURU_MENU_GROUPS;

  const handleLogout = () => {
    confirmModal(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari sesi aplikasi?',
      () => {
        setSession(null);
        navigate('/login');
      }
    );
  };

  const getPageTitle = () => {
    for (const group of menuGroups) {
      for (const item of group.items) {
        if (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))) {
          return item.name;
        }
      }
    }
    return isAdmin ? 'Panel Administrator' : 'E-Rapor SD';
  };

  const minChars = isAdmin ? 8 : 6;

  const handleForcedPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForcedPassError('');

    if (forcedNewPass.length < minChars) {
      setForcedPassError(`Kata sandi baru minimal ${minChars} karakter.`);
      return;
    }
    if (forcedNewPass !== forcedConfirmPass) {
      setForcedPassError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsChangingForcedPass(true);
    try {
      if (isAdmin) {
        await callApi('gantiSandi', { oldPassword: 'admin123', newPassword: forcedNewPass });
      } else {
        const kelasId = session?.kelasId || session?.rombelId || '';
        await gantiPasswordWaliSendiri(forcedNewPass, kelasId);
      }

      if (session) {
        setSession({
          ...session,
          wajib_ganti_sandi: false,
        });
      }
      notify('Kata sandi berhasil diperbarui. Selamat datang!', 'success');
    } catch (err: any) {
      setForcedPassError(err.message || 'Gagal mengubah kata sandi.');
    } finally {
      setIsChangingForcedPass(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-kemdikbud-bg text-slate-800">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (250px, #0d2370) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[250px] bg-kemdikbud-sidebar text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
              <img
                src="/logo/tut-wuri-handayani.png"
                alt="Logo Tut Wuri Handayani"
                className="w-6 h-6 object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wider text-white">E-RAPOR SD</h1>
              <p className="text-[11px] text-blue-200 font-medium">
                {isAdmin
                  ? 'Panel Admin Sekolah'
                  : `Wali Kelas ${session?.kelas} · ${session?.tahunAjaran} ${session?.semester === 1 ? 'Ganjil' : 'Genap'}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/70 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
          {menuGroups.map((grp, gIdx) => (
            <div key={gIdx}>
              <div className="px-3 mb-1.5 text-[10px] font-black uppercase tracking-wider text-blue-300/60">
                {grp.group}
              </div>
              <div className="space-y-0.5">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-kemdikbud-accent text-white shadow-md font-bold'
                          : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-white' : 'text-blue-300'} />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer / Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-red-200 bg-red-900/30 hover:bg-red-800/40 hover:text-white transition cursor-pointer"
          >
            <LogOut size={16} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[250px]">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <Menu size={22} />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                {getPageTitle()}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Auto-save Status Indicator (Refined Tahap 2) */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all">
              {isSaving ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                  <RefreshCw size={12} className="animate-spin text-blue-600" />
                  <span>{saveStatusText}</span>
                </div>
              ) : saveStatusText.startsWith('Gagal') ? (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                  <AlertCircle size={12} className="text-rose-600" />
                  <span>Gagal tersimpan</span>
                  <button
                    type="button"
                    onClick={flushSaveQueue}
                    className="ml-1 text-[11px] underline hover:text-rose-900 cursor-pointer font-bold"
                  >
                    Coba lagi
                  </button>
                </div>
              ) : saveStatusText === 'Tersimpan' ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  <span>Tersimpan</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>{saveStatusText}</span>
                </div>
              )}
            </div>

            {/* Profile Info Role-based: Section 6 */}
            <div className="text-right">
              {isAdmin ? (
                <>
                  <div className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[180px]">
                    Admin · {session?.username || 'admin'}
                  </div>
                  <div className="text-[11px] font-semibold text-navy-500">
                    Administrator Sekolah
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[200px]">
                    {session?.namaWali || 'Wali Kelas'}
                  </div>
                  <div className="text-[11px] font-semibold text-blue-700">
                    Kelas {session?.kelas} · Fase {session?.fase}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Pita Kuning: Mode Lihat Saja / Arsip (Tahap 3) */}
        {session?.hanya_lihat && (
          <div className="bg-amber-500 text-white px-4 py-2 text-xs sm:text-sm font-semibold flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                <strong>Arsip — hanya baca:</strong> Tahun Ajaran {session.tahunAjaran} Semester {session.semester === 1 ? 'Ganjil' : 'Genap'}. Semua input dinonaktifkan.
              </span>
            </div>
            <button
              onClick={() => navigate('/arsip')}
              className="px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1"
            >
              <span>Kelola di Arsip</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* ===================================================================== */}
      {/* MODAL PAKSA GANTI SANDI (Admin bawaan / Wali Kelas password awal)     */}
      {/* ===================================================================== */}
      {session?.wajib_ganti_sandi && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-line animate-fadeIn">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber flex items-center justify-center mb-3">
              <KeyRound size={26} />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Buat Kata Sandi Baru
            </h3>
            <p className="text-xs text-slate-600 mt-1 mb-4 leading-relaxed">
              {isAdmin ? (
                <>
                  Anda masuk dengan kata sandi bawaan (<code>admin123</code>). Demi keamanan sistem sekolah, Anda wajib membuat kata sandi baru (minimal 8 karakter) sebelum mengakses dashboard.
                </>
              ) : (
                <>
                  Akun Anda masih menggunakan kata sandi awal dari admin sekolah. Demi keamanan data nilai siswa, Anda wajib membuat kata sandi baru pribadi (minimal 6 karakter) sebelum mengakses sistem.
                </>
              )}
            </p>

            {forcedPassError && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{forcedPassError}</span>
              </div>
            )}

            <form onSubmit={handleForcedPasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi Baru (minimal {minChars} karakter)
                </label>
                <div className="relative">
                  <input
                    type={showForcedPass ? 'text' : 'password'}
                    value={forcedNewPass}
                    onChange={(e) => setForcedNewPass(e.target.value)}
                    placeholder={`Minimal ${minChars} karakter`}
                    required
                    className="w-full pl-3 pr-10 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForcedPass(!showForcedPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showForcedPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  type="password"
                  value={forcedConfirmPass}
                  onChange={(e) => setForcedConfirmPass(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  required
                  className="w-full px-3 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isChangingForcedPass}
                className="w-full mt-2 py-3 rounded-xl bg-navy-800 text-white font-bold text-xs hover:bg-navy-900 transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Lock size={15} />
                <span>{isChangingForcedPass ? 'Menyimpan…' : 'Simpan Kata Sandi & Masuk'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
