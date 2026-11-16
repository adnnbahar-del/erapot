// src/pages/admin/TahunAjaran.tsx
// Menu Admin: Pengaturan Tahun Ajaran & Semester (Tahap 3)
// - Koleksi tahunAjaran: { id, tahun: "2025/2026", semester: "Ganjil" | "Genap", aktif: boolean, status: "berjalan" | "ditutup" }
// - Hanya satu yang aktif dalam satu waktu. Hanya admin yang bisa mengubahnya.

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Unlock,
  Radio,
  Check,
  Clock,
  Archive,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getAllTahunAjaran,
  setTahunAjaranAktif,
  tambahTahunAjaran,
  updateStatusTahunAjaran,
  type TahunAjaranDoc,
} from '../../lib/tahunAjaranService';
import type { SemesterNama, StatusTahunAjaran } from '../../types';

export const TahunAjaran: React.FC = () => {
  const { notify, confirmModal, session, setSession } = useApp();
  const [taList, setTaList] = useState<TahunAjaranDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalTambah, setModalTambah] = useState(false);

  // Form tambah
  const [formTahun, setFormTahun] = useState('2026/2027');
  const [formSemester, setFormSemester] = useState<SemesterNama>('Ganjil');
  const [formTanggalRapor, setFormTanggalRapor] = useState('');
  const [formJadikanAktif, setFormJadikanAktif] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await getAllTahunAjaran();
      setTaList(list);
    } catch (err: any) {
      notify(err.message || 'Gagal memuat daftar tahun ajaran.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetAktif = (item: TahunAjaranDoc) => {
    if (item.aktif) return;

    confirmModal(
      'Aktifkan Tahun Ajaran',
      `Apakah Anda yakin ingin mengaktifkan ${item.tahun} Semester ${item.semester}?\n\nSemua wali kelas dan guru mapel otomatis akan bekerja di periode ini. Semester lain akan menjadi arsip (baca-saja).`,
      async () => {
        try {
          const updated = await setTahunAjaranAktif(item.id);
          notify(`Tahun ajaran ${updated.tahun} Semester ${updated.semester} sekarang aktif.`, 'success');
          
          if (session) {
            setSession({
              ...session,
              tahunAjaran: updated.tahun,
              semester: updated.semester === 'Genap' ? 2 : 1,
              tahunAjaranId: updated.id,
            });
          }
          await loadData();
        } catch (err: any) {
          notify(err.message || 'Gagal mengaktifkan tahun ajaran.', 'error');
        }
      }
    );
  };

  const handleToggleStatus = (item: TahunAjaranDoc) => {
    const nextStatus: StatusTahunAjaran = item.status === 'ditutup' ? 'berjalan' : 'ditutup';
    const labelAksi = nextStatus === 'ditutup' ? 'menutup' : 'membuka kembali';

    confirmModal(
      `${nextStatus === 'ditutup' ? 'Tutup' : 'Buka'} Periode ${item.tahun} (${item.semester})`,
      `Apakah Anda yakin ingin ${labelAksi} periode ini?${nextStatus === 'ditutup' ? '\nPeriode yang ditutup berstatus arsip dan tidak dapat diedit.' : ''}`,
      async () => {
        try {
          await updateStatusTahunAjaran(item.id, nextStatus);
          notify(`Status periode berhasil diubah menjadi ${nextStatus}.`, 'success');
          await loadData();
        } catch (err: any) {
          notify(err.message || 'Gagal mengubah status periode.', 'error');
        }
      }
    );
  };

  const handleTambahSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formTahun.trim() || !formTahun.includes('/')) {
      setFormError('Format tahun ajaran harus YYYY/YYYY (contoh: 2026/2027)');
      return;
    }

    setIsSubmitting(true);
    try {
      await tambahTahunAjaran({
        tahun: formTahun.trim(),
        semester: formSemester,
        aktif: formJadikanAktif,
        tanggal_rapor: formTanggalRapor,
      });

      notify(`Tahun ajaran ${formTahun} ${formSemester} berhasil ditambahkan.`, 'success');
      setModalTambah(false);
      setFormTanggalRapor('');
      setFormJadikanAktif(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menambahkan tahun ajaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeItem = taList.find((it) => it.aktif);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar size={24} className="text-navy-500" />
            <span>Tahun Ajaran &amp; Semester</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola periode semester akademik sekolah. Hanya satu periode yang aktif dalam satu waktu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            title="Muat Ulang"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              setFormError('');
              setModalTambah(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-800 text-white text-xs sm:text-sm font-bold hover:bg-navy-900 shadow-btn-admin transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Tambah Periode</span>
          </button>
        </div>
      </div>

      {/* Info Periode Aktif Saat Ini */}
      {activeItem && (
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-5 text-white shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber px-2 py-0.5 rounded-md bg-white/10 inline-block">
              Periode Aktif Sekarang
            </span>
            <div className="text-xl font-bold flex items-center gap-2">
              <span>Tahun Ajaran {activeItem.tahun}</span>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-400">Semester {activeItem.semester}</span>
            </div>
            <p className="text-xs text-blue-200/80">
              Semua guru saat login otomatis bekerja di periode ini.
              {activeItem.tanggal_rapor && ` Tanggal pembagian rapor: ${activeItem.tanggal_rapor}`}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <CheckCircle2 size={14} />
              <span>Aktif Berjalan</span>
            </span>
          </div>
        </div>
      )}

      {/* Banner Informasi Aturan */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-start gap-2.5 text-blue-900 text-xs">
        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Aturan Periode Akademik:</strong>
          <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-blue-800/90">
            <li>Hanya ada <strong>1 periode aktif</strong> pada sistem dalam satu waktu.</li>
            <li>Saat periode baru diaktifkan, periode sebelumnya otomatis menjadi arsip (mode lihat-saja bagi guru).</li>
            <li>Periode dengan status <strong>Ditutup</strong> dikunci secara permanen dan hanya dapat diakses melalui menu Arsip.</li>
          </ul>
        </div>
      </div>

      {/* Tabel Periode Tahun Ajaran */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Daftar Periode Akademik</h2>
          <span className="text-xs text-slate-500 font-medium">Total: {taList.length} Periode</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-navy-500" />
            <span className="text-xs">Memuat daftar tahun ajaran…</span>
          </div>
        ) : taList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada data tahun ajaran. Silakan tambahkan periode baru.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                  <th className="px-5 py-3">Tahun Ajaran</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Status Berjalan</th>
                  <th className="px-4 py-3">Status Aktif</th>
                  <th className="px-4 py-3">Tanggal Rapor</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taList.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.aktif
                        ? 'bg-blue-50/40 font-medium'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800">{item.tahun}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.id}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-700">
                        Semester {item.semester}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {item.status === 'ditutup' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <Lock size={11} />
                          <span>Ditutup</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Unlock size={11} />
                          <span>Berjalan</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {item.aktif ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-navy-50 text-navy-700 border border-navy-200">
                          <CheckCircle2 size={12} className="text-navy-500" />
                          <span>Aktif (Utama)</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          Non-aktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">
                      {item.tanggal_rapor || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!item.aktif && (
                          <button
                            onClick={() => handleSetAktif(item)}
                            className="px-3 py-1.5 rounded-lg bg-navy-50 text-navy-700 hover:bg-navy-100 font-bold text-xs transition cursor-pointer"
                          >
                            Jadikan Aktif
                          </button>
                        )}

                        <button
                          onClick={() => handleToggleStatus(item)}
                          title={item.status === 'ditutup' ? 'Buka Periode' : 'Tutup Periode'}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            item.status === 'ditutup'
                              ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {item.status === 'ditutup' ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Periode Baru */}
      {modalTambah && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-card-rise">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Calendar size={18} className="text-navy-500" />
              <span>Tambah Periode Akademik Baru</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Buat tahun ajaran baru atau tambahkan semester untuk tahun ajaran yang ada.
            </p>

            {formError && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleTambahSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tahun Ajaran *
                </label>
                <input
                  type="text"
                  value={formTahun}
                  onChange={(e) => setFormTahun(e.target.value)}
                  placeholder="Contoh: 2026/2027"
                  required
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Format: YYYY/YYYY</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Semester *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    onClick={() => setFormSemester('Ganjil')}
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                      formSemester === 'Ganjil'
                        ? 'border-navy-500 bg-navy-50/50 text-navy-900 font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="formSemester"
                      checked={formSemester === 'Ganjil'}
                      onChange={() => setFormSemester('Ganjil')}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        formSemester === 'Ganjil' ? 'border-navy-500' : 'border-slate-300'
                      }`}
                    >
                      {formSemester === 'Ganjil' && <div className="w-2 h-2 rounded-full bg-navy-500" />}
                    </div>
                    <span className="text-xs">Ganjil (1)</span>
                  </label>

                  <label
                    onClick={() => setFormSemester('Genap')}
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                      formSemester === 'Genap'
                        ? 'border-navy-500 bg-navy-50/50 text-navy-900 font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="formSemester"
                      checked={formSemester === 'Genap'}
                      onChange={() => setFormSemester('Genap')}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        formSemester === 'Genap' ? 'border-navy-500' : 'border-slate-300'
                      }`}
                    >
                      {formSemester === 'Genap' && <div className="w-2 h-2 rounded-full bg-navy-500" />}
                    </div>
                    <span className="text-xs">Genap (2)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tanggal Pembagian Rapor <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                <input
                  type="date"
                  value={formTanggalRapor}
                  onChange={(e) => setFormTanggalRapor(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formJadikanAktif}
                    onChange={(e) => setFormJadikanAktif(e.target.checked)}
                    className="w-4 h-4 rounded text-navy-500 focus:ring-navy-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Langsung jadikan sebagai periode aktif
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalTambah(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-navy-800 text-white text-xs font-bold hover:bg-navy-900 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Menyimpan…</span>
                    </>
                  ) : (
                    <span>Simpan Periode</span>
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
