// src/pages/admin/KelasWaliKelas.tsx
// Halaman Admin: Pengelolaan Kelas & Wali Kelas
// - Model: Akun sudah otomatis tersedia, admin tinggal edit.
// - Real-time sync via onSnapshot.
// - Modal Edit Wali: identitas (Nama huruf kapital, Gelar, NIP 18 digit) + Password baru/acak.
// - Modal kartu password & Cetak kartu login semua kelas berstatus 'Password awal'.

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, UserCheck, UserX, ChevronDown, ChevronUp,
  RefreshCw, Users, Eye, EyeOff, AlertCircle, Check, X, KeyRound,
  BookOpen, Shield, Printer, Copy, CheckCheck, Sparkles, HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isFirebaseConfigured } from '../../lib/firebase';
import {
  getAllKelas, tambahKelas, tambahRombelBerikutnya,
  toggleAktifKelas, hapusKelas, editWaliKelas,
  siapkanAkunWaliUntukKelas, siapkanSemuaAkunWali,
  ambilSemuaPasswordAwal, cekPratinjauMigrasiWali, eksekusiMigrasiWali,
  periksaSemuaKelas, terapkanPerbaikanSemuaKelas,
  generatePasswordAcak8, subscribeKelasRealtime, subscribeUsersRealtime,
  formatNamaKelas, hitungUrutanKelas,
  type KelasDoc, type PratinjauMigrasi, type PasswordAwalDoc,
  type HasilPemeriksaanKelas, type HasilEksekusiPerbaikan,
} from '../../lib/kelasService';
import { faseDariTingkat } from '../../lib/rombel';

// ─── Tipe Data Internal ───────────────────────────────────────────────────────

interface KelasRow {
  id: string;
  tingkat: number;
  rombel: string;
  nama: string;
  fase: 'A' | 'B' | 'C';
  aktif: boolean;
  namaWali?: string;
  gelarWali?: string;
  nipWali?: string;
  emailWali?: string;
  loginEmail?: string;
  waliKelasUid?: string;
  jumlahSiswa: number;
  harusGantiPassword?: boolean;
}

// ─── Helper Badge Status Akun ────────────────────────────────────────────────

function renderBadgeStatusAkun(k: KelasRow) {
  const namaAda = Boolean((k.namaWali || '').trim());
  if (!namaAda) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        Belum lengkap
      </span>
    );
  }
  if (k.harusGantiPassword) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
        Password awal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
      Siap
    </span>
  );
}

// ─── Modal: Tambah Kelas ─────────────────────────────────────────────────────

interface ModalTambahKelasProps {
  existingKelas: KelasRow[];
  onConfirm: (tingkat: number, rombel: string) => Promise<void>;
  onClose: () => void;
}

const ModalTambahKelas: React.FC<ModalTambahKelasProps> = ({
  existingKelas, onConfirm, onClose,
}) => {
  const [tingkat, setTingkat] = useState(1);
  const [rombel, setRombel]   = useState('');
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const nama = formatNamaKelas(tingkat, rombel);
    if (existingKelas.some((k) => k.nama.toUpperCase() === nama.toUpperCase() || (k.tingkat === tingkat && (k.rombel || '').trim().toUpperCase() === (rombel || '').trim().toUpperCase()))) {
      setErr(`Kelas ${nama} sudah ada.`);
      return;
    }
    setLoading(true);
    try {
      await onConfirm(tingkat, rombel.toUpperCase());
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Gagal menambah kelas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <BookOpen size={18} className="text-navy-500" /> Tambah Kelas
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">TINGKAT</label>
            <select
              value={tingkat}
              onChange={(e) => setTingkat(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-navy-500"
            >
              {[1,2,3,4,5,6].map((t) => (
                <option key={t} value={t}>Tingkat {t} — Fase {faseDariTingkat(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              ROMBEL <span className="font-normal text-slate-400">(kosongkan jika kelas tunggal)</span>
            </label>
            <input
              type="text"
              maxLength={2}
              value={rombel}
              onChange={(e) => setRombel(e.target.value.toUpperCase())}
              placeholder="A, B, C ... (opsional)"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-navy-500 uppercase"
            />
            <p className="text-xs text-slate-400 mt-1">
              Nama kelas: <strong>{formatNamaKelas(tingkat, rombel)}</strong>
            </p>
          </div>
          {err && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={14} /> {err}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-navy-800 text-white text-sm font-bold disabled:opacity-60 hover:bg-navy-900 flex items-center justify-center gap-2">
              {loading && <RefreshCw size={14} className="animate-spin" />}
              Tambah
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Edit Wali Kelas ───────────────────────────────────────────────────

interface ModalEditWaliProps {
  kelas: KelasRow;
  onSave: (input: { nama: string; gelar?: string; nip?: string; passwordBaru?: string }) => Promise<void>;
  onClose: () => void;
}

const ModalEditWaliKelas: React.FC<ModalEditWaliProps> = ({ kelas, onSave, onClose }) => {
  const [nama, setNama] = useState(kelas.namaWali ?? '');
  const [gelar, setGelar] = useState(kelas.gelarWali ?? '');
  const [nip, setNip] = useState(kelas.nipWali ?? '');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBuatAcak = () => {
    const rnd = generatePasswordAcak8();
    setPasswordBaru(rnd);
    setKonfirmasiPassword(rnd);
    setShowPass(true);
    setShowConfirm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');

    const cleanNama = nama.trim().toUpperCase();
    if (!cleanNama) {
      setErr('Nama lengkap wali kelas wajib diisi.');
      return;
    }

    const cleanNip = nip.trim();
    if (cleanNip && !/^\d{18}$/.test(cleanNip)) {
      setErr('NIP harus terdiri dari 18 digit angka.');
      return;
    }

    if (passwordBaru) {
      if (passwordBaru.length < 6) {
        setErr('Password baru minimal 6 karakter.');
        return;
      }
      if (passwordBaru !== konfirmasiPassword) {
        setErr('Konfirmasi password tidak cocok.');
        return;
      }
    }

    setLoading(true);
    try {
      await onSave({
        nama: cleanNama,
        gelar: gelar.trim(),
        nip: cleanNip,
        passwordBaru: passwordBaru || undefined,
      });
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Gagal menyimpan wali kelas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <UserCheck size={18} className="text-guru" />
              Wali Kelas — {kelas.nama}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Fase {kelas.fase} · Akun: {kelas.loginEmail || `kelas-${kelas.nama.toLowerCase().replace(/\s+/g, '')}-v1@erapor.local`}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── BAGIAN IDENTITAS ── */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>1. Identitas Wali Kelas</span>
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                NAMA LENGKAP * <span className="font-normal text-slate-400">(otomatis huruf kapital)</span>
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value.toUpperCase())}
                placeholder="CONTOH: SITI NURJANAH"
                className="w-full px-3 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-navy-500 uppercase"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  GELAR <span className="font-normal text-slate-400">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={gelar}
                  onChange={(e) => setGelar(e.target.value)}
                  placeholder="S.Pd, M.Pd"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-navy-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  NIP <span className="font-normal text-slate-400">(18 digit angka)</span>
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={nip}
                  onChange={(e) => setNip(e.target.value.replace(/\D/g, ''))}
                  placeholder="198501012010012001"
                  className="w-full px-3 py-2.5 text-sm font-mono rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-navy-500"
                />
              </div>
            </div>
          </div>

          {/* ── BAGIAN PASSWORD ── */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound size={14} className="text-amber-600" />
                <span>2. Keamanan &amp; Password</span>
              </h4>
              <button
                type="button"
                onClick={handleBuatAcak}
                className="px-2.5 py-1 text-xs font-bold text-guru bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition"
              >
                <Sparkles size={13} />
                <span>Buat acak</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
              <span>Password saat ini:</span>
              <span className="font-mono font-bold tracking-widest text-slate-700">••••••••</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                PASSWORD BARU <span className="font-normal text-slate-400">(kosongkan jika tidak diganti)</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={passwordBaru}
                  onChange={(e) => setPasswordBaru(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 pr-10 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-navy-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {passwordBaru && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  KONFIRMASI PASSWORD BARU *
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={konfirmasiPassword}
                    onChange={(e) => setKonfirmasiPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full px-3 pr-10 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-navy-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {err && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-guru text-white text-sm font-bold disabled:opacity-60 hover:bg-guru-700 flex items-center justify-center gap-2 shadow-xs transition"
            >
              {loading && <RefreshCw size={14} className="animate-spin" />}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Kartu Password Tunggal ───────────────────────────────────────────

interface ModalKartuPasswordProps {
  kelasNama: string;
  email: string;
  passwordBaru: string;
  onClose: () => void;
}

const ModalKartuPasswordTunggal: React.FC<ModalKartuPasswordProps> = ({
  kelasNama, email, passwordBaru, onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(passwordBaru);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scaleIn border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <KeyRound size={18} className="text-amber-500" />
            Kartu Login Wali Kelas
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Kartu Potong */}
        <div className="p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 space-y-3 mb-4">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-amber-900">
              {kelasNama} · E-RAPOR SD
            </span>
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              Wajib Ganti Password
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Email Akun:</span>
              <span className="font-mono font-bold text-slate-800">{email}</span>
            </div>
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-amber-200">
              <span className="text-slate-600 font-medium">Password Baru:</span>
              <span className="font-mono text-base font-extrabold text-navy-800 tracking-wider">
                {passwordBaru}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-amber-800 italic leading-snug">
            Catatan: Bagikan informasi ini kepada wali kelas. Wali kelas akan diwajibkan mengganti password saat pertama kali login.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
          >
            {copied ? <CheckCheck size={15} className="text-emerald-600" /> : <Copy size={15} />}
            <span>{copied ? 'Tersalin!' : 'Salin Password'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-navy-800 text-white text-xs font-bold hover:bg-navy-900 flex items-center justify-center gap-1.5 transition"
          >
            <Printer size={15} />
            <span>Cetak Kartu</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal: Cetak Kartu Login Semua Kelas ─────────────────────────────────────

interface ModalCetakSemuaProps {
  kelasList: KelasRow[];
  passwordAwalMap: Record<string, PasswordAwalDoc>;
  onClose: () => void;
}

const ModalCetakKartuSemua: React.FC<ModalCetakSemuaProps> = ({
  kelasList, passwordAwalMap, onClose,
}) => {
  // Hanya akun berstatus "Password awal" (harusGantiPassword === true)
  const targetKelas = kelasList.filter((k) => k.harusGantiPassword);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header (Non-print) */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Printer size={18} className="text-navy-700" />
              Cetak Kartu Login Semua Kelas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {targetKelas.length} kartu akun berstatus "Password awal" (format cetak A4 kartu potong).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={targetKelas.length === 0}
              className="px-4 py-2 rounded-xl bg-navy-800 text-white text-xs font-bold hover:bg-navy-900 flex items-center gap-1.5 shadow-sm transition disabled:opacity-40"
            >
              <Printer size={14} />
              <span>Cetak Sekarang (A4)</span>
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Area Pratinjau Cetak */}
        <div className="p-6 overflow-y-auto flex-1 bg-white print:p-0 print:m-0">
          {targetKelas.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <AlertCircle size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold">Tidak ada akun dengan status "Password awal".</p>
              <p className="text-xs mt-1">Semua wali kelas telah mengganti password atau akun belum dibuat.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
              {targetKelas.map((k) => {
                const pwDoc = passwordAwalMap[k.id];
                const passwordAwal = pwDoc?.passwordAwal || '••••••••';
                return (
                  <div
                    key={k.id}
                    className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 print:bg-white print:border-slate-400 space-y-2 break-inside-avoid text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div>
                        <div className="font-extrabold text-sm text-navy-900">{k.nama}</div>
                        <div className="text-[10px] font-semibold text-slate-500">Fase {k.fase} · E-Rapor SD</div>
                      </div>
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full uppercase">
                        Ganti Password Pertama
                      </span>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Wali Kelas:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[180px]">
                          {k.namaWali ? `${k.namaWali}${k.gelarWali ? `, ${k.gelarWali}` : ''}` : '(Nama belum diisi)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Email Login:</span>
                        <span className="font-mono text-slate-700">{k.loginEmail || `kelas-${k.nama.toLowerCase().replace(/\s+/g, '')}-v1@erapor.local`}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-300">
                        <span className="text-slate-600 font-bold">Password Awal:</span>
                        <span className="font-mono text-sm font-extrabold text-navy-800 tracking-wider">
                          {passwordAwal}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>Alamat Aplikasi:</span>
                        <span className="font-mono text-slate-600">{window.location.origin}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Modal: Pratinjau Migrasi ────────────────────────────────────────────────

interface ModalMigrasiProps {
  pratinjau: PratinjauMigrasi;
  onExecute: () => Promise<void>;
  onClose: () => void;
  loading: boolean;
  progressText: string;
}

const ModalMigrasiWali: React.FC<ModalMigrasiProps> = ({
  pratinjau, onExecute, onClose, loading, progressText,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Sparkles size={18} className="text-navy-600" />
          Pratinjau Sinkronisasi &amp; Akun Wali Kelas
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Sistem akan memeriksa dan menyiapkan akun untuk setiap kelas agar seluruh wali kelas siap digunakan.
        </p>

        <div className="space-y-3 mb-5 text-xs">
          {/* Akan disambungkan */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="font-bold text-blue-900 mb-1 flex items-center justify-between">
              <span>Kelas yang akan disambungkan ke user lama:</span>
              <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-[10px]">
                {pratinjau.kelasAkanDisambungkan.length} kelas
              </span>
            </div>
            {pratinjau.kelasAkanDisambungkan.length > 0 ? (
              <ul className="list-disc pl-4 space-y-0.5 text-blue-800 mt-1">
                {pratinjau.kelasAkanDisambungkan.map((item) => (
                  <li key={item.kelasId}>
                    <strong>{item.kelasNama}</strong> → {item.userNama} ({item.userEmail})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-blue-700 italic">Tidak ada user orphan yang perlu disambungkan.</p>
            )}
          </div>

          {/* Akan dibuatkan akun */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="font-bold text-amber-900 mb-1 flex items-center justify-between">
              <span>Kelas yang belum punya akun (akan dibuatkan otomatis):</span>
              <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-[10px]">
                {pratinjau.kelasAkanDibuatkanAkun.length} kelas
              </span>
            </div>
            {pratinjau.kelasAkanDibuatkanAkun.length > 0 ? (
              <ul className="list-disc pl-4 space-y-0.5 text-amber-800 mt-1">
                {pratinjau.kelasAkanDibuatkanAkun.map((item) => (
                  <li key={item.kelasId}>
                    <strong>{item.kelasNama}</strong> (password acak 8 karakter)
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-amber-700 italic">Semua kelas sudah memiliki akun wali kelas.</p>
            )}
          </div>

          {/* Sudah siap */}
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
            <span>Kelas yang sudah memiliki akun lengkap &amp; siap:</span>
            <span className="font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full text-[10px]">
              {pratinjau.kelasSudahSiap.length} kelas
            </span>
          </div>
        </div>

        {loading && (
          <div className="mb-4 p-3 bg-navy-50 border border-navy-200 rounded-xl flex items-center gap-3 text-xs text-navy-800 font-medium">
            <RefreshCw size={16} className="animate-spin text-navy-600 shrink-0" />
            <span>{progressText || 'Memproses pembuatan akun...'}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={loading || (pratinjau.kelasAkanDisambungkan.length === 0 && pratinjau.kelasAkanDibuatkanAkun.length === 0)}
            onClick={onExecute}
            className="flex-1 py-2.5 rounded-xl bg-navy-800 text-white text-sm font-bold hover:bg-navy-900 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {loading && <RefreshCw size={14} className="animate-spin" />}
            <span>Jalankan Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Periksa & Perbaiki Semua Kelas (Tahap 4) ──────────────────────────

interface ModalPeriksaPerbaikiKelasProps {
  pemeriksaan: HasilPemeriksaanKelas;
  onExecute: () => void;
  onClose: () => void;
  loading: boolean;
  progressText: string;
}

const ModalPeriksaPerbaikiKelas: React.FC<ModalPeriksaPerbaikiKelasProps> = ({
  pemeriksaan, onExecute, onClose, loading, progressText,
}) => {
  const adaMasalah = pemeriksaan.masalah.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-scale-up border border-slate-100 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Shield size={18} className="text-navy-600" />
              Periksa &amp; Perbaiki Semua Kelas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Validasi konsistensi kelasId, akun wali kelas, data siswa, dan status rapor.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="py-4 space-y-3 overflow-y-auto flex-1 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between font-semibold text-slate-700">
            <span>Total kelas aktif diperiksa:</span>
            <span className="bg-slate-200 px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-800">
              {pemeriksaan.totalKelas} kelas
            </span>
          </div>

          {adaMasalah ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800 text-xs">
                <AlertCircle size={15} className="shrink-0 text-amber-600" />
                <span>Ditemukan {pemeriksaan.masalah.length} masalah:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-950 font-mono">
                {pemeriksaan.daftarMasalahFormatted.map((teks, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {teks.replace(/^-\s*/, '')}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3">
              <Check size={20} className="text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold">Semua data kelas sudah konsisten &amp; siap!</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  Seluruh akun wali, field kelasId siswa, dan status rapor telah sesuai standar.
                </div>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="mb-4 p-3 bg-navy-50 border border-navy-200 rounded-xl flex items-center gap-3 text-xs text-navy-800 font-medium">
            <RefreshCw size={16} className="animate-spin text-navy-600 shrink-0" />
            <span>{progressText || 'Sedang menerapkan perbaikan data kelas...'}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            {adaMasalah ? 'Batal' : 'Tutup'}
          </button>
          {adaMasalah && (
            <button
              type="button"
              disabled={loading}
              onClick={onExecute}
              className="flex-1 py-2.5 rounded-xl bg-navy-800 text-white text-sm font-bold hover:bg-navy-900 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading && <RefreshCw size={14} className="animate-spin" />}
              <span>Terapkan Perbaikan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Komponen Baris Kelas ─────────────────────────────────────────────────────

interface KelasRowItemProps {
  kelas: KelasRow;
  onEditWali: (k: KelasRow) => void;
  onHapus: (k: KelasRow) => void;
}

const KelasRowItem: React.FC<KelasRowItemProps> = ({
  kelas, onEditWali, onHapus,
}) => (
  <tr className={`text-sm border-b border-slate-100 transition-colors ${!kelas.aktif ? 'bg-slate-50 opacity-70' : 'hover:bg-slate-50/80'}`}>
    {/* 1. Nama Kelas */}
    <td className="px-4 py-3 font-bold text-slate-800">
      {kelas.nama}
      {!kelas.aktif && (
        <span className="ml-2 text-[10px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">NONAKTIF</span>
      )}
    </td>

    {/* 2. Fase */}
    <td className="px-4 py-3">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-navy-500/10 text-navy-700">
        Fase {kelas.fase}
      </span>
    </td>

    {/* 3. Wali Kelas */}
    <td className="px-4 py-3">
      {kelas.namaWali ? (
        <div>
          <div className="font-bold text-slate-800 text-xs">
            {kelas.namaWali}{kelas.gelarWali ? `, ${kelas.gelarWali}` : ''}
          </div>
          {kelas.nipWali ? (
            <div className="text-[11px] font-mono text-slate-400">NIP: {kelas.nipWali}</div>
          ) : (
            <div className="text-[11px] text-slate-400 italic">NIP belum diisi</div>
          )}
        </div>
      ) : (
        <span className="text-xs text-amber-600 font-semibold italic">Nama belum diisi</span>
      )}
    </td>

    {/* 4. Status Akun */}
    <td className="px-4 py-3">
      {renderBadgeStatusAkun(kelas)}
    </td>

    {/* 5. Jumlah Siswa */}
    <td className="px-4 py-3 text-center">
      <span className="font-bold text-slate-700">{kelas.jumlahSiswa}</span>
      <span className="text-slate-400 text-xs"> siswa</span>
    </td>

    {/* 6. Status Kelas */}
    <td className="px-4 py-3">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
        kelas.aktif ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {kelas.aktif ? 'Aktif' : 'Nonaktif'}
      </span>
    </td>

    {/* 7. Aksi */}
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onEditWali(kelas)}
          className="px-3 py-1.5 rounded-xl bg-guru text-white hover:bg-guru-700 text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
        >
          <UserCheck size={14} />
          <span>Edit Wali</span>
        </button>
        <button
          onClick={() => onHapus(kelas)}
          title="Hapus Kelas"
          disabled={kelas.jumlahSiswa > 0}
          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </td>
  </tr>
);

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export const KelasWaliKelas: React.FC = () => {
  const { data, notify, confirmModal } = useApp();
  const [rawKelas, setRawKelas] = useState<KelasDoc[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, { aktif: boolean; harusGantiPassword?: boolean; nama?: string }>>({});
  const [passwordAwalMap, setPasswordAwalMap] = useState<Record<string, PasswordAwalDoc>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [modalTambah, setModalTambah] = useState(false);
  const [modalEditWali, setModalEditWali] = useState<KelasRow | null>(null);
  const [kartuBaru, setKartuBaru] = useState<{ kelasNama: string; email: string; passwordBaru: string } | null>(null);
  const [modalCetakSemua, setModalCetakSemua] = useState(false);
  const [modalMigrasi, setModalMigrasi] = useState<PratinjauMigrasi | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrasiProgress, setMigrasiProgress] = useState('');
  const [modalPeriksa, setModalPeriksa] = useState<HasilPemeriksaanKelas | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [fixingProgress, setFixingProgress] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [collapsedTingkat, setCollapsedTingkat] = useState<Record<number, boolean>>({});

  // ── 1. Setup Realtime Listeners (onSnapshot) ──────────────────────────────
  useEffect(() => {
    let unsubsKelas: () => void = () => {};
    let unsubsUsers: () => void = () => {};

    if (isFirebaseConfigured) {
      unsubsKelas = subscribeKelasRealtime((list) => {
        setRawKelas(list);
        setIsLoading(false);
      });
      unsubsUsers = subscribeUsersRealtime((map) => {
        setUsersMap(map);
      });
    } else {
      getAllKelas().then((list) => {
        setRawKelas(list);
        setIsLoading(false);
      });
    }

    // Ambil passwordAwal store
    ambilSemuaPasswordAwal().then(setPasswordAwalMap);

    return () => {
      unsubsKelas();
      unsubsUsers();
    };
  }, []);

  // ── Gabungkan data Kelas + Users + Siswa ────────────────────────────────────
  const kelasList: KelasRow[] = useMemo(() => {
    const kelasSiswa = data?.kelasSiswa || [];
    return rawKelas.map((k) => {
      const jumlah = kelasSiswa.filter((ks) => ks.rombel_id === k.id || ks.kelas_id === k.id).length;
      const userDoc = k.waliKelasUid ? usersMap[k.waliKelasUid] : undefined;
      const harusGanti = userDoc ? userDoc.harusGantiPassword : Boolean(passwordAwalMap[k.id]);

      return {
        id:          k.id,
        tingkat:     k.tingkat,
        rombel:      k.rombel,
        nama:        k.nama,
        fase:        k.fase,
        aktif:       k.aktif !== false,
        namaWali:    k.namaWali || k.waliNama || userDoc?.nama,
        gelarWali:   k.gelarWali || k.waliGelar,
        nipWali:     k.nipWali,
        emailWali:   k.emailWali,
        loginEmail:  k.loginEmail,
        waliKelasUid: k.waliKelasUid,
        jumlahSiswa: k.jumlahSiswa ?? jumlah,
        harusGantiPassword: harusGanti,
      };
    }).sort((a, b) => {
      if (a.tingkat !== b.tingkat) return a.tingkat - b.tingkat;
      const codeA = a.rombel ? a.rombel.charCodeAt(0) - 64 : 0;
      const codeB = b.rombel ? b.rombel.charCodeAt(0) - 64 : 0;
      return codeA - codeB;
    });
  }, [rawKelas, usersMap, passwordAwalMap, data]);

  // Group per tingkat
  const groups = useMemo(() => {
    const map: Record<number, KelasRow[]> = {};
    for (let t = 1; t <= 6; t++) map[t] = [];
    kelasList.forEach((k) => {
      if (!map[k.tingkat]) map[k.tingkat] = [];
      map[k.tingkat].push(k);
    });
    return map;
  }, [kelasList]);

  const totalKelas = kelasList.length;
  const totalAktif = kelasList.filter((k) => k.aktif).length;
  const totalSiswa = kelasList.reduce((s, k) => s + k.jumlahSiswa, 0);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTambah = async (tingkat: number, rombel: string) => {
    try {
      await tambahKelas(tingkat, rombel, rawKelas);
      notify(`Kelas ${rombel ? `${tingkat}${rombel}` : tingkat} berhasil ditambah beserta akun wali kelas bawaan.`, 'success');
      const refreshedPw = await ambilSemuaPasswordAwal();
      setPasswordAwalMap(refreshedPw);
    } catch (err: any) {
      notify(err.message || 'Gagal menambah kelas.', 'error');
    }
  };

  const handleTambahRombel = async (tingkat: number) => {
    try {
      await tambahRombelBerikutnya(tingkat, rawKelas);
      notify(`Rombel baru berhasil ditambah untuk Tingkat ${tingkat} beserta akun wali kelasnya.`, 'success');
      const refreshedPw = await ambilSemuaPasswordAwal();
      setPasswordAwalMap(refreshedPw);
    } catch (err: any) {
      notify(err.message || 'Gagal menambah rombel.', 'error');
    }
  };

  const handleHapus = (kelas: KelasRow) => {
    if (kelas.jumlahSiswa > 0) {
      notify(`Kelas ${kelas.nama} masih memiliki ${kelas.jumlahSiswa} siswa. Pindahkan siswa terlebih dahulu.`, 'error');
      return;
    }
    confirmModal(
      `Hapus Kelas ${kelas.nama}`,
      `Apakah Anda yakin ingin menghapus kelas ${kelas.nama}? Akun login wali kelas untuk rombel ini juga akan dinonaktifkan.`,
      async () => {
        try {
          await hapusKelas(kelas.id, kelas.jumlahSiswa);
          notify(`Kelas ${kelas.nama} dan akun wali kelasnya berhasil dihapus.`, 'success');
        } catch (err: any) {
          notify(err.message || 'Gagal menghapus kelas.', 'error');
        }
      }
    );
  };

  const handleSaveWali = async (input: { nama: string; gelar?: string; nip?: string; passwordBaru?: string }) => {
    if (!modalEditWali) return;
    try {
      const res = await editWaliKelas(modalEditWali.id, input);
      if (res.gantiPassword && res.passwordBaruTersimpan) {
        notify(`Password ${modalEditWali.nama} berhasil diganti.`, 'success');
        setKartuBaru({
          kelasNama: modalEditWali.nama,
          email: modalEditWali.loginEmail || `kelas-${modalEditWali.nama.toLowerCase().replace(/\s+/g, '')}-v1@erapor.local`,
          passwordBaru: res.passwordBaruTersimpan,
        });
      } else {
        notify(`Data wali kelas ${modalEditWali.nama} berhasil disimpan.`, 'success');
      }
      const refreshedPw = await ambilSemuaPasswordAwal();
      setPasswordAwalMap(refreshedPw);
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan data wali kelas.', 'error');
      throw err;
    }
  };

  const handleBukaPratinjauMigrasi = async () => {
    try {
      const p = await cekPratinjauMigrasiWali();
      setModalMigrasi(p);
    } catch (e: any) {
      notify(e.message || 'Gagal mengecek status akun.', 'error');
    }
  };

  const handleEksekusiMigrasi = async () => {
    if (!modalMigrasi) return;
    setIsMigrating(true);
    try {
      const res = await eksekusiMigrasiWali(modalMigrasi, (cur, tot, msg) => {
        setMigrasiProgress(`${cur} dari ${tot} kelas: ${msg}`);
      });
      notify(`Sinkronisasi selesai! ${res.disambungkan} kelas disambungkan, ${res.dibuat} akun baru disiapkan.`, 'success');
      setModalMigrasi(null);
      const refreshedPw = await ambilSemuaPasswordAwal();
      setPasswordAwalMap(refreshedPw);
    } catch (e: any) {
      notify(e.message || 'Gagal menjalankan sinkronisasi.', 'error');
    } finally {
      setIsMigrating(false);
      setMigrasiProgress('');
    }
  };

  const handlePeriksaSemuaKelas = async () => {
    setIsChecking(true);
    try {
      const res = await periksaSemuaKelas();
      setModalPeriksa(res);
    } catch (err: any) {
      notify(err.message || 'Gagal memeriksa data kelas.', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  const handleTerapkanPerbaikan = async () => {
    if (!modalPeriksa) return;
    setIsFixing(true);
    try {
      const hasil = await terapkanPerbaikanSemuaKelas(modalPeriksa, (cur, tot, msg) => {
        setFixingProgress(`${cur} dari ${tot}: ${msg}`);
      });
      notify(hasil.pesanRingkasan, hasil.totalGagal > 0 ? 'info' : 'success');
      setModalPeriksa(null);
      const refreshedPw = await ambilSemuaPasswordAwal();
      setPasswordAwalMap(refreshedPw);
    } catch (err: any) {
      notify(err.message || 'Gagal menerapkan perbaikan.', 'error');
    } finally {
      setIsFixing(false);
      setFixingProgress('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={28} className="animate-spin text-navy-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Aksi Global */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kelas &amp; Wali Kelas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalAktif} aktif dari {totalKelas} kelas · {totalSiswa} siswa total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol 0: Periksa & Perbaiki Semua Kelas (Tahap 4) */}
          <button
            onClick={handlePeriksaSemuaKelas}
            disabled={isChecking}
            className="px-3.5 py-2 rounded-xl bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {isChecking ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
            <span>Periksa &amp; Perbaiki Semua Kelas</span>
          </button>

          {/* Tombol 1: Siapkan / Sinkronkan Akun */}
          <button
            onClick={handleBukaPratinjauMigrasi}
            className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Sparkles size={14} />
            <span>Siapkan Akun Semua Kelas</span>
          </button>

          {/* Tombol 2: Cetak Kartu Login */}
          <button
            onClick={() => setModalCetakSemua(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Printer size={14} />
            <span>Cetak Kartu Login</span>
          </button>

          {/* Tombol 3: Tambah Kelas */}
          <button
            onClick={() => setModalTambah(true)}
            className="px-3.5 py-2 rounded-xl bg-navy-800 text-white text-xs font-bold hover:bg-navy-900 flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus size={14} />
            <span>Tambah Kelas</span>
          </button>
        </div>
      </div>

      {/* Accordion Daftar Kelas per Tingkat */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((tingkat) => {
          const list = groups[tingkat] || [];
          const isCollapsed = Boolean(collapsedTingkat[tingkat]);
          const fase = faseDariTingkat(tingkat);

          return (
            <div key={tingkat} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              {/* Header Tingkat */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/70 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setCollapsedTingkat((prev) => ({ ...prev, [tingkat]: !prev[tingkat] }))}
                  className="flex items-center gap-2.5 text-left font-bold text-slate-800 hover:text-navy-600 transition"
                >
                  <span className="text-sm">Kelas {tingkat}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-navy-500/10 text-navy-700">
                    Fase {fase}
                  </span>
                  <span className="text-xs text-slate-400 font-normal">
                    ({list.length} rombel · {list.reduce((s, k) => s + k.jumlahSiswa, 0)} siswa)
                  </span>
                  {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => handleTambahRombel(tingkat)}
                  className="px-2.5 py-1 text-xs font-bold text-navy-700 bg-white hover:bg-navy-50 border border-slate-200 rounded-lg flex items-center gap-1 shadow-2xs transition"
                >
                  <Plus size={13} />
                  <span>+ Rombel</span>
                </button>
              </div>

              {/* Tabel Kelas */}
              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50/40 border-b border-slate-100">
                        <th className="px-4 py-2.5">Nama Kelas</th>
                        <th className="px-4 py-2.5">Fase</th>
                        <th className="px-4 py-2.5">Wali Kelas</th>
                        <th className="px-4 py-2.5">Status Akun</th>
                        <th className="px-4 py-2.5 text-center">Jumlah Siswa</th>
                        <th className="px-4 py-2.5">Status Kelas</th>
                        <th className="px-4 py-2.5">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">
                            Belum ada rombel untuk Tingkat {tingkat}.
                          </td>
                        </tr>
                      ) : (
                        list.map((k) => (
                          <KelasRowItem
                            key={k.id}
                            kelas={k}
                            onEditWali={(target) => setModalEditWali(target)}
                            onHapus={handleHapus}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Tambah Kelas */}
      {modalTambah && (
        <ModalTambahKelas
          existingKelas={kelasList}
          onConfirm={handleTambah}
          onClose={() => setModalTambah(false)}
        />
      )}

      {/* Modal Edit Wali Kelas */}
      {modalEditWali && (
        <ModalEditWaliKelas
          kelas={modalEditWali}
          onSave={handleSaveWali}
          onClose={() => setModalEditWali(null)}
        />
      )}

      {/* Modal Kartu Password Sekali */}
      {kartuBaru && (
        <ModalKartuPasswordTunggal
          kelasNama={kartuBaru.kelasNama}
          email={kartuBaru.email}
          passwordBaru={kartuBaru.passwordBaru}
          onClose={() => setKartuBaru(null)}
        />
      )}

      {/* Modal Cetak Kartu Login Semua Kelas */}
      {modalCetakSemua && (
        <ModalCetakKartuSemua
          kelasList={kelasList}
          passwordAwalMap={passwordAwalMap}
          onClose={() => setModalCetakSemua(false)}
        />
      )}

      {/* Modal Pratinjau Migrasi */}
      {modalMigrasi && (
        <ModalMigrasiWali
          pratinjau={modalMigrasi}
          onExecute={handleEksekusiMigrasi}
          onClose={() => setModalMigrasi(null)}
          loading={isMigrating}
          progressText={migrasiProgress}
        />
      )}

      {/* Modal Periksa & Perbaiki Semua Kelas (Tahap 4) */}
      {modalPeriksa && (
        <ModalPeriksaPerbaikiKelas
          pemeriksaan={modalPeriksa}
          onExecute={handleTerapkanPerbaikan}
          onClose={() => setModalPeriksa(null)}
          loading={isFixing}
          progressText={fixingProgress}
        />
      )}
    </div>
  );
};
