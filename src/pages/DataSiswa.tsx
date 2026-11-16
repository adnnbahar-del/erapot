import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Siswa, KelasSiswa, JenisKelamin } from '../types';
import * as XLSX from 'xlsx';
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
} from 'lucide-react';

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
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importIgnoredCount, setImportIgnoredCount] = useState(0);
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
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        // Cari sheet 'DATA SISWA' atau sheet pertama
        let targetSheetName = wb.SheetNames.find(
          (name) => name.toUpperCase().replace(/\s+/g, '') === 'DATASISWA'
        );
        if (!targetSheetName) targetSheetName = wb.SheetNames[0];

        const sheet = wb.Sheets[targetSheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Cari baris header yang memuat 'NAMA PESERTA DIDIK' atau 'NAMA'
        let headerRowIndex = -1;
        for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
          const row = rawRows[r];
          if (
            row &&
            row.some((cell: any) =>
              String(cell || '').toUpperCase().includes('NAMA')
            )
          ) {
            headerRowIndex = r;
            break;
          }
        }

        if (headerRowIndex === -1) {
          throw new Error("Tidak dapat menemukan kolom header 'NAMA PESERTA DIDIK' pada file Excel.");
        }

        const headers: string[] = rawRows[headerRowIndex].map((h) =>
          String(h || '').trim().toUpperCase()
        );

        // Petakan kolom berdasarkan nama header (bukan posisi tetap!)
        const colMap: Record<string, number> = {};
        headers.forEach((h, idx) => {
          if (h.includes('NISN')) colMap['nisn'] = idx;
          else if (h.includes('NIS')) colMap['nis'] = idx;
          else if (h.includes('NAMA')) colMap['nama'] = idx;
          else if (h.includes('L/P') || h.includes('JK') || h.includes('KELAMIN')) colMap['jk'] = idx;
          else if (h.includes('TEMPAT LAHIR') || h.includes('TEMPAT')) colMap['tempat_lahir'] = idx;
          else if (h.includes('TANGGAL LAHIR') || h.includes('TGL')) colMap['tanggal_lahir'] = idx;
          else if (h.includes('AGAMA')) colMap['agama'] = idx;
          else if (h.includes('PENDIDIKAN')) colMap['pendidikan_sebelumnya'] = idx;
          else if (h.includes('ALAMAT PESERTA') || (h.includes('ALAMAT') && !h.includes('ORTU') && !h.includes('WALI'))) colMap['alamat'] = idx;
          else if (h.includes('AYAH') && !h.includes('PEKERJAAN')) colMap['nama_ayah'] = idx;
          else if (h.includes('IBU') && !h.includes('PEKERJAAN')) colMap['nama_ibu'] = idx;
          else if (h.includes('PEKERJAAN AYAH')) colMap['pekerjaan_ayah'] = idx;
          else if (h.includes('PEKERJAAN IBU')) colMap['pekerjaan_ibu'] = idx;
          else if (h.includes('JALAN')) colMap['alamat_ortu_jalan'] = idx;
          else if (h.includes('DESA') || h.includes('KELURAHAN')) colMap['alamat_ortu_desa'] = idx;
          else if (h.includes('KECAMATAN')) colMap['alamat_ortu_kecamatan'] = idx;
          else if (h.includes('KABUPATEN') || h.includes('KOTA')) colMap['alamat_ortu_kabupaten'] = idx;
          else if (h.includes('PROVINSI')) colMap['alamat_ortu_provinsi'] = idx;
          else if (h.includes('WALI') && !h.includes('PEKERJAAN') && !h.includes('ALAMAT')) colMap['nama_wali'] = idx;
          else if (h.includes('PEKERJAAN WALI')) colMap['pekerjaan_wali'] = idx;
          else if (h.includes('ALAMAT WALI')) colMap['alamat_wali'] = idx;
          else if (h.includes('TELEPON') || h.includes('HP') || h.includes('KONTAK')) colMap['telepon'] = idx;
        });

        const parsedList: any[] = [];
        for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length === 0) continue;

          const rawNama = row[colMap['nama']];
          if (!rawNama || String(rawNama).trim() === '' || String(rawNama).trim() === '0') {
            continue; // Lewati baris kosong atau nama '0'
          }

          let rawJK = String(row[colMap['jk']] || 'L').trim().toUpperCase();
          if (rawJK.startsWith('P') || rawJK.includes('PEREMPUAN')) rawJK = 'P';
          else rawJK = 'L';

          let rawNisn = String(row[colMap['nisn']] || '').trim();
          // Pad or clean string
          if (rawNisn === '0') rawNisn = '';

          parsedList.push({
            nama: String(rawNama).trim(),
            nis: String(row[colMap['nis']] || '').trim(),
            nisn: rawNisn,
            jk: rawJK as JenisKelamin,
            tempat_lahir: String(row[colMap['tempat_lahir']] || '').trim(),
            tanggal_lahir: String(row[colMap['tanggal_lahir']] || '').trim(),
            agama: String(row[colMap['agama']] || 'Islam').trim(),
            pendidikan_sebelumnya: String(row[colMap['pendidikan_sebelumnya']] || '').trim(),
            alamat: String(row[colMap['alamat']] || '').trim(),
            nama_ayah: String(row[colMap['nama_ayah']] || '').trim(),
            nama_ibu: String(row[colMap['nama_ibu']] || '').trim(),
            pekerjaan_ayah: String(row[colMap['pekerjaan_ayah']] || '').trim(),
            pekerjaan_ibu: String(row[colMap['pekerjaan_ibu']] || '').trim(),
            alamat_ortu_jalan: String(row[colMap['alamat_ortu_jalan']] || '').trim(),
            alamat_ortu_desa: String(row[colMap['alamat_ortu_desa']] || '').trim(),
            alamat_ortu_kecamatan: String(row[colMap['alamat_ortu_kecamatan']] || '').trim(),
            alamat_ortu_kabupaten: String(row[colMap['alamat_ortu_kabupaten']] || '').trim(),
            alamat_ortu_provinsi: String(row[colMap['alamat_ortu_provinsi']] || '').trim(),
            nama_wali: String(row[colMap['nama_wali']] || '').trim(),
            pekerjaan_wali: String(row[colMap['pekerjaan_wali']] || '').trim(),
            alamat_wali: String(row[colMap['alamat_wali']] || '').trim(),
            telepon: String(row[colMap['telepon']] || '').trim(),
          });
        }

        // Limit to available slot up to 50
        const availableSlots = maxStudents - studentCount;
        if (availableSlots <= 0) {
          notify(`Kelas ${session.kelas} sudah penuh (50 siswa).`, 'error');
          return;
        }

        const validBatch = parsedList.slice(0, availableSlots);
        const ignored = parsedList.length - validBatch.length;

        setImportPreview(validBatch);
        setImportIgnoredCount(ignored);
        setImportModalOpen(true);
      } catch (err: any) {
        notify(err.message || 'Gagal membaca file Excel', 'error');
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;
    setIsImporting(true);
    try {
      await importSiswaList(importPreview);
      setImportModalOpen(false);
      setImportPreview([]);
    } catch (err: any) {
      notify(err.message || 'Gagal mengimpor siswa', 'error');
    } finally {
      setIsImporting(false);
    }
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

          {/* Import Excel */}
          <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 cursor-pointer shadow-xs transition">
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
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery
                        ? 'Coba gunakan kata kunci pencarian yang lain.'
                        : 'Klik tombol "+ Tambah Siswa" atau "Impor Excel" di atas untuk menambahkan data.'}
                    </p>
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
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle size={18} className="text-emerald-600" />
                  <span>Pratinjau Impor Siswa dari Excel</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Siap menambahkan {importPreview.length} siswa ke Kelas {session.kelas}.
                </p>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {importIgnoredCount > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs">
                <AlertTriangle size={16} className="shrink-0" />
                <span>
                  Perhatian: Terdapat {importIgnoredCount} baris siswa yang dilewati karena batas maksimal kelas adalah 50 siswa.
                </span>
              </div>
            )}

            <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-3 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Peserta Didik</th>
                    <th className="py-2.5 px-3">NIS</th>
                    <th className="py-2.5 px-3">NISN</th>
                    <th className="py-2.5 px-3 text-center">L/P</th>
                    <th className="py-2.5 px-3">Tempat, Tanggal Lahir</th>
                    <th className="py-2.5 px-3">Nama Orang Tua</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importPreview.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{s.nama}</td>
                      <td className="py-2 px-3 tabular-nums">{s.nis || '-'}</td>
                      <td className="py-2 px-3 tabular-nums font-semibold">{s.nisn || '-'}</td>
                      <td className="py-2 px-3 text-center">{s.jk}</td>
                      <td className="py-2 px-3">{s.tempat_lahir}, {s.tanggal_lahir}</td>
                      <td className="py-2 px-3">{s.nama_ayah || s.nama_ibu || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isImporting}
                onClick={handleConfirmImport}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow transition disabled:opacity-50"
              >
                <Upload size={14} />
                <span>{isImporting ? 'Menyimpan ke Database…' : `Konfirmasi Simpan ${importPreview.length} Siswa`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
