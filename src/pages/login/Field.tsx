import React from 'react';
import { ChevronDown } from 'lucide-react';

interface FieldProps {
  id: string;
  label: string;
  icon?: React.ReactNode;
  error?: boolean;
  isSelect?: boolean;
  children?: React.ReactNode;
  className?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  selectProps?: React.SelectHTMLAttributes<HTMLSelectElement>;
}

export const Field: React.FC<FieldProps> = ({
  id,
  label,
  icon,
  error = false,
  isSelect = false,
  children,
  className = '',
  inputProps,
  selectProps,
}) => {
  const baseControlClasses = `
    w-full h-12 bg-paper-2 rounded-field text-ink text-base sm:text-sm font-medium
    border-[1.5px] transition-all duration-200 outline-none
    hover:border-line-2 focus:bg-white focus:border-navy-500 focus:shadow-focus
    ${error ? '!border-rose !shadow-focus-bad' : 'border-line'}
    ${icon ? 'pl-11' : 'pl-4'}
    ${isSelect ? 'pr-10 appearance-none cursor-pointer' : 'pr-4'}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className="w-full space-y-1.5 text-left">
      <label
        htmlFor={id}
        className="block text-xs font-bold uppercase tracking-[0.06em] text-muted select-none"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        {icon && (
          <div
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-soft pointer-events-none flex items-center justify-center w-[18px] h-[18px]"
          >
            {icon}
          </div>
        )}

        {isSelect ? (
          <>
            <select id={id} className={baseControlClasses} {...selectProps}>
              {children}
            </select>
            <div
              aria-hidden="true"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-soft pointer-events-none flex items-center justify-center"
            >
              <ChevronDown className="w-4 h-4 text-soft" strokeWidth={2.2} />
            </div>
          </>
        ) : children ? (
          children
        ) : (
          <input id={id} className={baseControlClasses} {...inputProps} />
        )}
      </div>
    </div>
  );
};
