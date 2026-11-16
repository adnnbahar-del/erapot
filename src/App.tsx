import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from './context/AppContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ProfilSaya } from './pages/ProfilSaya';
import { DataSekolah } from './pages/DataSekolah';
import { DataSiswa } from './pages/DataSiswa';
import { Intrakurikuler } from './pages/Intrakurikuler';
import { Ekstrakurikuler } from './pages/Ekstrakurikuler';
import { Kokurikuler } from './pages/Kokurikuler';
import { TujuanPembelajaranPage } from './pages/TujuanPembelajaran';
import { LingkupMateriPage } from './pages/LingkupMateri';
import { InputNilai } from './pages/InputNilai';
import { AsesmenFormatif } from './pages/AsesmenFormatif';
import { AsesmenSumatif } from './pages/AsesmenSumatif';
import { Penilaian } from './pages/Penilaian';
import { NilaiAkhir } from './pages/NilaiAkhir';
import { Input7Kaih } from './pages/Input7Kaih';
import { RekapKehadiran } from './pages/RekapKehadiran';
import { CetakSampul } from './pages/cetak/CetakSampul';
import { CetakRapor } from './pages/cetak/CetakRapor';
import { Cetak7Kaih } from './pages/cetak/Cetak7Kaih';
import { CetakMutasi } from './pages/cetak/CetakMutasi';
import { CetakBukuInduk } from './pages/cetak/CetakBukuInduk';
import { Arsip } from './pages/Arsip';

// Admin Pages
import { DashboardSekolah } from './pages/admin/DashboardSekolah';
import { AkunGuru } from './pages/admin/AkunGuru';
import { KelasWaliKelas } from './pages/admin/KelasWaliKelas';
import { GuruMapelPage } from './pages/admin/GuruMapel';
import { AkunLama } from './pages/admin/AkunLama';
import { TahunAjaran } from './pages/admin/TahunAjaran';
import { KunciNilai } from './pages/admin/KunciNilai';
import { TutupTahunAjaran } from './pages/admin/TutupTahunAjaran';
import { CadanganData } from './pages/admin/CadanganData';
import { LogAktivitas } from './pages/admin/LogAktivitas';
import { RiwayatMasuk } from './pages/admin/RiwayatMasuk';
import { CetakSemua } from './pages/admin/CetakSemua';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 menit
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useApp();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RootRedirect: React.FC = () => {
  const { session } = useApp();
  if (session?.peran === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RootRedirect />} />
        
        {/* Guru & Common Routes */}
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="profil-saya" element={<ProfilSaya />} />
        <Route path="data-user" element={<Navigate to="/profil-saya" replace />} />
        <Route path="data-sekolah" element={<DataSekolah />} />
        <Route path="data-siswa" element={<DataSiswa />} />
        <Route path="intrakurikuler" element={<Intrakurikuler />} />
        <Route path="ekstrakurikuler" element={<Ekstrakurikuler />} />
        <Route path="kokurikuler" element={<Kokurikuler />} />
        <Route path="tujuan-pembelajaran" element={<TujuanPembelajaranPage />} />
        <Route path="lingkup-materi" element={<LingkupMateriPage />} />
        <Route path="input-nilai" element={<InputNilai />} />
        <Route path="asesmen-formatif" element={<AsesmenFormatif />} />
        <Route path="asesmen-sumatif" element={<AsesmenSumatif />} />
        <Route path="penilaian" element={<Penilaian />} />
        <Route path="nilai-akhir" element={<NilaiAkhir />} />
        <Route path="input-7-kaih" element={<Input7Kaih />} />
        <Route path="rekap-kehadiran" element={<RekapKehadiran />} />
        <Route path="cetak/sampul" element={<CetakSampul />} />
        <Route path="cetak/rapor" element={<CetakRapor />} />
        <Route path="cetak/7-kaih" element={<Cetak7Kaih />} />
        <Route path="cetak/mutasi" element={<CetakMutasi />} />
        <Route path="cetak/buku-induk" element={<CetakBukuInduk />} />
        <Route path="arsip" element={<Arsip />} />

        {/* Admin Dedicated Routes */}
        <Route path="admin/dashboard" element={<DashboardSekolah />} />
        <Route path="admin/kelas-wali" element={<KelasWaliKelas />} />
        <Route path="admin/guru-mapel" element={<GuruMapelPage />} />
        <Route path="admin/akun-lama" element={<AkunLama />} />
        <Route path="admin/akun-guru" element={<KelasWaliKelas />} />
        <Route path="admin/tahun-ajaran" element={<TahunAjaran />} />
        <Route path="admin/kunci-nilai" element={<KunciNilai />} />
        <Route path="admin/tutup-tahun" element={<TutupTahunAjaran />} />
        <Route path="admin/log-aktivitas" element={<LogAktivitas />} />
        <Route path="admin/backup" element={<CadanganData />} />
        <Route path="admin/riwayat-masuk" element={<RiwayatMasuk />} />
        <Route path="admin/cetak-semua" element={<CetakSemua />} />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};

import { isEmulatorActive } from './lib/firebase';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
          {isEmulatorActive && (
            <div
              role="status"
              aria-label="Mode Firebase Emulator aktif"
              className="fixed bottom-3 right-3 z-50 bg-amber-400 text-amber-950 text-[11px] font-black px-3 py-1.5 rounded-full shadow-lg border border-amber-500 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none select-none"
            >
              <span className="w-2 h-2 rounded-full bg-amber-800 animate-pulse" />
              MODE EMULATOR
            </div>
          )}
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  );
}
