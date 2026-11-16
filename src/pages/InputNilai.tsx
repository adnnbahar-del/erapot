import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getMapelForSession } from '../lib/mapelService';
import { CheckSquare, Calculator, BookOpen, ArrowRight, CheckCircle2, Clock } from 'lucide-react';

export const InputNilai: React.FC = () => {
  const { data, session } = useApp();
  const navigate = useNavigate();

  if (!data || !session) return null;

  const currentClassRoster = data.kelasSiswa.filter((ks) => ks.kelas_id === session.kelasId);
  const studentCount = currentClassRoster.length;

  const classMapel = getMapelForSession(data.mapel, session);

  return (
    <div className="space-y-8">
      {/* 2 Big Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Asesmen Formatif */}
        <div
          onClick={() => navigate('/asesmen-formatif')}
          className="bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-500 p-6 sm:p-8 shadow-xs hover:shadow-lg transition cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-kemdikbud-dark flex items-center justify-center mb-5 group-hover:scale-105 transition">
              <CheckSquare size={30} />
            </div>
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">
              Kualitatif · Deskripsi
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              Asesmen Formatif
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Menilai ketercapaian Tujuan Pembelajaran (KKTP) dan memilih TP yang tampil di rapor untuk menghasilkan kalimat deskripsi capaian kompetensi otomatis.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-kemdikbud-dark">
            <span>Buka Input Formatif</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Card 2: Asesmen Sumatif */}
        <div
          onClick={() => navigate('/asesmen-sumatif')}
          className="bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-500 p-6 sm:p-8 shadow-xs hover:shadow-lg transition cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5 group-hover:scale-105 transition">
              <Calculator size={30} />
            </div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest">
              Kuantitatif · Nilai Angka
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              Asesmen Sumatif
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Mengisi nilai angka (0–100) per Lingkup Materi (Sumatif 1, 2, …), PTS, dan PAS untuk menghasilkan Nilai Rapor secara otomatis. Mendukung paste dari Excel.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>Buka Input Sumatif</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition" />
          </div>
        </div>
      </div>

      {/* Progress Kelengkapan Per Mata Pelajaran */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BookOpen size={18} className="text-kemdikbud-dark" />
              <span>Status Penilaian Per Mata Pelajaran</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantauan pengisian asesmen formatif dan sumatif Kelas {session.kelas}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-3">Mata Pelajaran</th>
                <th className="py-3 px-3 text-center">Tujuan Pembelajaran</th>
                <th className="py-3 px-3 text-center">Lingkup Materi</th>
                <th className="py-3 px-3 text-center">Formatif Terisi</th>
                <th className="py-3 px-3 text-center">Sumatif Terisi</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classMapel.map((m, idx) => {
                const mapelTPs = data.tp.filter((t) => t.mapel_id === m.id);
                const mapelLMs = data.lm.filter((l) => l.mapel_id === m.id);

                // Count filled formatif
                const formatifFilled = data.formatif.filter((f) =>
                  mapelTPs.some((t) => t.id === f.tp_id)
                ).length;

                // Count filled sumatif
                const sumatifLMFilled = data.sumatifLM.filter((s) =>
                  mapelLMs.some((l) => l.id === s.lm_id) && s.nilai !== null
                ).length;

                const isFormatifDone = studentCount > 0 && mapelTPs.length > 0 && formatifFilled >= studentCount;
                const isSumatifDone = studentCount > 0 && mapelLMs.length > 0 && sumatifLMFilled >= studentCount;

                return (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{m.nama}</div>
                      <div className="text-[11px] font-mono text-blue-700">{m.singkatan}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-slate-700">{mapelTPs.length} TP</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-slate-700">{mapelLMs.length} LM</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isFormatifDone ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          <CheckCircle2 size={12} /> Selesai
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                          <Clock size={12} /> {formatifFilled} entri
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isSumatifDone ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          <CheckCircle2 size={12} /> Selesai
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                          <Clock size={12} /> {sumatifLMFilled} entri
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/asesmen-sumatif?mapel=${m.id}`)}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                        >
                          Sumatif
                        </button>
                        <button
                          onClick={() => navigate(`/asesmen-formatif?mapel=${m.id}`)}
                          className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          Formatif
                        </button>
                      </div>
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
};
