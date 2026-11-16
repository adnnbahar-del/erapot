import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CalendarCheck, Info } from 'lucide-react';
import { Kehadiran } from '../types';

export const RekapKehadiran: React.FC = () => {
  const { data, session, queueBatchUpsert } = useApp();

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

  const kehadiranMap = useMemo(() => {
    const map = new Map<string, Kehadiran>();
    data.kehadiran
      .filter((k) => k.kelas_id === session.kelasId)
      .forEach((k) => {
        map.set(k.siswa_id, k);
      });
    return map;
  }, [data.kehadiran, session.kelasId]);

  const handleUpdate = (siswaId: string, field: 'sakit' | 'izin' | 'alpa', valStr: string) => {
    const num = valStr.trim() === '' ? 0 : Math.max(0, parseInt(valStr, 10) || 0);
    const curr = kehadiranMap.get(siswaId) || {
      siswa_id: siswaId,
      kelas_id: session.kelasId,
      sakit: 0,
      izin: 0,
      alpa: 0,
    };

    const updated = {
      ...curr,
      [field]: num,
    };

    queueBatchUpsert('kehadiran', [updated], ['siswa_id', 'kelas_id']);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-kemdikbud-dark">
            <CalendarCheck size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Rekap Ketidakhadiran Peserta Didik
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Dicetak pada kolom Ketidakhadiran (Sakit, Izin, Tanpa Keterangan) di rapor
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs text-slate-700 border-b border-slate-300">
              <tr className="text-[11px] font-bold">
                <th className="py-2.5 px-3 text-center w-12 border-r border-slate-200">No</th>
                <th className="py-2.5 px-3 min-w-[200px] border-r border-slate-200">
                  Nama Peserta Didik
                </th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200 min-w-[100px]">
                  Sakit (hari)
                </th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200 min-w-[100px]">
                  Izin (hari)
                </th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200 min-w-[100px]">
                  Tanpa Keterangan
                </th>
                <th className="py-2.5 px-3 text-center bg-slate-200/60 font-black min-w-[90px]">
                  Total Hari
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {enrolledStudents.length > 0 ? (
                enrolledStudents.map((s, idx) => {
                  const rec = kehadiranMap.get(s.id) || {
                    siswa_id: s.id,
                    kelas_id: session.kelasId,
                    sakit: 0,
                    izin: 0,
                    alpa: 0,
                  };

                  const total = (Number(rec.sakit) || 0) + (Number(rec.izin) || 0) + (Number(rec.alpa) || 0);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border-r border-slate-200 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200">
                        {s.nama}
                      </td>

                      {/* Sakit */}
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          min={0}
                          value={rec.sakit || ''}
                          onChange={(e) => handleUpdate(s.id, 'sakit', e.target.value)}
                          placeholder="0"
                          className="w-20 h-8 text-center bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none tabular-nums font-semibold text-slate-800"
                        />
                      </td>

                      {/* Izin */}
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          min={0}
                          value={rec.izin || ''}
                          onChange={(e) => handleUpdate(s.id, 'izin', e.target.value)}
                          placeholder="0"
                          className="w-20 h-8 text-center bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none tabular-nums font-semibold text-slate-800"
                        />
                      </td>

                      {/* Alpa */}
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          min={0}
                          value={rec.alpa || ''}
                          onChange={(e) => handleUpdate(s.id, 'alpa', e.target.value)}
                          placeholder="0"
                          className="w-20 h-8 text-center bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none tabular-nums font-semibold text-slate-800"
                        />
                      </td>

                      {/* Total */}
                      <td className="py-2 px-3 text-center font-bold text-slate-900 bg-slate-50/50 tabular-nums">
                        {total > 0 ? (
                          <span className="text-rose-700">{total} hari</span>
                        ) : (
                          <span className="text-slate-400">0 hari</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
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
