import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { callApi } from '../lib/api';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { User, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';

export const ProfilSaya: React.FC = () => {
  const { session, setSession, notify } = useApp();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!oldPassword) {
      setErrorMsg('Masukkan kata sandi lama.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isFirebaseConfigured && auth.currentUser && auth.currentUser.email) {
        try {
          const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
          await reauthenticateWithCredential(auth.currentUser, credential);
          await updatePassword(auth.currentUser, newPassword);
        } catch (authErr: any) {
          if (authErr?.code === 'auth/wrong-password' || authErr?.code === 'auth/invalid-credential') {
            throw new Error('Kata sandi saat ini tidak cocok.');
          }
          if (authErr?.code === 'auth/too-many-requests') {
            throw new Error('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
          }
          throw authErr;
        }
      }

      await callApi('gantiSandi', { oldPassword, newPassword });
      setSuccessMsg('Kata sandi berhasil diperbarui!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (session) {
        setSession({
          ...session,
          wajib_ganti_sandi: false,
        });
      }

      notify('Kata sandi berhasil diubah.', 'success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah kata sandi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info Akun */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-navy-50 text-navy-500 flex items-center justify-center font-bold text-lg">
              {session?.peran === 'admin' ? <ShieldCheck size={26} /> : <User size={26} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Profil Saya</h2>
              <p className="text-xs text-slate-500">
                Informasi akun dan pengaturan kata sandi
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            session?.peran === 'admin'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            {session?.peran === 'admin' ? 'Operator / Administrator' : `Guru Wali Kelas ${session?.kelas}`}
          </span>
        </div>

        {/* Data Profil */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5 text-xs">
          {session?.peran === 'admin' ? (
            <>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">
                  Nama Pengguna (Username)
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {session.username || 'admin'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">
                  Nama Akun
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {session.namaWali || 'Administrator Sekolah'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">
                  Nama Wali Kelas
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {session?.namaWali}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">
                  Kelas & Fase
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  Kelas {session?.kelas} · Fase {session?.fase}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">
                  Tahun Ajaran & Semester Sesi
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {session?.tahunAjaran} · Semester {session?.semester === 1 ? 'Ganjil' : 'Genap'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">
                  Mode Akses
                </span>
                <span className={`font-bold text-sm ${session?.hanya_lihat ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {session?.hanya_lihat ? 'Lihat Saja (Arsip)' : 'Penuh (Tulis & Simpan)'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Form Ubah Kata Sandi */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs max-w-xl">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-navy-500" />
          <span>Ubah Kata Sandi</span>
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Gunakan minimal 8 karakter kombinasi huruf dan angka untuk keamanan akun Anda.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Kata Sandi Saat Ini
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan kata sandi lama"
                className="w-full pl-3 pr-10 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Kata Sandi Baru (minimal 8 karakter)
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full pl-3 pr-10 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Ulangi Kata Sandi Baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ketik ulang kata sandi baru"
              className="w-full px-3 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-navy-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-navy-800 text-white font-bold text-xs hover:bg-navy-900 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Lock size={14} />
            <span>{isSubmitting ? 'Menyimpan…' : 'Simpan Kata Sandi'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
