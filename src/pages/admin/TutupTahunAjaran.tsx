// src/pages/admin/TutupTahunAjaran.tsx
// Menu Admin: Tutup Tahun Ajaran & Kenaikan Kelas (Tahap 5)
// - Hanya aktif di semester Genap
// - Cek finalisasi seluruh kelas (wajib semua final sebelum lanjut)
// - Pemetaan kelas tujuan (default 1A -> 2A, 6A -> LULUS)
// - Penentuan status kenaikan per siswa (Naik, Tinggal Kelas, Lulus, Mutasi Keluar)
// - Konfirmasi ketik "TUTUP [tahun]" sebelum eksekusi atomik

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Users,
  ShieldCheck,
  Check,
  RefreshCw,
  Award,
  AlertCircle,
  School,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import {
  cekStatusFinalisasiSemuaKelas,
  generateDefaultPemetaanKelas,
  generateDefaultSiswaKenaikan,
  eksekusiTutupTahunAjaran,
  getTahunAjaranBerikutnya,
  type PemetaanKelas,
  type SiswaKenaikanItem,
  type StatusKenaikan,
  type CekFinalisasiResult,
} from '../../lib/tutupTahunService';

export const TutupTahunAjaran: React.FC = () => {
  const { data, session, notify, refreshData, setSession } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isLoading, setIsLoading] = useState(true);

  // Data Prasyarat
  const [finalisasiCek, setFinalisasiCek] = useState<CekFinalisasiResult | null>(null);

  // Step 2 & 3 State
  const [pemetaanKelas, setPemetaanKelas] = useState<PemetaanKelas[]>([]);
  const [siswaKenaikan, setSiswaKenaikan] = useState<SiswaKenaikanItem[]>([]);
  const [filterKelasSiswa, setFilterKelasSiswa] = useState<string>('all');

  // Step 4 Confirmation
  const [konfirmasiTeks, setKonfirmasiTeks] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [hasilEksekusi, setHasilEksekusi] = useState<any | null>(null);

  const currentTAId = session?.tahunAjaranId || (data ? data.activeTahunAjaranId : 'ta_2025_1');
  const currentTahun = session?.tahunAjaran || '2025/2026';
  const isSemesterGenap = session?.semester === 2 || (session?.semester as any) === 'Genap';
  const requiredConfirmationText = `TUTUP ${currentTahun}`;

  const kelasList = (data?.rombel && data.rombel.length > 0)
    ? data.rombel
    : (data?.kelas || []);

  const loadPrasyarat = async () => {
    setIsLoading(true);
    try {
      const cek = await cekStatusFinalisasiSemuaKelas(currentTAId, kelasList);
      setFinalisasiCek(cek);

      // Inisialisasi default pemetaan & siswa
      const defPem = generateDefaultPemetaanKelas(kelasList);
      setPemetaanKelas(defPem);

      if (data?.siswa && data?.kelasSiswa) {
        const defSiswa = generateDefaultSiswaKenaikan(data.siswa, data.kelasSiswa, defPem);
        setSiswaKenaikan(defSiswa);
      }
    } catch (err: any) {
      notify(err.message || 'Gagal memuat status prasyarat.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrasyarat();
  }, [currentTAId]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    let naik = 0;
    let tinggal = 0;
    let lulus = 0;
    let mutasi = 0;
    siswaKenaikan.forEach((s) => {
      if (s.status === 'Naik') naik++;
      else if (s.status === 'Tinggal Kelas') tinggal++;
      else if (s.status === 'Lulus') lulus++;
      else if (s.status === 'Mutasi Keluar') mutasi++;
    });
    return { naik, tinggal, lulus, mutasi, total: siswaKenaikan.length };
  }, [siswaKenaikan]);

  // Update target kelas pada step 2
  const handleUpdatePemetaanTarget = (asalId: string, targetId: string) => {
    setPemetaanKelas((prev) =>
      prev.map((p) => {
        if (p.kelasAsalId === asalId) {
          const matchTarget = kelasList.find((k: any) => k.id === targetId);
          return {
            ...p,
            kelasTujuanId: targetId,
            kelasTujuanNama: targetId === 'LULUS' ? 'LULUS (Tamat Sekolah)' : (matchTarget ? String(matchTarget.nama || matchTarget.tingkat || targetId) : targetId),
          };
        }
        return p;
      })
    );
  };

  // Update status kenaikan per siswa pada step 3
  const handleUpdateStatusSiswa = (siswaId: string, status: StatusKenaikan) => {
    setSiswaKenaikan((prev) =>
      prev.map((s) => {
        if (s.siswaId === siswaId) {
          const pem = pemetaanKelas.find((p) => p.kelasAsalId === s.kelasAsalId);
          const target = status === 'Lulus' ? 'LULUS' : (status === 'Tinggal Kelas' ? s.kelasAsalId : (pem ? pem.kelasTujuanId : s.kelasTujuanId));
          return { ...s, status, kelasTujuanId: target };
        }
        return s;
      })
    );
  };

  // Eksekusi Tutup Tahun
  const handleEksekusi = async () => {
    if (konfirmasiTeks.trim() !== requiredConfirmationText) return;

    setIsExecuting(true);
    try {
      const res = await eksekusiTutupTahunAjaran({
        tahunAjaranSekarangId: currentTAId,
        tahunAjaranSekarang: currentTahun,
        semesterSekarang: session?.semester || 2,
        pemetaanKelas,
        siswaKenaikan,
      });

      setHasilEksekusi(res);
      setStep(5);
      notify(`Tahun ajaran ${currentTahun} berhasil ditutup! Periode ${res.tahunAjaranBaru} Ganjil kini aktif.`, 'success');

      if (session) {
        setSession({
          ...session,
          tahunAjaran: res.tahunAjaranBaru,
          semester: 1,
          tahunAjaranId: res.tahunAjaranBaruId,
          hanya_lihat: false,
        });
      }
      await refreshData();
    } catch (err: any) {
      notify(err.message || 'Gagal mengeksekusi tutup tahun ajaran.', 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const filteredSiswa = useMemo(() => {
    if (filterKelasSiswa === 'all') return siswaKenaikan;
    return siswaKenaikan.filter((s) => s.kelasAsalId === filterKelasSiswa);
  }, [siswaKenaikan, filterKelasSiswa]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Halaman */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Calendar size={24} className="text-navy-500" />
          <span>Tutup Tahun Ajaran &amp; Kenaikan Kelas</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Proses akhir tahun akademik untuk memetakan kenaikan kelas, kelulusan siswa, dan membuka tahun ajaran baru.
        </p>
      </div>

      {/* Stepper Indikator */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 max-w-3xl mx-auto">
          {[
            { num: 1, label: '1. Cek Prasyarat' },
            { num: 2, label: '2. Pemetaan Kelas' },
            { num: 3, label: '3. Status Siswa' },
            { num: 4, label: '4. Konfirmasi' },
            { num: 5, label: '5. Selesai' },
          ].map((item) => (
            <div
              key={item.num}
              className={`flex items-center gap-2 ${
                step === item.num
                  ? 'text-navy-700 font-black'
                  : step > item.num
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === item.num
                    ? 'bg-navy-700 text-white shadow-xs'
                    : step > item.num
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > item.num ? <Check size={14} /> : item.num}
              </div>
              <span className="hidden sm:inline">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: CEK PRASYARAT                                                    */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-800">
              Langkah 1: Pemeriksaan Prasyarat Tutup Tahun
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tutup tahun ajaran hanya dapat dilakukan pada Semester Genap dan setelah seluruh rapor kelas difinalkan.
            </p>
          </div>

          {/* Validasi 1: Semester Genap */}
          <div
            className={`p-4.5 rounded-2xl border flex items-start gap-3.5 ${
              isSemesterGenap
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/80 border-rose-200 text-rose-900'
            }`}
          >
            {isSemesterGenap ? (
              <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={22} className="text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm">
                Status Semester: {session?.tahunAjaran} {session?.semester === 2 ? 'Semester Genap' : 'Semester Ganjil'}
              </div>
              <p className="text-xs mt-0.5">
                {isSemesterGenap
                  ? 'Semester saat ini adalah Semester Genap. Syarat periode terpenuhi.'
                  : 'Proses Tutup Tahun Ajaran hanya dapat dijalankan pada akhir Semester Genap. Silakan ganti periode aktif ke Semester Genap terlebih dahulu di menu Tahun Ajaran.'}
              </p>
            </div>
          </div>

          {/* Validasi 2: Seluruh Rapor Difinalkan */}
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-navy-500" />
              <span className="text-xs">Memeriksa status finalisasi kelas…</span>
            </div>
          ) : finalisasiCek && (
            <div
              className={`p-4.5 rounded-2xl border flex items-start gap-3.5 ${
                finalisasiCek.semuaFinal
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/80 border-amber-200 text-amber-900'
              }`}
            >
              {finalisasiCek.semuaFinal ? (
                <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold text-sm flex items-center justify-between">
                  <span>
                    Status Finalisasi Rapor: {finalisasiCek.semuaFinal ? 'Semua Kelas Final' : 'Belum Semua Final'}
                  </span>
                  <span className="text-xs font-semibold">
                    {finalisasiCek.totalKelas - finalisasiCek.kelasBelumFinal.length} / {finalisasiCek.totalKelas} Kelas
                  </span>
                </div>

                {finalisasiCek.semuaFinal ? (
                  <p className="text-xs mt-0.5 text-emerald-700">
                    Seluruh nilai kelas telah difinalkan dan terkunci secara aman.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-amber-800">
                      <strong>Proses tidak bisa lanjut sampai semua kelas difinalkan.</strong> Berikut daftar kelas yang belum difinalkan oleh wali kelas:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {finalisasiCek.kelasBelumFinal.map((kb) => (
                        <div
                          key={kb.id}
                          className="bg-white/90 p-2.5 rounded-xl border border-amber-300 text-xs font-medium text-slate-800 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold">Kelas {kb.nama}</span>
                            <span className="text-slate-400 block text-[11px]">
                              Wali: {kb.nama_wali || 'Belum diatur'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                            Belum Final
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tombol Aksi Step 1 */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={loadPrasyarat}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Cek Ulang</span>
            </button>

            <button
              disabled={!isSemesterGenap || !finalisasiCek?.semuaFinal}
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-800 text-white font-bold text-xs hover:bg-navy-900 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-btn-admin cursor-pointer"
            >
              <span>Lanjut ke Pemetaan Kelas</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: PEMETAAN KELAS TUJUAN                                            */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-800">
              Langkah 2: Pemetaan Kelas Tujuan Kenaikan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Secara bawaan rombel sumber dipetakan ke tingkat berikutnya (1A → 2A, 5A → 6A). Kelas VI otomatis ditandai "LULUS". Anda dapat menyesuaikan kelas tujuan jika diperlukan.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                  <th className="px-5 py-3">Kelas Asal (2025/2026)</th>
                  <th className="px-4 py-3">Tingkat</th>
                  <th className="px-5 py-3">Kelas Tujuan ({getTahunAjaranBerikutnya(currentTahun)})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pemetaanKelas.map((pem) => {
                  const isKelas6 = pem.tingkatAsal >= 6;

                  return (
                    <tr key={pem.kelasAsalId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        Kelas {pem.kelasAsalNama}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-medium">
                        Tingkat {pem.tingkatAsal}
                      </td>
                      <td className="px-5 py-3.5">
                        {isKelas6 ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-800 font-bold text-xs border border-purple-200">
                            <GraduationCap size={15} className="text-purple-600" />
                            <span>LULUS (Tamat Sekolah Dasar)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 max-w-xs">
                            <select
                              value={pem.kelasTujuanId}
                              onChange={(e) => handleUpdatePemetaanTarget(pem.kelasAsalId, e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-navy-500"
                            >
                              {kelasList
                                .filter((k: any) => {
                                  const t = k.angka || k.tingkat_angka || parseInt(String(k.nama || k.tingkat).replace(/\D/g, ''), 10);
                                  return t === pem.tingkatAsal + 1;
                                })
                                .map((k: any) => (
                                  <option key={k.id} value={k.id}>
                                    Naik ke Kelas {k.nama || k.tingkat}
                                  </option>
                                ))}
                              <option value="LULUS">LULUS</option>
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tombol Navigasi Step 2 */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Kembali</span>
            </button>

            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-800 text-white font-bold text-xs hover:bg-navy-900 transition shadow-btn-admin cursor-pointer"
            >
              <span>Lanjut ke Status Siswa ({siswaKenaikan.length} Siswa)</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: STATUS SISWA PERORANGAN                                          */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Langkah 3: Konfirmasi Status Kenaikan Per Siswa
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bawaan siswa tingkat 1–5 adalah "Naik" dan kelas VI adalah "Lulus". Anda dapat mengubah per siswa bila ada yang Tinggal Kelas atau Mutasi.
              </p>
            </div>

            {/* Filter Kelas */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter:</span>
              <select
                value={filterKelasSiswa}
                onChange={(e) => setFilterKelasSiswa(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:border-navy-500"
              >
                <option value="all">Semua Kelas ({siswaKenaikan.length} Siswa)</option>
                {pemetaanKelas.map((p) => (
                  <option key={p.kelasAsalId} value={p.kelasAsalId}>
                    Kelas {p.kelasAsalNama}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              Naik: {stats.naik}
            </span>
            <span className="px-3 py-1 rounded-xl bg-rose-50 text-rose-800 font-bold border border-rose-200">
              Tinggal Kelas: {stats.tinggal}
            </span>
            <span className="px-3 py-1 rounded-xl bg-purple-50 text-purple-800 font-bold border border-purple-200">
              Lulus: {stats.lulus}
            </span>
            <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-800 font-bold border border-amber-200">
              Mutasi Keluar: {stats.mutasi}
            </span>
          </div>

          {/* Tabel Siswa */}
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">NISN / NIS</th>
                  <th className="px-4 py-3">Kelas Asal</th>
                  <th className="px-4 py-3">Status Kenaikan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSiswa.map((item) => (
                  <tr key={item.siswaId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{item.nama}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {item.nisn || item.nis || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                      Kelas {item.kelasAsalNama}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(['Naik', 'Tinggal Kelas', 'Lulus', 'Mutasi Keluar'] as StatusKenaikan[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleUpdateStatusSiswa(item.siswaId, st)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              item.status === st
                                ? st === 'Naik'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : st === 'Tinggal Kelas'
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : st === 'Lulus'
                                  ? 'bg-purple-600 text-white shadow-2xs'
                                  : 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tombol Navigasi Step 3 */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Kembali</span>
            </button>

            <button
              onClick={() => setStep(4)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-800 text-white font-bold text-xs hover:bg-navy-900 transition shadow-btn-admin cursor-pointer"
            >
              <span>Lanjut ke Ringkasan &amp; Konfirmasi</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: RINGKASAN & KONFIRMASI EKSEKUSI                                  */}
      {/* ========================================================================= */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-800">
              Langkah 4: Ringkasan &amp; Konfirmasi Tutup Tahun
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Periksa ringkasan perubahan di bawah sebelum melakukan eksekusi atomik.
            </p>
          </div>

          {/* Grid Statistik */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Naik Kelas</span>
              <div className="text-2xl font-black text-emerald-900 mt-1">{stats.naik}</div>
              <span className="text-xs text-emerald-600">siswa pindah tingkat</span>
            </div>

            <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Lulus</span>
              <div className="text-2xl font-black text-purple-900 mt-1">{stats.lulus}</div>
              <span className="text-xs text-purple-600">tercatat di Buku Induk</span>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Tinggal Kelas</span>
              <div className="text-2xl font-black text-rose-900 mt-1">{stats.tinggal}</div>
              <span className="text-xs text-rose-600">tetap di rombel asal</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Mutasi Keluar</span>
              <div className="text-2xl font-black text-amber-900 mt-1">{stats.mutasi}</div>
              <span className="text-xs text-amber-600">siswa pindah sekolah</span>
            </div>
          </div>

          {/* Peringatan Dampak */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertTriangle size={16} className="text-amber-600" />
              <span>Dampak Eksekusi Tutup Tahun:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-amber-900/90 leading-relaxed">
              <li>Tahun ajaran <strong>{currentTahun}</strong> akan berstatus <strong>DITUTUP</strong> (arsip baca-saja).</li>
              <li>Dibuat tahun ajaran baru <strong>{getTahunAjaranBerikutnya(currentTahun)} Semester Ganjil</strong> yang otomatis menjadi periode aktif.</li>
              <li>Seluruh nilai, catatan, dan data rapor semester lama tetap <strong>utuh 100%</strong> dan dapat dibuka kapan saja lewat menu Arsip.</li>
            </ul>
          </div>

          {/* Konfirmasi Ketik */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Ketik Konfirmasi untuk Melanjutkan:
            </label>
            <p className="text-xs text-slate-600">
              Ketik <code className="bg-white px-2 py-0.5 rounded border border-slate-300 font-bold text-rose-600">{requiredConfirmationText}</code> pada kotak di bawah untuk mengaktifkan tombol eksekusi:
            </p>
            <input
              type="text"
              value={konfirmasiTeks}
              onChange={(e) => setKonfirmasiTeks(e.target.value)}
              placeholder={`Ketik "${requiredConfirmationText}"`}
              className="w-full max-w-sm px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-bold tracking-wider uppercase focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Tombol Eksekusi */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Kembali</span>
            </button>

            <button
              disabled={isExecuting || konfirmasiTeks.trim() !== requiredConfirmationText}
              onClick={handleEksekusi}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 text-white font-extrabold text-xs sm:text-sm hover:bg-rose-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer"
            >
              {isExecuting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Mengeksekusi Batch Tutup Tahun…</span>
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>EKSEKUSI TUTUP {currentTahun}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: SELESAI / HASIL SUKSES                                           */}
      {/* ========================================================================= */}
      {step === 5 && hasilEksekusi && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 shadow-xs text-center space-y-6 animate-card-rise">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <Sparkles size={32} />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-xl font-black text-slate-900">
              Tahun Ajaran Berhasil Ditutup!
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tahun ajaran baru <strong>{hasilEksekusi.tahunAjaranBaru} Semester Ganjil</strong> telah berhasil dibuat dan aktif sebagai periode sekolah.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Naik Kelas</span>
              <div className="text-lg font-bold text-slate-800">{hasilEksekusi.ringkasan.totalNaik} siswa</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Lulus</span>
              <div className="text-lg font-bold text-slate-800">{hasilEksekusi.ringkasan.totalLulus} siswa</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Tinggal</span>
              <div className="text-lg font-bold text-slate-800">{hasilEksekusi.ringkasan.totalTinggal} siswa</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Mutasi</span>
              <div className="text-lg font-bold text-slate-800">{hasilEksekusi.ringkasan.totalMutasi} siswa</div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-5 py-2.5 rounded-xl bg-navy-800 text-white font-bold text-xs hover:bg-navy-900 transition shadow-btn-admin cursor-pointer"
            >
              Buka Dashboard Sekolah
            </button>
            <button
              onClick={() => navigate('/arsip')}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Lihat Arsip {currentTahun}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

