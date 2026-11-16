// src/pages/admin/LogAktivitas.tsx
// Menu Admin: Log Aktivitas Sistem (Tahap 6)
// Koleksi Firestore `logAktivitas`:
//   { waktu, uid, nama, peran, aksi, target, nilaiLama, nilaiBaru }
// Dilengkapi filter tanggal, kelas, dan pengguna

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Clock,
  RefreshCw,
  Filter,
  User,
  Calendar,
  Layers,
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  KeyRound,
  FileText,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { getLogAktivitas, type LogAktivitasItem } from '../../lib/logAktivitasService';

export const LogAktivitas: React.FC = () => {
  const { data, notify } = useApp();
  const [logs, setLogs] = useState<LogAktivitasItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter State
  const [filterTanggal, setFilterTanggal] = useState('');
  const [filterKelas, setFilterKelas] = useState('all');
  const [filterPeran, setFilterPeran] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await getLogAktivitas();
      setLogs(res);
    } catch (err: any) {
      notify(err.message || 'Gagal memuat log aktivitas.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const kelasList = (data?.rombel && data.rombel.length > 0)
    ? data.rombel
    : (data?.kelas || []);

  const handleResetFilter = () => {
    setFilterTanggal('');
    setFilterKelas('all');
    setFilterPeran('all');
    setSearchTerm('');
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (filterTanggal && !item.waktu.startsWith(filterTanggal)) {
        return false;
      }
      if (filterKelas !== 'all') {
        const matchKelas = item.kelasId === filterKelas || item.target.toLowerCase().includes(filterKelas.toLowerCase());
        if (!matchKelas) return false;
      }
      if (filterPeran !== 'all') {
        if (item.peran !== filterPeran) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const inNama = item.nama.toLowerCase().includes(q);
        const inAksi = item.aksi.toLowerCase().includes(q);
        const inTarget = item.target.toLowerCase().includes(q);
        const inDetail = (item.nilaiBaru || '').toLowerCase().includes(q);
        if (!inNama && !inAksi && !inTarget && !inDetail) return false;
      }
      return true;
    });
  }, [logs, filterTanggal, filterKelas, filterPeran, searchTerm]);

  const getAksiBadge = (aksi: string) => {
    if (aksi.includes('Final')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          <Lock size={10} />
          <span>{aksi}</span>
        </span>
      );
    }
    if (aksi.includes('Buka Kunci')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <Unlock size={10} />
          <span>{aksi}</span>
        </span>
      );
    }
    if (aksi.includes('Tutup Tahun')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <Calendar size={10} />
          <span>{aksi}</span>
        </span>
      );
    }
    if (aksi.includes('Password') || aksi.includes('Sandi')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <KeyRound size={10} />
          <span>{aksi}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <FileText size={10} />
        <span>{aksi}</span>
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Clock size={22} className="text-navy-500" />
            <span>Log Aktivitas Sistem</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Audit riwayat aktivitas: perubahan nilai, finalisasi rapor, buka kunci, reset password, dan tutup tahun ajaran.
          </p>
        </div>

        <button
          onClick={loadLogs}
          title="Segarkan Log"
          className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter Box */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter size={14} className="text-navy-500" />
            <span>Filter Aktivitas</span>
          </span>
          {(filterTanggal || filterKelas !== 'all' || filterPeran !== 'all' || searchTerm) && (
            <button
              onClick={handleResetFilter}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Filter Tanggal */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">TANGGAL</label>
            <input
              type="date"
              value={filterTanggal}
              onChange={(e) => setFilterTanggal(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:outline-none"
            />
          </div>

          {/* Filter Kelas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">KELAS</label>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:outline-none"
            >
              <option value="all">Semua Kelas</option>
              {kelasList.map((k: any) => (
                <option key={k.id} value={k.id}>
                  Kelas {k.nama || k.tingkat}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Peran */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">PERAN PENGGUNA</label>
            <select
              value={filterPeran}
              onChange={(e) => setFilterPeran(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:outline-none"
            >
              <option value="all">Semua Peran</option>
              <option value="admin">Admin</option>
              <option value="wali_kelas">Wali Kelas</option>
              <option value="guru_mapel">Guru Mapel</option>
              <option value="guru">Guru</option>
            </select>
          </div>

          {/* Search Term */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">CARI KATA KUNCI</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nama, aksi, target…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:outline-none"
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Log Aktivitas */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Riwayat Kejadian</h2>
          <span className="text-xs text-slate-500 font-medium">
            Menampilkan {filteredLogs.length} dari {logs.length} entri
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-navy-500" />
            <span className="text-xs">Memuat catatan log…</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Tidak ada riwayat aktivitas yang sesuai dengan filter pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Pengguna</th>
                  <th className="px-3 py-3">Peran</th>
                  <th className="px-4 py-3">Aksi</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Rincian Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(item.waktu).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{item.nama}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.uid.slice(0, 10)}…</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                        {item.peran}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getAksiBadge(item.aksi)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {item.target}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs break-words">
                      {item.nilaiBaru ? (
                        <span className="font-medium text-slate-700">{item.nilaiBaru}</span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

