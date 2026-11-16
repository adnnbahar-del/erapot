import React, { useState, useEffect, useMemo } from 'react';
import { callApi } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  KeyRound,
  Edit2,
  Check,
  X,
  Copy,
  CheckCheck,
  RefreshCw,
  Plus,
  UserCheck,
  UserX,
  ArrowRightLeft,
  Database,
  Users,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Rombel, TingkatKelas } from '../../types';
import { hurufBerikutnya, faseDariTingkat } from '../../lib/rombel';

interface SafeAkunGuru {
  id: string;
  peran: string;
  kelas: string;
  rombel_id?: string;
  nama: string;
  nip: string;
  aktif: boolean;
  wajib_ganti_sandi?: boolean;
  terakhir_masuk?: string;
  tempPassword?: string;
}

export const AkunGuru: React.FC = () => {
  const {
    data,
    notify,
    confirmModal,
    tambahRombel,
    toggleRombelAktif,
    pindahRombelSiswa,
    ubahModeKelas,
    migrateKeRombel,
  } = useApp();

  const [gurus, setGurus] = useState<SafeAkunGuru[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Wali Rombel State
  const [editingRombel, setEditingRombel] = useState<Rombel | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formNip, setFormNip] = useState('');
  const [formAktif, setFormAktif] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Temporary Passwords State
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal Pindah Rombel State
  const [isPindahModalOpen, setIsPindahModalOpen] = useState(false);
  const [pindahTingkat, setPindahTingkat] = useState<number>(1);
  const [pindahRombelAsal, setPindahRombelAsal] = useState<string>('');
  const [pindahSiswaId, setPindahSiswaId] = useState<string>('');
  const [pindahRombelTujuan, setPindahRombelTujuan] = useState<string>('');
  const [pindahAlasan, setPindahAlasan] = useState<string>('');
  const [isPindahLoading, setIsPindahLoading] = useState(false);

  // Modal Migrasi State
  const [migrationResult, setMigrationResult] = useState<any | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  // Load accounts
  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const list = await callApi<SafeAkunGuru[]>('listAkunGuru');
      setGurus(list || []);

      const rawTemp = localStorage.getItem('erapot_sd_temp_passwords_v2');
      if (rawTemp) {
        const parsed = JSON.parse(rawTemp);
        const map: Record<string, string> = {};
        for (const k in parsed) {
          map[k] = parsed[k].password;
        }
        setTempPasswords(map);
      }
    } catch (err: any) {
      notify(err.message || 'Gagal memuat akun guru.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const rombelList = data?.rombel || [];
  const kelasSiswaList = data?.kelasSiswa || [];
  const siswaList = data?.siswa || [];

  // Group rombel per tingkat 1..6
  const tingkatGroups = useMemo(() => {
    const arr = [1, 2, 3, 4, 5, 6];
    return arr.map((t) => {
      const list = rombelList
        .filter((r) => {
          const tAngka = r.tingkat_angka || r.tingkat || parseInt(r.nama, 10);
          return tAngka === t;
        })
        .sort((a, b) => a.nama.localeCompare(b.nama));
      const tg = (data?.tingkat || []).find((item) => item.angka === t);
      const isSingle = tg?.modeKelas === 'tunggal' || (list.length === 1 && !list[0].huruf);
      const modeKelas: 'tunggal' | 'rombel' = isSingle ? 'tunggal' : 'rombel';
      return {
        tingkat: t,
        fase: faseDariTingkat(t),
        modeKelas,
        rombels: list,
      };
    });
  }, [rombelList, data?.tingkat]);

  // Handler Ganti Mode Kelas (Satu kelas vs Dibagi rombel)
  const handleSwitchMode = (tingkat: number, currentMode: 'tunggal' | 'rombel', targetMode: 'tunggal' | 'rombel') => {
    if (currentMode === targetMode) return;

    if (targetMode === 'rombel') {
      confirmModal(
        `Ubah Tingkat ${tingkat} Menjadi Dibagi Rombel`,
        `Kelas ${tingkat} akan menjadi ${tingkat}A beserta seluruh siswa dan nilainya. Rombel ${tingkat}B dan ${tingkat}C ditambahkan dalam keadaan kosong.`,
        async () => {
          try {
            await ubahModeKelas(tingkat, 'rombel');
            await loadAccounts();
          } catch (err: any) {
            notify(err.message || 'Gagal mengubah mode kelas', 'error');
          }
        }
      );
    } else {
      // Periksa apakah ada 2 atau lebih rombel yang berisi siswa
      const list = rombelList.filter((r) => (r.tingkat_angka || r.tingkat || parseInt(r.nama, 10)) === tingkat);
      const rombelsWithStudents = list.filter((r) =>
        kelasSiswaList.some((ks) => ks.rombel_id === r.id || ks.rombel_id === r.nama || ks.kelas_id === r.id || ks.kelas_id === r.nama)
      );

      if (rombelsWithStudents.length > 1) {
        const names = rombelsWithStudents.map((r) => r.nama).join(' dan ');
        notify(`${names} sama-sama berisi siswa. Pindahkan siswa ke satu rombel dulu, lalu ubah mode kelas.`, 'error');
        return;
      }

      confirmModal(
        `Ubah Tingkat ${tingkat} Menjadi Satu Kelas`,
        `Ubah Tingkat ${tingkat} menjadi Satu kelas (tanpa rombel)? Rombel yang berisi siswa akan menjadi Kelas ${tingkat}, dan rombel kosong lainnya akan dihapus.`,
        async () => {
          try {
            await ubahModeKelas(tingkat, 'tunggal');
            await loadAccounts();
          } catch (err: any) {
            notify(err.message || 'Gagal mengubah mode kelas', 'error');
          }
        }
      );
    }
  };

  // Handle Edit Wali
  const handleStartEdit = (r: Rombel) => {
    setEditingRombel(r);
    setFormNama(r.nama_wali || '');
    setFormNip(r.nip_wali || '');
    setFormAktif(r.aktif);
  };

  const handleSaveRombelWali = async () => {
    if (!editingRombel) return;
    if (!formNama.trim()) {
      notify('Nama wali kelas wajib diisi.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await callApi('simpanAkunGuru', {
        rombel_id: editingRombel.id,
        kelas: editingRombel.nama,
        nama: formNama.trim(),
        nip: formNip.trim(),
        aktif: formAktif,
      });
      notify(`Wali kelas rombel ${editingRombel.nama} berhasil diperbarui.`, 'success');
      setEditingRombel(null);
      await loadAccounts();
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan wali kelas.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (r: Rombel) => {
    confirmModal(
      'Atur Ulang Kata Sandi',
      `Atur ulang kata sandi akun Kelas ${r.nama}? Kata sandi sementara baru akan dibuat.`,
      async () => {
        try {
          const res = await callApi<{ ok: boolean; tempPassword: string }>('resetSandiGuru', {
            rombel_id: r.id,
            kelas: r.nama,
          });
          notify(`Kata sandi Kelas ${r.nama} diatur ulang: ${res.tempPassword}`, 'success');

          setTempPasswords((prev) => ({
            ...prev,
            [r.nama]: res.tempPassword,
          }));

          await loadAccounts();
        } catch (err: any) {
          notify(err.message || 'Gagal mengatur ulang kata sandi.', 'error');
        }
      }
    );
  };

  // Handle Toggle Aktif
  const handleToggleAktif = async (r: Rombel) => {
    const nextStatus = !r.aktif;
    try {
      await toggleRombelAktif(r.id, nextStatus);
      notify(`Rombel ${r.nama} sekarang ${nextStatus ? 'Aktif' : 'Nonaktif'}.`, 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal mengubah status rombel', 'error');
    }
  };

  // Handle Tambah Rombel
  const handleTambahRombel = async (tingkat: number, hurufAda: string[]) => {
    const nextHuruf = hurufBerikutnya(hurufAda);
    const namaBaru = `${tingkat}${nextHuruf}`;

    confirmModal(
      `Tambah Rombel ${namaBaru}`,
      `Apakah Anda yakin ingin menambahkan Rombel ${namaBaru} untuk Tingkat ${tingkat}? Rombel ini akan dibuat aktif beserta akun wali kelas bawaan.`,
      async () => {
        try {
          await tambahRombel(tingkat, nextHuruf);
          notify(`Rombel ${namaBaru} berhasil ditambahkan!`, 'success');
          await loadAccounts();
        } catch (err: any) {
          notify(err.message || 'Gagal menambah rombel', 'error');
        }
      }
    );
  };

  // Pindah Rombel Siswa Logic
  const rombelsInPindahTingkat = useMemo(() => {
    return rombelList.filter((r) => {
      const tAngka = r.tingkat_angka || parseInt(r.nama, 10);
      return tAngka === pindahTingkat && r.aktif;
    });
  }, [rombelList, pindahTingkat]);

  // Set default rombel asal saat pindahTingkat berubah
  useEffect(() => {
    if (rombelsInPindahTingkat.length > 0) {
      setPindahRombelAsal(rombelsInPindahTingkat[0].id);
      if (rombelsInPindahTingkat.length > 1) {
        setPindahRombelTujuan(rombelsInPindahTingkat[1].id);
      }
    }
  }, [rombelsInPindahTingkat]);

  // Daftar siswa di rombel asal
  const siswaDiRombelAsal = useMemo(() => {
    if (!pindahRombelAsal) return [];
    const roster = kelasSiswaList.filter(
      (ks) => ks.rombel_id === pindahRombelAsal || ks.kelas_id === pindahRombelAsal
    );
    return siswaList
      .filter((s) => roster.some((ks) => ks.siswa_id === s.id))
      .map((s) => {
        const ks = roster.find((item) => item.siswa_id === s.id);
        return {
          ...s,
          no_urut: ks?.no_urut || 0,
        };
      })
      .sort((a, b) => a.no_urut - b.no_urut);
  }, [pindahRombelAsal, kelasSiswaList, siswaList]);

  // Set default siswa terpilih
  useEffect(() => {
    if (siswaDiRombelAsal.length > 0) {
      setPindahSiswaId(siswaDiRombelAsal[0].id);
    } else {
      setPindahSiswaId('');
    }
  }, [siswaDiRombelAsal]);

  // Hitung kapasitas rombel tujuan
  const jumlahSiswaRombelTujuan = useMemo(() => {
    if (!pindahRombelTujuan) return 0;
    return kelasSiswaList.filter(
      (ks) => ks.rombel_id === pindahRombelTujuan || ks.kelas_id === pindahRombelTujuan
    ).length;
  }, [pindahRombelTujuan, kelasSiswaList]);

  const isTujuanPenuh = jumlahSiswaRombelTujuan >= 50;

  const handlePindahSiswaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pindahSiswaId || !pindahRombelAsal || !pindahRombelTujuan) {
      notify('Mohon lengkapi data pemindahan siswa.', 'error');
      return;
    }
    if (pindahRombelAsal === pindahRombelTujuan) {
      notify('Rombel tujuan harus berbeda dengan rombel asal.', 'error');
      return;
    }
    if (isTujuanPenuh) {
      notify('Rombel tujuan sudah mencapai batas maksimum 50 siswa!', 'error');
      return;
    }

    setIsPindahLoading(true);
    try {
      const res = await pindahRombelSiswa(
        pindahSiswaId,
        pindahRombelAsal,
        pindahRombelTujuan,
        pindahAlasan
      );
      notify(
        (res as any)?.message || 'Siswa berhasil dipindahkan ke rombel tujuan beserta seluruh nilainya.',
        'success'
      );
      setIsPindahModalOpen(false);
      setPindahAlasan('');
    } catch (err: any) {
      notify(err.message || 'Gagal memindahkan siswa.', 'error');
    } finally {
      setIsPindahLoading(false);
    }
  };

  // Handle Migrasi Data Lama
  const handleRunMigration = () => {
    confirmModal(
      'Migrasi Data Lama ke Rombel',
      'Tindakan ini akan membuat cadangan tab lama (_lama), memetakan kelas I–VI ke 1A–6A, dan memindahkan akun guru serta seluruh nilai siswa. Lanjutkan?',
      async () => {
        setIsMigrating(true);
        try {
          const res = await migrateKeRombel();
          setMigrationResult(res);
          notify('Migrasi berhasil dijalankan!', 'success');
          await loadAccounts();
        } catch (err: any) {
          notify(err.message || 'Gagal menjalankan migrasi', 'error');
        } finally {
          setIsMigrating(false);
        }
      }
    );
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    notify('Kata sandi disalin ke papan klip!', 'info');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const tingkatBisaPindah = useMemo(() => {
    return tingkatGroups.filter(
      (tg) => tg.modeKelas === 'rombel' && tg.rombels.filter((r) => r.aktif).length >= 2
    );
  }, [tingkatGroups]);

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck size={22} className="text-navy-500" />
            <span>Rombel & Akun Guru Wali Kelas</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pengaturan mode kelas (satu kelas atau dibagi rombel), akun wali kelas, kata sandi, dan mutasi kelas siswa
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {tingkatBisaPindah.length > 0 && (
            <button
              onClick={() => {
                setPindahTingkat(tingkatBisaPindah[0].tingkat);
                setIsPindahModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition"
            >
              <ArrowRightLeft size={14} />
              <span>Pindah Rombel Siswa</span>
            </button>
          )}
          <button
            onClick={handleRunMigration}
            disabled={isMigrating}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition"
          >
            <Database size={14} />
            <span>{isMigrating ? 'Memigrasi...' : 'Migrasi Data Lama'}</span>
          </button>
          <button
            onClick={loadAccounts}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {/* Banner Kata Sandi Sementara */}
      {Object.keys(tempPasswords).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <KeyRound size={18} className="text-amber-600" />
              <span>Daftar Kata Sandi Sementara Baru</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {Object.entries(tempPasswords).map(([kls, pass]) => (
              <div
                key={kls}
                className="bg-white border border-amber-200/80 rounded-xl p-2.5 text-center flex flex-col justify-between"
              >
                <span className="text-[11px] font-bold text-slate-600">Kelas {kls}</span>
                <span className="text-xs font-mono font-bold text-amber-900 my-1">{pass}</span>
                <button
                  onClick={() => copyToClipboard(pass, kls)}
                  className="mt-1 flex items-center justify-center gap-1 text-[10px] text-amber-700 font-bold hover:underline"
                >
                  {copiedKey === kls ? <CheckCheck size={12} /> : <Copy size={12} />}
                  <span>{copiedKey === kls ? 'Disalin' : 'Salin'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal / Ringkasan Hasil Migrasi */}
      {migrationResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <CheckCheck size={18} className="text-emerald-600" />
              <span>Ringkasan Hasil Migrasi Data Rombel</span>
            </h3>
            <button
              onClick={() => setMigrationResult(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-emerald-800 mb-3 leading-relaxed">
            {migrationResult.message || 'Data kelas lama I–VI berhasil dimigrasikan ke rombel 1A–6A.'}
          </p>
          {migrationResult.summary && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs bg-white rounded-xl border border-emerald-200">
                <thead>
                  <tr className="bg-emerald-100/60 font-bold text-emerald-900">
                    <th className="py-2 px-3">Nama Tab Data</th>
                    <th className="py-2 px-3 text-right">Baris Dimigrasikan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {Object.entries(migrationResult.summary).map(([tab, count]) => (
                    <tr key={tab}>
                      <td className="py-1.5 px-3 font-mono font-semibold text-slate-700">{tab}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-emerald-800">
                        {String(count)} baris
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Grid Per Tingkat (Kelas 1 - Kelas 6) */}
      <div className="space-y-6">
        {tingkatGroups.map(({ tingkat, fase, modeKelas, rombels }) => {
          const hurufAda = rombels.map((r) => r.huruf || r.nama.replace(/\d/g, ''));
          const displayedRombels = modeKelas === 'tunggal' && rombels.length > 0 ? [rombels[0]] : rombels;

          return (
            <div
              key={tingkat}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
            >
              {/* Header Tingkat */}
              <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-kemdikbud-dark text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    {tingkat}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      Tingkat {tingkat} · Fase {fase}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {modeKelas === 'tunggal'
                        ? 'Mode: Satu kelas (tanpa rombel)'
                        : `${rombels.filter((r) => r.aktif).length} rombel aktif dari ${rombels.length} terdaftar`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Sakelar Segmented Mode Kelas: Satu kelas | Dibagi rombel */}
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode(tingkat, modeKelas, 'tunggal')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        modeKelas === 'tunggal'
                          ? 'bg-white text-kemdikbud-dark shadow-xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Satu kelas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode(tingkat, modeKelas, 'rombel')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        modeKelas === 'rombel'
                          ? 'bg-white text-kemdikbud-dark shadow-xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Dibagi rombel
                    </button>
                  </div>

                  {/* Tombol Tambah Rombel (Hanya Tampil Jika Mode Rombel) */}
                  {modeKelas === 'rombel' && (
                    <button
                      onClick={() => handleTambahRombel(tingkat, hurufAda)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-kemdikbud-dark hover:bg-blue-100 font-bold text-xs border border-blue-200 transition"
                      title="Tambah rombel baru (misalnya D)"
                    >
                      <Plus size={14} />
                      <span>+ Tambah Rombel</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Kartu Rombel */}
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedRombels.map((r) => {
                  const rombelStudentIds = new Set(
                    kelasSiswaList
                      .filter((ks) => ks.rombel_id === r.id || ks.kelas_id === r.id)
                      .map((ks) => ks.siswa_id)
                  );
                  const countSiswa = rombelStudentIds.size;
                  const hasData = countSiswa > 0;
                  const isSingle = !r.huruf || modeKelas === 'tunggal';
                  const titleName = isSingle ? `Kelas ${tingkat}` : `Kelas ${r.nama}`;
                  const badgeName = isSingle ? String(tingkat) : r.nama;

                  return (
                    <div
                      key={r.id}
                      className={`border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                        r.aktif
                          ? 'border-slate-200 bg-white hover:border-blue-300 shadow-2xs'
                          : 'border-slate-200 bg-slate-50/60 opacity-60'
                      }`}
                    >
                      <div>
                        {/* Top Row: Rombel Badge & Active Switch */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-kemdikbud-dark text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                              {badgeName}
                            </span>
                            <div>
                              <h3 className="font-bold text-slate-800 text-sm">{titleName}</h3>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                Fase {fase}
                              </span>
                            </div>
                          </div>

                          {/* Sakelar Aktif */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-500">
                              {r.aktif ? 'Aktif' : 'Nonaktif'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleAktif(r)}
                              className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                                r.aktif ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                              title={r.aktif ? 'Klik untuk menonaktifkan' : 'Klik untuk mengaktifkan'}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                  r.aktif ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Wali Kelas & NIP */}
                        <div className="space-y-1 mb-3 text-xs">
                          <div className="flex items-start justify-between">
                            <span className="text-slate-500 font-medium">Wali Kelas:</span>
                            <span className="font-bold text-slate-800 text-right max-w-[160px] truncate">
                              {r.nama_wali || 'Belum diisi'}
                            </span>
                          </div>
                          <div className="flex items-start justify-between">
                            <span className="text-slate-500 font-medium">NIP:</span>
                            <span className="text-slate-600 font-mono text-right">
                              {r.nip_wali || '-'}
                            </span>
                          </div>
                          <div className="flex items-start justify-between">
                            <span className="text-slate-500 font-medium">Jumlah Siswa:</span>
                            <span className="font-bold tabular-nums text-slate-800">
                              {countSiswa} / 50 siswa
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleStartEdit(r)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                        >
                          <Edit2 size={12} />
                          <span>Ubah Wali</span>
                        </button>

                        <button
                          onClick={() => handleResetPassword(r)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                          title="Atur ulang kata sandi rombel"
                        >
                          <KeyRound size={12} />
                          <span>Atur Ulang Sandi</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Edit Wali Kelas Rombel */}
      {editingRombel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-800">
                Ubah Wali Kelas {editingRombel.nama}
              </h3>
              <button
                onClick={() => setEditingRombel(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveRombelWali();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap Guru & Gelar <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Rika Muslikhah, S.Pd"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 outline-hidden font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">NIP (Opsional)</label>
                <input
                  type="text"
                  value={formNip}
                  onChange={(e) => setFormNip(e.target.value)}
                  placeholder="198501012010012001 atau -"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 outline-hidden tabular-nums font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="font-semibold text-slate-700">Status Akun Rombel</span>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={formAktif}
                    onChange={(e) => setFormAktif(e.target.checked)}
                    className="rounded text-kemdikbud-dark h-4 w-4"
                  />
                  <span>{formAktif ? 'Aktif' : 'Nonaktif'}</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRombel(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white font-bold shadow-xs disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pindah Rombel Siswa */}
      {isPindahModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-purple-600" />
                <h3 className="text-base font-bold text-slate-800">Pindah Rombel Siswa</h3>
              </div>
              <button
                onClick={() => setIsPindahModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePindahSiswaSubmit} className="space-y-4 text-xs">
              <p className="text-slate-500 leading-relaxed">
                Pindahkan siswa ke rombel lain dalam tingkat yang sama. Seluruh nilai formatif,
                sumatif, kehadiran, dan penilaian lainnya akan <strong>ikut berpindah secara utuh</strong>.
              </p>

              {/* 1. Pilih Tingkat */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">1. Pilih Tingkat Kelas</label>
                <select
                  value={pindahTingkat}
                  onChange={(e) => setPindahTingkat(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 outline-hidden"
                >
                  {tingkatBisaPindah.map(({ tingkat: t, fase }) => (
                    <option key={t} value={t}>
                      Kelas {t} (Fase {fase})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Pilih Rombel Asal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">2. Rombel Asal</label>
                  <select
                    value={pindahRombelAsal}
                    onChange={(e) => setPindahRombelAsal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 outline-hidden"
                  >
                    {rombelsInPindahTingkat.map((r) => (
                      <option key={r.id} value={r.id}>
                        Kelas {r.nama}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Pilih Rombel Tujuan */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    3. Rombel Tujuan{' '}
                    <span className="font-normal text-slate-500">
                      ({jumlahSiswaRombelTujuan}/50)
                    </span>
                  </label>
                  <select
                    value={pindahRombelTujuan}
                    onChange={(e) => setPindahRombelTujuan(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 outline-hidden"
                  >
                    {rombelsInPindahTingkat
                      .filter((r) => r.id !== pindahRombelAsal)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          Kelas {r.nama}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Warning jika rombel tujuan penuh */}
              {isTujuanPenuh && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 font-semibold">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>
                    Rombel tujuan sudah penuh (50 / 50 siswa). Pemindahan ke rombel ini tidak dapat
                    dilakukan.
                  </span>
                </div>
              )}

              {/* 4. Pilih Siswa */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  4. Pilih Siswa yang Dipindahkan ({siswaDiRombelAsal.length} siswa tersedia)
                </label>
                {siswaDiRombelAsal.length > 0 ? (
                  <select
                    value={pindahSiswaId}
                    onChange={(e) => setPindahSiswaId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 outline-hidden"
                  >
                    {siswaDiRombelAsal.map((s) => (
                      <option key={s.id} value={s.id}>
                        {String(s.no_urut).padStart(2, '0')}. {s.nama} ({s.nisn || s.nis || 'Tanpa NIS'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-slate-100 rounded-xl text-slate-500 italic">
                    Tidak ada siswa di rombel asal ini.
                  </div>
                )}
              </div>

              {/* 5. Catatan / Alasan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Pemindahan (Catatan Riwayat)
                </label>
                <input
                  type="text"
                  value={pindahAlasan}
                  onChange={(e) => setPindahAlasan(e.target.value)}
                  placeholder="Contoh: Penyeimbangan rasio siswa per kelas"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-hidden"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPindahModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPindahLoading || isTujuanPenuh || siswaDiRombelAsal.length === 0}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold shadow-xs"
                >
                  {isPindahLoading ? 'Memindahkan...' : 'Pindahkan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
