// src/pages/login/LoginCard.tsx
// Kartu login dengan 3 tab: Wali Kelas | Guru Mapel | Admin
// Tahap 1: 3 peran, hapus garis oranye panel (sudah diubah jadi dekoratif di HeroBukuKotak),
// kontras teks abu-abu diperbaiki (WCAG AA).

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { LoginTabs, type LoginTab } from './LoginTabs';
import { GuruForm } from './GuruForm';
import { GuruMapelForm } from './GuruMapelForm';
import { AdminForm } from './AdminForm';
import { InfoRombelLogin } from '../../types';

interface LoginCardProps {
  activeTab: LoginTab;
  onTabChange: (tab: LoginTab) => void;
  // Wali Kelas form props
  rombelList: InfoRombelLogin[];
  isLoadingRombel: boolean;
  selectedRombel: string;
  onSelectRombel: (rombelNama: string) => void;
  semesterLabel?: string;
  isLoadingSemester?: boolean;
  guruPassword: string;
  onChangeGuruPassword: (val: string) => void;
  onSubmitGuru: (e: React.FormEvent) => void;
  // Guru Mapel form props
  guruMapelUsername: string;
  onChangeGuruMapelUsername: (val: string) => void;
  guruMapelPassword: string;
  onChangeGuruMapelPassword: (val: string) => void;
  onSubmitGuruMapel: (e: React.FormEvent) => void;
  // Admin form props
  adminUsername: string;
  onChangeAdminUsername: (val: string) => void;
  adminPassword: string;
  onChangeAdminPassword: (val: string) => void;
  onSubmitAdmin: (e: React.FormEvent) => void;
  // State
  isSubmitting: boolean;
  errorMsg: string;
  shakeCard: boolean;
  focusedErrorField?: 'guruPass' | 'gmUser' | 'gmPass' | 'adminUser' | 'adminPass' | null;
}

export const LoginCard: React.FC<LoginCardProps> = ({
  activeTab,
  onTabChange,
  rombelList,
  isLoadingRombel,
  selectedRombel,
  onSelectRombel,
  semesterLabel,
  isLoadingSemester,
  guruPassword,
  onChangeGuruPassword,
  onSubmitGuru,
  guruMapelUsername,
  onChangeGuruMapelUsername,
  guruMapelPassword,
  onChangeGuruMapelPassword,
  onSubmitGuruMapel,
  adminUsername,
  onChangeAdminUsername,
  adminPassword,
  onChangeAdminPassword,
  onSubmitAdmin,
  isSubmitting,
  errorMsg,
  shakeCard,
  focusedErrorField,
}) => {
  return (
    <div
      className={`
        w-full max-w-[420px] bg-white rounded-card border border-line
        shadow-card p-[18px_20px_20px] lg:p-[30px_28px_22px]
        space-y-4 sm:space-y-5 relative z-10
        animate-card-slide-up
        ${shakeCard ? 'animate-subtle-shake' : ''}
      `.trim().replace(/\s+/g, ' ')}
    >
      {/* Kepala Kartu (desktop ≥ 960px) */}
      <div className="hidden lg:flex flex-col items-center text-center pb-1">
        <div className="w-[84px] h-[84px] rounded-full bg-white border border-line flex items-center justify-center shadow-[0_6px_16px_rgba(15,28,80,0.1)] mb-3">
          <img
            src="/logo/tut-wuri-handayani.png"
            alt="Logo Tut Wuri Handayani"
            className="w-16 h-16 object-contain"
          />
        </div>
        <h1 className="font-display text-[28px] font-bold text-ink leading-tight">
          E-Rapor SD
        </h1>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-soft mt-1 leading-none">
          KURIKULUM MERDEKA
        </p>
      </div>

      {/* Tab Selector */}
      <LoginTabs activeTab={activeTab} onTabChange={onTabChange} />

      {/* Kotak Galat */}
      {errorMsg && (
        <div
          role="alert"
          className="w-full rounded-[10px] bg-rose-tint p-3 text-rose-ink text-sm font-semibold flex items-start gap-2.5 text-left border border-rose/30 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 text-rose shrink-0 mt-0.5" strokeWidth={2.2} />
          <span className="leading-snug">{errorMsg}</span>
        </div>
      )}

      {/* Form Panels */}
      {activeTab === 'guru' && (
        <GuruForm
          rombelList={rombelList}
          isLoadingRombel={isLoadingRombel}
          selectedRombel={selectedRombel}
          onSelectRombel={onSelectRombel}
          semesterLabel={semesterLabel}
          isLoadingSemester={isLoadingSemester}
          password={guruPassword}
          onChangePassword={onChangeGuruPassword}
          onSubmit={onSubmitGuru}
          isSubmitting={isSubmitting}
          hasPasswordError={focusedErrorField === 'guruPass'}
        />
      )}

      {activeTab === 'guru_mapel' && (
        <GuruMapelForm
          username={guruMapelUsername}
          onChangeUsername={onChangeGuruMapelUsername}
          password={guruMapelPassword}
          onChangePassword={onChangeGuruMapelPassword}
          onSubmit={onSubmitGuruMapel}
          isSubmitting={isSubmitting}
          hasUserError={focusedErrorField === 'gmUser'}
          hasPasswordError={focusedErrorField === 'gmPass'}
        />
      )}

      {activeTab === 'admin' && (
        <AdminForm
          username={adminUsername}
          onChangeUsername={onChangeAdminUsername}
          password={adminPassword}
          onChangePassword={onChangeAdminPassword}
          onSubmit={onSubmitAdmin}
          isSubmitting={isSubmitting}
          hasUserError={focusedErrorField === 'adminUser'}
          hasPasswordError={focusedErrorField === 'adminPass'}
        />
      )}
    </div>
  );
};
