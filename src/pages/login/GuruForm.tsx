// src/pages/login/GuruForm.tsx
// Form login Tab "Wali Kelas"
// Perubahan Tahap 1:
//   • Dropdown semester dihapus → diganti SemesterInfoBadge (info saja dari pengaturan admin)
//   • Placeholder password: "Kata sandi wali kelas"
//   • Pilihan kelas terakhir tersimpan di localStorage (try/catch)

import React, { useRef, useId } from 'react';
import { School } from 'lucide-react';
import { InfoRombelLogin, Semester } from '../../types';
import { Field } from './Field';
import { PasswordField } from './PasswordField';
import { WaliKelasCard } from './WaliKelasCard';
import { SubmitButton } from './SubmitButton';
import { SemesterInfoBadge } from './SemesterInfoBadge';

// Tetap diekspor untuk backward-compat dengan Login.tsx lama
export interface SemesterOption {
  tahun: string;
  semester: Semester;
  label: string;
  aktif: boolean;
}

interface GuruFormProps {
  rombelList: InfoRombelLogin[];
  isLoadingRombel?: boolean;
  selectedRombel: string;
  onSelectRombel: (rombelNama: string) => void;
  password: string;
  onChangePassword: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  hasPasswordError?: boolean;
  /** Label semester aktif dari dokumen tahunAjaran aktif */
  semesterLabel?: string;
  isLoadingSemester?: boolean;
  isSemesterValid?: boolean;
}

export const GuruForm: React.FC<GuruFormProps> = ({
  rombelList,
  isLoadingRombel = false,
  selectedRombel,
  onSelectRombel,
  password,
  onChangePassword,
  onSubmit,
  isSubmitting,
  hasPasswordError = false,
  semesterLabel = '',
  isLoadingSemester = false,
  isSemesterValid = true,
}) => {
  const rombelSelectId = useId();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Urutkan kelas aktif: tingkat (1-6), rombel kosong dulu, lalu A, B, C, dst.
  const activeRombels = rombelList
    .filter((r) => r.aktif !== false)
    .sort((a, b) => {
      const tA = a.tingkat || parseInt(a.nama?.replace(/\D/g, '') || '1', 10) || 1;
      const tB = b.tingkat || parseInt(b.nama?.replace(/\D/g, '') || '1', 10) || 1;
      if (tA !== tB) return tA - tB;
      const hA = (a.huruf || '').trim().toUpperCase();
      const hB = (b.huruf || '').trim().toUpperCase();
      if (!hA && hB) return -1;
      if (hA && !hB) return 1;
      return hA.localeCompare(hB);
    });

  const getNamaLengkap = (r: InfoRombelLogin) => {
    const t = r.tingkat || parseInt(r.nama?.replace(/\D/g, '') || '1', 10) || 1;
    const cleanHuruf = (r.huruf || '').trim().toUpperCase();
    return cleanHuruf ? `Kelas ${t}${cleanHuruf}` : `Kelas ${t}`;
  };

  const currentRombel = activeRombels.find(
    (r) => {
      const full = getNamaLengkap(r);
      return (
        r.nama === selectedRombel ||
        r.id === selectedRombel ||
        full === selectedRombel ||
        (r.huruf && `${r.tingkat}${r.huruf}` === selectedRombel) ||
        (!r.huruf && String(r.tingkat) === selectedRombel)
      );
    }
  );

  const canSubmit = Boolean(
    currentRombel &&
    currentRombel.ada_akun &&
    currentRombel.nama_wali?.trim() &&
    isSemesterValid
  );

  return (
    <form
      id="panel-guru"
      role="tabpanel"
      aria-labelledby="tab-guru"
      onSubmit={onSubmit}
      className="space-y-4"
    >
      {/* 1. Kelas — DAFTAR DATAR (FLAT), SETIAP BARIS BISA DIPILIH */}
      <Field
        id={rombelSelectId}
        label="KELAS"
        icon={<School className="w-[18px] h-[18px]" strokeWidth={2} />}
        isSelect
        selectProps={{
          value: currentRombel ? getNamaLengkap(currentRombel) : selectedRombel,
          onChange: (e) => onSelectRombel(e.target.value),
          disabled: isSubmitting,
        }}
      >
        {activeRombels.map((r) => {
          const namaLengkap = getNamaLengkap(r);
          const labelSuffix = r.ada_akun ? '' : ' · belum ada akun';
          return (
            <option key={r.id || namaLengkap} value={namaLengkap}>
              {namaLengkap}{labelSuffix}
            </option>
          );
        })}
      </Field>

      {/* 2. Kartu Wali Kelas */}
      <WaliKelasCard rombel={currentRombel} isLoading={isLoadingRombel} />

      {/* 3. Kata Sandi */}
      <PasswordField
        ref={passwordInputRef}
        id="guru-password"
        label="KATA SANDI"
        value={password}
        onChange={(e) => onChangePassword(e.target.value)}
        placeholder="Kata sandi wali kelas"
        disabled={isSubmitting}
        error={hasPasswordError}
      />

      {/* 4. Info Semester Aktif (hanya info murni, bukan dropdown) */}
      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-[0.06em] text-muted select-none">
          TAHUN AJARAN &amp; SEMESTER
        </label>
        <SemesterInfoBadge
          label={semesterLabel}
          isLoading={isLoadingSemester}
          isError={!isSemesterValid}
        />
      </div>

      {/* 5. Tombol Masuk */}
      <div className="pt-1">
        <SubmitButton
          mode="guru"
          isSubmitting={isSubmitting}
          disabled={!canSubmit}
        />
      </div>

      {/* 6. Kaki Kartu */}
      <div className="border-t border-line pt-3 mt-4 text-center">
        <p className="text-[13px] text-[#4b5572] font-medium">
          Lupa kata sandi? Hubungi admin sekolah.
        </p>
      </div>
    </form>
  );
};
