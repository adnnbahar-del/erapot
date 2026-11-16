// src/pages/admin/KunciNilai.tsx
// Menu Admin: Kunci Nilai & Buka Kunci Rapor (Tahap 4)
// - Daftar status finalisasi seluruh kelas untuk semester aktif
// - Hanya admin yang bisa "Buka Kunci", dengan wajib mengisi alasan
// - Catatan riwayat pembukaan kunci tersimpan

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Lock,
  Unlock,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileText,
  User,
} from 'lucide-react';
import {
  getAllStatusFinalisasi,
  bukaKunciRaporKelas,
  finalkanRaporKelas,
  type FinalisasiRaporDoc,
} from '../../lib/kunciNilaiService';

export const KunciNilai: React.FC = () => {
  const { data, session, notify, refreshFinalisasi } = useApp();
  const [finalisasiMap, setFinalisasiMap] = useState<Record<string, FinalisasiRaporDoc>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Modal Buka Kunci
  const [targetKelas, setTargetKelas] = useState<{ id: string; nama: string } | null>(null);
  const [alasanBuka, setAlasanBuka] = useState('');
  const [modalBukaKunci, setModalBukaKunci] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const currentTAId = session?.tahunAjaranId || (data ? data.activeTahunAjaranId : 'ta_2025_1');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getAllStatusFinalisasi(currentTAId);
      setFinalisasiMap(res);
    } catch (err: any) {
      notify(err.message || 'Gagal memuat status kunci nilai.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentTAId]);

  // Classes list from data.rombel or data.kelas
  const kelasList = (data?.rombel && data.rombel.length > 0)
    ? data.rombel
    : (data?.kelas || []);

  const handleOpenBukaModal = (k: { id: string; nama: string }) => {
    setTargetKelas(k);
    setAlasanBuka('');
    setModalError('');
    setModalBukaKunci(true);
  };

  const handleSubmitBukaKunci = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!alasanBuka.trim()) {
      setModalError('Alasan pembukaan kunci wajib diisi.');
      return;
    }

    if (!targetKelas) return;

    setIsSubmitting(true);
    try {
      await bukaKunciRaporKelas({
        kelasId: targetKelas.id,
        tahunAjaranId: currentTAId,
        alasan: alasanBuka.trim(),
        adminUid: session?.token,
        adminNama: session?.namaWali || 'Administrator',
      });

      notify(`Kunci nilai Kelas ${targetKelas.nama} berhasil dibuka. Wali kelas & guru mapel kini dapat mengedit nilai kembali.`, 'success');
      await refreshFinalisasi();
      setModalBukaKunci(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Gagal membuka kunci nilai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKunciManual = async (k: { id: string; nama: string }) => {
    try {
      await finalkanRaporKelas({
        kelasId: k.id,
        kelasNama: k.nama,
        tahunAjaranId: currentTAId,
        userUid: session?.token,
        userNama: 'Admin (Kunci Manual)',
      });

      notify(`Rapor Kelas ${k.nama} berhasil dikunci.`, 'success');
      await refreshFinalisasi();
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Gagal mengunci rapor.', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Lock size={22} className="text-navy-500" />
            <span>Kunci &amp; Finalisasi Nilai Rapor</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola status kunci nilai rapor per kelas pada periode <strong>{session?.tahunAjaran} Semester {session?.semester === 1 ? 'Ganjil' : 'Genap'}</strong>.
          </p>
        </div>

        <button
          onClick={loadData}
          title="Muat Ulang"
          className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-start gap-2.5 text-blue-900 text-xs">
        <ShieldAlert size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Aturan Kunci Nilai (Finalisasi):</strong>
          <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-blue-800/90">
            <li>Saat wali kelas memfinalkan rapor, seluruh nilai dan kehadiran terkunci secara otomatis.</li>
            <li><strong>Hanya Administrator</strong> yang memiliki wewenang untuk membuka kunci kembali.</li>
            <li>Setiap pembukaan kunci <strong>wajib menyertakan alasan</strong> yang tercatat ke dalam sistem.</li>
          </ul>
        </div>
      </div>

      {/* Daftar Kelas */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Status Kunci per Kelas</h2>
          <span className="text-xs text-slate-500 font-medium">Total: {kelasList.length} Kelas</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-navy-500" />
            <span className="text-xs">Memuat status kunci nilai…</span>
          </div>
        ) : kelasList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada data kelas yang terdaftar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {kelasList.map((k: any) => {
              const fin = finalisasiMap[k.id];
              const isLocked = fin?.status === 'final';

              return (
                <div
                  key={k.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-slate-800">
                        Kelas {k.nama || k.tingkat}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500 font-medium">
                        Fase {k.fase || 'A'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isLocked
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isLocked ? <Lock size={11} /> : <Unlock size={11} />}
                        <span>{isLocked ? 'Final (Terkunci)' : 'Terbuka'}</span>
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <User size={13} className="text-slate-400" />
                      <span>Wali Kelas: {k.nama_wali || 'Belum diatur'}</span>
                    </div>

                    {isLocked && fin.tanggalFinal && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                        <Clock size={12} />
                        <span>
                          Difinalkan: {new Date(fin.tanggalFinal).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          {fin.difinalkanOlehNama ? ` oleh ${fin.difinalkanOlehNama}` : ''}
                        </span>
                      </div>
                    )}

                    {!isLocked && fin?.alasanBukaKunci && (
                      <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 max-w-lg">
                        <strong>Riwayat Buka Kunci:</strong> "{fin.alasanBukaKunci}"
                        <span className="text-amber-700 block mt-0.5">
                          Oleh {fin.dibukaOlehNama || 'Admin'} pada {fin.tanggalBukaKunci ? new Date(fin.tanggalBukaKunci).toLocaleString('id-ID') : '—'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isLocked ? (
                      <button
                        onClick={() => handleOpenBukaModal({ id: k.id, nama: k.nama || k.tingkat })}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition cursor-pointer shadow-2xs"
                      >
                        <Unlock size={14} />
                        <span>Buka Kunci</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleKunciManual({ id: k.id, nama: k.nama || k.tingkat })}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shadow-2xs"
                      >
                        <Lock size={14} />
                        <span>Kunci Rapor</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Buka Kunci (Wajib Alasan) */}
      {modalBukaKunci && targetKelas && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-card-rise">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <Unlock size={24} />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              Buka Kunci Rapor Kelas {targetKelas.nama}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Membuka kunci memungkinkan wali kelas dan guru mapel untuk mengedit kembali nilai, deskripsi capaian, dan kehadiran.
            </p>

            {modalError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitBukaKunci} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alasan Pembukaan Kunci * <span className="text-red-500">(Wajib diisi)</span>
                </label>
                <textarea
                  rows={3}
                  value={alasanBuka}
                  onChange={(e) => setAlasanBuka(e.target.value)}
                  placeholder="Contoh: Perbaikan nilai sumatif lingkup materi Matematika atas persetujuan kepala sekolah"
                  required
                  className="w-full p-3 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:outline-none resize-none leading-relaxed"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Alasan ini akan tercatat dalam riwayat audit pembukaan kunci nilai.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalBukaKunci(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !alasanBuka.trim()}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Menyimpan…</span>
                    </>
                  ) : (
                    <span>Konfirmasi Buka Kunci</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
