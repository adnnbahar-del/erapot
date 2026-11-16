import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { callApi } from '../lib/api';
import { Users, KeyRound, Check, Edit2, ShieldCheck, AlertCircle } from 'lucide-react';

export const DataUser: React.FC = () => {
  const { data, session, updateKelasWali, notify } = useApp();

  // Edit Wali Kelas state
  const [editingKelasId, setEditingKelasId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState<string>('');
  const [editNip, setEditNip] = useState<string>('');

  // Change Admin Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  if (!data || !session) return null;

  const handleStartEdit = (k: any) => {
    setEditingKelasId(k.id);
    setEditNama(k.nama_wali || '');
    setEditNip(k.nip_wali || '');
  };

  const handleSaveWali = async (kId: string) => {
    try {
      await updateKelasWali(kId, editNama, editNip);
      setEditingKelasId(null);
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan wali kelas', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!oldPassword) {
      setPassError('Masukkan kata sandi lama.');
      return;
    }
    if (newPassword.length < 6) {
      setPassError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsChangingPass(true);
    try {
      await callApi('changePassword', { oldPassword, newPassword });
      setPassSuccess('Kata sandi admin berhasil diperbarui!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      sessionStorage.removeItem('erapot_show_default_pass_warning');
      notify('Password admin berhasil diubah.', 'success');
    } catch (err: any) {
      setPassError(err.message || 'Gagal mengubah kata sandi.');
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Tabel Wali Kelas I–VI */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-kemdikbud-dark" />
              <span>Daftar Wali Kelas I – VI</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Data wali kelas dan status aktivitas login aplikasi
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50">
                <th className="py-3 px-3">Tingkat Kelas</th>
                <th className="py-3 px-3">Fase</th>
                <th className="py-3 px-3">Nama Wali Kelas</th>
                <th className="py-3 px-3">NIP</th>
                <th className="py-3 px-3 text-center">Status Akses</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.kelas.map((k) => {
                const isCurrentLoggedIn = session.kelasId === k.id;
                const hasEverLoggedIn = Boolean(k.terakhir_masuk);
                const isEditing = editingKelasId === k.id;

                let statusBadge = (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                    Belum Pernah Masuk
                  </span>
                );

                if (isCurrentLoggedIn) {
                  statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      Sedang Masuk
                    </span>
                  );
                } else if (hasEverLoggedIn) {
                  statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                      Pernah Masuk
                    </span>
                  );
                }

                return (
                  <tr key={k.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-bold text-slate-800">
                      Kelas {k.tingkat}
                    </td>
                    <td className="py-3 px-3 font-semibold text-blue-700">
                      Fase {k.fase}
                    </td>
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editNama}
                          onChange={(e) => setEditNama(e.target.value)}
                          className="px-2.5 py-1 text-xs border border-blue-400 rounded-lg w-full max-w-xs focus:outline-none"
                        />
                      ) : (
                        <span className="font-semibold text-slate-800">
                          {k.nama_wali || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 tabular-nums">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editNip}
                          onChange={(e) => setEditNip(e.target.value)}
                          placeholder="NIP Wali"
                          className="px-2.5 py-1 text-xs border border-blue-400 rounded-lg w-full max-w-xs focus:outline-none"
                        />
                      ) : (
                        <span className="text-slate-500">{k.nip_wali || '-'}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">{statusBadge}</td>
                    <td className="py-3 px-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSaveWali(k.id)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                            title="Simpan"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingKelasId(null)}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition text-[11px] font-bold px-2"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(k)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold"
                        >
                          <Edit2 size={13} />
                          <span>Ubah</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Form Ganti Password Admin */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs max-w-xl">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={20} className="text-kemdikbud-dark" />
          <h3 className="text-base font-bold text-slate-800">
            Ganti Kata Sandi Admin
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Kata sandi admin digunakan bersama oleh seluruh wali kelas untuk masuk ke aplikasi.
        </p>

        {passError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
            <AlertCircle size={16} />
            <span>{passError}</span>
          </div>
        )}

        {passSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-semibold">
            <ShieldCheck size={16} />
            <span>{passSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Kata Sandi Lama
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Masukkan password admin saat ini"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Kata Sandi Baru
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Ulangi Kata Sandi Baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ketik ulang password baru"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isChangingPass}
              className="px-5 py-2.5 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white font-bold shadow transition disabled:opacity-50"
            >
              {isChangingPass ? 'Menyimpan...' : 'Perbarui Kata Sandi Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
