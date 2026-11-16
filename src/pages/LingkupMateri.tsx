import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Layers, Plus, Edit2, Trash2, X, Save, BookOpen, Info, Lock, Unlock } from 'lucide-react';
import { LingkupMateri as LMItem } from '../types';
import { formatDiubahOleh } from '../lib/rombel';
import { getMapelForSession } from '../lib/mapelService';

export const LingkupMateriPage: React.FC = () => {
  const { data, session, addLM, updateLM, deleteLM, kunciTpLmPerTingkat, confirmModal, notify } = useApp();

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
  const [nama, setNama] = useState('');

  if (!data || !session) return null;

  const isLockedByAdmin = Boolean(data.kunciTpLm?.[tingkatAngka]);
  const canEdit = session.peran === 'admin' || !isLockedByAdmin;

  const currentMapel = classMapel.find((m) => m.id === selectedMapelId) || classMapel[0];
  const activeLMs = data.lm
    .filter((l) => l.mapel_id === currentMapel?.id)
    .sort((a, b) => a.urutan - b.urutan);

  const handleOpenAdd = () => {
    if (!canEdit) {
      notify('Lingkup Materi dikunci oleh admin untuk tingkat ini.', 'error');
      return;
    }
    setEditingId(null);
    setNama('');
    setModalOpen(true);
  };

  const handleOpenEdit = (lm: LMItem) => {
    if (!canEdit) {
      notify('Lingkup Materi dikunci oleh admin untuk tingkat ini.', 'error');
      return;
    }
    setEditingId(lm.id);
    setNama(lm.nama);
    setModalOpen(true);
  };

  const handleDelete = (lm: LMItem) => {
    if (!canEdit) {
      notify('Lingkup Materi dikunci oleh admin untuk tingkat ini.', 'error');
      return;
    }
    confirmModal(
      'Hapus Lingkup Materi',
      `Yakin ingin menghapus Lingkup Materi "${lm.nama}"? Kolom nilai sumatif terkait pada mapel ini akan terhapus.`,
      () => {
        deleteLM(lm.id);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      notify('Nama lingkup materi wajib diisi.', 'error');
      return;
    }
    if (!canEdit) {
      notify('Lingkup Materi dikunci oleh admin.', 'error');
      return;
    }

    const diubahOleh = formatDiubahOleh(session);

    try {
      if (editingId) {
        await updateLM(editingId, { nama: nama.trim(), diubah_oleh: diubahOleh });
      } else {
        await addLM({
          mapel_id: currentMapel.id,
          urutan: activeLMs.length + 1,
          nama: nama.trim(),
          diubah_oleh: diubahOleh,
        });
      }
      setModalOpen(false);
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan LM', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Mapel Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700">
            <Layers size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Lingkup Materi (LM)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Setiap Lingkup Materi menjadi satu kolom nilai pada Asesmen Sumatif (Sumatif 1, 2, …)
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
              <span>Tambah LM</span>
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
        <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-indigo-950 font-medium">
            <Info size={18} className="text-indigo-600 shrink-0" />
            <span>
              {isMultiRombel ? (
                <>
                  <strong className="font-bold">Dipakai bersama oleh {rombelInfoText}</strong> (Tingkat {tingkatAngka}). Perubahan oleh wali kelas manapun langsung berlaku untuk seluruh rombel di tingkat ini.
                </>
              ) : (
                <span>Lingkup Materi untuk Tingkat {tingkatAngka}.</span>
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

      {/* LM Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 text-center w-14">Kode</th>
                <th className="py-3 px-4">Nama Lingkup Materi / Bab</th>
                <th className="py-3 px-4">Peruntukan Kolom Sumatif</th>
                <th className="py-3 px-4 text-right w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeLMs.length > 0 ? (
                activeLMs.map((l, idx) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-center font-bold text-slate-500 tabular-nums">
                      LM {idx + 1}
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-bold">
                      <div>{l.nama}</div>
                      {l.diubah_oleh && (
                        <div className="text-[11px] font-normal text-slate-400 mt-1 italic">
                          Terakhir diubah oleh {l.diubah_oleh}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-indigo-700 font-semibold font-mono">
                      Sumatif {idx + 1} ({l.nama})
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canEdit ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(l)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                            title="Ubah"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(l)}
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
                  <td colSpan={4} className="text-center py-10 text-slate-400">
                    Belum ada Lingkup Materi untuk mata pelajaran {currentMapel?.nama}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit LM */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-800">
                {editingId ? 'Ubah Lingkup Materi' : 'Tambah Lingkup Materi'}
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
                  Nama Lingkup Materi / Pokok Bahasan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Pecahan, Rasio, Bangun Datar"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none font-semibold"
                />
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
                  <span>Simpan LM</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
