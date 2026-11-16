import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { calculateRekapDanPeringkat, calcNALingkupMateri, calcNAAkhirSemester, calcNilaiRapor } from '../lib/rapor';
import { getMapelForSession } from '../lib/mapelService';
import { Medal, Award, MessageSquare, ChevronRight, HelpCircle, Check, X, FileText } from 'lucide-react';

const QUICK_CATATAN = [
  'Kamu hebat! Prestasimu luar biasa. Pertahankan prestasi dan nilaimu, nak.',
  'Kamu termasuk siswa yang cerdas. Jaga pola belajarmu agar prestasi tetap stabil dan meningkat.',
  'Teruslah meningkatkan semangat belajarmu agar prestasi terbaik dapat kamu capai di masa depan.',
  'Belajarlah dengan hati yang gembira dan pikiran yang positif. Semangat yang tulus akan memudahkanmu meraih prestasi.',
  'Tingkatkan lagi waktu belajar di rumah, kurangi bermain handphone dan/atau main di luar rumah.',
];

const getContohDeskripsiEkskul = (namaEkskul: string): string => {
  const nama = (namaEkskul || '').toLowerCase();
  if (nama.includes('pramuka')) {
    return 'Sangat aktif dalam kegiatan kepramukaan, terampil dalam baris-berbaris dan tali temali.';
  }
  if (nama.includes('tari')) {
    return 'Menunjukkan keluwesan gerak dan penguasaan teknik dasar seni tari tradisional dengan sangat baik.';
  }
  if (nama.includes('musik') || nama.includes('paduan suara') || nama.includes('vokal') || nama.includes('angklung')) {
    return 'Mampu mengikuti tempo dan ritme lagu dengan harmonis serta berpartisipasi aktif dalam latihan.';
  }
  if (nama.includes('drumband') || nama.includes('marching')) {
    return 'Disiplin dan kompak dalam barisan serta terampil memainkan instrumen musik dengan ritmis.';
  }
  if (nama.includes('olahraga') || nama.includes('futsal') || nama.includes('sepak') || nama.includes('voli') || nama.includes('badminton') || nama.includes('bulutangkis')) {
    return 'Menunjukkan sportivitas tinggi, stamina fisik yang prima, dan penguasaan teknik dasar olahraga.';
  }
  if (nama.includes('silat') || nama.includes('karate') || nama.includes('taekwondo') || nama.includes('bela diri')) {
    return 'Memiliki kedisiplinan diri yang tinggi dan menguasai rangkaian jurus dasar bela diri dengan baik.';
  }
  if (nama.includes('lukis') || nama.includes('gambar') || nama.includes('rupa')) {
    return 'Kreatif dalam memadukan warna serta mampu mengekspresikan imajinasi visual secara rapi dan estetis.';
  }
  if (nama.includes('renang')) {
    return 'Menguasai teknik dasar pernapasan dan luncuran renang dengan penuh percaya diri.';
  }
  if (nama.includes('tahfidz') || nama.includes('quran') || nama.includes('mengaji')) {
    return 'Mampu menghafal ayat-ayat pilihan dengan tartil, makhraj, dan kaidah tajwid yang baik.';
  }
  if (nama.includes('komputer') || nama.includes('tik') || nama.includes('it') || nama.includes('coding')) {
    return 'Mampu mengoperasikan perangkat komputer dan aplikasi produktivitas dasar secara mandiri.';
  }
  if (nama.includes('catur')) {
    return 'Menunjukkan ketelitian, ketenangan, dan kecakapan dalam menyusun strategi permainan catur.';
  }
  if (nama.includes('pmr') || nama.includes('uks') || nama.includes('kesehatan') || nama.includes('dokcil')) {
    return 'Cekatan dan peduli dalam pertolongan pertama serta aktif menjaga kesehatan lingkungan sekolah.';
  }
  if (nama.includes('bahasa') || nama.includes('english')) {
    return 'Percaya diri dalam berkomunikasi dan memiliki perbendaharaan kosakata yang berkembang baik.';
  }
  return 'Menunjukkan keaktifan, kedisiplinan, dan perkembangan minat yang sangat baik dalam kegiatan ini.';
};

export const Penilaian: React.FC = () => {
  const { data, session, queueBatchUpsert, notify } = useApp();

  if (!data || !session) return null;

  const currentClassRoster = data.kelasSiswa.filter((ks) => ks.kelas_id === session.kelasId);
  const enrolledStudents = data.siswa
    .filter((s) => currentClassRoster.some((ks) => ks.siswa_id === s.id))
    .map((s) => {
      const ks = currentClassRoster.find((item) => item.siswa_id === s.id);
      return {
        ...s,
        no_urut: ks?.no_urut || 0,
      };
    })
    .sort((a, b) => a.no_urut - b.no_urut);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return enrolledStudents[0]?.id || '';
  });

  const classMapel = getMapelForSession(data.mapel, session);

  // Pre-calculate rankings for all students
  const studentScoresGrid = useMemo(() => {
    return enrolledStudents.map((s) => {
      const scores = classMapel.map((m) => {
        const mapelLMs = data.lm.filter((l) => l.mapel_id === m.id);
        const lmValues = mapelLMs.map((lm) => {
          const entry = data.sumatifLM.find((row) => row.siswa_id === s.id && row.lm_id === lm.id);
          return entry ? entry.nilai : null;
        });

        const semEntry = data.sumatifSemester.find((row) => row.siswa_id === s.id && row.mapel_id === m.id);
        const pts = semEntry?.pts ?? null;
        const pas = semEntry?.pas ?? null;

        const naLM = calcNALingkupMateri(lmValues);
        const naAkhir = calcNAAkhirSemester(pts, pas);
        return calcNilaiRapor(naLM, naAkhir);
      });

      return {
        id: s.id,
        nama: s.nama,
        nilaiMapel: scores,
      };
    });
  }, [enrolledStudents, classMapel, data.lm, data.sumatifLM, data.sumatifSemester]);

  const rekapOutputs = useMemo(() => {
    return calculateRekapDanPeringkat(studentScoresGrid, classMapel.length);
  }, [studentScoresGrid, classMapel.length]);

  const activeStudent = enrolledStudents.find((s) => s.id === selectedStudentId) || enrolledStudents[0];
  const activeRekap = rekapOutputs.find((r) => r.id === activeStudent?.id);

  // Catatan wali record dari Firestore / Context
  const catatanRecord = data.catatanWali.find(
    (c) => c.siswa_id === activeStudent?.id && c.kelas_id === session.kelasId
  ) || {
    siswa_id: activeStudent?.id || '',
    kelas_id: session.kelasId,
    catatan: '',
    keputusan_naik: session.semester === 2 ? 'Naik ke Kelas VII (Tujuh)' : null,
  };

  // State lokal untuk Catatan Wali Kelas (instant typing, debounce 800ms)
  const [localCatatan, setLocalCatatan] = useState<string>(catatanRecord.catatan || '');
  const [isDirtyCatatan, setIsDirtyCatatan] = useState<boolean>(false);
  const catatanDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const prevStudentIdRef = useRef<string>(activeStudent?.id || '');

  // Modal / dialog konfirmasi Pilihan Cepat Catatan
  const [confirmPreset, setConfirmPreset] = useState<{ isOpen: boolean; presetText: string } | null>(null);

  // Sinkronisasi catatan ketika siswa berubah
  useEffect(() => {
    if (activeStudent && activeStudent.id !== prevStudentIdRef.current) {
      // Flush perubahan siswa lama jika dirty
      if (isDirtyCatatan && prevStudentIdRef.current) {
        queueBatchUpsert(
          'catatan_wali',
          [
            {
              siswa_id: prevStudentIdRef.current,
              kelas_id: session.kelasId,
              catatan: localCatatan,
              keputusan_naik: catatanRecord.keputusan_naik,
            },
          ],
          ['siswa_id', 'kelas_id']
        );
      }
      if (catatanDebounceTimer.current) {
        clearTimeout(catatanDebounceTimer.current);
        catatanDebounceTimer.current = null;
      }

      // Ambil data catatan untuk siswa baru
      const newRec = data.catatanWali.find(
        (c) => c.siswa_id === activeStudent.id && c.kelas_id === session.kelasId
      );
      setLocalCatatan(newRec?.catatan || '');
      setIsDirtyCatatan(false);
      prevStudentIdRef.current = activeStudent.id;
    }
  }, [activeStudent?.id, session.kelasId, isDirtyCatatan, localCatatan, catatanRecord.keputusan_naik, data.catatanWali, queueBatchUpsert]);

  // Sinkronkan localCatatan jika data di store berubah dari luar dan tidak sedang diedit
  useEffect(() => {
    if (!isDirtyCatatan && activeStudent) {
      const currentRemote = data.catatanWali.find(
        (c) => c.siswa_id === activeStudent.id && c.kelas_id === session.kelasId
      );
      if (currentRemote && currentRemote.catatan !== localCatatan) {
        setLocalCatatan(currentRemote.catatan || '');
      }
    }
  }, [data.catatanWali, activeStudent, session.kelasId, isDirtyCatatan]);

  // Fungsi simpan catatan ke Firestore
  const saveCatatanNow = (text: string) => {
    if (!activeStudent) return;
    if (catatanDebounceTimer.current) {
      clearTimeout(catatanDebounceTimer.current);
      catatanDebounceTimer.current = null;
    }
    setIsDirtyCatatan(false);
    queueBatchUpsert(
      'catatan_wali',
      [
        {
          siswa_id: activeStudent.id,
          kelas_id: session.kelasId,
          catatan: text,
          keputusan_naik: catatanRecord.keputusan_naik,
        },
      ],
      ['siswa_id', 'kelas_id']
    );
  };

  // Handler input catatan (instant update + 800ms debounce)
  const handleCatatanChange = (val: string) => {
    setLocalCatatan(val);
    setIsDirtyCatatan(true);

    if (catatanDebounceTimer.current) {
      clearTimeout(catatanDebounceTimer.current);
    }
    catatanDebounceTimer.current = setTimeout(() => {
      saveCatatanNow(val);
    }, 800);
  };

  const handleCatatanBlur = () => {
    if (isDirtyCatatan) {
      saveCatatanNow(localCatatan);
    }
  };

  // Handler Pilihan Cepat: jika sudah ada teks, tampilkan pilihan ganti atau tambahkan
  const handleSelectQuickPreset = (preset: string) => {
    if (localCatatan.trim().length === 0) {
      setLocalCatatan(preset);
      saveCatatanNow(preset);
    } else {
      setConfirmPreset({ isOpen: true, presetText: preset });
    }
  };

  const applyPresetReplace = () => {
    if (!confirmPreset) return;
    setLocalCatatan(confirmPreset.presetText);
    saveCatatanNow(confirmPreset.presetText);
    setConfirmPreset(null);
  };

  const applyPresetAppend = () => {
    if (!confirmPreset) return;
    const combined = `${localCatatan.trim()}\n${confirmPreset.presetText}`;
    setLocalCatatan(combined);
    saveCatatanNow(combined);
    setConfirmPreset(null);
  };

  const handleUpdateKeputusan = (val: string) => {
    if (!activeStudent) return;
    queueBatchUpsert(
      'catatan_wali',
      [
        {
          siswa_id: activeStudent.id,
          kelas_id: session.kelasId,
          catatan: localCatatan,
          keputusan_naik: val,
        },
      ],
      ['siswa_id', 'kelas_id']
    );
  };

  // State lokal untuk Ekstrakurikuler (3 slot)
  const studentEkskuls = data.nilaiEkskul
    .filter((e) => e.siswa_id === activeStudent?.id && e.kelas_id === session.kelasId)
    .sort((a, b) => a.urutan - b.urutan);

  const [localEkskulRows, setLocalEkskulRows] = useState<
    Array<{ ekskulId: string; deskripsi: string; isDirty: boolean }>
  >([
    { ekskulId: '', deskripsi: '', isDirty: false },
    { ekskulId: '', deskripsi: '', isDirty: false },
    { ekskulId: '', deskripsi: '', isDirty: false },
  ]);

  const ekskulDebounceTimers = useRef<Array<NodeJS.Timeout | null>>([null, null, null]);

  // Sinkronisasi ekskul saat siswa aktif berubah
  useEffect(() => {
    if (activeStudent) {
      const rows = [0, 1, 2].map((slotIdx) => {
        const found = studentEkskuls.find((e) => e.urutan === slotIdx + 1);
        const defaultEkskulId = found?.ekskul_id || (slotIdx === 0 && data.ekskul[0]?.id) || '';
        return {
          ekskulId: defaultEkskulId,
          deskripsi: found?.deskripsi || '',
          isDirty: false,
        };
      });
      setLocalEkskulRows(rows);
    }
  }, [activeStudent?.id, session.kelasId, data.nilaiEkskul]);

  const saveEkskulRowNow = (slotIdx: number, ekskulId: string, desc: string) => {
    if (!activeStudent) return;
    if (ekskulDebounceTimers.current[slotIdx]) {
      clearTimeout(ekskulDebounceTimers.current[slotIdx]!);
      ekskulDebounceTimers.current[slotIdx] = null;
    }
    setLocalEkskulRows((prev) => {
      const copy = [...prev];
      copy[slotIdx] = { ...copy[slotIdx], isDirty: false };
      return copy;
    });
    queueBatchUpsert(
      'nilai_ekskul',
      [
        {
          siswa_id: activeStudent.id,
          kelas_id: session.kelasId,
          ekskul_id: ekskulId,
          urutan: slotIdx + 1,
          deskripsi: desc,
        },
      ],
      ['siswa_id', 'kelas_id', 'urutan']
    );
  };

  const handleEkskulSelectChange = (slotIdx: number, newEkskulId: string) => {
    const currentDesc = localEkskulRows[slotIdx]?.deskripsi || '';
    setLocalEkskulRows((prev) => {
      const copy = [...prev];
      copy[slotIdx] = { ...copy[slotIdx], ekskulId: newEkskulId, isDirty: false };
      return copy;
    });
    saveEkskulRowNow(slotIdx, newEkskulId, currentDesc);
  };

  const handleEkskulDescChange = (slotIdx: number, val: string) => {
    const currentEkskulId = localEkskulRows[slotIdx]?.ekskulId || '';
    setLocalEkskulRows((prev) => {
      const copy = [...prev];
      copy[slotIdx] = { ...copy[slotIdx], deskripsi: val, isDirty: true };
      return copy;
    });

    if (ekskulDebounceTimers.current[slotIdx]) {
      clearTimeout(ekskulDebounceTimers.current[slotIdx]!);
    }
    ekskulDebounceTimers.current[slotIdx] = setTimeout(() => {
      saveEkskulRowNow(slotIdx, currentEkskulId, val);
    }, 800);
  };

  const handleEkskulDescBlur = (slotIdx: number) => {
    const row = localEkskulRows[slotIdx];
    if (row && row.isDirty) {
      saveEkskulRowNow(slotIdx, row.ekskulId, row.deskripsi);
    }
  };

  const handleFillExampleEkskul = (slotIdx: number) => {
    const row = localEkskulRows[slotIdx];
    const currentEkskulId = row?.ekskulId || (slotIdx === 0 && data.ekskul[0]?.id) || '';
    const ekskulItem = data.ekskul.find((e) => e.id === currentEkskulId);
    const contoh = getContohDeskripsiEkskul(ekskulItem?.nama || '');

    setLocalEkskulRows((prev) => {
      const copy = [...prev];
      copy[slotIdx] = { ...copy[slotIdx], ekskulId: currentEkskulId, deskripsi: contoh, isDirty: false };
      return copy;
    });
    saveEkskulRowNow(slotIdx, currentEkskulId, contoh);
    if (notify) {
      notify('Contoh deskripsi berhasil diisi', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
            <Medal size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Penilaian Ekstrakurikuler & Catatan Wali Kelas
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                Sheet NEKS
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kegiatan ekskul, catatan perkembangan pribadi, prestasi akademik, dan keputusan kenaikan
            </p>
          </div>
        </div>
      </div>

      {enrolledStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Belum ada siswa terdaftar. Tambahkan siswa terlebih dahulu di menu Data Siswa.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Student List Sidebar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs lg:col-span-1 max-h-[75vh] flex flex-col">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 px-2">
              Pilih Peserta Didik ({enrolledStudents.length})
            </div>
            <div className="overflow-y-auto space-y-1 pr-1 flex-1">
              {enrolledStudents.map((s, idx) => {
                const isSelected = (activeStudent?.id || '') === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-kemdikbud-dark text-white font-bold shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="opacity-60 tabular-nums w-4 text-center">{idx + 1}</span>
                      <span className="truncate">{s.nama}</span>
                    </div>
                    <ChevronRight size={14} className={isSelected ? 'text-white' : 'text-slate-300'} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Input Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs lg:col-span-3 space-y-6">
            <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-lg font-black text-slate-900">
                  {activeStudent?.nama}
                </h4>
                <p className="text-xs text-slate-500">
                  NIS: {activeStudent?.nis || '-'} · NISN: {activeStudent?.nisn || '-'}
                </p>
              </div>

              {/* Prestasi Akademik Badge */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs">
                <span className="font-bold text-amber-800 block text-[10px] uppercase">
                  Prestasi Akademik (Otomatis)
                </span>
                <span className="font-semibold text-slate-800">
                  {activeRekap?.prestasiAkademikText || '-'}
                </span>
              </div>
            </div>

            {/* 1. Catatan Wali Kelas */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare size={15} className="text-kemdikbud-dark" />
                <span>Catatan Wali Kelas</span>
              </label>

              <textarea
                rows={3}
                value={localCatatan}
                onChange={(e) => handleCatatanChange(e.target.value)}
                onBlur={handleCatatanBlur}
                placeholder="Tuliskan catatan motivasi dan evaluasi untuk siswa ini..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none transition"
              />

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500">
                  Pilihan Cepat Catatan Motivasi:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CATATAN.map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handleSelectQuickPreset(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[11px] transition text-left"
                    >
                      "{preset.substring(0, 45)}…"
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Ekstrakurikuler (Hingga 3 Kegiatan) */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Award size={15} className="text-kemdikbud-dark" />
                  <span>Ekstrakurikuler yang Diikuti (Maksimal 3)</span>
                </label>
              </div>

              <div className="space-y-3">
                {[0, 1, 2].map((slotIdx) => {
                  const row = localEkskulRows[slotIdx] || { ekskulId: '', deskripsi: '', isDirty: false };
                  const currentEkskulId = row.ekskulId || (slotIdx === 0 && data.ekskul[0]?.id) || '';
                  const currentDesc = row.deskripsi;

                  return (
                    <div
                      key={slotIdx}
                      className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
                    >
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kegiatan #{slotIdx + 1}
                        </label>
                        <select
                          value={currentEkskulId}
                          onChange={(e) => handleEkskulSelectChange(slotIdx, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                        >
                          <option value="">-- Pilih Ekstrakurikuler --</option>
                          {data.ekskul.map((ek) => (
                            <option key={ek.id} value={ek.id}>
                              {ek.nama}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-600">
                            Keterangan / Predikat Kualitatif
                          </label>
                          <button
                            type="button"
                            onClick={() => handleFillExampleEkskul(slotIdx)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-semibold flex items-center gap-1"
                          >
                            <FileText size={12} />
                            <span>+ Isi Contoh</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={currentDesc}
                          onChange={(e) => handleEkskulDescChange(slotIdx, e.target.value)}
                          onBlur={() => handleEkskulDescBlur(slotIdx)}
                          placeholder="Pilih kegiatan dan klik '+ Isi Contoh' atau ketik keterangan di sini"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Keputusan Kenaikan Kelas (Khusus Semester 2) */}
            {session.semester === 2 && (
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <label className="block font-bold text-emerald-900 uppercase tracking-wider text-[11px]">
                  Keputusan Kenaikan Kelas (Semester Genap)
                </label>
                <select
                  value={catatanRecord.keputusan_naik || ''}
                  onChange={(e) => handleUpdateKeputusan(e.target.value)}
                  className="px-3 py-2 bg-white border border-emerald-300 rounded-lg font-bold text-slate-800 focus:outline-none w-full sm:w-80"
                >
                  <option value="Naik ke Kelas VII (Tujuh)">Naik ke Kelas VII (Tujuh)</option>
                  <option value="Naik ke Kelas berikutnya">Naik ke Kelas berikutnya</option>
                  <option value="Tinggal di Kelas VI (Enam)">Tinggal di Kelas VI (Enam)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Pilihan Cepat Catatan */}
      {confirmPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <HelpCircle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-800">Pilihan Cepat Catatan</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Sudah ada teks catatan yang tersimpan. Apakah Anda ingin mengganti teks catatan ini atau menambahkannya di bawah?
                </p>
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 italic">
                  "{confirmPreset.presetText}"
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPreset(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={applyPresetAppend}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
              >
                Tambahkan di Bawah
              </button>
              <button
                type="button"
                onClick={applyPresetReplace}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm"
              >
                Ganti Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
