import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatusKaih, KaihRecord } from '../types';
import { HeartHandshake, Copy, Info, ArrowRightLeft } from 'lucide-react';
import {
  Periode,
  LABEL_PERIODE,
  periodeBawaan,
  teksPeriode,
  periodeSebelumnya,
  normalisasiKaih,
} from '../lib/kaih';
import { PilihPeriodeKaih } from '../components/PilihPeriodeKaih';

const STATUS_OPTIONS: StatusKaih[] = ['Belum Terbiasa', 'Mulai Terbiasa', 'Sudah Terbiasa'];

export const Input7Kaih: React.FC = () => {
  const { data, session, queueBatchUpsert, notify, flushSaveQueue, hasUnsavedChanges, isSaving } = useApp();

  const storageKey = session ? `kaih_selected_periode_${session.kelasId}` : '';

  // Inisialisasi periode & tahun dari localStorage atau bawaan semester aktif
  const [{ tahun: selectedTahun, periode: selectedPeriode }, setPeriodeState] = useState<{
    tahun: number;
    periode: Periode;
  }>(() => {
    const bawaan = session
      ? periodeBawaan(session.tahunAjaran, session.semester as 1 | 2)
      : { tahun: 2025, periode: 'JUL-DES' as Periode };
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.tahun && (parsed.periode === 'JAN-JUN' || parsed.periode === 'JUL-DES')) {
            return { tahun: Number(parsed.tahun), periode: parsed.periode as Periode };
          }
        }
      } catch {
        // ignore
      }
    }
    return bawaan;
  });

  const enrolledStudents = useMemo(() => {
    if (!data || !session) return [];
    const currentClassRoster = data.kelasSiswa.filter((ks) => ks.kelas_id === session.kelasId);
    return data.siswa
      .filter((s) => currentClassRoster.some((ks) => ks.siswa_id === s.id))
      .map((s) => {
        const ks = currentClassRoster.find((item) => item.siswa_id === s.id);
        return {
          ...s,
          no_urut: ks?.no_urut || 0,
        };
      })
      .sort((a, b) => a.no_urut - b.no_urut);
  }, [data, session]);

  // Map of KAIH records untuk periode & tahun terpilih
  const kaihMap = useMemo(() => {
    const map = new Map<string, KaihRecord>();
    if (!data || !session) return map;
    (data.kaih || [])
      .filter((k) => k.kelas_id === session.kelasId)
      .forEach((k) => {
        const norm = normalisasiKaih(k);
        if (norm.tahun === selectedTahun && norm.periode === selectedPeriode) {
          map.set(k.siswa_id, {
            ...k,
            tahun: norm.tahun,
            periode: norm.periode,
          });
        }
      });
    return map;
  }, [data, session, selectedTahun, selectedPeriode]);

  // Cek apakah periode ini belum pernah diisi sama sekali
  const isPeriodEmpty = useMemo(() => {
    if (enrolledStudents.length === 0) return true;
    for (const s of enrolledStudents) {
      const rec = kaihMap.get(s.id);
      if (
        rec &&
        (rec.bangun_pagi ||
          rec.beribadah ||
          rec.berolahraga ||
          rec.makan_sehat ||
          rec.gemar_belajar ||
          rec.bermasyarakat ||
          rec.tidur_cepat)
      ) {
        return false;
      }
    }
    return true;
  }, [enrolledStudents, kaihMap]);

  if (!data || !session) return null;

  // Handle ganti periode/tahun dengan memastikan simpan antrean terlebih dahulu
  const handlePeriodeChange = async (newPeriode: Periode) => {
    if (newPeriode === selectedPeriode) return;
    if (hasUnsavedChanges || isSaving) {
      await flushSaveQueue();
    }
    setPeriodeState((prev) => {
      const next = { ...prev, periode: newPeriode };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleTahunChange = async (newTahun: number) => {
    if (newTahun === selectedTahun) return;
    if (hasUnsavedChanges || isSaving) {
      await flushSaveQueue();
    }
    setPeriodeState((prev) => {
      const next = { ...prev, tahun: newTahun };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Update 1 field untuk 1 siswa
  const handleUpdateField = (
    siswaId: string,
    field: keyof Omit<KaihRecord, 'id' | 'siswa_id' | 'kelas_id' | 'tahun' | 'periode' | 'created_at' | 'updated_at'>,
    val: StatusKaih | ''
  ) => {
    const curr = kaihMap.get(siswaId) || {
      siswa_id: siswaId,
      kelas_id: session.kelasId,
      tahun: selectedTahun,
      periode: selectedPeriode,
      bangun_pagi: '',
      beribadah: '',
      berolahraga: '',
      makan_sehat: '',
      gemar_belajar: '',
      bermasyarakat: '',
      tidur_cepat: '',
    };

    const updated: KaihRecord = {
      ...curr,
      tahun: selectedTahun,
      periode: selectedPeriode,
      [field]: val,
    };

    queueBatchUpsert('kaih', [updated], ['siswa_id', 'tahun', 'periode']);
  };

  // Terapkan ke semua siswa untuk periode & tahun yang sedang dipilih
  const handleApplyToAll = () => {
    if (enrolledStudents.length === 0) return;
    const firstStudent = enrolledStudents[0];
    const source = kaihMap.get(firstStudent.id);

    // Ambil nilai dari siswa pertama atau standar jika belum diisi
    const template: Record<string, StatusKaih> = {
      bangun_pagi: (source?.bangun_pagi as StatusKaih) || 'Sudah Terbiasa',
      beribadah: (source?.beribadah as StatusKaih) || 'Sudah Terbiasa',
      berolahraga: (source?.berolahraga as StatusKaih) || 'Mulai Terbiasa',
      makan_sehat: (source?.makan_sehat as StatusKaih) || 'Sudah Terbiasa',
      gemar_belajar: (source?.gemar_belajar as StatusKaih) || 'Mulai Terbiasa',
      bermasyarakat: (source?.bermasyarakat as StatusKaih) || 'Sudah Terbiasa',
      tidur_cepat: (source?.tidur_cepat as StatusKaih) || 'Sudah Terbiasa',
    };

    const batch = enrolledStudents.map((s) => ({
      siswa_id: s.id,
      kelas_id: session.kelasId,
      tahun: selectedTahun,
      periode: selectedPeriode,
      ...template,
    }));

    queueBatchUpsert('kaih', batch, ['siswa_id', 'tahun', 'periode']);
    notify(
      `Pola 7 KAIH diterapkan ke seluruh ${enrolledStudents.length} siswa untuk periode ${teksPeriode(
        selectedTahun,
        selectedPeriode
      )}.`,
      'success'
    );
  };

  // Salin dari periode sebelumnya
  const handleCopyFromPrevious = () => {
    const prev = periodeSebelumnya(selectedTahun, selectedPeriode);

    // Cari data periode sebelumnya di kelas ini
    const prevDataMap = new Map<string, KaihRecord>();
    (data.kaih || [])
      .filter((k) => k.kelas_id === session.kelasId)
      .forEach((k) => {
        const norm = normalisasiKaih(k);
        if (norm.tahun === prev.tahun && norm.periode === prev.periode) {
          prevDataMap.set(k.siswa_id, k);
        }
      });

    // Hanya salin siswa yang masih terdaftar di kelas dan punya data di periode sebelumnya
    const toCopy: KaihRecord[] = [];
    for (const s of enrolledStudents) {
      const prevRec = prevDataMap.get(s.id);
      if (prevRec) {
        toCopy.push({
          id: 'kaih_' + Math.random().toString(36).substring(2),
          siswa_id: s.id,
          kelas_id: session.kelasId,
          tahun: selectedTahun,
          periode: selectedPeriode,
          bangun_pagi: prevRec.bangun_pagi || '',
          beribadah: prevRec.beribadah || '',
          berolahraga: prevRec.berolahraga || '',
          makan_sehat: prevRec.makan_sehat || '',
          gemar_belajar: prevRec.gemar_belajar || '',
          bermasyarakat: prevRec.bermasyarakat || '',
          tidur_cepat: prevRec.tidur_cepat || '',
        });
      }
    }

    if (toCopy.length === 0) {
      notify(
        `Tidak ada data penilaian pada periode sebelumnya (${LABEL_PERIODE[prev.periode]} ${prev.tahun}) untuk disalin.`,
        'error'
      );
      return;
    }

    queueBatchUpsert('kaih', toCopy, ['siswa_id', 'tahun', 'periode']);
    notify(
      `Berhasil menyalin penilaian dari periode ${LABEL_PERIODE[prev.periode]} ${prev.tahun} (${toCopy.length} siswa).`,
      'success'
    );
  };

  const fields: {
    key: keyof Omit<KaihRecord, 'id' | 'siswa_id' | 'kelas_id' | 'tahun' | 'periode' | 'created_at' | 'updated_at'>;
    label: string;
  }[] = [
    { key: 'bangun_pagi', label: '1. Bangun Pagi' },
    { key: 'beribadah', label: '2. Beribadah' },
    { key: 'berolahraga', label: '3. Berolahraga' },
    { key: 'makan_sehat', label: '4. Makan Sehat' },
    { key: 'gemar_belajar', label: '5. Gemar Belajar' },
    { key: 'bermasyarakat', label: '6. Bermasyarakat' },
    { key: 'tidur_cepat', label: '7. Tidur Cepat' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shrink-0 mt-0.5">
            <HeartHandshake size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-800">
                7 Kebiasaan Anak Hebat Indonesia (7 KAIH)
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                Sheet rekap7kaih
              </span>
            </div>

            {/* Pilihan Periode Penilaian dan Tahun Bersama */}
            <PilihPeriodeKaih
              tahun={selectedTahun}
              periode={selectedPeriode}
              onPeriodeChange={handlePeriodeChange}
              onTahunChange={handleTahunChange}
              tahunAjaran={session.tahunAjaran}
              semester={session.semester as 1 | 2}
              mode="input"
            />
          </div>
        </div>

        {enrolledStudents.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-start md:self-center">
            <button
              onClick={handleApplyToAll}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
            >
              <Copy size={14} />
              <span>Terapkan ke Semua Siswa</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty State Banner di atas tabel jika periode belum pernah diisi */}
      {isPeriodEmpty && enrolledStudents.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <Info size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                Penilaian 7 KAIH periode {LABEL_PERIODE[selectedPeriode]} {selectedTahun} belum diisi.
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Anda dapat menyalin penilaian dari periode sebelumnya atau menerapkan pola ke semua siswa.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
            <button
              onClick={handleCopyFromPrevious}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-amber-100/70 text-amber-900 border border-amber-300 text-xs font-bold transition shadow-2xs"
            >
              <ArrowRightLeft size={14} />
              <span>Salin dari periode sebelumnya</span>
            </button>
            <button
              onClick={handleApplyToAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-2xs"
            >
              <Copy size={14} />
              <span>Terapkan ke semua siswa</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs text-slate-700 border-b border-slate-300">
              <tr className="text-[11px] font-bold">
                <th className="py-2.5 px-3 text-center w-12 border-r border-slate-200">No</th>
                <th className="py-2.5 px-3 min-w-[170px] border-r border-slate-200">
                  Nama Peserta Didik
                </th>
                <th className="py-2 px-2 text-center border-r border-slate-200 min-w-[130px]">
                  1. Bangun Pagi
                </th>
                <th className="py-2 px-2 text-center border-r border-slate-200 min-w-[130px]">
                  2. Beribadah
                </th>
                <th className="py-2 px-2 text-center border-r border-slate-200 min-w-[130px]">
                  3. Berolahraga
                </th>
                <th className="py-2 px-2 text-center border-r border-slate-200 min-w-[130px]">
                  4. Makan Sehat
                </th>
                <th className="py-2 px-2 text-center border-r border-slate-200 min-w-[130px]">
                  5. Gemar Belajar
                </th>
                <th className="py-2 px-2 text-center border-r border-slate-200 min-w-[130px]">
                  6. Bermasyarakat
                </th>
                <th className="py-2 px-2 text-center min-w-[130px]">
                  7. Tidur Cepat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {enrolledStudents.length > 0 ? (
                enrolledStudents.map((s, idx) => {
                  const rec = kaihMap.get(s.id);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border-r border-slate-200 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200">
                        {s.nama}
                      </td>

                      {fields.map((fld, fIdx) => {
                        const val = rec ? (rec[fld.key] as StatusKaih | '') : '';
                        return (
                          <td
                            key={fld.key}
                            className={`p-1.5 text-center ${
                              fIdx < fields.length - 1 ? 'border-r border-slate-200' : ''
                            }`}
                          >
                            <select
                              value={val || ''}
                              onChange={(e) =>
                                handleUpdateField(
                                  s.id,
                                  fld.key,
                                  e.target.value as StatusKaih | ''
                                )
                              }
                              className={`w-full px-2 py-1 rounded-md text-[11px] font-bold border focus:outline-none transition-colors ${
                                val === 'Sudah Terbiasa'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : val === 'Mulai Terbiasa'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : val === 'Belum Terbiasa'
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}
                            >
                              <option value="">Pilih…</option>
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    Belum ada siswa terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
