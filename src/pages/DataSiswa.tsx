import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Siswa, KelasSiswa, JenisKelamin } from '../types';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  AlertTriangle,
  Upload,
  CheckCircle,
  Download,
  FileDown,
  Info,
  AlertCircle,
  Check,
} from 'lucide-react';
import {
  unduhTemplateSiswaExcel,
  eksporDataSiswaExcel,
  validasiBerkasSiswaExcel,
  unduhDaftarBarisBermasalah,
  HasilValidasiImportSiswa,
} from '../lib/excelSiswaService';

export const DataSiswa: React.FC = () => {
  const { data, session, addSiswa, updateSiswa, deleteSiswa, importSiswaList, notify, confirmModal } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [currentSiswaId, setCurrentSiswaId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    siswa: Partial<Siswa>;
    kelasSiswa: Partial<KelasSiswa>;
  }>({
    siswa: {
      nis: '',
      nisn: '',
      nama: '',
      jk: 'L',
      tempat_lahir: '',
      tanggal_lahir: '',
      agama: 'Islam',
      pendidikan_sebelumnya: 'TK / RA',
      alamat: '',
      nama_ayah: '',
      nama_ibu: '',
      pekerjaan_ayah: '',
      pekerjaan_ibu: '',
      alamat_ortu_jalan: '',
      alamat_ortu_desa: '',
      alamat_ortu_kecamatan: '',
      alamat_ortu_kabupaten: '',
      alamat_ortu_provinsi: '',
      nama_wali: '',
      pekerjaan_wali: '',
      alamat_wali: '',
      telepon: '',
    },
    kelasSiswa: {
      tinggi_badan: '',
      berat_badan: '',
      pendengaran: 'Baik',
      penglihatan: 'Baik',
      gigi: 'Baik',
      kesehatan_lain: '',
      prestasi_kesenian: '',
      prestasi_olahraga: '',
      prestasi_sains: '',
    },
  });

  // Import Excel State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<HasilValidasiImportSiswa | null>(null);
  const [rawFileBuffer, setRawFileBuffer] = useState<ArrayBuffer | null>(null);
  const [allowUpdateExisting, setAllowUpdateExisting] = useState(true);
  const [importTab, setImportTab] = useState<'all' | 'valid' | 'invalid'>('all');
  const [isImporting, setIsImporting] = useState(false);

  if (!data || !session) return null;

  const currentClassRoster = data.kelasSiswa.filter((ks) => ks.kelas_id === session.kelasId);
  const enrolledStudents = data.siswa
    .filter((s) => currentClassRoster.some((ks) => ks.siswa_id === s.id))
    .map((s) => {
      const ks = currentClassRoster.find((item) => item.siswa_id === s.id);
      return {
        ...s,
        no_urut: ks?.no_urut || 0,
        kelasSiswaData: ks,
      };
    })
    .sort((a, b) => a.no_urut - b.no_urut);

  const studentCount = enrolledStudents.length;
  const maxStudents = 50;

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return enrolledStudents;
    const q = searchQuery.toLowerCase();
    return enrolledStudents.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) ||
        s.nis.includes(q) ||
        s.nisn.includes(q) ||
        s.alamat.toLowerCase().includes(q)
    );
  }, [enrolledStudents, searchQuery]);

  const handleOpenAddModal = () => {
    if (studentCount >= maxStudents) {
      notify(
        `Kelas ${session.kelas} sudah berisi 50 siswa. Hapus atau pindahkan siswa sebelum menambah yang baru.`,
        'error'
      );
      return;
    }
    setFormData({
      siswa: {
        nis: '',
        nisn: '',
        nama: '',
        jk: 'L',
        tempat_lahir: 'Tanggamus',
        tanggal_lahir: '2013-05-10',
        agama: 'Islam',
        pendidikan_sebelumnya: 'TK / RA',
        alamat: '',
        nama_ayah: '',
        nama_ibu: '',
        pekerjaan_ayah: '',
        pekerjaan_ibu: '',
        alamat_ortu_jalan: '',
        alamat_ortu_desa: 'Sukaraja',
        alamat_ortu_kecamatan: 'Semaka',
        alamat_ortu_kabupaten: 'Kabupaten Tanggamus',
        alamat_ortu_provinsi: 'Lampung',
        nama_wali: '',
        pekerjaan_wali: '',
        alamat_wali: '',
        telepon: '',
      },
      kelasSiswa: {
        tinggi_badan: '135',
        berat_badan: '32',
        pendengaran: 'Baik',
        penglihatan: 'Baik',
        gigi: 'Baik',
        kesehatan_lain: '',
        prestasi_kesenian: '',
        prestasi_olahraga: '',
        prestasi_sains: '',
      },
    });
    setModalMode('create');
  };

  const handleOpenEditModal = (s: any) => {
    setCurrentSiswaId(s.id);
    const ks = s.kelasSiswaData;
    setFormData({
      siswa: {
        nis: s.nis,
        nisn: s.nisn,
        nama: s.nama,
        jk: s.jk,
        tempat_lahir: s.tempat_lahir,
        tanggal_lahir: s.tanggal_lahir,
        agama: s.agama,
        pendidikan_sebelumnya: s.pendidikan_sebelumnya,
        alamat: s.alamat,
        nama_ayah: s.nama_ayah,
        nama_ibu: s.nama_ibu,
        pekerjaan_ayah: s.pekerjaan_ayah,
        pekerjaan_ibu: s.pekerjaan_ibu,
        alamat_ortu_jalan: s.alamat_ortu_jalan,
        alamat_ortu_desa: s.alamat_ortu_desa,
        alamat_ortu_kecamatan: s.alamat_ortu_kecamatan,
        alamat_ortu_kabupaten: s.alamat_ortu_kabupaten,
        alamat_ortu_provinsi: s.alamat_ortu_provinsi,
        nama_wali: s.nama_wali,
        pekerjaan_wali: s.pekerjaan_wali,
        alamat_wali: s.alamat_wali,
        telepon: s.telepon,
      },
      kelasSiswa: {
        tinggi_badan: ks?.tinggi_badan || '',
        berat_badan: ks?.berat_badan || '',
        pendengaran: ks?.pendengaran || 'Baik',
        penglihatan: ks?.penglihatan || 'Baik',
        gigi: ks?.gigi || 'Baik',
        kesehatan_lain: ks?.kesehatan_lain || '',
        prestasi_kesenian: ks?.prestasi_kesenian || '',
        prestasi_olahraga: ks?.prestasi_olahraga || '',
        prestasi_sains: ks?.prestasi_sains || '',
      },
    });
    setModalMode('edit');
  };

  const handleDelete = (s: any) => {
    confirmModal(
      'Hapus Siswa',
      `Apakah Anda yakin ingin menghapus siswa ${s.nama} dari Kelas ${session.kelas}? Semua data nilai siswa ini juga akan dibersihkan dari kelas.`,
      () => {
        deleteSiswa(s.id);
      }
    );
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siswa.nama?.trim()) {
      notify('Nama peserta didik wajib diisi.', 'error');
      return;
    }

    try {
      if (modalMode === 'create') {
        await addSiswa(formData.siswa, formData.kelasSiswa);
      } else if (modalMode === 'edit' && currentSiswaId) {
        await updateSiswa(currentSiswaId, formData.siswa, formData.kelasSiswa);
      }
      setModalMode(null);
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan siswa', 'error');
    }
  };

  // --- EXCEL IMPORT LOGIC ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        setRawFileBuffer(buffer);
        const result = validasiBerkasSiswaExcel(
          buffer,
          enrolledStudents,
          studentCount,
          maxStudents,
          allowUpdateExisting
        );
        setValidationResult(result);
        setImportTab(result.invalidCount > 0 && result.validCount === 0 ? 'invalid' : 'all');
        setImportModalOpen(true);
      } catch (err: any) {
        notify(err.message || 'Gagal membaca berkas Excel.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleToggleUpdateExisting = (checked: boolean) => {
    setAllowUpdateExisting(checked);
    if (rawFileBuffer) {
      try {
        const result = validasiBerkasSiswaExcel(
          rawFileBuffer,
          enrolledStudents,
          studentCount,
          maxStudents,
          checked
        );
        setValidationResult(result);
      } catch {}
    }
  };

  const handleConfirmImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) return;
    setIsImporting(true);
    try {
      await importSiswaList(validationResult.validRows);
      setImportModalOpen(false);
      setValidationResult(null);
      setRawFileBuffer(null);
    } catch (err: any) {
      notify(err.message || 'Gagal mengimpor siswa', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadInvalid = () => {
    if (!validationResult || validationResult.invalidRows.length === 0) return;
    unduhDaftarBarisBermasalah(validationResult.invalidRows, session.kelas);
    notify('Daftar baris bermasalah berhasil diunduh.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-kemdikbud-dark">
            <Users size={22} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Data Peserta Didik
              </h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 tabular-nums">
                {studentCount} / {maxStudents} Siswa
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelas {session.kelas} · {session.tahunAjaran}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={15} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama / NIS / NISN…"
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 w-48 sm:w-56"
            />
          </div>

          {/* Unduh Template */}
          <button
            type="button"
            onClick={() => {
              unduhTemplateSiswaExcel({
                namaSekolah: data.sekolah?.nama,
                namaKelas: session.kelas,
                tahunAjaran: session.tahunAjaran,
              });
              notify('Template Excel Data Siswa berhasil diunduh.', 'success');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-kemdikbud-dark text-xs font-bold border border-blue-200 shadow-xs transition"
            title="Unduh Template Excel untuk mengisi data siswa secara massal"
          >
            <Download size={15} />
            <span>Unduh Template</span>
          </button>

          {/* Ekspor Excel */}
          <button
            type="button"
            disabled={enrolledStudents.length === 0}
            onClick={() => {
              eksporDataSiswaExcel({
                namaSekolah: data.sekolah?.nama || 'SD',
                namaKelas: session.kelas,
                tahunAjaran: session.tahunAjaran,
                siswaList: enrolledStudents,
                kelasSiswaList: currentClassRoster,
              });
              notify('Data siswa berhasil diekspor ke Excel.', 'success');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 shadow-xs transition disabled:opacity-50"
            title="Ekspor data siswa kelas saat ini ke format Excel"
          >
            <FileDown size={15} className="text-blue-600" />
            <span>Ekspor Excel</span>
          </button>

          {/* Impor Excel */}
          <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 cursor-pointer shadow-xs transition">
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>Impor Excel</span>
            <input
              type="file"
              accept=".xlsx, .xlsm, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Add Manual */}
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white text-xs font-bold shadow-xs transition"
          >
            <UserPlus size={15} />
            <span>+ Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Main Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-3">NIS</th>
                <th className="py-3 px-3">NISN</th>
                <th className="py-3 px-3">Nama Peserta Didik</th>
                <th className="py-3 px-3 text-center w-14">L/P</th>
                <th className="py-3 px-3">Tempat, Tgl Lahir</th>
                <th className="py-3 px-3">Nama Orang Tua</th>
                <th className="py-3 px-3">Alamat</th>
                <th className="py-3 px-3 text-right w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 text-center font-bold text-slate-500 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 tabular-nums font-mono text-slate-600">
                      {s.nis || '-'}
                    </td>
                    <td className="py-3 px-3 tabular-nums font-mono font-semibold text-slate-800">
                      {s.nisn || '-'}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {s.nama}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.jk === 'L'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {s.jk}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {s.tempat_lahir ? `${s.tempat_lahir}, ` : ''}{s.tanggal_lahir || '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>Ayah: {s.nama_ayah || '-'}</div>
                      <div className="text-[11px] text-slate-400">Ibu: {s.nama_ibu || '-'}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                      {s.alamat || '-'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                          title="Ubah Data"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                          title="Hapus Siswa"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <Users size={36} className="mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-sm text-slate-600">
                      {searchQuery
                        ? 'Tidak ada siswa yang sesuai pencarian.'
                        : 'Belum ada siswa di kelas ini.'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">
                      {searchQuery
                        ? 'Coba gunakan kata kunci pencarian yang lain.'
                        : 'Mulai dengan mengunduh template Excel, menambah manual, atau mengimpor data.'}
                    </p>
                    {!searchQuery && (
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            unduhTemplateSiswaExcel({
                              namaSekolah: data.sekolah?.nama,
                              namaKelas: session.kelas,
                              tahunAjaran: session.tahunAjaran,
                            });
                            notify('Template Excel Data Siswa berhasil diunduh.', 'success');
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-kemdikbud-dark text-xs font-bold border border-blue-200 transition"
                        >
                          <Download size={14} />
                          <span>Unduh Template</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenAddModal}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white text-xs font-bold shadow-xs transition"
                        >
                          <UserPlus size={14} />
                          <span>Tambah Siswa</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Tambah / Ubah Siswa (Comprehensive Drawer Form) */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-kemdikbud-dark text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {modalMode === 'create' ? 'Tambah Peserta Didik Baru' : 'Ubah Data Peserta Didik'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-white/80 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-6 text-xs max-h-[75vh] overflow-y-auto">
              {/* Bagian A: Identitas Diri */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
                  A. Identitas Peserta Didik
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.siswa.nama || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, nama: e.target.value },
                        })
                      }
                      required
                      placeholder="Contoh: AHMAD FAHRI"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                    <select
                      value={formData.siswa.jk || 'L'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, jk: e.target.value as JenisKelamin },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    >
                      <option value="L">L (Laki-Laki)</option>
                      <option value="P">P (Perempuan)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NIS</label>
                    <input
                      type="text"
                      value={formData.siswa.nis || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, nis: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NISN (10 Digit)</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={formData.siswa.nisn || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, nisn: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Agama</label>
                    <input
                      type="text"
                      value={formData.siswa.agama || 'Islam'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, agama: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tempat Lahir</label>
                    <input
                      type="text"
                      value={formData.siswa.tempat_lahir || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, tempat_lahir: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={formData.siswa.tanggal_lahir || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, tanggal_lahir: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pendidikan Sebelumnya</label>
                    <input
                      type="text"
                      value={formData.siswa.pendidikan_sebelumnya || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, pendidikan_sebelumnya: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-700 mb-1">Alamat Peserta Didik</label>
                    <input
                      type="text"
                      value={formData.siswa.alamat || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, alamat: e.target.value },
                        })
                      }
                      placeholder="Jalan, RT/RW, Dusun"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian B: Orang Tua & Wali */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
                  B. Data Orang Tua / Wali
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Ayah</label>
                    <input
                      type="text"
                      value={formData.siswa.nama_ayah || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, nama_ayah: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pekerjaan Ayah</label>
                    <input
                      type="text"
                      value={formData.siswa.pekerjaan_ayah || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, pekerjaan_ayah: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Ibu</label>
                    <input
                      type="text"
                      value={formData.siswa.nama_ibu || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, nama_ibu: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pekerjaan Ibu</label>
                    <input
                      type="text"
                      value={formData.siswa.pekerjaan_ibu || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, pekerjaan_ibu: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Wali (Jika ada)</label>
                    <input
                      type="text"
                      value={formData.siswa.nama_wali || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, nama_wali: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pekerjaan Wali</label>
                    <input
                      type="text"
                      value={formData.siswa.pekerjaan_wali || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          siswa: { ...formData.siswa, pekerjaan_wali: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian C: Fisik, Kesehatan & Prestasi */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
                  C. Perkembangan Fisik & Kesehatan
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tinggi Badan (cm)</label>
                    <input
                      type="text"
                      value={formData.kelasSiswa.tinggi_badan || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          kelasSiswa: { ...formData.kelasSiswa, tinggi_badan: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Berat Badan (kg)</label>
                    <input
                      type="text"
                      value={formData.kelasSiswa.berat_badan || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          kelasSiswa: { ...formData.kelasSiswa, berat_badan: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pendengaran</label>
                    <input
                      type="text"
                      value={formData.kelasSiswa.pendengaran || 'Baik'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          kelasSiswa: { ...formData.kelasSiswa, pendengaran: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Penglihatan</label>
                    <input
                      type="text"
                      value={formData.kelasSiswa.penglihatan || 'Baik'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          kelasSiswa: { ...formData.kelasSiswa, penglihatan: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white font-bold shadow transition"
                >
                  <Save size={15} />
                  <span>Simpan Data</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Pratinjau Impor Excel */}
      {importModalOpen && validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Pratinjau Impor Data Siswa
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Kelas {session.kelas} · {session.tahunAjaran} · Deteksi Header Otomatis
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    unduhTemplateSiswaExcel({
                      namaSekolah: data.sekolah?.nama,
                      namaKelas: session.kelas,
                      tahunAjaran: session.tahunAjaran,
                    });
                    notify('Template Excel Data Siswa berhasil diunduh.', 'success');
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition"
                  title="Unduh format template resmi jika diperlukan"
                >
                  <Download size={13} />
                  <span>Unduh Template</span>
                </button>
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Baris File</div>
                  <div className="text-xl font-bold text-slate-800 mt-1 tabular-nums">{validationResult.totalRows}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Baris data terdeteksi</div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle size={13} />
                    <span>Baris Valid</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-800 mt-1 tabular-nums">{validationResult.validCount}</div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">Siap disimpan ke kelas</div>
                </div>

                <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={13} />
                    <span>Bermasalah</span>
                  </div>
                  <div className="text-xl font-bold text-rose-800 mt-1 tabular-nums">{validationResult.invalidCount}</div>
                  <div className="text-[11px] text-rose-600 mt-0.5">Tidak dapat diimpor</div>
                </div>

                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                    <Info size={13} />
                    <span>Keterangan</span>
                  </div>
                  <div className="text-sm font-bold text-blue-900 mt-1">
                    {validationResult.existingCount > 0
                      ? `${validationResult.existingCount} siswa lama`
                      : 'Semua siswa baru'}
                  </div>
                  <div className="text-[11px] text-blue-600 mt-0.5">
                    {validationResult.exampleCount > 0
                      ? `${validationResult.exampleCount} baris contoh diabaikan`
                      : 'Tidak ada baris contoh'}
                  </div>
                </div>
              </div>

              {/* Alert Kuota atau Contoh jika ada */}
              {validationResult.quotaExceededCount > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Batas Kuota Kelas:</span> Terdapat{' '}
                    <span className="font-bold">{validationResult.quotaExceededCount}</span> siswa yang melebihi kapasitas maksimal kelas ({maxStudents} siswa). Baris-baris tersebut otomatis ditolak.
                  </div>
                </div>
              )}

              {/* Toggle Opsi: Perbarui Siswa Eksisting */}
              {validationResult.existingCount > 0 && (
                <div className="p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-blue-600 shrink-0" />
                    <span className="text-slate-700">
                      Terdeteksi <strong className="text-blue-900">{validationResult.existingCount} siswa</strong> dengan NISN yang sudah terdaftar di kelas ini.
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 font-semibold text-blue-900 select-none">
                    <input
                      type="checkbox"
                      checked={allowUpdateExisting}
                      onChange={(e) => handleToggleUpdateExisting(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>Perbarui data siswa yang sudah ada</span>
                  </label>
                </div>
              )}

              {/* Filter Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setImportTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      importTab === 'all'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Semua ({validationResult.totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportTab('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      importTab === 'valid'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    Hanya Valid ({validationResult.validCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportTab('invalid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      importTab === 'invalid'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    Bermasalah ({validationResult.invalidCount})
                  </button>
                </div>

                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Baris berwarna hijau siap diimpor; baris merah memiliki catatan perbaikan.
                </span>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">No</th>
                      <th className="py-2.5 px-3 text-center w-28">Status</th>
                      <th className="py-2.5 px-3">Nama Lengkap</th>
                      <th className="py-2.5 px-3 text-center w-12">L/P</th>
                      <th className="py-2.5 px-3">NIS</th>
                      <th className="py-2.5 px-3">NISN</th>
                      <th className="py-2.5 px-3">Tempat, Tgl Lahir</th>
                      <th className="py-2.5 px-3">Catatan / Alasan Masalah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(importTab === 'valid'
                      ? validationResult.validRows
                      : importTab === 'invalid'
                      ? validationResult.invalidRows
                      : validationResult.rows
                    ).map((r, idx) => (
                      <tr
                        key={idx}
                        className={`transition ${
                          r.isValid
                            ? 'hover:bg-emerald-50/40 bg-emerald-50/15'
                            : 'hover:bg-rose-50/60 bg-rose-50/30'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {r.isValid ? (
                            r.isExisting ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                <Check size={11} />
                                <span>Perbarui</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <Check size={11} />
                                <span>Valid</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <AlertCircle size={11} />
                              <span>Bermasalah</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {r.nama || <span className="text-red-500 italic">(kosong)</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {r.jk ? (
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                r.jk === 'L'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {r.jk}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums font-mono text-slate-600">
                          {r.nis || '-'}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums font-mono font-semibold text-slate-800">
                          {r.nisn || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.tempat_lahir ? `${r.tempat_lahir}, ` : ''}
                          {r.tanggal_lahir_raw || '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          {r.isValid ? (
                            <span className="text-emerald-700 text-[11px] font-medium">
                              {r.isExisting
                                ? 'Data siswa akan diperbarui'
                                : 'Siap ditambahkan sebagai siswa baru'}
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              {r.errors.map((err, eIdx) => (
                                <div key={eIdx} className="text-rose-700 text-[11px] font-semibold flex items-center gap-1">
                                  <span>•</span>
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500">
                {validationResult.validCount > 0 ? (
                  <span>
                    Klik tombol simpan untuk memasukkan{' '}
                    <strong className="text-slate-800 font-bold">
                      {validationResult.validCount} siswa valid
                    </strong>{' '}
                    ke database kelas.
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold">
                    Tidak ada baris siswa valid untuk diimpor. Silakan periksa berkas Excel Anda.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition"
                >
                  Batal
                </button>

                {validationResult.invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadInvalid}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 shadow-xs transition"
                    title="Unduh berkas Excel yang hanya berisi baris-baris bermasalah beserta kolom alasan"
                  >
                    <Download size={14} />
                    <span>Unduh Baris Bermasalah ({validationResult.invalidCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={validationResult.validCount === 0 || isImporting}
                  onClick={handleConfirmImport}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload size={14} />
                  <span>
                    {isImporting
                      ? 'Menyimpan ke Database…'
                      : `Simpan ${validationResult.validCount} Siswa Valid`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
