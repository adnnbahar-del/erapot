// src/pages/login/GuruMapelForm.tsx
// Form login Tab "Guru Mapel" — username + password

import React, { useRef, useId } from 'react';
import { User } from 'lucide-react';
import { Field } from './Field';
import { PasswordField } from './PasswordField';
import { SubmitButton } from './SubmitButton';

interface GuruMapelFormProps {
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

export const GuruMapelForm: React.FC<GuruMapelFormProps> = ({
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
      id="panel-guru-mapel"
      role="tabpanel"
      aria-labelledby="tab-guru-mapel"
      onSubmit={onSubmit}
      className="space-y-4"
    >
      {/* 1. Username */}
      <Field
        id={usernameId}
        label="NAMA PENGGUNA"
        icon={<User className="w-[18px] h-[18px]" strokeWidth={2} />}
        error={hasUserError}
        inputProps={{
          type: 'text',
          value: username,
          onChange: (e) => onChangeUsername(e.target.value),
          placeholder: 'username guru mapel',
          disabled: isSubmitting,
          autoComplete: 'username',
        }}
      />

      {/* 2. Kata Sandi */}
      <PasswordField
        ref={passwordInputRef}
        id="guruMapel-password"
        label="KATA SANDI"
        value={password}
        onChange={(e) => onChangePassword(e.target.value)}
        placeholder="Kata sandi guru mapel"
        disabled={isSubmitting}
        error={hasPasswordError}
      />

      {/* 3. Tombol Masuk */}
      <div className="pt-1">
        <SubmitButton mode="guru_mapel" isSubmitting={isSubmitting} disabled={isSemesterValid === false} />
      </div>

      {/* 4. Kaki Kartu */}
      <div className="border-t border-line pt-3 mt-4 text-center">
        <p className="text-[13px] text-soft">
          Lupa kata sandi? Hubungi admin sekolah.
        </p>
      </div>
    </form>
  );
};

