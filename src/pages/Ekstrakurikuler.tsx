import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Award, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { callApi } from '../lib/api';

export const Ekstrakurikuler: React.FC = () => {
  const { data, confirmModal, notify, refreshData } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nama, setNama] = useState('');

  if (!data) return null;

  const handleOpenAdd = () => {
    setEditingId(null);
    setNama('');
    setModalOpen(true);
  };

  const handleOpenEdit = (ekskul: any) => {
    setEditingId(ekskul.id);
    setNama(ekskul.nama);
    setModalOpen(true);
  };

  const handleDelete = (ekskul: any) => {
    confirmModal(
      'Hapus Ekstrakurikuler',
      `Yakin ingin menghapus ekstrakurikuler "${ekskul.nama}"?`,
      async () => {
        try {
          await callApi('delete', { sheetName: 'ekstrakurikuler', id: ekskul.id, keyField: 'id' });
          await refreshData();
          notify('Ekstrakurikuler berhasil dihapus.', 'success');
        } catch (err: any) {
          notify(err.message || 'Gagal menghapus', 'error');
        }
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      notify('Nama ekstrakurikuler wajib diisi.', 'error');
      return;
    }

    try {
      if (editingId) {
        await callApi('upsert', {
          sheetName: 'ekstrakurikuler',
          item: { id: editingId, sekolah_id: data.sekolah.id, nama: nama.trim() },
          keyFields: ['id'],
        });
      } else {
        await callApi('upsert', {
          sheetName: 'ekstrakurikuler',
          item: { id: 'ekskul_' + Math.random().toString(36).substring(2), sekolah_id: data.sekolah.id, nama: nama.trim() },
          keyFields: ['id'],
        });
      }
      await refreshData();
      setModalOpen(false);
      notify('Ekstrakurikuler berhasil disimpan.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Award size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Program Ekstrakurikuler
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar kegiatan bakat dan minat ekstrakurikuler sekolah
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white text-xs font-bold shadow-xs transition"
        >
          <Plus size={15} />
          <span>Tambah Ekskul</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 text-center w-14">No</th>
                <th className="py-3 px-4">Nama Ekstrakurikuler</th>
                <th className="py-3 px-4 text-right w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.ekskul.length > 0 ? (
                data.ekskul.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-center font-bold text-slate-500 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.nama}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                          title="Ubah"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-slate-400">
                    Belum ada program ekstrakurikuler.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-800">
                {editingId ? 'Ubah Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Ekstrakurikuler <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Pramuka, Dokter Kecil, Karate"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
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
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
