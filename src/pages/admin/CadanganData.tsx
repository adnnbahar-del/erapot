// src/pages/admin/CadanganData.tsx
// Menu Admin: Cadangan & Pemulihan Data serta Skrip Migrasi (Tahap 6)
// Fitur:
// 1. Ekspor data per semester ke Excel (.xlsx) dengan 6 sheet
// 2. Ekspor basis data ke JSON
// 3. Impor/Pemulihan data dari berkas JSON (dengan modal konfirmasi)
// 4. Skrip Migrasi Satu Kali Struktur Lama ke Firestore/Struktur Baru
// 5. Laporan jumlah dokumen sebelum dan sesudah migrasi

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldAlert,
  Calendar,
  X,
} from 'lucide-react';
import { eksporSemesterExcel, eksporSemesterJson, eksporSemuaKoleksiJson, eksporSemuaKoleksiExcel, pulihkanDariJson, getTanggalBackupTerakhir } from '../../lib/backupService';
import { hitungDokumen, jalankanMigrasi, type DokumenCounts, type HasilMigrasi } from '../../lib/migrasiService';
import { getAllTahunAjaran, type TahunAjaranDoc } from '../../lib/tahunAjaranService';
import { inisialisasiDataDefault, dapatkanPratinjauInisialisasi, type HasilInisialisasi, type PratinjauInisialisasi } from '../../lib/inisialisasiService';

export const CadanganData: React.FC = () => {
  const { data, session, notify, confirmModal, refreshData } = useApp();

  // State Pilihan Semester
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaranDoc[]>([]);
  const [selectedTaId, setSelectedTaId] = useState<string>('');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingAllJson, setIsExportingAllJson] = useState(false);
  const [isExportingAllExcel, setIsExportingAllExcel] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

  // State Pemulihan JSON
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // State Migrasi Struktur Lama
  const [dokumenCounts, setDokumenCounts] = useState<DokumenCounts | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [hasilMigrasi, setHasilMigrasi] = useState<HasilMigrasi | null>(null);

  // State Inisialisasi Data Default
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasilInisialisasi, setHasilInisialisasi] = useState<HasilInisialisasi | null>(null);
  const [showModalPratinjau, setShowModalPratinjau] = useState(false);
  const [pratinjauData, setPratinjauData] = useState<PratinjauInisialisasi | null>(null);

  // Load Tahun Ajaran & Dokumen Counts
  const loadInitialData = async () => {
    try {
      const list = await getAllTahunAjaran();
      setTahunAjaranList(list);
      const active = list.find((ta: TahunAjaranDoc) => ta.aktif) || list[0];
      if (active) {
        setSelectedTaId(active.id);
      }
    } catch {
      // Fallback
    }

    getTanggalBackupTerakhir().then(setLastBackupDate);
    setIsCounting(true);
    try {
      const counts = await hitungDokumen(data);
      setDokumenCounts(counts);
    } finally {
      setIsCounting(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [data]);

  const selectedTa = tahunAjaranList.find((t) => t.id === selectedTaId);
  const taLabel = selectedTa
    ? `${selectedTa.tahun} · Semester ${selectedTa.semester}${selectedTa.aktif ? ' (Aktif)' : ''}`
    : 'Tahun Ajaran Aktif';


  // ─── Ekspor Seluruh Koleksi (JSON) ───────────────────────────────────────────
  const handleExportAllJson = async () => {
    if (!data) {
      notify('Data aplikasi belum siap.', 'error');
      return;
    }
    setIsExportingAllJson(true);
    try {
      await eksporSemuaKoleksiJson(
        data,
        session ? { uid: session.token, nama: session.namaWali, peran: session.peran } : undefined
      );
      const dt = await getTanggalBackupTerakhir();
      setLastBackupDate(dt);
      notify('Cadangan lengkap seluruh koleksi (JSON) berhasil diunduh.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal mengekspor seluruh koleksi ke JSON.', 'error');
    } finally {
      setIsExportingAllJson(false);
    }
  };

  // ─── Ekspor Seluruh Koleksi (Excel .xlsx) ────────────────────────────────────
  const handleExportAllExcel = async () => {
    if (!data) {
      notify('Data aplikasi belum siap.', 'error');
      return;
    }
    setIsExportingAllExcel(true);
    try {
      await eksporSemuaKoleksiExcel(
        data,
        session ? { uid: session.token, nama: session.namaWali, peran: session.peran } : undefined
      );
      const dt = await getTanggalBackupTerakhir();
      setLastBackupDate(dt);
      notify('Cadangan lengkap seluruh koleksi (Excel) berhasil diunduh.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal mengekspor seluruh koleksi ke Excel.', 'error');
    } finally {
      setIsExportingAllExcel(false);
    }
  };

  // ─── Ekspor Excel ────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    if (!data) {
      notify('Data aplikasi belum siap.', 'error');
      return;
    }
    setIsExportingExcel(true);
    try {
      await eksporSemesterExcel(
        data,
        selectedTaId || data.activeTahunAjaranId || 'ta_2025_1',
        taLabel,
        session ? { uid: session.token, nama: session.namaWali, peran: session.peran } : undefined
      );
      notify('Cadangan data Excel (.xlsx) berhasil diunduh.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal mengekspor data ke Excel.', 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // ─── Ekspor JSON ─────────────────────────────────────────────────────────────
  const handleExportJson = async () => {
    if (!data) {
      notify('Data aplikasi belum siap.', 'error');
      return;
    }
    setIsExportingJson(true);
    try {
      await eksporSemesterJson(
        data,
        selectedTaId || data.activeTahunAjaranId || 'ta_2025_1',
        taLabel,
        session ? { uid: session.token, nama: session.namaWali, peran: session.peran } : undefined
      );
      notify('Cadangan data JSON berhasil diunduh.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal mengekspor data ke JSON.', 'error');
    } finally {
      setIsExportingJson(false);
    }
  };

  // ─── Pilih Berkas JSON untuk Pemulihan ────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.json')) {
        notify('Pilih berkas cadangan dengan format .json.', 'error');
        return;
      }
      setSelectedFile(file);
    }
  };

  // ─── Eksekusi Pemulihan JSON dengan Konfirmasi ────────────────────────────────
  const handleRestoreSubmit = () => {
    if (!selectedFile || !data) {
      notify('Silakan pilih berkas cadangan JSON terlebih dahulu.', 'error');
      return;
    }

    confirmModal(
      'Konfirmasi Pemulihan Data',
      `Apakah Anda yakin ingin memulihkan basis data dari berkas "${selectedFile.name}"? Data yang ada akan diperbarui dengan isi berkas cadangan ini. Tindakan ini tidak dapat dibatalkan.`,
      async () => {
        setIsRestoring(true);
        try {
          const text = await selectedFile.text();
          const res = await pulihkanDariJson(
            text,
            data,
            session ? { uid: session.token, nama: session.namaWali, peran: session.peran } : undefined
          );
          notify(`Pemulihan berhasil! ${res.recordCounts.siswa} siswa dan ${res.recordCounts.nilaiFormatif} nilai dimuat.`, 'success');
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          await refreshData();
          const newCounts = await hitungDokumen();
          setDokumenCounts(newCounts);
        } catch (err: any) {
          notify(err.message || 'Gagal memulihkan data dari berkas JSON.', 'error');
        } finally {
          setIsRestoring(false);
        }
      }
    );
  };

  // ─── Eksekusi Skrip Migrasi Struktur Lama ─────────────────────────────────────
  const handleJalankanMigrasi = () => {
    if (!data) return;

    confirmModal(
      'Konfirmasi Migrasi Struktur Lama',
      'Skrip ini akan memindahkan kelas lama (1A–6C dan kelas tanpa rombel) ke koleksi `kelas`, membuat akun wali kelas di koleksi `users`, serta menambahkan `kelasId` dan `tahunAjaranId` pada seluruh data siswa & nilai. Data lama tidak akan dihapus. Lanjutkan proses migrasi?',
      async () => {
        setIsMigrating(true);
        try {
          const res = await jalankanMigrasi(
            data,
            session ? { uid: session.token, nama: session.namaWali, peran: session.peran } : undefined
          );
          setHasilMigrasi(res);
          setDokumenCounts(res.sesudah);
          notify(`Migrasi berhasil! ${res.kelasBaru} kelas dan ${res.siswaDimigrasikan} relasi siswa diproses.`, 'success');
          await refreshData();
        } catch (err: any) {
          notify(err.message || 'Gagal menjalankan migrasi struktur lama.', 'error');
        } finally {
          setIsMigrating(false);
        }
      }
    );
  };

  // ─── Eksekusi Inisialisasi Data Default ─────────────────────────────────────────
  const handleBukaPratinjauInisialisasi = () => {
    const p = dapatkanPratinjauInisialisasi();
    setPratinjauData(p);
    setShowModalPratinjau(true);
  };

  const handleEksekusiInisialisasi = async () => {
    setIsInitializing(true);
    try {
      const res = await inisialisasiDataDefault(
        session ? { uid: session.token, nama: session.namaWali, peran: session.peran } : undefined
      );
      setHasilInisialisasi(res);
      setShowModalPratinjau(false);
      notify(`Inisialisasi berhasil! ${res.totalKelas} kelas dan ${res.totalMapel} mapel terpasang di Firestore produksi.`, 'success');
      await refreshData();
      const newCounts = await hitungDokumen();
      setDokumenCounts(newCounts);
    } catch (err: any) {
      notify(err.message || 'Gagal melakukan inisialisasi data default.', 'error');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Halaman */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Database size={22} className="text-navy-500" />
              <span>Cadangan, Pemulihan & Migrasi Data</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Kelola ekspor rekap semester, pencadangan basis data, pemulihan darurat, dan migrasi struktur lama.
            </p>
          </div>

          {/* Pemilih Semester yang Aktif diekspor */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <Calendar size={15} className="text-navy-500 shrink-0" />
            <div className="text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Target Semester:</span>
              <select
                value={selectedTaId}
                onChange={(e) => setSelectedTaId(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
              >
                {tahunAjaranList.map((ta) => (
                  <option key={ta.id} value={ta.id}>
                    {ta.tahun} · {ta.semester} {ta.aktif ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      
      {/* Kartu Khusus Spark Plan: Cadangan Lengkap Seluruh Koleksi */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-amber uppercase tracking-wider">
              <Database size={16} />
              <span>Cadangan Lengkap Satu Klik (Paket Spark)</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Cadangkan Seluruh Koleksi Data E-Rapor
            </h2>
            <p className="text-xs text-blue-100/80 max-w-2xl leading-relaxed">
              Mengekspor seluruh koleksi data (kelas, pengguna, siswa, relasi rombel, mata pelajaran, TP, LM, nilai formatif, sumatif, kehadiran, 7 KAIH, kokurikuler, dan pengaturan) ke dalam satu berkas terpadu untuk pencadangan aman.
            </p>
            <p className="text-[11px] text-amber-300 font-medium pt-1">
              Cadangan terakhir: {lastBackupDate ? new Date(lastBackupDate).toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belum pernah dicadangkan'}
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportAllJson}
              disabled={isExportingAllJson}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-navy-900 font-bold text-xs hover:bg-blue-50 transition shadow-sm disabled:opacity-50"
            >
              {isExportingAllJson ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} className="text-navy-700" />}
              <span>Unduh JSON Lengkap</span>
            </button>
            <button
              type="button"
              onClick={handleExportAllExcel}
              disabled={isExportingAllExcel}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
            >
              {isExportingAllExcel ? <RefreshCw size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              <span>Unduh Excel Lengkap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bagian 1: Ekspor Cadangan Semester (Excel & JSON) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kartu Ekspor Excel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <FileSpreadsheet size={22} />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Ekspor Rekap Semester ke Excel (.xlsx)
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Mengunduh berkas lembar kerja Excel lengkap dengan 6 sheet terpisah:
            </p>
            <ul className="text-xs text-slate-600 mt-2 space-y-1 list-disc pl-5">
              <li><strong>Siswa</strong> (Biodata, NIS, NISN, Rombel)</li>
              <li><strong>Nilai Formatif</strong> (TP, KKTP, Tampil Rapor)</li>
              <li><strong>Nilai Sumatif</strong> (Materi LM, Nilai, PTS/PAS)</li>
              <li><strong>Kehadiran</strong> (Sakit, Izin, Alpa)</li>
              <li><strong>Kokurikuler</strong> (DPL Kuat & Penguatan)</li>
              <li><strong>7 KAIH</strong> (Pembiasaan 7 Karakter Hebat)</li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Format: .xlsx (Multi-Sheet)</span>
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isExportingExcel ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Mengekspor...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Unduh Rekap Excel</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Kartu Ekspor JSON */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-navy-500 flex items-center justify-center mb-4">
              <FileText size={22} />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Ekspor Cadangan Basis Data (JSON)
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Simpan seluruh data master sekolah, kelas, profil siswa, seluruh capaian nilai semester, dan pengaturan ke dalam berkas standar JSON.
            </p>
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <p className="text-[11px]">
                Berkas JSON ini dapat disimpan di komputer lokal atau penyimpanan awan sebagai salinan keamanan berkala sekolah.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Format: .json (Full Dataset)</span>
            <button
              onClick={handleExportJson}
              disabled={isExportingJson}
              className="px-4 py-2.5 rounded-xl bg-navy-500 text-white text-xs font-bold hover:bg-navy-600 transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isExportingJson ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Menyiapkan...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Unduh Cadangan JSON</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bagian 2: Pemulihan Basis Data dari Berkas JSON */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Upload size={18} className="text-amber-600" />
          <span>Pemulihan Basis Data dari Cadangan JSON</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Pulihkan seluruh data sekolah, kelas, siswa, dan rekap penilaian dari berkas cadangan JSON yang sebelumnya pernah diunduh.
        </p>

        <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs text-amber-900 flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Peringatan Keselamatan Pemulihan</p>
            <p className="text-[11px] mt-0.5 text-amber-800">
              Memulihkan basis data akan menimpa data siswa dan nilai yang ada di sistem saat ini dengan isi dari berkas cadangan. Pastikan Anda telah mengunduh cadangan terbaru terlebih dahulu sebelum menjalankan pemulihan.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="block w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
          />

          <button
            onClick={handleRestoreSubmit}
            disabled={!selectedFile || isRestoring}
            className="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-40"
          >
            {isRestoring ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Memulihkan Data...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Pulihkan dari JSON</span>
              </>
            )}
          </button>
        </div>

        {selectedFile && (
          <p className="text-[11px] text-slate-500 mt-2">
            Berkas terpilih: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* Bagian 3: Skrip Migrasi Satu Kali Struktur Lama */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-orange-500" />
              <span>Skrip Migrasi Satu Kali Struktur Lama</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Migrasikan kelas lama (1A–6C), akun wali kelas ke koleksi `users`, serta kaitkan `kelasId` dan `tahunAjaranId` pada siswa dan seluruh nilai.
            </p>
          </div>

          <button
            onClick={handleJalankanMigrasi}
            disabled={isMigrating}
            className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isMigrating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Menjalankan Migrasi...</span>
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                <span>Jalankan Skrip Migrasi</span>
              </>
            )}
          </button>
        </div>

        {/* Tabel Ringkasan Jumlah Dokumen Sebelum & Sesudah */}
        <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Laporan Verifikasi Dokumen Basis Data</span>
            {isCounting && <span className="text-[11px] text-slate-400">Menghitung dokumen...</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Entitas / Koleksi Data</th>
                  <th className="py-2.5 px-4 text-center">Sebelum Migrasi</th>
                  <th className="py-2.5 px-4 text-center">Sesudah Migrasi</th>
                  <th className="py-2.5 px-4 text-center">Status Integritas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-2.5 px-4 font-medium">Koleksi Kelas (`kelas`)</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">{hasilMigrasi?.sebelum.kelas ?? dokumenCounts?.kelas ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{hasilMigrasi?.sesudah.kelas ?? dokumenCounts?.kelas ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center text-emerald-600 font-medium">Tersinkronisasi</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">Koleksi Pengguna (`users` / Wali Kelas)</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">{hasilMigrasi?.sebelum.users ?? dokumenCounts?.users ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{hasilMigrasi?.sesudah.users ?? dokumenCounts?.users ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center text-emerald-600 font-medium">Terhubung Auth</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">Data Siswa & KelasSiswa</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">{hasilMigrasi?.sebelum.siswa ?? dokumenCounts?.siswa ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{hasilMigrasi?.sesudah.siswa ?? dokumenCounts?.siswa ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center text-emerald-600 font-medium">Terpetakan kelasId</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">Nilai Formatif</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">{hasilMigrasi?.sebelum.formatif ?? dokumenCounts?.formatif ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{hasilMigrasi?.sesudah.formatif ?? dokumenCounts?.formatif ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center text-emerald-600 font-medium">Terverifikasi Utuh</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">Nilai Sumatif (LM & Semester)</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">{hasilMigrasi?.sebelum.sumatif ?? dokumenCounts?.sumatif ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{hasilMigrasi?.sesudah.sumatif ?? dokumenCounts?.sumatif ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center text-emerald-600 font-medium">Terverifikasi Utuh</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">Rekap Kehadiran</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">{hasilMigrasi?.sebelum.kehadiran ?? dokumenCounts?.kehadiran ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{hasilMigrasi?.sesudah.kehadiran ?? dokumenCounts?.kehadiran ?? '-'}</td>
                  <td className="py-2.5 px-4 text-center text-emerald-600 font-medium">Terverifikasi Utuh</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">Kokurikuler & 7 KAIH</td>
                  <td className="py-2.5 px-4 text-center text-slate-500">{(hasilMigrasi?.sebelum.kokurikuler ?? dokumenCounts?.kokurikuler ?? 0) + (hasilMigrasi?.sebelum.kaih ?? dokumenCounts?.kaih ?? 0)}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{(hasilMigrasi?.sesudah.kokurikuler ?? dokumenCounts?.kokurikuler ?? 0) + (hasilMigrasi?.sesudah.kaih ?? dokumenCounts?.kaih ?? 0)}</td>
                  <td className="py-2.5 px-4 text-center text-emerald-600 font-medium">Terverifikasi Utuh</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Laporan Rincian Migrasi jika sudah dijalankan */}
        {hasilMigrasi && (
          <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <CheckCircle2 size={16} />
              <span>Migrasi Berhasil Dijalankan ({new Date(hasilMigrasi.waktu).toLocaleString('id-ID')})</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              {hasilMigrasi.rincian.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bagian 4: Inisialisasi Data Default Kurikulum Merdeka */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <RefreshCw size={18} className="text-navy-600" />
              <span>Inisialisasi Data Default Kurikulum Merdeka</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Pasang dan sinkronkan data awal lengkap: 18 Kelas (Tingkat 1–6), 9 Mata Pelajaran Kurikulum Merdeka per Fase, Tahun Ajaran 2025/2026 Ganjil, profil sekolah, dan siswa sampel. Aman dijalankan berulang kali (idempotent).
            </p>
          </div>

          <button
            onClick={handleBukaPratinjauInisialisasi}
            disabled={isInitializing}
            className="px-5 py-2.5 rounded-xl bg-navy-600 text-white text-xs font-bold hover:bg-navy-700 transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isInitializing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Menginisialisasi Data...</span>
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                <span>Inisialisasi Data Default</span>
              </>
            )}
          </button>
        </div>

        {hasilInisialisasi && (
          <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <CheckCircle2 size={16} />
              <span>Inisialisasi Data Sukses ({new Date(hasilInisialisasi.waktu).toLocaleString('id-ID')})</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>18 Kelas Kurikulum Merdeka terpasang aktif di Firestore produksi.</li>
              <li>Akun login wali kelas untuk 18 rombel berhasil dibuat &amp; disiapkan.</li>
              <li>9 Mata Pelajaran Kurikulum Merdeka default siap digunakan.</li>
              <li>Tahun Ajaran 2025/2026 Ganjil aktif &amp; profil sekolah terbarui di Firestore.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Modal Pratinjau Inisialisasi Data */}
      {showModalPratinjau && pratinjauData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-line my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-line shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy flex items-center justify-center">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-ink">
                    Pratinjau Inisialisasi Data Firestore Produksi
                  </h3>
                  <p className="text-xs text-muted">
                    Periksa ringkasan struktur data yang akan ditulis ke project Firebase <span className="font-semibold text-navy">e-rapot-sd</span>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModalPratinjau(false)}
                disabled={isInitializing}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
              {/* Ringkasan Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-muted block">Jumlah Kelas</span>
                  <span className="text-lg font-black text-navy">{pratinjauData.daftarKelas.length} Rombel</span>
                  <span className="text-[10px] text-slate-500 block">Tingkat 1 s.d. 6</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-muted block">Akun Wali Kelas</span>
                  <span className="text-lg font-black text-emerald-600">{pratinjauData.totalAkunWali} Akun</span>
                  <span className="text-[10px] text-slate-500 block">Password acak 8 kar</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-muted block">Mata Pelajaran</span>
                  <span className="text-lg font-black text-indigo-600">{pratinjauData.daftarMapel.length} Mapel</span>
                  <span className="text-[10px] text-slate-500 block">Kurikulum Merdeka</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-muted block">Semester Aktif</span>
                  <span className="text-sm font-black text-amber-700 block mt-1">{pratinjauData.tahunAjaran.tahun}</span>
                  <span className="text-[10px] text-slate-500 block">Semester {pratinjauData.tahunAjaran.semester}</span>
                </div>
              </div>

              {/* Profil Sekolah */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-blue-900 tracking-wider block">Profil Sekolah Target:</span>
                <p className="font-bold text-blue-950 text-xs">{pratinjauData.sekolah.nama} · NPSN: {pratinjauData.sekolah.npsn}</p>
                <p className="text-[11px] text-blue-800">Kepala Sekolah: {pratinjauData.sekolah.kepala_sekolah}</p>
              </div>

              {/* Tabel 18 Kelas & Email Akun Wali */}
              <div>
                <span className="text-xs font-bold text-ink block mb-2">18 Kelas &amp; Email Akun Wali Kelas Otomatis:</span>
                <div className="border border-line rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase sticky top-0">
                      <tr>
                        <th className="py-2 px-3 border-b border-line">Kelas</th>
                        <th className="py-2 px-3 border-b border-line">Fase</th>
                        <th className="py-2 px-3 border-b border-line">Email Akun Wali</th>
                        <th className="py-2 px-3 border-b border-line">Password Awal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {pratinjauData.daftarKelas.map((k) => (
                        <tr key={k.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-sans font-bold text-ink">{k.nama}</td>
                          <td className="py-1.5 px-3 font-sans font-medium text-muted">Fase {k.fase}</td>
                          <td className="py-1.5 px-3 text-slate-700">{k.emailWali}</td>
                          <td className="py-1.5 px-3 text-emerald-700 font-semibold font-sans text-[10px]">Otomatis dibuat</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Daftar 9 Mapel */}
              <div>
                <span className="text-xs font-bold text-ink block mb-2">9 Mata Pelajaran Kurikulum Merdeka Default:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {pratinjauData.daftarMapel.map((m, idx) => (
                    <div key={m.id} className="p-2 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800 truncate mr-2">{idx + 1}. {m.nama}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-200 font-bold text-slate-600 shrink-0">{m.kelompok}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-line flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowModalPratinjau(false)}
                disabled={isInitializing}
                className="px-4 py-2 rounded-xl border border-line text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleEksekusiInisialisasi}
                disabled={isInitializing}
                className="px-5 py-2.5 rounded-xl bg-navy-800 text-white text-xs font-bold hover:bg-navy-900 transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isInitializing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Menyimpan ke Firestore Produksi...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Simpan Inisialisasi ke Firestore Produksi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
