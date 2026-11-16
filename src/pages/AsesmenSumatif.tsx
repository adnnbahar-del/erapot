import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calcNALingkupMateri, calcNAAkhirSemester, calcNilaiRapor, avg } from '../lib/rapor';
import { getMapelForSession } from '../lib/mapelService';
import { Calculator, BookOpen, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export const AsesmenSumatif: React.FC = () => {
  const { data, session, queueBatchUpsert, notify } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const classMapel = getMapelForSession(data?.mapel || [], session || {});
  const mapelParam = searchParams.get('mapel');
  const selectedMapelId = mapelParam || classMapel[0]?.id || 'mapel_mtk';

  const currentMapel = classMapel.find((m) => m.id === selectedMapelId) || classMapel[0];

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

  // Active Lingkup Materi for selected mapel
  const activeLMs = data.lm
    .filter((l) => l.mapel_id === currentMapel?.id)
    .sort((a, b) => a.urutan - b.urutan);

  // Lookup map for fast value retrieval: lmScores[siswa_id][lm_id]
  const lmScoresMap = useMemo(() => {
    const map = new Map<string, number | null>();
    data.sumatifLM.forEach((row) => {
      map.set(`${row.siswa_id}_${row.lm_id}`, row.nilai);
    });
    return map;
  }, [data.sumatifLM]);

  // Lookup map for semester scores: semScoresMap[siswa_id] -> { pts, pas }
  const semScoresMap = useMemo(() => {
    const map = new Map<string, { pts: number | null; pas: number | null }>();
    data.sumatifSemester
      .filter((s) => s.mapel_id === currentMapel?.id)
      .forEach((row) => {
        map.set(row.siswa_id, { pts: row.pts, pas: row.pas });
      });
    return map;
  }, [data.sumatifSemester, currentMapel?.id]);

  // Handle cell change for LM scores
  const handleLMScoreChange = (siswaId: string, lmId: string, valStr: string) => {
    let parsedVal: number | null = null;
    if (valStr.trim() !== '') {
      const num = Number(valStr);
      if (isNaN(num) || num < 0 || num > 100) {
        notify('Nilai harus berupa angka antara 0 dan 100.', 'error');
        return;
      }
      parsedVal = num;
    }

    queueBatchUpsert(
      'sumatifLM',
      [
        {
          siswa_id: siswaId,
          lm_id: lmId,
          nilai: parsedVal,
        },
      ],
      ['siswa_id', 'lm_id']
    );
  };

  // Handle cell change for PTS / PAS
  const handleSemesterScoreChange = (siswaId: string, field: 'pts' | 'pas', valStr: string) => {
    let parsedVal: number | null = null;
    if (valStr.trim() !== '') {
      const num = Number(valStr);
      if (isNaN(num) || num < 0 || num > 100) {
        notify('Nilai harus berupa angka antara 0 dan 100.', 'error');
        return;
      }
      parsedVal = num;
    }

    const currentRecord = semScoresMap.get(siswaId) || { pts: null, pas: null };
    const updated = {
      siswa_id: siswaId,
      mapel_id: currentMapel.id,
      pts: field === 'pts' ? parsedVal : currentRecord.pts,
      pas: field === 'pas' ? parsedVal : currentRecord.pas,
    };

    queueBatchUpsert('sumatifSemester', [updated], ['siswa_id', 'mapel_id']);
  };

  // Handle Paste from Excel (single column or multiple rows)
  const handlePasteColumn = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startStudentIndex: number,
    columnType: 'lm' | 'pts' | 'pas',
    lmId?: string
  ) => {
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;

    // Check if multi-line
    const lines = clipboardData
      .split(/\r\n|\n|\r/)
      .map((l) => l.trim())
      .filter((l) => l !== '');

    if (lines.length > 1) {
      e.preventDefault();
      const updates: any[] = [];

      for (let i = 0; i < lines.length; i++) {
        const studentIdx = startStudentIndex + i;
        if (studentIdx >= enrolledStudents.length) break;

        const siswa = enrolledStudents[studentIdx];
        const num = Number(lines[i].replace(',', '.'));
        const validNum = !isNaN(num) && num >= 0 && num <= 100 ? num : null;

        if (columnType === 'lm' && lmId) {
          updates.push({
            siswa_id: siswa.id,
            lm_id: lmId,
            nilai: validNum,
          });
        } else if (columnType === 'pts' || columnType === 'pas') {
          const currentRecord = semScoresMap.get(siswa.id) || { pts: null, pas: null };
          updates.push({
            siswa_id: siswa.id,
            mapel_id: currentMapel.id,
            pts: columnType === 'pts' ? validNum : currentRecord.pts,
            pas: columnType === 'pas' ? validNum : currentRecord.pas,
          });
        }
      }

      if (columnType === 'lm') {
        queueBatchUpsert('sumatifLM', updates, ['siswa_id', 'lm_id']);
      } else {
        queueBatchUpsert('sumatifSemester', updates, ['siswa_id', 'mapel_id']);
      }

      notify(`Berhasil menempel ${updates.length} nilai dari Excel.`, 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Mapel Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
            <Calculator size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Asesmen Sumatif (Nilai Angka)
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                Sheet S{currentMapel?.urutan || 1}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nilai per Lingkup Materi, PTS, PAS → Menghitung Nilai Rapor Otomatis
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

      {/* Warning if no Lingkup Materi defined */}
      {activeLMs.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>
              Belum ada Lingkup Materi (LM) untuk mata pelajaran {currentMapel?.nama}. Tambahkan LM terlebih dahulu agar kolom sumatif tersedia.
            </span>
          </div>
          <a
            href="/lingkup-materi"
            className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 ml-3 shrink-0"
          >
            + Tambah LM
          </a>
        </div>
      )}

      {/* Summative Input Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs shadow-xs text-slate-700">
              <tr className="border-b border-slate-300 text-[11px] font-bold">
                <th className="py-2.5 px-3 text-center w-12 border-r border-slate-200">No</th>
                <th className="py-2.5 px-3 min-w-[180px] border-r border-slate-200">
                  Nama Peserta Didik
                </th>

                {/* Kolom Sumatif per LM */}
                {activeLMs.map((lm, idx) => (
                  <th
                    key={lm.id}
                    className="py-2 px-2 text-center border-r border-slate-200 bg-emerald-50/50 min-w-[90px]"
                  >
                    <div className="font-bold text-emerald-800">Sum {idx + 1}</div>
                    <div className="text-[10px] text-slate-500 font-normal truncate max-w-[100px]" title={lm.nama}>
                      {lm.nama}
                    </div>
                  </th>
                ))}

                {/* Kolom NA Lingkup Materi */}
                <th className="py-2 px-2 text-center border-r border-slate-200 bg-blue-50/70 text-blue-900 min-w-[75px]">
                  <div>NA Sum.</div>
                  <div className="text-[10px] font-normal text-blue-700">LM</div>
                </th>

                {/* Kolom PTS & PAS */}
                <th className="py-2 px-2 text-center border-r border-slate-200 bg-amber-50/50 text-amber-900 min-w-[75px]">
                  PTS
                </th>
                <th className="py-2 px-2 text-center border-r border-slate-200 bg-amber-50/50 text-amber-900 min-w-[75px]">
                  PAS
                </th>

                {/* Kolom NA Semester */}
                <th className="py-2 px-2 text-center border-r border-slate-200 bg-blue-50/70 text-blue-900 min-w-[75px]">
                  <div>NA Sum.</div>
                  <div className="text-[10px] font-normal text-blue-700">Akhir</div>
                </th>

                {/* Kolom Nilai Rapor Final */}
                <th className="py-2 px-3 text-center bg-kemdikbud-dark text-white min-w-[85px] font-black">
                  Nilai Rapor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {enrolledStudents.length > 0 ? (
                enrolledStudents.map((s, sIdx) => {
                  const studentLMScores = activeLMs.map((lm) =>
                    lmScoresMap.get(`${s.id}_${lm.id}`) ?? null
                  );

                  const semRecord = semScoresMap.get(s.id);
                  const ptsVal = semRecord?.pts ?? null;
                  const pasVal = semRecord?.pas ?? null;

                  const naLM = calcNALingkupMateri(studentLMScores);
                  const naAkhir = calcNAAkhirSemester(ptsVal, pasVal);
                  const nilaiRapor = calcNilaiRapor(naLM, naAkhir);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-1.5 px-3 text-center font-bold text-slate-500 border-r border-slate-200 tabular-nums">
                        {sIdx + 1}
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-slate-900 border-r border-slate-200">
                        {s.nama}
                      </td>

                      {/* Inputs per LM */}
                      {activeLMs.map((lm) => {
                        const val = lmScoresMap.get(`${s.id}_${lm.id}`);
                        const displayVal = val !== undefined && val !== null ? val : '';

                        return (
                          <td key={lm.id} className="p-1 border-r border-slate-200 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={displayVal}
                              onChange={(e) => handleLMScoreChange(s.id, lm.id, e.target.value)}
                              onPaste={(e) => handlePasteColumn(e, sIdx, 'lm', lm.id)}
                              className="w-16 h-8 text-center bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none tabular-nums font-semibold text-slate-800 text-xs"
                              placeholder="-"
                            />
                          </td>
                        );
                      })}

                      {/* NA Sumatif LM (Read-Only) */}
                      <td className="py-1.5 px-2 text-center border-r border-slate-200 font-bold text-blue-900 bg-blue-50/30 tabular-nums">
                        {naLM !== null ? naLM.toFixed(1) : '-'}
                      </td>

                      {/* PTS Input */}
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={ptsVal !== null && ptsVal !== undefined ? ptsVal : ''}
                          onChange={(e) => handleSemesterScoreChange(s.id, 'pts', e.target.value)}
                          onPaste={(e) => handlePasteColumn(e, sIdx, 'pts')}
                          className="w-16 h-8 text-center bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none tabular-nums font-semibold text-slate-800 text-xs"
                          placeholder="-"
                        />
                      </td>

                      {/* PAS Input */}
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={pasVal !== null && pasVal !== undefined ? pasVal : ''}
                          onChange={(e) => handleSemesterScoreChange(s.id, 'pas', e.target.value)}
                          onPaste={(e) => handlePasteColumn(e, sIdx, 'pas')}
                          className="w-16 h-8 text-center bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none tabular-nums font-semibold text-slate-800 text-xs"
                          placeholder="-"
                        />
                      </td>

                      {/* NA Akhir Semester (Read-Only) */}
                      <td className="py-1.5 px-2 text-center border-r border-slate-200 font-bold text-blue-900 bg-blue-50/30 tabular-nums">
                        {naAkhir !== null ? naAkhir.toFixed(1) : '-'}
                      </td>

                      {/* Nilai Rapor Final (Bulat, Read-Only) */}
                      <td className="py-1.5 px-3 text-center font-black text-slate-900 bg-slate-50 tabular-nums text-sm">
                        {nilaiRapor !== null ? (
                          <span className="text-kemdikbud-dark">{nilaiRapor}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={activeLMs.length + 6} className="text-center py-12 text-slate-400">
                    Belum ada siswa terdaftar di Kelas {session.kelas}. Tambah siswa di menu Data Siswa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Excel Paste Tip Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
          <Info size={14} className="text-blue-600 shrink-0" />
          <span>
            <strong>Tips Pengisian Cepat:</strong> Anda dapat menekan <code>Tab</code> atau <code>Enter</code> untuk berpindah antarsel, atau menyalin (copy) 1 kolom nilai dari Excel lalu menempelkannya (<code>Ctrl+V</code>) langsung pada kotak isian siswa teratas.
          </span>
        </div>
      </div>
    </div>
  );
};
