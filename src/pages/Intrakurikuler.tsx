import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ShieldAlert,
  Info,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Mapel, Fase, KelompokMapel } from '../types';
import { getMapelForWaliKelasView } from '../lib/mapelService';

export const Intrakurikuler: React.FC = () => {
  const {
    data,
    session,
    addMapel,
    updateMapel,
    deleteMapel,
    toggleMapelKelas,
    seedMapelDefault,
    confirmModal,
    notify,
  } = useApp();

  // Admin state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [kelompok, setKelompok] = useState<KelompokMapel>('wajib');
  const [faseBerlaku, setFaseBerlaku] = useState<Fase[]>(['A', 'B', 'C']);
  const [urutanRapor, setUrutanRapor] = useState<number>(1);
  const [aktif, setAktif] = useState(true);
  const [varianAgama, setVarianAgama] = useState<string[]>([]);
  const [filterFase, setFilterFase] = useState<string>('all');
  const [filterKelompok, setFilterKelompok] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!data || !session) return null;

  const isAdmin = session.peran === 'admin';
  const classFase = session.fase || 'A';
  const kelasId = session.kelasId || '';

  // Wali Kelas mapel view: all mapels relevant to their phase
  const waliMapelList = useMemo(() => {
    return getMapelForWaliKelasView(data.mapel, classFase);
  }, [data.mapel, classFase]);

  // Admin mapel view: filtered list
  const adminMapelList = useMemo(() => {
    return [...data.mapel]
      .filter((m) => {
        if (filterFase !== 'all') {
          if (!m.faseBerlaku || !m.faseBerlaku.includes(filterFase as Fase)) return false;
        }
        if (filterKelompok !== 'all') {
          if (m.kelompok !== filterKelompok) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchNama = m.nama.toLowerCase().includes(q);
          const matchKode = (m.kode || m.singkatan || '').toLowerCase().includes(q);
          if (!matchNama && !matchKode) return false;
        }
        return true;
      })
      .sort((a, b) => (a.urutanRapor || a.urutan || 0) - (b.urutanRapor || b.urutan || 0));
  }, [data.mapel, filterFase, filterKelompok, searchQuery]);

  // Modal Handlers (Admin Only)
  const handleOpenAdd = () => {
    setEditingId(null);
    setKode('');
    setNama('');
    setKelompok('wajib');
    setFaseBerlaku(['A', 'B', 'C']);
    setUrutanRapor(data.mapel.length + 1);
    setAktif(true);
    setVarianAgama([]);
    setModalOpen(true);
  };

  const handleOpenEdit = (m: Mapel) => {
    setEditingId(m.id);
    setKode(m.kode || m.singkatan || '');
    setNama(m.nama);
    setKelompok(m.kelompok || (m.jenis === 'mulok' ? 'mulok' : 'wajib'));
    setFaseBerlaku(m.faseBerlaku && m.faseBerlaku.length > 0 ? m.faseBerlaku : ['A', 'B', 'C']);
    setUrutanRapor(m.urutanRapor || m.urutan || 1);
    setAktif(m.aktif !== false);
    setVarianAgama(m.varianAgama || []);
    setModalOpen(true);
  };

  const handleDelete = (m: Mapel) => {
    confirmModal(
      'Hapus Mata Pelajaran',
      `Yakin ingin menghapus mata pelajaran "${m.nama}"? Tujuan pembelajaran dan nilai yang telah diinputkan pada mapel ini dapat terpengaruh.`,
      async () => {
        try {
          await deleteMapel(m.id);
        } catch (err: any) {
          notify(err.message || 'Gagal menghapus mata pelajaran', 'error');
        }
      }
    );
  };

  const handleToggleFase = (f: Fase) => {
    if (faseBerlaku.includes(f)) {
      if (faseBerlaku.length <= 1) {
        notify('Minimal pilih satu fase yang berlaku.', 'error');
        return;
      }
      setFaseBerlaku(faseBerlaku.filter((x) => x !== f));
    } else {
      setFaseBerlaku([...faseBerlaku, f].sort());
    }
  };

  const handleSubmitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kode.trim()) {
      notify('Kode mata pelajaran wajib diisi.', 'error');
      return;
    }
    if (!nama.trim()) {
      notify('Nama mata pelajaran wajib diisi.', 'error');
      return;
    }
    if (faseBerlaku.length === 0) {
      notify('Pilih minimal satu fase yang berlaku.', 'error');
      return;
    }

    try {
      if (editingId) {
        await updateMapel(editingId, {
          kode: kode.trim().toUpperCase(),
          nama: nama.trim(),
          kelompok,
          faseBerlaku,
          urutanRapor: Number(urutanRapor) || 1,
          aktif,
          varianAgama,
          singkatan: kode.trim().toUpperCase(),
          jenis: kelompok === 'mulok' ? 'mulok' : 'intra',
          urutan: Number(urutanRapor) || 1,
        });
      } else {
        await addMapel({
          kode: kode.trim().toUpperCase(),
          nama: nama.trim(),
          kelompok,
          faseBerlaku,
          urutanRapor: Number(urutanRapor) || 1,
          aktif,
          varianAgama,
          singkatan: kode.trim().toUpperCase(),
          jenis: kelompok === 'mulok' ? 'mulok' : 'intra',
          urutan: Number(urutanRapor) || 1,
        });
      }
      setModalOpen(false);
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan mata pelajaran', 'error');
    }
  };

  const handleToggleAktifDiKelas = async (mapel: Mapel, saatIniAktif: boolean) => {
    const aksi = saatIniAktif ? 'menonaktifkan' : 'mengaktifkan';
    confirmModal(
      `${saatIniAktif ? 'Nonaktifkan' : 'Aktifkan'} Mata Pelajaran`,
      `Apakah Anda yakin ingin ${aksi} "${mapel.nama}" untuk Kelas ${session.kelas}?`,
      async () => {
        try {
          await toggleMapelKelas(mapel.id, kelasId, !saatIniAktif);
        } catch (err: any) {
          notify(err.message || 'Gagal mengubah status mapel kelas', 'error');
        }
      }
    );
  };

  // Helper badge kelompok
  const renderKelompokBadge = (k?: KelompokMapel) => {
    switch (k) {
      case 'seni':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            Seni Budaya
          </span>
        );
      case 'pilihan':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Pilihan
          </span>
        );
      case 'mulok':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Muatan Lokal
          </span>
        );
      case 'wajib':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Wajib
          </span>
        );
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // VIEW: WALI KELAS (Otomatis per Fase, Read-Only kecuali toggle pilihan/mulok)
  // ───────────────────────────────────────────────────────────────────────────
  if (!isAdmin) {
    const activeCount = waliMapelList.filter(
      (m) => !m.kelasNonaktif || !m.kelasNonaktif.includes(kelasId)
    ).length;
    const disabledCount = waliMapelList.length - activeCount;

    return (
      <div className="space-y-6">
        {/* Header Kartu */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-blue-50 text-kemdikbud-dark">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Mata Pelajaran Kelas {session.kelas}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-kemdikbud-dark text-white">
                  Fase {classFase}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mata pelajaran ditentukan otomatis sesuai Kurikulum Merdeka. Wali kelas tidak perlu mengetik daftar mapel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-right">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Mapel Aktif</span>
              <span className="text-sm font-black text-slate-800 tabular-nums">
                {activeCount} / {waliMapelList.length}
              </span>
            </div>
          </div>
        </div>

        {/* Banner Penjelasan Kurikulum */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900 leading-relaxed shadow-xs">
          <Info size={18} className="text-kemdikbud-dark shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-kemdikbud-dark">
              Pengaturan Mata Pelajaran Otomatis (Fase {classFase})
            </p>
            <p className="text-blue-800/90">
              Mata pelajaran wajib dan seni budaya diambil oleh seluruh siswa. Jika kelas Anda tidak mengambil mata pelajaran <strong>Pilihan</strong> (mis. Bahasa Inggris) atau <strong>Muatan Lokal</strong>, Anda dapat menonaktifkannya melalui tombol aksi di bawah.
            </p>
          </div>
        </div>

        {/* Tabel Mata Pelajaran Kelas */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 text-center w-14">No</th>
                  <th className="py-3 px-4 w-24">Kode</th>
                  <th className="py-3 px-4">Nama Mata Pelajaran</th>
                  <th className="py-3 px-4 text-center w-32">Kelompok</th>
                  <th className="py-3 px-4 text-center w-40">Status di Kelas Ini</th>
                  <th className="py-3 px-4 text-right w-48">Aksi Wali Kelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {waliMapelList.map((m, idx) => {
                  const isDeactivated = Boolean(m.kelasNonaktif?.includes(kelasId));
                  const isOptionalOrMulok = m.kelompok === 'pilihan' || m.kelompok === 'mulok';

                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50/70 transition ${
                        isDeactivated ? 'bg-slate-50/50 opacity-75' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-bold text-slate-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-kemdikbud-dark">
                        {m.kode || m.singkatan || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{m.nama}</div>
                        {m.varianAgama && m.varianAgama.length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Varian Agama: {m.varianAgama.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {renderKelompokBadge(m.kelompok)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isDeactivated ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle size={12} className="text-slate-400" />
                            <span>Dinonaktifkan</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>Aktif</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isOptionalOrMulok ? (
                          <button
                            type="button"
                            onClick={() => handleToggleAktifDiKelas(m, !isDeactivated)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-2xs ${
                              isDeactivated
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200'
                            }`}
                          >
                            {isDeactivated ? (
                              <>
                                <Check size={13} />
                                <span>Aktifkan</span>
                              </>
                            ) : (
                              <>
                                <X size={13} />
                                <span>Nonaktifkan</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic font-medium">
                            Wajib Kurikulum
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // VIEW: ADMIN (Data Master, Full CRUD, Fase Berlaku, Urutan Rapor)
  // ───────────────────────────────────────────────────────────────────────────
  const totalMapel = data.mapel.length;
  const wajibCount = data.mapel.filter((m) => m.kelompok === 'wajib').length;
  const seniCount = data.mapel.filter((m) => m.kelompok === 'seni').length;
  const pilihanCount = data.mapel.filter((m) => m.kelompok === 'pilihan').length;
  const mulokCount = data.mapel.filter((m) => m.kelompok === 'mulok').length;

  return (
    <div className="space-y-6">
      {/* Header Admin */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-blue-50 text-kemdikbud-dark">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Manajemen Mata Pelajaran (Admin)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-kemdikbud-dark border border-blue-200">
                Data Master
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola daftar mata pelajaran nasional Kurikulum Merdeka, fase berlaku, kelompok, dan urutan cetak rapor.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={seedMapelDefault}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            title="Pastikan 9 mapel default Kurikulum Merdeka terpasang rapi tanpa duplikat"
          >
            <RotateCcw size={14} />
            <span>Sinkronkan Default</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white text-xs font-bold shadow-xs transition"
          >
            <Plus size={15} />
            <span>+ Tambah Mapel</span>
          </button>
        </div>
      </div>

      {/* Statistik Ringkas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Total Mapel
          </span>
          <span className="text-2xl font-black text-slate-900 tabular-nums mt-1 block">
            {totalMapel}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Tersimpan di sistem</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
            Wajib & Seni
          </span>
          <span className="text-2xl font-black text-blue-900 tabular-nums mt-1 block">
            {wajibCount + seniCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{wajibCount} Wajib • {seniCount} Seni</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
            Pilihan
          </span>
          <span className="text-2xl font-black text-amber-900 tabular-nums mt-1 block">
            {pilihanCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Dapat dipilih tiap kelas</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
            Muatan Lokal
          </span>
          <span className="text-2xl font-black text-emerald-900 tabular-nums mt-1 block">
            {mulokCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Mulok Daerah</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode atau nama mata pelajaran…"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-kemdikbud-dark focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Fase:</span>
            <select
              value={filterFase}
              onChange={(e) => setFilterFase(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none bg-white font-medium"
            >
              <option value="all">Semua Fase</option>
              <option value="A">Fase A (Kls 1-2)</option>
              <option value="B">Fase B (Kls 3-4)</option>
              <option value="C">Fase C (Kls 5-6)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Kelompok:</span>
            <select
              value={filterKelompok}
              onChange={(e) => setFilterKelompok(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none bg-white font-medium"
            >
              <option value="all">Semua Kelompok</option>
              <option value="wajib">Wajib</option>
              <option value="seni">Seni Budaya</option>
              <option value="pilihan">Pilihan</option>
              <option value="mulok">Muatan Lokal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabel Master Mapel Admin */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 text-center w-14">Urutan</th>
                <th className="py-3 px-4 w-28">Kode</th>
                <th className="py-3 px-4">Nama Mata Pelajaran</th>
                <th className="py-3 px-4 text-center w-32">Kelompok</th>
                <th className="py-3 px-4 text-center w-36">Fase Berlaku</th>
                <th className="py-3 px-4 text-center w-24">Status</th>
                <th className="py-3 px-4 text-right w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adminMapelList.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3.5 px-4 text-center font-bold text-slate-500 tabular-nums">
                    {m.urutanRapor || m.urutan || '-'}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-kemdikbud-dark">
                    {m.kode || m.singkatan || '-'}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{m.nama}</div>
                    {m.varianAgama && m.varianAgama.length > 0 && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {m.varianAgama.length} varian agama tersedia
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {renderKelompokBadge(m.kelompok)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {['A', 'B', 'C'].map((f) => {
                        const isMatch = m.faseBerlaku?.includes(f as Fase);
                        return (
                          <span
                            key={f}
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                              isMatch
                                ? 'bg-kemdikbud-dark text-white'
                                : 'bg-slate-100 text-slate-300'
                            }`}
                          >
                            {f}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {m.aktif !== false ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(m)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                        title="Ubah Mapel"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(m)}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                        title="Hapus Mapel"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Admin: Tambah / Edit Mapel */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-800">
                {editingId ? 'Ubah Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAdmin} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode Mapel <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={kode}
                    onChange={(e) => setKode(e.target.value.toUpperCase())}
                    placeholder="Contoh: MTK"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Mata Pelajaran <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Contoh: Matematika"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kelompok Kurikulum</label>
                  <select
                    value={kelompok}
                    onChange={(e) => setKelompok(e.target.value as KelompokMapel)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none font-medium"
                  >
                    <option value="wajib">Wajib Kurikulum</option>
                    <option value="seni">Seni dan Budaya</option>
                    <option value="pilihan">Pilihan</option>
                    <option value="mulok">Muatan Lokal</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Urutan di Rapor
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={urutanRapor}
                    onChange={(e) => setUrutanRapor(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Fase yang Berlaku <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['A', 'B', 'C'] as Fase[]).map((f) => {
                    const checked = faseBerlaku.includes(f);
                    const label =
                      f === 'A' ? 'Fase A (Kelas 1–2)' : f === 'B' ? 'Fase B (Kelas 3–4)' : 'Fase C (Kelas 5–6)';

                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => handleToggleFase(f)}
                        className={`p-2.5 rounded-xl border text-left font-semibold transition ${
                          checked
                            ? 'bg-blue-50 border-kemdikbud-dark text-kemdikbud-dark'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">{f}</span>
                          {checked && <Check size={14} />}
                        </div>
                        <div className="text-[10px] font-normal text-slate-500 mt-0.5">{label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aktif}
                    onChange={(e) => setAktif(e.target.checked)}
                    className="w-4 h-4 rounded text-kemdikbud-dark focus:ring-kemdikbud-dark"
                  />
                  <span className="font-semibold text-slate-700">Mata pelajaran aktif</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white font-bold rounded-xl shadow-xs"
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
