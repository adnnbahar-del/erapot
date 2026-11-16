// src/pages/login/AdminForm.tsx
// Form login Tab "Admin" — username + password

import React, { useRef, useId } from 'react';
import { User } from 'lucide-react';
import { Field } from './Field';
import { PasswordField } from './PasswordField';
import { SubmitButton } from './SubmitButton';

interface AdminFormProps {
  username: string;
  onChangeUsername: (val: string) => void;
  password: string;
  onChangePassword: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  hasUserError?: boolean;
  hasPasswordError?: boolean;
  isSemesterValid?: boolean;
}

export const AdminForm: React.FC<AdminFormProps> = ({
  username,
  onChangeUsername,
  password,
  onChangePassword,
  onSubmit,
  isSubmitting,
  hasUserError = false,
  hasPasswordError = false,
  isSemesterValid = true,
}) => {
  const usernameId = useId();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      id="panel-admin"
      role="tabpanel"
      aria-labelledby="tab-admin"
      onSubmit={onSubmit}
      className="space-y-4"
    >
      {/* 1. Nama Pengguna / Email */}
      <Field
        id={usernameId}
        label="EMAIL / NAMA PENGGUNA"
        icon={<User className="w-[18px] h-[18px]" strokeWidth={2} />}
        error={hasUserError}
        inputProps={{
          type: 'text',
          value: username,
          onChange: (e) => onChangeUsername(e.target.value),
          placeholder: 'adnnbahar@gmail.com atau admin',
          disabled: isSubmitting,
          autoComplete: 'username',
        }}
      />

      {/* 2. Kata Sandi */}
      <PasswordField
        ref={passwordInputRef}
        id="admin-password"
        label="KATA SANDI"
        value={password}
        onChange={(e) => onChangePassword(e.target.value)}
        placeholder="Kata sandi admin"
        disabled={isSubmitting}
        error={hasPasswordError}
      />

      {/* 3. Tombol Masuk */}
      <div className="pt-1">
        <SubmitButton mode="admin" isSubmitting={isSubmitting} disabled={isSemesterValid === false} />
      </div>

      {/* 4. Kaki Kartu — kontras WCAG AA (#4b5572 ≈ 4.6:1 di atas putih) */}
      <div className="border-t border-line pt-3 mt-4 text-center">
        <p className="text-[13px] text-[#4b5572] font-medium">
          Khusus operator atau kepala sekolah.
        </p>
      </div>
    </form>
  );
};
