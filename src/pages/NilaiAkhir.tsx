import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculateRekapDanPeringkat, calcNALingkupMateri, calcNAAkhirSemester, calcNilaiRapor, formatRataRata } from '../lib/rapor';
import { getMapelForSession } from '../lib/mapelService';
import * as XLSX from 'xlsx';
import { TableProperties, Download, Trophy, FileSpreadsheet } from 'lucide-react';

export const NilaiAkhir: React.FC = () => {
  const { data, session } = useApp();

  if (!data || !session) return null;

  const classMapel = getMapelForSession(data.mapel, session);

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

  // Calculate final grade for each student & mapel
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
        nisn: s.nisn,
        nilaiMapel: scores,
      };
    });
  }, [enrolledStudents, classMapel, data.lm, data.sumatifLM, data.sumatifSemester]);

  // Rekap & Peringkat
  const rekapOutputs = useMemo(() => {
    return calculateRekapDanPeringkat(studentScoresGrid, classMapel.length);
  }, [studentScoresGrid, classMapel.length]);

  // Combined rows for rendering
  const tableRows = useMemo(() => {
    return studentScoresGrid.map((s, idx) => {
      const rekap = rekapOutputs.find((r) => r.id === s.id);
      return {
        no: idx + 1,
        id: s.id,
        nama: s.nama,
        nisn: s.nisn,
        scores: s.nilaiMapel,
        jumlah: rekap?.jumlah ?? null,
        rataRata: rekap?.rataRata ?? null,
        rataRataFormatted: rekap?.rataRataFormatted ?? '-',
        peringkat: rekap?.peringkat ?? null,
      };
    });
  }, [studentScoresGrid, rekapOutputs]);

  // Statistics per mapel (Rata-rata, Tertinggi, Terendah)
  const statsPerMapel = useMemo(() => {
    return classMapel.map((_, mIdx) => {
      const colValues = tableRows
        .map((r) => r.scores[mIdx])
        .filter((v): v is number => typeof v === 'number');

      if (colValues.length === 0) {
        return { avg: '-', max: '-', min: '-' };
      }

      const sum = colValues.reduce((a, b) => a + b, 0);
      const avgVal = sum / colValues.length;
      const maxVal = Math.max(...colValues);
      const minVal = Math.min(...colValues);

      return {
        avg: formatRataRata(avgVal),
        max: maxVal.toString(),
        min: minVal.toString(),
      };
    });
  }, [classMapel, tableRows]);

  // Export Excel Rekap Nilai
  const handleExportExcel = () => {
    const headers = [
      'No',
      'NISN',
      'Nama Peserta Didik',
      ...classMapel.map((m) => `${m.nama} (${m.singkatan})`),
      'Jumlah Nilai',
      'Rata-Rata',
      'Peringkat',
    ];

    const dataRows = tableRows.map((r) => [
      r.no,
      r.nisn,
      r.nama,
      ...r.scores.map((sc) => (sc !== null ? sc : '')),
      r.jumlah !== null ? r.jumlah : '',
      r.rataRataFormatted,
      r.peringkat !== null ? r.peringkat : '',
    ]);

    // Bottom statistic rows
    const avgRow = ['RATA-RATA', '', '', ...statsPerMapel.map((s) => s.avg), '', '', ''];
    const maxRow = ['TERTINGGI', '', '', ...statsPerMapel.map((s) => s.max), '', '', ''];
    const minRow = ['TERENDAH', '', '', ...statsPerMapel.map((s) => s.min), '', '', ''];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [`REKAP NILAI AKHIR RAPOR KELAS ${session.kelas}`],
      [`${data.sekolah.nama} - SEMESTER ${session.semester} TAHUN AJARAN ${session.tahunAjaran}`],
      [],
      headers,
      ...dataRows,
      [],
      avgRow,
      maxRow,
      minRow,
    ]);

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Nilai_Akhir');
    XLSX.writeFile(wb, `Rekap_Nilai_Kelas_${session.kelas}_${session.tahunAjaran.replace('/', '-')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-kemdikbud-dark">
            <TableProperties size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Rekap Nilai Akhir Rapor (NA)
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                Sheet NA
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nilai rapor bulat tiap mata pelajaran, jumlah, rata-rata, dan peringkat kelas
            </p>
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
        >
          <Download size={15} />
          <span>Unduh Excel Rekap</span>
        </button>
      </div>

      {/* Main NA Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs text-slate-700 border-b border-slate-300">
              <tr className="text-[11px] font-bold">
                <th className="py-2.5 px-3 text-center w-12 border-r border-slate-200">No</th>
                <th className="py-2.5 px-3 min-w-[180px] border-r border-slate-200">
                  Nama Peserta Didik
                </th>

                {/* Subject Headers with Tooltips */}
                {classMapel.map((m) => (
                  <th
                    key={m.id}
                    className="py-2 px-2 text-center border-r border-slate-200 min-w-[65px]"
                    title={m.nama}
                  >
                    <span className="cursor-help font-bold text-blue-900">{m.singkatan}</span>
                  </th>
                ))}

                <th className="py-2.5 px-3 text-center border-r border-slate-200 bg-slate-200/60 font-black min-w-[70px]">
                  Jumlah
                </th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200 bg-slate-200/60 font-black min-w-[75px]">
                  Rata-rata
                </th>
                <th className="py-2.5 px-3 text-center bg-amber-100 text-amber-900 font-black min-w-[75px]">
                  Peringkat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tableRows.length > 0 ? (
                tableRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2 px-3 text-center font-bold text-slate-500 border-r border-slate-200 tabular-nums">
                      {r.no}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200">
                      {r.nama}
                    </td>

                    {/* Subject final grades */}
                    {r.scores.map((score, sIdx) => (
                      <td
                        key={sIdx}
                        className="py-2 px-2 text-center border-r border-slate-200 tabular-nums font-semibold text-slate-800"
                      >
                        {score !== null ? score : '-'}
                      </td>
                    ))}

                    {/* Jumlah */}
                    <td className="py-2 px-3 text-center border-r border-slate-200 font-bold text-slate-900 tabular-nums bg-slate-50/50">
                      {r.jumlah !== null ? r.jumlah : '-'}
                    </td>

                    {/* Rata-rata */}
                    <td className="py-2 px-3 text-center border-r border-slate-200 font-bold text-emerald-700 tabular-nums bg-slate-50/50">
                      {r.rataRataFormatted}
                    </td>

                    {/* Peringkat */}
                    <td className="py-2 px-3 text-center font-black tabular-nums bg-amber-50/40">
                      {r.peringkat !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                            r.peringkat === 1
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                              : r.peringkat <= 3
                              ? 'bg-amber-100 text-amber-900 font-bold'
                              : 'text-slate-700 font-bold'
                          }`}
                        >
                          {r.peringkat === 1 && <Trophy size={11} />}
                          {r.peringkat}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={classMapel.length + 5} className="text-center py-12 text-slate-400">
                    Belum ada siswa terdaftar.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Bottom Summary Rows (Rata-rata, Tertinggi, Terendah) */}
            {tableRows.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-[11px] text-slate-700">
                <tr>
                  <td colSpan={2} className="py-2 px-3 text-right border-r border-slate-200 uppercase">
                    Rata-Rata Mapel
                  </td>
                  {statsPerMapel.map((st, i) => (
                    <td key={i} className="py-2 px-2 text-center border-r border-slate-200 tabular-nums text-emerald-800">
                      {st.avg}
                    </td>
                  ))}
                  <td colSpan={3} className="bg-slate-100" />
                </tr>
                <tr>
                  <td colSpan={2} className="py-2 px-3 text-right border-r border-slate-200 uppercase">
                    Nilai Tertinggi
                  </td>
                  {statsPerMapel.map((st, i) => (
                    <td key={i} className="py-2 px-2 text-center border-r border-slate-200 tabular-nums text-blue-800">
                      {st.max}
                    </td>
                  ))}
                  <td colSpan={3} className="bg-slate-100" />
                </tr>
                <tr>
                  <td colSpan={2} className="py-2 px-3 text-right border-r border-slate-200 uppercase">
                    Nilai Terendah
                  </td>
                  {statsPerMapel.map((st, i) => (
                    <td key={i} className="py-2 px-2 text-center border-r border-slate-200 tabular-nums text-rose-800">
                      {st.min}
                    </td>
                  ))}
                  <td colSpan={3} className="bg-slate-100" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
