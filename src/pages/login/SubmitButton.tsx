import React from 'react';
import { Loader2 } from 'lucide-react';

interface SubmitButtonProps {
  mode: 'guru' | 'guru_mapel' | 'admin';
  isSubmitting?: boolean;
  disabled?: boolean;
  className?: string;
}

const LABEL: Record<string, string> = {
  guru:       'Masuk sebagai Wali Kelas',
  guru_mapel: 'Masuk sebagai Guru Mapel',
  admin:      'Masuk sebagai Admin',
};

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  mode,
  isSubmitting = false,
  disabled = false,
  className = '',
}) => {
  const isAdmin = mode === 'admin';

  const baseStyle = `
    w-full h-[50px] rounded-field font-extrabold text-base text-white
    flex items-center justify-center gap-2 select-none
    transition-all duration-150 ease-out outline-none
    active:translate-y-[1px]
    focus:outline-none focus:ring-[3px] focus:ring-[#9db3ff] focus:ring-offset-2
  `;

  const variantStyle = isAdmin
    ? 'bg-admin hover:bg-admin-700 shadow-btn-admin active:bg-admin-700 disabled:bg-admin/60'
    : 'bg-guru hover:bg-guru-700 shadow-btn-guru active:bg-guru-700 disabled:bg-guru/60';

  return (
    <button
      type="submit"
      disabled={disabled || isSubmitting}
      className={`
        ${baseStyle}
        ${variantStyle}
        ${disabled || isSubmitting ? 'cursor-not-allowed opacity-70 !shadow-none !translate-y-0' : 'cursor-pointer'}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="w-[18px] h-[18px] animate-spin text-white" strokeWidth={2.5} />
          <span>Memeriksa…</span>
        </>
      ) : (
        LABEL[mode] ?? 'Masuk'
      )}
    </button>
  );
};
