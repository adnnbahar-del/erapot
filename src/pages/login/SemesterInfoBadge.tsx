// src/pages/login/SemesterInfoBadge.tsx
// Menampilkan info semester aktif (hanya teks info murni, bukan dropdown)
// Bersumber langsung dari dokumen tahunAjaran aktif di Firestore via onSnapshot.

import React from 'react';
import { CalendarCheck, AlertTriangle } from 'lucide-react';

interface SemesterInfoBadgeProps {
  label: string; // e.g. "Tahun Ajaran 2026/2027 · Semester Genap (aktif)"
  isLoading?: boolean;
  isError?: boolean;
}

export const SemesterInfoBadge: React.FC<SemesterInfoBadgeProps> = ({
  label,
  isLoading = false,
  isError = false,
}) => {
  if (isLoading) {
    return (
      <div className="w-full h-10 rounded-field bg-[#edf1f7] animate-pulse border border-line" />
    );
  }

  const isUnset = isError || !label || label.includes('belum diatur');

  if (isUnset) {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-field bg-amber-50 border border-amber-300">
        <AlertTriangle className="w-[18px] h-[18px] text-amber-600 shrink-0" strokeWidth={2} />
        <span className="text-xs sm:text-sm font-semibold text-amber-900 leading-snug">
          {label || 'Tahun ajaran belum diatur — hubungi admin'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-field bg-[#eef4ff] border border-[#c5d3f8]">
      <CalendarCheck className="w-[18px] h-[18px] text-navy-500 shrink-0" strokeWidth={2} />
      <span className="text-xs sm:text-sm font-semibold text-navy-800 leading-snug">
        {label}
      </span>
    </div>
  );
};
