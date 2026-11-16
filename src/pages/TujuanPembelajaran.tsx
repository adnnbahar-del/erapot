import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Target, Plus, Edit2, Trash2, X, Save, BookOpen, Info, Lock, Unlock } from 'lucide-react';
import { TujuanPembelajaran as TPItem } from '../types';
import { formatDiubahOleh } from '../lib/rombel';
import { getMapelForSession } from '../lib/mapelService';

export const TujuanPembelajaranPage: React.FC = () => {
  const { data, session, addTP, updateTP, deleteTP, kunciTpLmPerTingkat, confirmModal, notify } = useApp();

  const tingkatAngka = session?.tingkatAngka || parseInt(session?.kelas || '1', 10) || 1;
  const tingkatId = `tingkat_${tingkatAngka}`;
  const rombelListInTingkat = data?.rombel
    ?.filter((r) => r.tingkat_id === tingkatId && r.aktif)
    ?.map((r) => r.nama) || [];
  const rombelInfoText = rombelListInTingkat.length > 0
    ? rombelListInTingkat.join(', ')
    : `${tingkatAngka}A, ${tingkatAngka}B, ${tingkatAngka}C`;

  const currentTingkat = data?.tingkat?.find((t) => t.tingkat === tingkatAngka || t.id === tingkatId);
  const isMultiRombel = currentTingkat?.modeKelas === 'rombel' || rombelListInTingkat.length > 1;

  const classMapel = getMapelForSession(data?.mapel || [], session || {});

  const [selectedMapelId, setSelectedMapelId] = useState<string>(() => {
    return classMapel[0]?.id || 'mapel_mtk';
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deskripsi, setDeskripsi] = useState('');

  if (!data || !session) return null;

  const isLockedByAdmin = Boolean(data.kunciTpLm?.[tingkatAngka]);
  const canEdit = session.peran === 'admin' || !isLockedByAdmin;

  const currentMapel = classMapel.find((m) => m.id === selectedMapelId) || classMapel[0];
  const activeTPs = data.tp
    .filter((t) => t.mapel_id === currentMapel?.id)
    .sort((a, b) => a.urutan - b.urutan);

  // Find latest modified TP in this mapel
  const latestModified = activeTPs.find((t) => t.diubah_oleh)?.diubah_oleh;

  const handleOpenAdd = () => {
    if (!canEdit) {
      notify('Tujuan Pembelajaran dikunci oleh admin untuk tingkat ini.', 'error');
      return;
    }
    setEditingId(null);
    setDeskripsi('');
    setModalOpen(true);
  };

  const handleOpenEdit = (tp: TPItem) => {
    if (!canEdit) {
      notify('Tujuan Pembelajaran dikunci oleh admin untuk tingkat ini.', 'error');
      return;
    }
    setEditingId(tp.id);
    setDeskripsi(tp.deskripsi);
    setModalOpen(true);
  };

  const handleDelete = (tp: TPItem) => {
    if (!canEdit) {
      notify('Tujuan Pembelajaran dikunci oleh admin untuk tingkat ini.', 'error');
      return;
    }
    confirmModal(
      'Hapus Tujuan Pembelajaran',
      `Yakin ingin menghapus TP: "${tp.deskripsi.substring(0, 50)}..."?`,
      () => {
        deleteTP(tp.id);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deskripsi.trim()) {
      notify('Deskripsi TP wajib diisi.', 'error');
      return;
    }
    if (!canEdit) {
      notify('Tujuan Pembelajaran dikunci oleh admin.', 'error');
      return;
    }

    const diubahOleh = formatDiubahOleh(session);

    try {
      if (editingId) {
        await updateTP(editingId, { deskripsi: deskripsi.trim(), diubah_oleh: diubahOleh });
      } else {
        await addTP({
          mapel_id: currentMapel.id,
          urutan: activeTPs.length + 1,
          deskripsi: deskripsi.trim(),
          diubah_oleh: diubahOleh,
        });
      }
      setModalOpen(false);
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan TP', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Mapel Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-kemdikbud-dark">
            <Target size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Tujuan Pembelajaran (TP)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Digunakan dalam Asesmen Formatif untuk menghasilkan deskripsi capaian rapor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-slate-400" />
            <select
              value={currentMapel?.id || ''}
              onChange={(e) => setSelectedMapelId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {classMapel.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama} ({m.singkatan})
                </option>
              ))}
            </select>
          </div>

          {canEdit ? (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white text-xs font-bold shadow-xs transition"
            >
              <Plus size={15} />
              <span>Tambah TP</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <Lock size={14} />
              <span>Terkunci</span>
            </div>
          )}
        </div>
      </div>

      {/* Banner Dipakai Bersama */}
      {(isMultiRombel || session.peran === 'admin' || isLockedByAdmin) && (
        <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-blue-900 font-medium">
            <Info size={18} className="text-blue-600 shrink-0" />
            <span>
              {isMultiRombel ? (
                <>
                  <strong className="font-bold">Dipakai bersama oleh {rombelInfoText}</strong> (Tingkat {tingkatAngka}). Perubahan oleh wali kelas manapun langsung berlaku untuk seluruh rombel di tingkat ini.
                </>
              ) : (
                <span>Tujuan Pembelajaran untuk Tingkat {tingkatAngka}.</span>
              )}
            </span>
          </div>
          {session.peran === 'admin' ? (
            <button
              onClick={() => kunciTpLmPerTingkat(tingkatAngka, !isLockedByAdmin)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs shrink-0 transition ${
                isLockedByAdmin
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {isLockedByAdmin ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{isLockedByAdmin ? 'Buka Kunci TP/LM' : 'Kunci TP/LM (Admin)'}</span>
            </button>
          ) : isLockedByAdmin ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px] shrink-0">
              <Lock size={12} /> Terkunci oleh Admin
            </span>
          ) : null}
        </div>
      )}

      {/* TP Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 text-center w-14">Kode</th>
                <th className="py-3 px-4">Deskripsi Tujuan Pembelajaran</th>
                <th className="py-3 px-4 text-right w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTPs.length > 0 ? (
                activeTPs.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-center font-bold text-slate-500 tabular-nums">
                      TP {idx + 1}
                    </td>
                    <td className="py-3 px-4 text-slate-800 leading-relaxed font-medium">
                      <div>{t.deskripsi}</div>
                      {t.diubah_oleh && (
                        <div className="text-[11px] text-slate-400 mt-1 italic">
                          Terakhir diubah oleh {t.diubah_oleh}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canEdit ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(t)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                            title="Ubah"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Terkunci</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-slate-400">
                    Belum ada Tujuan Pembelajaran untuk mata pelajaran {currentMapel?.nama}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit TP */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-800">
                {editingId ? 'Ubah Tujuan Pembelajaran' : 'Tambah Tujuan Pembelajaran'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mata Pelajaran
                </label>
                <input
                  type="text"
                  disabled
                  value={`${currentMapel?.nama} (${currentMapel?.singkatan})`}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-600 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deskripsi Tujuan Pembelajaran <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Contoh: mampu memahami perkalian pecahan dengan bilangan asli dan menghitung hasil perkalian tersebut"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Tulis dengan huruf kecil di awal kalimat (misal: "mampu...") agar tersambung alami pada teks capaian rapor.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white font-bold rounded-xl shadow"
                >
                  <Save size={14} />
                  <span>Simpan TP</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
