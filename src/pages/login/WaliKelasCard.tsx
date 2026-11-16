import React from 'react';
import { InfoRombelLogin } from '../../types';

interface WaliKelasCardProps {
  rombel?: InfoRombelLogin | null;
  isLoading?: boolean;
}

export function getInitials(fullName: string): string {
  if (!fullName) return 'WK';
  // Remove degrees after comma
  const withoutDegrees = fullName.replace(/,.*$/g, '').trim();
  // Remove honorary front titles
  const clean = withoutDegrees.replace(/^(drs?|dra|prof|dr|h|hj)\.?\s+/i, '');
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'WK';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const WaliKelasCard: React.FC<WaliKelasCardProps> = ({ rombel, isLoading = false }) => {
  if (isLoading) {
    return (
      <div
        aria-live="polite"
        className="w-full h-[62px] rounded-field bg-[#edf1f7] animate-pulse flex items-center px-3 gap-3 border border-line"
      >
        <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-24 bg-slate-200 rounded" />
          <div className="h-3 w-40 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (!rombel || !rombel.ada_akun || !rombel.nama_wali) {
    return (
      <div
        aria-live="polite"
        className="w-full rounded-field p-2.5 sm:px-3 bg-amber-tint border border-amber-edge flex items-center gap-3 text-left transition-all duration-200"
      >
        <div className="w-9 h-9 rounded-full bg-amber text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-sm">
          !
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#8a4b00] leading-snug">
            Data wali belum lengkap — hubungi admin
          </p>
        </div>
      </div>
    );
  }

  const initials = getInitials(rombel.nama_wali);
  const labelDisplay = !rombel.huruf
    ? String(rombel.tingkat || rombel.nama.replace(/\D/g, ''))
    : (rombel.nama || `${rombel.tingkat}${rombel.huruf}`);

  return (
    <div
      aria-live="polite"
      className="w-full rounded-field p-2.5 sm:px-3 bg-guru-tint border border-guru-edge flex items-center gap-3 text-left transition-all duration-200"
    >
      <div className="w-9 h-9 rounded-full bg-guru text-white font-extrabold text-xs tracking-wider flex items-center justify-center shrink-0 shadow-sm">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted truncate">
          WALI KELAS {labelDisplay} · FASE {rombel.fase}
        </div>
        <div className="text-sm font-bold text-ink truncate leading-tight mt-0.5">
          {rombel.nama_wali}
        </div>
      </div>
    </div>
  );
};
