// src/pages/login/SemesterInfoBadge.tsx
// Menampilkan info semester aktif (gantikan dropdown semester di form Guru)
// Data diambil dari Firestore (pengaturan/aktif) atau fallback ke local mock.

import React from 'react';
import { CalendarCheck } from 'lucide-react';

interface SemesterInfoBadgeProps {
  label: string; // e.g. "2025/2026 Ganjil (aktif)"
  isLoading?: boolean;
}

export const SemesterInfoBadge: React.FC<SemesterInfoBadgeProps> = ({
  label,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="w-full h-10 rounded-field bg-[#edf1f7] animate-pulse border border-line" />
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-field bg-[#eef4ff] border border-[#c5d3f8]">
      <CalendarCheck className="w-[18px] h-[18px] text-navy-500 shrink-0" strokeWidth={2} />
      <span className="text-sm font-semibold text-navy-700 leading-snug">
        {label}
      </span>
    </div>
  );
};

