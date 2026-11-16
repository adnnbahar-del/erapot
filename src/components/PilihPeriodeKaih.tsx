import React from 'react';
import { Periode, LABEL_PERIODE, periodeBawaan, teksPeriode, daftarPilihanTahun } from '../lib/kaih';
import { Calendar, AlertCircle } from 'lucide-react';

interface PilihPeriodeKaihProps {
  tahun: number;
  periode: Periode;
  onPeriodeChange: (periode: Periode) => void;
  onTahunChange: (tahun: number) => void;
  tahunAjaran: string;
  semester: 1 | 2;
  mode?: 'input' | 'cetak';
  disabled?: boolean;
}

export const PilihPeriodeKaih: React.FC<PilihPeriodeKaihProps> = ({
  tahun,
  periode,
  onPeriodeChange,
  onTahunChange,
  tahunAjaran,
  semester,
  mode = 'input',
  disabled = false,
}) => {
  const bawaan = periodeBawaan(tahunAjaran, semester);
  const isOutOfActiveSemester = tahun !== bawaan.tahun || periode !== bawaan.periode;
  const listTahun = daftarPilihanTahun(tahunAjaran);

  // Pastikan tahun yang dipilih ada dalam opsi dropdown
  const opsiTahun = listTahun.includes(tahun) ? listTahun : [...listTahun, tahun].sort();

  const semesterLabel = semester === 1 ? 'Ganjil' : 'Genap';

  return (
    <div className="space-y-2.5">
      {/* Kontrol Berdampingan di Desktop, Bertumpuk di Layar Sempit */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Kontrol Periode Penilaian (Segmented Control) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Periode Penilaian
          </label>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(['JAN-JUN', 'JUL-DES'] as Periode[]).map((p) => {
              const active = periode === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPeriodeChange(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-white text-rose-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {LABEL_PERIODE[p]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kontrol Tahun */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Tahun
          </label>
          <div className="relative inline-block w-full sm:w-auto">
            <select
              value={tahun}
              disabled={disabled}
              onChange={(e) => onTahunChange(Number(e.target.value))}
              className={`w-full sm:w-28 pl-3 pr-8 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {opsiTahun.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <Calendar size={13} />
            </div>
          </div>
        </div>
      </div>

      {/* Ringkasan Periode Penilaian */}
      <div className="text-xs text-slate-500">
        Periode Penilaian: <strong className="text-slate-800 font-bold">{teksPeriode(tahun, periode)}</strong>
      </div>

      {/* Info Kecil Kuning jika di Luar Semester Aktif */}
      {isOutOfActiveSemester && (
        <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-lg">
          <AlertCircle size={14} className="shrink-0 text-amber-600" />
          <span>
            Anda sedang {mode === 'cetak' ? 'mencetak' : 'mengisi'} periode di luar semester aktif ({tahunAjaran} {semesterLabel}).
          </span>
        </div>
      )}
    </div>
  );
};
