import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { generateDeskripsiKompetensi } from '../lib/rapor';
import { getMapelForSession } from '../lib/mapelService';
import { CheckSquare, BookOpen, Check, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';

export const AsesmenFormatif: React.FC = () => {
  const { data, session, queueBatchUpsert } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const classMapel = getMapelForSession(data?.mapel || [], session || {});
  const mapelParam = searchParams.get('mapel');
  const selectedMapelId = mapelParam || classMapel[0]?.id || 'mapel_mtk';

  const currentMapel = classMapel.find((m) => m.id === selectedMapelId) || classMapel[0];

  const [activePreviewStudentId, setActivePreviewStudentId] = useState<string | null>(null);

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

  // Active TPs for selected mapel
  const activeTPs = data.tp
    .filter((t) => t.mapel_id === currentMapel?.id)
    .sort((a, b) => a.urutan - b.urutan);

  // Lookup map: formatifMap[`${siswa_id}_${tp_id}`] -> { kktp, tampil }
  const formatifMap = useMemo(() => {
    const map = new Map<string, { kktp: 0 | 1; tampil: 0 | 1 }>();
    data.formatif.forEach((row) => {
      map.set(`${row.siswa_id}_${row.tp_id}`, {
        kktp: row.kktp,
        tampil: row.tampil,
      });
    });
    return map;
  }, [data.formatif]);

  // Toggle single cell
  const handleToggleCell = (siswaId: string, tpId: string, field: 'kktp' | 'tampil') => {
    const current = formatifMap.get(`${siswaId}_${tpId}`) || { kktp: 1, tampil: 1 };
    const updated = {
      siswa_id: siswaId,
      tp_id: tpId,
      kktp: field === 'kktp' ? (current.kktp === 1 ? (0 as const) : (1 as const)) : current.kktp,
      tampil: field === 'tampil' ? (current.tampil === 1 ? (0 as const) : (1 as const)) : current.tampil,
    };

    queueBatchUpsert('nilai_formatif', [updated], ['siswa_id', 'tp_id']);
  };

  // Quick action: Set all KKTP = 1 for a single student across this mapel's TPs
  const handleSetAllKKTPStudent = (siswaId: string, kktpValue: 0 | 1) => {
    const batch = activeTPs.map((tp) => {
      const curr = formatifMap.get(`${siswaId}_${tp.id}`) || { kktp: 1, tampil: 1 };
      return {
        siswa_id: siswaId,
        tp_id: tp.id,
        kktp: kktpValue,
        tampil: curr.tampil,
      };
    });
    queueBatchUpsert('nilai_formatif', batch, ['siswa_id', 'tp_id']);
  };

  // Quick action: Set all Tampil = 1 for a single student
  const handleSetAllTampilStudent = (siswaId: string, tampilValue: 0 | 1) => {
    const batch = activeTPs.map((tp) => {
      const curr = formatifMap.get(`${siswaId}_${tp.id}`) || { kktp: 1, tampil: 1 };
      return {
        siswa_id: siswaId,
        tp_id: tp.id,
        kktp: curr.kktp,
        tampil: tampilValue,
      };
    });
    queueBatchUpsert('nilai_formatif', batch, ['siswa_id', 'tp_id']);
  };

  // Quick action: Set all KKTP for an entire column (TP)
  const handleSetAllKKTPColumn = (tpId: string, kktpValue: 0 | 1) => {
    const batch = enrolledStudents.map((s) => {
      const curr = formatifMap.get(`${s.id}_${tpId}`) || { kktp: 1, tampil: 1 };
      return {
        siswa_id: s.id,
        tp_id: tpId,
        kktp: kktpValue,
        tampil: curr.tampil,
      };
    });
    queueBatchUpsert('nilai_formatif', batch, ['siswa_id', 'tp_id']);
  };

  // Quick action: Set all Tampil for an entire column (TP)
  const handleSetAllTampilColumn = (tpId: string, tampilValue: 0 | 1) => {
    const batch = enrolledStudents.map((s) => {
      const curr = formatifMap.get(`${s.id}_${tpId}`) || { kktp: 1, tampil: 1 };
      return {
        siswa_id: s.id,
        tp_id: tpId,
        kktp: curr.kktp,
        tampil: tampilValue,
      };
    });
    queueBatchUpsert('nilai_formatif', batch, ['siswa_id', 'tp_id']);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-kemdikbud-dark">
            <CheckSquare size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Asesmen Formatif (Capaian Kompetensi)
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                Sheet F{currentMapel?.urutan || 1}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              KKTP tercapai (1/0) dan Tampil (1/0) untuk membuat deskripsi capaian rapor otomatis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-slate-400" />
            <select
              value={currentMapel?.id || ''}
              onChange={(e) => setSearchParams({ mapel: e.target.value })}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {classMapel.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama} ({m.singkatan})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeTPs.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>
              Belum ada Tujuan Pembelajaran (TP) untuk mata pelajaran {currentMapel?.nama}. Tambahkan TP di menu Tujuan Pembelajaran.
            </span>
          </div>
          <a
            href="/tujuan-pembelajaran"
            className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 ml-3 shrink-0"
          >
            + Tambah TP
          </a>
        </div>
      )}

      {/* Main Formative Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs text-slate-700 border-b border-slate-300">
              <tr className="text-[11px] font-bold">
                <th className="py-2.5 px-3 text-center w-12 border-r border-slate-200">No</th>
                <th className="py-2.5 px-3 min-w-[180px] border-r border-slate-200">
                  Nama Peserta Didik
                </th>

                {/* TP Column Headers with Batch Toggles */}
                {activeTPs.map((tp, tpIdx) => (
                  <th
                    key={tp.id}
                    className="py-2 px-2 text-center border-r border-slate-200 min-w-[100px] max-w-[140px]"
                  >
                    <div className="font-bold text-blue-900">TP {tpIdx + 1}</div>
                    <div
                      className="text-[10px] text-slate-500 font-normal truncate mb-1"
                      title={tp.deskripsi}
                    >
                      {tp.deskripsi}
                    </div>
                    {/* Batch Actions for this TP */}
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleSetAllKKTPColumn(tp.id, 1)}
                        className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[9px] font-bold"
                        title="Set semua siswa KKTP tercapai"
                      >
                        ✓ Semua
                      </button>
                      <button
                        onClick={() => handleSetAllTampilColumn(tp.id, 1)}
                        className="px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-[9px] font-bold"
                        title="Set semua siswa Tampil di rapor"
                      >
                        👁 Semua
                      </button>
                    </div>
                  </th>
                ))}

                <th className="py-2.5 px-3 text-center min-w-[110px] bg-slate-200/60 font-black">
                  Pratinjau Deskripsi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {enrolledStudents.length > 0 ? (
                enrolledStudents.map((s, sIdx) => {
                  const studentTPsWithData = activeTPs.map((tp) => {
                    const rec = formatifMap.get(`${s.id}_${tp.id}`) || { kktp: 1, tampil: 1 };
                    return {
                      deskripsi: tp.deskripsi,
                      kktp: rec.kktp,
                      tampil: rec.tampil,
                    };
                  });

                  const descResult = generateDeskripsiKompetensi(s.nama, studentTPsWithData);
                  const isPreviewOpen = activePreviewStudentId === s.id;

                  return (
                    <React.Fragment key={s.id}>
                      <tr className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 text-center font-bold text-slate-500 border-r border-slate-200 tabular-nums">
                          {sIdx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200">
                          <div className="font-bold text-slate-900">{s.nama}</div>
                          {/* Student Quick Action Buttons */}
                          <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                            <button
                              onClick={() => handleSetAllKKTPStudent(s.id, 1)}
                              className="text-emerald-700 hover:underline font-semibold"
                            >
                              Semua KKTP
                            </button>
                            <span className="text-slate-300">·</span>
                            <button
                              onClick={() => handleSetAllTampilStudent(s.id, 1)}
                              className="text-blue-700 hover:underline font-semibold"
                            >
                              Tampil Semua
                            </button>
                          </div>
                        </td>

                        {/* Interactive Grid Toggles per TP */}
                        {activeTPs.map((tp) => {
                          const rec = formatifMap.get(`${s.id}_${tp.id}`) || { kktp: 1, tampil: 1 };
                          const isKKTP = rec.kktp === 1;
                          const isTampil = rec.tampil === 1;

                          return (
                            <td key={tp.id} className="p-2 border-r border-slate-200 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Toggle 1: KKTP Tercapai */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleCell(s.id, tp.id, 'kktp')}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold transition shadow-xs ${
                                    isKKTP
                                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                      : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                  }`}
                                  title={isKKTP ? 'KKTP Tercapai (1)' : 'Perlu Bimbingan (0)'}
                                >
                                  {isKKTP ? '✓' : '✕'}
                                </button>

                                {/* Toggle 2: Tampil di Rapor */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleCell(s.id, tp.id, 'tampil')}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition shadow-xs ${
                                    isTampil
                                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                                      : 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                                  }`}
                                  title={isTampil ? 'Tampil di Rapor (1)' : 'Sembunyikan dari Rapor (0)'}
                                >
                                  {isTampil ? <Eye size={13} /> : <EyeOff size={13} />}
                                </button>
                              </div>
                            </td>
                          );
                        })}

                        {/* Preview Deskripsi Action */}
                        <td className="py-2 px-3 text-center bg-slate-50/50">
                          <button
                            type="button"
                            onClick={() =>
                              setActivePreviewStudentId(isPreviewOpen ? null : s.id)
                            }
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 mx-auto transition ${
                              isPreviewOpen
                                ? 'bg-kemdikbud-dark text-white'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Sparkles size={12} className={isPreviewOpen ? 'text-amber-300' : 'text-blue-600'} />
                            <span>{isPreviewOpen ? 'Tutup' : 'Lihat Teks'}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Preview Drawer */}
                      {isPreviewOpen && (
                        <tr className="bg-blue-50/40 border-b border-blue-200">
                          <td colSpan={activeTPs.length + 3} className="p-4">
                            <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-xs space-y-2">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="font-bold text-slate-800 text-xs">
                                  Pratinjau Deskripsi Rapor: {s.nama} ({currentMapel?.nama})
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Otomatis diformat sesuai kaidah Kurikulum Merdeka
                                </span>
                              </div>

                              {descResult.tercapaiText && (
                                <div className="text-xs text-slate-700 leading-relaxed">
                                  <strong className="text-emerald-700">Tercapai: </strong>
                                  <span>{descResult.tercapaiText}</span>
                                </div>
                              )}

                              {descResult.perluBimbinganText && (
                                <div className="text-xs text-slate-700 leading-relaxed">
                                  <strong className="text-rose-700">Perlu Bimbingan: </strong>
                                  <span>{descResult.perluBimbinganText}</span>
                                </div>
                              )}

                              {!descResult.tercapaiText && !descResult.perluBimbinganText && (
                                <p className="text-xs text-slate-400 italic">
                                  Tidak ada TP yang dipilih tampil di rapor untuk siswa ini.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={activeTPs.length + 3} className="text-center py-12 text-slate-400">
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
