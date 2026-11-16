// src/pages/admin/AkunLama.tsx
// Halaman Admin: Daftar Akun Lama (Nonaktif)
// Pada Firebase Spark Plan, akun dinonaktifkan (aktif = false).
// Admin dapat melihat daftar ini dan menghapus user secara manual di Firebase Console jika diperlukan.

import React, { useState, useEffect } from 'react';
import {
  UserX,
  ExternalLink,
  RefreshCw,
  Search,
  AlertCircle,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { getAkunLama, type AkunLamaItem } from '../../lib/kelasService';

export const AkunLama: React.FC = () => {
  const [list, setList] = useState<AkunLamaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getAkunLama();
      setList(data);
    } catch (e) {
      console.warn('Gagal memuat akun lama:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = list.filter((item) => {
    const q = search.toLowerCase();
    const nama = (item.nama || '').toLowerCase();
    const email = (item.loginEmail || item.email || '').toLowerCase();
    const nip = (item.nip || '').toLowerCase();
    return nama.includes(q) || email.includes(q) || nip.includes(q);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <UserX size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Daftar Akun Lama (Nonaktif)</h2>
              <p className="text-xs text-slate-500">
                Riwayat akun guru dan wali kelas yang telah dinonaktifkan atau diganti versinya
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
          <a
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-800 text-white text-xs font-bold hover:bg-navy-900 transition shadow-sm"
          >
            <ExternalLink size={14} />
            <span>Firebase Console</span>
          </a>
        </div>
      </div>

      {/* Info Card Spark Plan */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
        <Info size={18} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-bold text-amber-950">Mekanisme Akun Firebase Paket Spark (Gratis)</p>
          <p className="text-amber-800 leading-relaxed">
            Karena aplikasi berjalan pada paket gratis tanpa Cloud Functions, setiap pergantian wali kelas atau reset kata sandi otomatis menonaktifkan akun lama (<code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">aktif = false</code>) dan menerbitkan akun baru dengan nomor versi lebih tinggi (contoh: <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">-v2</code>). Akun nonaktif tidak dapat digunakan untuk login. Jika ingin membersihkan daftar akun lama secara permanen dari Firebase Authentication, Anda dapat menghapusnya di Firebase Console.
          </p>
        </div>
      </div>

      {/* Tabel Akun Lama */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Toolbar Pencarian */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari berdasarkan nama, email, atau NIP..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Total: <strong>{filtered.length}</strong> akun nonaktif
          </span>
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Nama & Gelar</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Peran</th>
                <th className="py-3 px-4">Kelas / Mapel</th>
                <th className="py-3 px-4">Email Login</th>
                <th className="py-3 px-4">Versi</th>
                <th className="py-3 px-4">Tanggal Dinonaktifkan</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-navy-500" />
                    <span>Memuat daftar akun nonaktif...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <UserX size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">Tidak ada akun lama nonaktif</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {search ? 'Tidak ada akun yang cocok dengan kata kunci.' : 'Semua akun saat ini berstatus aktif.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const roleLabel =
                    item.peran === 'wali_kelas'
                      ? 'Wali Kelas'
                      : item.peran === 'guru_mapel'
                      ? 'Guru Mapel'
                      : 'Admin';
                  const dateStr = item.updatedAt
                    ? new Date(item.updatedAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-';

                  return (
                    <tr key={item.uid || idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-medium text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {item.nama}
                        {item.gelar ? `, ${item.gelar}` : ''}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-slate-500">{item.nip || '-'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.peran === 'wali_kelas'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {roleLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.kelasId
                          ? item.kelasId.replace('kelas_', 'Kelas ').toUpperCase()
                          : item.mapelIds?.length
                          ? `${item.mapelIds.length} Mapel`
                          : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                        {item.loginEmail || item.email || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        v{item.loginVersi || 1}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] tabular-nums">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          Nonaktif
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

