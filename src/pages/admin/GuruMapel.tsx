// src/pages/admin/GuruMapel.tsx
// Halaman Admin: Guru Mapel (Tahap 2)
// - Daftar guru mapel dengan mapel + kelas yang diajar
// - Tambah/edit guru mapel: nama, username, password, mapel, kelas (checklist)
// - Nonaktifkan guru mapel (hapus lunak)

import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, UserX, UserCheck, RefreshCw, AlertCircle,
  Eye, EyeOff, BookOpen, Users, Check, X, KeyRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isFirebaseConfigured } from '../../lib/firebase';
import {
  getAllGuruMapel, tambahGuruMapel, editGuruMapel, hapusGuruMapel, getAllKelas,
  resetPasswordUser,
  type GuruMapelDoc, type KelasDoc,
} from '../../lib/kelasService';
import { faseDariTingkat } from '../../lib/rombel';

// ─── Modal Tambah/Edit Guru Mapel ─────────────────────────────────────────────

interface ModalGuruMapelProps {
  guru: GuruMapelDoc | null;
  kelasList: { id: string; nama: string; tingkat: number }[];
  mapelList: { id: string; nama: string }[];
  onConfirm: (data: {
    nama: string; username: string; email: string; nip?: string;
    password: string; kelasIds: string[]; mapelIds: string[];
  }) => Promise<void>;
  onClose: () => void;
}

const ModalGuruMapel: React.FC<ModalGuruMapelProps> = ({
  guru, kelasList, mapelList, onConfirm, onClose,
}) => {
  const isEdit = Boolean(guru);
  const [nama,     setNama]     = useState(guru?.nama ?? '');
  const [username, setUsername] = useState(guru?.username ?? '');
  const [email,    setEmail]    = useState(guru?.email ?? '');
  const [nip,      setNip]      = useState(guru?.nip ?? '');
  const [pass,     setPass]     = useState('');
  const [showP,    setShowP]    = useState(false);
  const [selKelas, setSelKelas] = useState<string[]>(guru?.kelasIds ?? []);
  const [selMapel, setSelMapel] = useState<string[]>(guru?.mapelIds ?? []);
  const [err,      setErr]      = useState('');
  const [loading,  setLoading]  = useState(false);

  // Reset password states
  const [newPass,  setNewPass]  = useState('');
  const [showNewP, setShowNewP] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const toggleKelas = (id: string) =>
    setSelKelas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleMapel = (id: string) =>
    setSelMapel((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleResetPassword = async () => {
    if (!guru?.uid) return;
    if (newPass.length < 6) {
      setErr('Kata sandi baru minimal 6 karakter.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      await resetPasswordUser(guru.uid, newPass);
      setResetSuccess(true);
      setNewPass('');
    } catch (e: any) {
      setErr(e.message || 'Gagal mereset kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const targetEmail = email.trim() || `${username.toLowerCase().trim()}@erapor.local`;
    if (!nama.trim())     { setErr('Nama wajib diisi.'); return; }
    if (!username.trim()) { setErr('Username wajib diisi.'); return; }
    if (!targetEmail)     { setErr('Email wajib diisi.'); return; }
    if (!isEdit && pass.length < 6) { setErr('Kata sandi minimal 6 karakter.'); return; }
    if (selKelas.length === 0) { setErr('Pilih minimal 1 kelas.'); return; }
    if (selMapel.length === 0) { setErr('Pilih minimal 1 mapel.'); return; }

    setLoading(true);
    try {
      await onConfirm({
        nama: nama.trim(), username: username.trim(),
        email: targetEmail, nip: nip.trim() || undefined,
        password: pass, kelasIds: selKelas, mapelIds: selMapel,
      });
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Group kelas by tingkat for display
  const kelasByTingkat: Record<number, typeof kelasList> = {};
  kelasList.forEach((k) => {
    if (!kelasByTingkat[k.tingkat]) kelasByTingkat[k.tingkat] = [];
    kelasByTingkat[k.tingkat].push(k);
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <BookOpen size={18} className="text-navy-500" />
          {isEdit ? 'Edit Guru Mapel' : 'Tambah Guru Mapel'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">NAMA LENGKAP *</label>
              <input value={nama} onChange={(e) => setNama(e.target.value)}
                placeholder="Nama guru"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-navy-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">NIP <span className="font-normal text-slate-400">(opsional)</span></label>
              <input value={nip} onChange={(e) => setNip(e.target.value)}
                placeholder="1985..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-navy-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">USERNAME (Login) *</label>
            <input value={username} onChange={(e) => {
              const u = e.target.value.toLowerCase().trim();
              setUsername(u);
              if (!isEdit) setEmail(`${u}@erapor.local`);
            }}
              placeholder="contoh: pjok.guru" disabled={isEdit}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-navy-500 disabled:opacity-60" />
            <p className="text-[11px] text-slate-400 mt-0.5">Email login: {username ? `${username}@erapor.local` : 'username@erapor.local'}</p>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">KATA SANDI * <span className="font-normal text-slate-400">(min. 6 karakter)</span></label>
              <div className="relative">
                <input type={showP ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 pr-10 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-navy-500" />
                <button type="button" onClick={() => setShowP(!showP)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showP ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {isEdit && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 space-y-2">
              <label className="block text-xs font-bold text-slate-700">RESET KATA SANDI GURU</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showNewP ? 'text' : 'password'}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Sandi baru (min. 6 kar)"
                    className="w-full px-3 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-navy-500"
                  />
                  <button type="button" onClick={() => setShowNewP(!showNewP)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNewP ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loading || !newPass}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-amber-700 bg-white hover:bg-amber-100 border border-amber-300 flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <KeyRound size={13} />
                  <span>Update</span>
                </button>
              </div>
              {resetSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                  <Check size={14} /> Password berhasil diganti. Akun lama otomatis tidak bisa dipakai.
                </div>
              )}
            </div>
          )}

          {/* Checklist Mapel */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">
              MATA PELAJARAN YANG DIAJAR * <span className="font-normal text-slate-400">(pilih semua yang berlaku)</span>
            </label>
            {mapelList.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada mata pelajaran. Tambahkan di menu Intrakurikuler.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-1">
                {mapelList.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50">
                    <div onClick={() => toggleMapel(m.id)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        selMapel.includes(m.id) ? 'bg-navy-600 border-navy-600' : 'border-slate-300'
                      }`}>
                      {selMapel.includes(m.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-xs text-slate-700 leading-tight">{m.nama}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Checklist Kelas */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">
              KELAS YANG DIAJAR * <span className="font-normal text-slate-400">(pilih semua yang berlaku)</span>
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto p-1">
              {Object.entries(kelasByTingkat).map(([t, klss]) => (
                <div key={t}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tingkat {t}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {klss.map((k) => (
                      <button key={k.id} type="button" onClick={() => toggleKelas(k.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border-2 transition-colors ${
                          selKelas.includes(k.id)
                            ? 'bg-navy-600 border-navy-600 text-white'
                            : 'border-slate-200 text-slate-600 hover:border-navy-300'
                        }`}>
                        {k.nama}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {err}
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
              {isEdit ? 'Simpan' : 'Tambah Guru Mapel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export const GuruMapelPage: React.FC = () => {
  const { data, notify, confirmModal } = useApp();
  const [guruList, setGuruList]   = useState<GuruMapelDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalData, setModalData] = useState<GuruMapelDoc | null | false>(false); // false = tutup

  const mapelList = (data?.mapel ?? []).map((m) => ({ id: m.id, nama: m.nama }));
  const [kelasList, setKelasList] = useState<{ id: string; nama: string; tingkat: number }[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const kList = await getAllKelas();
      setKelasList(kList.map((k) => ({
        id: k.id,
        nama: k.nama,
        tingkat: k.tingkat,
      })));
      const list = await getAllGuruMapel();
      setGuruList(list);
    } catch (err: any) {
      notify(err.message || 'Gagal memuat data guru mapel.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [data]);

  const handleConfirm = async (formData: any) => {
    if (modalData) {
      // Edit
      await editGuruMapel(modalData.uid, {
        nama: formData.nama,
        nip:  formData.nip,
        kelasIds: formData.kelasIds,
        mapelIds: formData.mapelIds,
      });
      notify('Data guru mapel berhasil diperbarui.', 'success');
    } else {
      // Tambah
      await tambahGuruMapel(formData);
      notify(`Guru mapel ${formData.nama} berhasil ditambah.`, 'success');
    }
    await loadData();
  };

  const handleNonaktif = (guru: GuruMapelDoc) => {
    confirmModal(
      `Nonaktifkan ${guru.nama}`,
      `Akun guru mapel ${guru.nama} akan dinonaktifkan dan tidak bisa login.`,
      async () => {
        try {
          await hapusGuruMapel(guru.uid);
          notify(`${guru.nama} berhasil dinonaktifkan.`, 'success');
          await loadData();
        } catch (err: any) {
          notify(err.message || 'Gagal.', 'error');
        }
      }
    );
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Firebase belum dikonfigurasi</p>
            <p className="text-sm mt-1">
              Fitur Guru Mapel membutuhkan Firebase Authentication dan Firestore.
              Isi variabel <code>VITE_FIREBASE_*</code> di file <code>.env</code> untuk mengaktifkan fitur ini.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Guru Mapel</h1>
          <p className="text-sm text-slate-500 mt-0.5">{guruList.filter((g) => g.aktif).length} aktif dari {guruList.length} guru</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setModalData(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-800 text-white text-sm font-bold hover:bg-navy-900 shadow-btn-admin">
            <Plus size={16} /> Tambah Guru Mapel
          </button>
        </div>
      </div>

      {/* Tabel */}
      {isLoading ? (
        <div className="flex justify-center py-16"><RefreshCw size={28} className="animate-spin text-navy-500" /></div>
      ) : guruList.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Belum ada guru mapel</p>
          <button onClick={() => setModalData(null)} className="mt-3 text-sm text-navy-600 font-bold underline">
            Tambah sekarang
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs font-bold text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Mapel</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {guruList.map((guru) => (
                <tr key={guru.id} className={`border-b border-slate-100 ${!guru.aktif ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50/80'}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{guru.nama}</div>
                    {guru.nip && <div className="text-xs text-slate-400">{guru.nip}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">{guru.username}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(guru.mapelIds ?? []).map((mid) => {
                        const m = mapelList.find((x) => x.id === mid);
                        return m ? (
                          <span key={mid} className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                            {m.nama}
                          </span>
                        ) : null;
                      })}
                      {(guru.mapelIds ?? []).length === 0 && <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(guru.kelasIds ?? []).map((kid) => {
                        const k = kelasList.find((x) => x.id === kid);
                        return k ? (
                          <span key={kid} className="text-[10px] font-bold bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">
                            {k.nama}
                          </span>
                        ) : null;
                      })}
                      {(guru.kelasIds ?? []).length === 0 && <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      guru.aktif ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {guru.aktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setModalData(guru)}
                        className="p-1.5 rounded-lg text-navy-600 hover:bg-navy-50">
                        <Edit2 size={14} />
                      </button>
                      {guru.aktif && (
                        <button onClick={() => handleNonaktif(guru)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50">
                          <UserX size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalData !== false && (
        <ModalGuruMapel
          guru={modalData}
          kelasList={kelasList}
          mapelList={mapelList}
          onConfirm={handleConfirm}
          onClose={() => setModalData(false)}
        />
      )}
    </div>
  );
};

