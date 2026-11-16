import React, { useState, forwardRef } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface PasswordFieldProps {
  id: string;
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  autoComplete?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      id,
      label = 'KATA SANDI',
      value,
      onChange,
      placeholder = 'Kata sandi',
      error = false,
      disabled = false,
      autoComplete = 'current-password',
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockActive, setCapsLockActive] = useState(false);

    const handleKeyActivity = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.getModifierState) {
        setCapsLockActive(e.getModifierState('CapsLock'));
      }
    };

    return (
      <div className="w-full space-y-1.5 text-left">
        <label
          htmlFor={id}
          className="block text-xs font-bold uppercase tracking-[0.06em] text-muted select-none"
        >
          {label}
        </label>
        <div className="relative flex items-center">
          <div
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-soft pointer-events-none flex items-center justify-center w-[18px] h-[18px]"
          >
            <Lock className="w-[18px] h-[18px]" strokeWidth={2} />
          </div>

          <input
            ref={ref}
            id={id}
            type={showPassword ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyActivity}
            onKeyUp={handleKeyActivity}
            onBlur={() => setCapsLockActive(false)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete={autoComplete}
            className={`
              w-full h-12 bg-paper-2 rounded-field text-ink text-base sm:text-sm font-medium
              border-[1.5px] transition-all duration-200 outline-none
              pl-11 pr-12
              hover:border-line-2 focus:bg-white focus:border-navy-500 focus:shadow-focus
              disabled:opacity-60 disabled:cursor-not-allowed
              ${error ? '!border-rose !shadow-focus-bad' : 'border-line'}
            `.trim().replace(/\s+/g, ' ')}
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            tabIndex={0}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-soft hover:text-ink hover:bg-black/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#9db3ff] focus:ring-offset-1"
          >
            {showPassword ? (
              <EyeOff className="w-[18px] h-[18px]" strokeWidth={2} />
            ) : (
              <Eye className="w-[18px] h-[18px]" strokeWidth={2} />
            )}
          </button>
        </div>

        {capsLockActive && (
          <div
            className="flex items-center gap-1.5 text-xs font-semibold text-[#a4610a] pt-0.5 animate-fadeIn"
            role="status"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
            <span>Caps Lock aktif</span>
          </div>
        )}
      </div>
    );
  }
);

PasswordField.displayName = 'PasswordField';
