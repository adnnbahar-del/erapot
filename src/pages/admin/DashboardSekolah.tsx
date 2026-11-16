import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  School,
  Users,
  GraduationCap,
  Calendar,
  Clock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Rombel } from '../../types';
import { faseDariTingkat } from '../../lib/rombel';
import { getTanggalBackupTerakhir } from '../../lib/backupService';
import { getEstimasiTulisSesiIni, subscribeEstimasiTulis } from '../../lib/firestoreWriteCounter';
import { Database, AlertTriangle } from 'lucide-react';

export const DashboardSekolah: React.FC = () => {
  const { data, session, setSession } = useApp();
  const navigate = useNavigate();

  const [backupNotice, setBackupNotice] = React.useState<{ show: boolean; days?: number; dateStr?: string }>({ show: false });
  const [writeCount, setWriteCount] = React.useState<number>(getEstimasiTulisSesiIni());

  React.useEffect(() => {
    return subscribeEstimasiTulis(setWriteCount);
  }, []);

  React.useEffect(() => {
    getTanggalBackupTerakhir().then((dateStr) => {
      if (!dateStr) {
        setBackupNotice({ show: true });
      } else {
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 14) {
          setBackupNotice({ show: true, days: diffDays, dateStr });
        }
      }
    });
  }, []);

  if (!data) return null;

  const rombelList = (data.rombel || []).filter((r) => r.aktif);
  const siswaList = data.siswa || [];
  const kelasSiswaList = data.kelasSiswa || [];

  const totalSiswa = siswaList.length;
  const activeTahun =
    (data.tahunAjaran || []).find((t) => t.aktif) ||
    (data.tahunAjaran || []).find((t) => t.id === data.activeTahunAjaranId) ||
    data.tahunAjaran[0];

  // Helper buka kelas dalam mode lihat
  const handleOpenClassView = (r: Rombel) => {
    if (session) {
      const tingkatAngka = r.tingkat_angka || parseInt(r.nama, 10) || 1;
      const fase = faseDariTingkat(tingkatAngka);
      setSession({
        ...session,
        rombelId: r.id,
        rombelNama: r.nama,
        kelas: r.nama,
        kelasId: r.id,
        tingkatAngka,
        huruf: r.huruf || 'A',
        fase,
        namaWali: r.nama_wali || 'Wali Kelas',
        hanya_lihat: true, // Admin viewing class data
      });
      navigate('/dashboard');
    }
  };

  // Kelompokkan rombel per tingkat (1 s.d. 6)
  const tingkatList = [1, 2, 3, 4, 5, 6];
  const rombelPerTingkat = tingkatList.map((t) => {
    const list = rombelList.filter((r) => {
      const tAngka = r.tingkat_angka || r.tingkat || parseInt(r.nama, 10);
      return tAngka === t;
    }).sort((a, b) => a.nama.localeCompare(b.nama));
    const tg = (data?.tingkat || []).find((item) => item.angka === t);
    const isSingle = tg?.modeKelas === 'tunggal' || (list.length === 1 && !list[0].huruf);
    return {
      tingkat: t,
      fase: faseDariTingkat(t),
      isSingle,
      rombels: list,
    };
  });

  // Hitung total rata-rata sekolah
  let grandTotalSiswa = 0;
  let totalProgressSum = 0;
  let totalRombelCount = 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber uppercase tracking-wider mb-1">
              <ShieldCheck size={16} />
              <span>Panel Administrator & Operator</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-white">
              Dashboard Sekolah
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/80 mt-1">
              Monitoring 18 rombongan belajar (1A–6C), pengisian rapor, kelengkapan penilaian, dan aktivitas wali kelas
            </p>
          </div>
          <div className="bg-white/10 border border-white/20 backdrop-blur-xs px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-blue-200 block">Tahun Ajaran Aktif</span>
            <span className="text-sm font-bold text-white">
              {activeTahun?.tahun} · Semester {activeTahun?.semester === 1 || activeTahun?.semester === 'Ganjil' ? 'Ganjil' : 'Genap'}
            </span>
          </div>
        </div>
      </div>

      
      {/* Pengingat Backup 14 Hari (Spark Plan) */}
      {backupNotice.show && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <span>Pengingat Cadangan Data (Firebase Spark Plan)</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                  {backupNotice.days ? `${backupNotice.days} Hari Lalu` : 'Belum Pernah'}
                </span>
              </h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                {backupNotice.days
                  ? `Cadangan data terakhir dilakukan ${backupNotice.days} hari yang lalu. Untuk keamanan data pada paket gratis tanpa Cloud Storage, sangat disarankan mencadangkan seluruh koleksi secara berkala.`
                  : 'Basis data sistem belum pernah dicadangkan. Disarankan untuk mengunduh cadangan lengkap (JSON & Excel) minimal setiap 14 hari.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/backup')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-sm transition"
          >
            <Database size={15} />
            <span>Cadangkan Data</span>
          </button>
        </div>
      )}

      {/* 4 Kartu Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Siswa</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalSiswa}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-navy-500 flex items-center justify-center">
              <GraduationCap size={22} />
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block font-medium">Terdaftar di seluruh rombel</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rombongan Belajar</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{rombelList.length} Rombel</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-guru flex items-center justify-center">
              <School size={22} />
            </div>
          </div>
          <span className="text-[11px] text-emerald-600 mt-2 block font-medium">6 Tingkat (A, B, C aktif)</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Wali Kelas</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{rombelList.length} Guru</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber flex items-center justify-center">
              <Users size={22} />
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block font-medium">Akun rombel aktif</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Rapor</p>
              <h3 className="text-base font-bold text-slate-800 mt-1">{activeTahun?.tanggal_rapor || '20 Desember 2025'}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Calendar size={22} />
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block font-medium">Batas akhir pencetakan</span>
        </div>
      </div>

      {/* Estimasi Pemakaian Tulis Firestore Hari Ini (Spark Plan) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-navy-600 flex items-center justify-center shrink-0">
            <Database size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Pemakaian Tulis Hari Ini (Sesi Ini)
            </h4>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold text-slate-800">{writeCount.toLocaleString('id-ID')}</span>
              <span className="text-xs text-slate-500 font-medium">dokumen ditulis / batas harian Spark: 20.000</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-36 bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                writeCount > 15000 ? 'bg-red-500' : writeCount > 10000 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(1, (writeCount / 20000) * 100))}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-600 min-w-[45px] text-right">
            {((writeCount / 20000) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Tabel 18 Rombel Dikelompokkan per Tingkat */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <School size={18} className="text-navy-500" />
              <span>Monitoring Rombongan Belajar (1A – 6C)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Status kelengkapan rapor per rombel (maks. 50 siswa) dan waktu terakhir akses wali kelas
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Rombel & Fase</th>
                <th className="py-3 px-4">Wali Kelas</th>
                <th className="py-3 px-4 text-center">Jumlah Siswa</th>
                <th className="py-3 px-4">Kelengkapan Rapor</th>
                <th className="py-3 px-4">Terakhir Masuk</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rombelPerTingkat.map(({ tingkat, fase, isSingle, rombels }) => {
                let subtotalSiswaTingkat = 0;
                let subtotalProgressTingkat = 0;

                return (
                  <React.Fragment key={tingkat}>
                    {/* Header Group Tingkat (Hanya Tampil Jika Mode Rombel) */}
                    {!isSingle && (
                      <tr className="bg-slate-100/80 border-t-2 border-slate-200">
                        <td colSpan={6} className="py-2.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                          Kelas {tingkat} · Fase {fase} ({rombels.length} Rombel)
                        </td>
                      </tr>
                    )}

                    {/* Baris Rombel / Kelas */}
                    {rombels.map((r) => {
                      const rombelStudentIds = new Set(
                        kelasSiswaList
                          .filter((ks) => ks.rombel_id === r.id || ks.kelas_id === r.id)
                          .map((ks) => ks.siswa_id)
                      );
                      const countSiswa = rombelStudentIds.size;
                      subtotalSiswaTingkat += countSiswa;
                      grandTotalSiswa += countSiswa;

                      const sumatifCount = (data.sumatifLM || []).filter((s) => rombelStudentIds.has(s.siswa_id)).length;
                      const progressPct =
                        countSiswa > 0 ? Math.min(100, Math.round((sumatifCount / (countSiswa * 4 || 1)) * 100)) : 0;
                      subtotalProgressTingkat += progressPct;
                      totalProgressSum += progressPct;
                      totalRombelCount += 1;

                      const rombelAccount = ((data as any).accounts || []).find(
                        (a: any) => a.rombel_id === r.id || a.kelas === r.nama
                      );
                      const lastLogin = r.terakhir_masuk || rombelAccount?.terakhir_masuk;
                      const badgeText = isSingle || !r.huruf ? String(tingkat) : r.nama;
                      const classTitle = isSingle || !r.huruf ? `Kelas ${tingkat}` : `Kelas ${r.nama}`;

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-800">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-7 h-7 rounded-lg bg-blue-100 text-kemdikbud-dark flex items-center justify-center font-bold text-xs">
                                {badgeText}
                              </span>
                              <span>{classTitle}</span>
                            </span>
                            <span className="ml-2 px-2 py-0.5 text-[10px] rounded bg-blue-50 text-navy-500 font-semibold">
                              Fase {fase}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{r.nama_wali || 'Belum diatur'}</div>
                            <div className="text-[10px] text-slate-400">NIP: {r.nip_wali || '-'}</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-bold tabular-nums ${countSiswa >= 50 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {countSiswa} / 50
                            </span>
                            <span className="text-[10px] text-slate-400 block">siswa</span>
                          </td>
                          <td className="py-3 px-4 min-w-[160px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    progressPct >= 80 ? 'bg-guru' : progressPct >= 40 ? 'bg-blue-500' : 'bg-amber'
                                  }`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-slate-700 w-8 text-right">
                                {progressPct}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {lastLogin ? (
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-slate-400" />
                                <span>
                                  {new Date(lastLogin).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Belum pernah masuk</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenClassView(r)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-navy-50 text-navy-500 hover:bg-navy-500 hover:text-white transition-all cursor-pointer"
                              title="Buka data rombel dalam mode lihat"
                            >
                              <span>Lihat Rapor</span>
                              <ExternalLink size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Subtotal Baris Tingkat */}
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <td colSpan={2} className="py-2.5 px-4 font-bold text-slate-700">
                        Subtotal Tingkat {tingkat} ({rombels.length} Rombel)
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-800">
                        {subtotalSiswaTingkat} / {rombels.length * 50}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-700">
                        Rata-rata: {rombels.length > 0 ? Math.round(subtotalProgressTingkat / rombels.length) : 0}%
                      </td>
                      <td colSpan={2} className="py-2.5 px-4"></td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Baris Total Keseluruhan Sekolah */}
              <tr className="bg-kemdikbud-dark text-white font-bold text-xs border-t-2 border-slate-400">
                <td colSpan={2} className="py-3 px-4 tracking-wider">
                  TOTAL KESELURUHAN SEKOLAH ({rombelList.length} ROMBEL)
                </td>
                <td className="py-3 px-4 text-center tabular-nums text-sm">
                  {grandTotalSiswa} / {rombelList.length * 50}
                </td>
                <td className="py-3 px-4">
                  Rata-rata:{' '}
                  {totalRombelCount > 0 ? Math.round(totalProgressSum / totalRombelCount) : 0}%
                </td>
                <td colSpan={2} className="py-3 px-4 text-right font-medium text-blue-200">
                  Kapasitas maksimum: {rombelList.length * 50} siswa
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

