// src/pages/Arsip.tsx
// Menu Arsip: Membuka rapor dan nilai semester lama dalam mode baca-saja (Tahap 3)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Calendar,
  CheckCircle2,
  Lock,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  Info,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getAllTahunAjaran,
  getTahunAjaranAktif,
  type TahunAjaranDoc,
} from '../lib/tahunAjaranService';

export const Arsip: React.FC = () => {
  const { session, setSession, notify } = useApp();
  const navigate = useNavigate();
  const [taList, setTaList] = useState<TahunAjaranDoc[]>([]);
  const [activeTA, setActiveTA] = useState<TahunAjaranDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [list, active] = await Promise.all([
        getAllTahunAjaran(),
        getTahunAjaranAktif(),
      ]);
      setTaList(list);
      setActiveTA(active);
    } catch (err: any) {
      notify(err.message || 'Gagal memuat arsip tahun ajaran.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBukaArsip = (item: TahunAjaranDoc) => {
    if (!session) return;

    const isCurrentActive = item.id === activeTA?.id;
    const semAngka = item.semester === 'Genap' ? 2 : 1;

    setSession({
      ...session,
      tahunAjaran: item.tahun,
      semester: semAngka,
      tahunAjaranId: item.id,
      hanya_lihat: !isCurrentActive,
      isArsip: !isCurrentActive,
    });

    if (isCurrentActive) {
      notify(`Kembali ke semester aktif (${item.tahun} ${item.semester}). Mode edit aktif.`, 'success');
    } else {
      notify(`Membuka arsip ${item.tahun} ${item.semester} dalam Mode Baca-Saja.`, 'info');
    }

    navigate('/dashboard');
  };

  const handleKembaliKeAktif = () => {
    if (!session || !activeTA) return;
    const semAngka = activeTA.semester === 'Genap' ? 2 : 1;

    setSession({
      ...session,
      tahunAjaran: activeTA.tahun,
      semester: semAngka,
      tahunAjaranId: activeTA.id,
      hanya_lihat: false,
      isArsip: false,
    });

    notify(`Kembali ke semester aktif (${activeTA.tahun} ${activeTA.semester}).`, 'success');
    navigate('/dashboard');
  };

  const isSedangBukaArsip = Boolean(session?.isArsip);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Archive size={24} className="text-navy-500" />
            <span>Arsip Semester</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Buka data nilai, kehadiran, dan rapor dari semester lampau dalam mode baca-saja.
          </p>
        </div>

        {isSedangBukaArsip && (
          <button
            onClick={handleKembaliKeAktif}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>Kembali ke Semester Aktif</span>
          </button>
        )}
      </div>

      {/* Status Saat Ini */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Sesi Anda Saat Ini
          </span>
          <div className="text-base font-bold text-slate-800 mt-0.5">
            Tahun Ajaran {session?.tahunAjaran} · Semester {session?.semester === 2 ? 'Genap' : 'Ganjil'}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {session?.isArsip ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <Lock size={12} />
                <span>Arsip — hanya baca (Input dinonaktifkan)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={12} />
                <span>Semester Aktif (Mode Pengisian Nilai)</span>
              </span>
            )}
          </div>
        </div>

        {activeTA && (
          <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Periode Utama Sekolah
            </span>
            <div className="text-sm font-semibold text-slate-700 mt-0.5">
              {activeTA.tahun} · Semester {activeTA.semester}
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-start gap-2.5 text-blue-900 text-xs">
        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Tentang Arsip Semester:</strong>
          <p className="text-[11px] text-blue-800/90 mt-0.5">
            Saat membuka arsip, Anda dapat melihat seluruh rekap nilai, cetak rapor, mutasi, dan 7 KAIH
            dari periode tersebut tanpa khawatir data terubah secara tidak sengaja.
          </p>
        </div>
      </div>

      {/* Daftar Arsip */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800">Pilih Periode Semester</h2>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-navy-500" />
            <span className="text-xs">Memuat daftar arsip…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {taList.map((item) => {
              const isCurrentSession =
                session?.tahunAjaran === item.tahun &&
                ((session.semester === 1 && item.semester === 'Ganjil') ||
                  (session.semester === 2 && item.semester === 'Genap'));

              const isOfficialActive = item.id === activeTA?.id;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border p-4 transition-all shadow-xs flex flex-col justify-between gap-3 ${
                    isCurrentSession
                      ? 'border-navy-500 ring-2 ring-navy-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isOfficialActive
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isOfficialActive ? <Calendar size={20} /> : <Archive size={20} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          {item.tahun}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          Semester {item.semester}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isOfficialActive ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Semester Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                          Arsip
                        </span>
                      )}

                      {item.status === 'ditutup' && (
                        <span className="text-[10px] font-medium text-slate-400 flex items-center gap-0.5">
                          <Lock size={10} /> Ditutup
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {item.tanggal_rapor ? `Rapor: ${item.tanggal_rapor}` : 'Tanggal rapor belum diatur'}
                    </span>

                    {isCurrentSession ? (
                      <span className="text-xs font-bold text-navy-600 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Sedang Dibuka
                      </span>
                    ) : (
                      <button
                        onClick={() => handleBukaArsip(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-navy-50 text-slate-700 hover:text-navy-700 font-bold text-xs transition cursor-pointer"
                      >
                        <span>{isOfficialActive ? 'Buka Periode Aktif' : 'Buka Arsip'}</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

