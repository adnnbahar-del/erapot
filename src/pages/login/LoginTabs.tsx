// src/pages/login/LoginTabs.tsx
// Segmented-control dengan 3 tab: Wali Kelas | Guru Mapel | Admin
// Navigasi keyboard: Arrow Left/Right berpindah tab.

import React, { useRef } from 'react';
import { GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';

export type LoginTab = 'guru' | 'guru_mapel' | 'admin';

interface LoginTabsProps {
  activeTab: LoginTab;
  onTabChange: (tab: LoginTab) => void;
}

const TABS: { id: LoginTab; label: string; Icon: React.ElementType }[] = [
  { id: 'guru',       label: 'Wali Kelas', Icon: GraduationCap },
  { id: 'guru_mapel', label: 'Guru Mapel', Icon: BookOpen      },
  { id: 'admin',      label: 'Admin',      Icon: ShieldCheck   },
];

export const LoginTabs: React.FC<LoginTabsProps> = ({ activeTab, onTabChange }) => {
  const refs = useRef<Record<LoginTab, HTMLButtonElement | null>>({
    guru: null, guru_mapel: null, admin: null,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, current: LoginTab) => {
    const ids = TABS.map((t) => t.id);
    const idx = ids.indexOf(current);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = ids[(idx + 1) % ids.length];
      onTabChange(next);
      refs.current[next]?.focus();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = ids[(idx - 1 + ids.length) % ids.length];
      onTabChange(prev);
      refs.current[prev]?.focus();
    }
  };

  const activeIdx = TABS.findIndex((t) => t.id === activeTab);

  return (
    <div className="w-full space-y-3">
      {/* Segmented Control */}
      <div
        role="tablist"
        aria-label="Pilih peran login"
        className="relative bg-[#eef1f8] rounded-field p-1 grid grid-cols-3 select-none"
      >
        {/* Sliding white pill */}
        <div
          aria-hidden="true"
          className="absolute top-1 bottom-1 pointer-events-none bg-white rounded-[9px] shadow-tab transition-transform duration-250 ease-[cubic-bezier(.3,.7,.2,1)]"
          style={{
            width: 'calc(33.333% - 2.67px)',
            transform: `translateX(calc(${activeIdx * 100}% + ${activeIdx * 4}px))`,
          }}
        />

        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => { refs.current[tab.id] = el; }}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={`
              relative z-10 h-10 flex items-center justify-center gap-1.5 rounded-[9px]
              text-xs font-bold transition-colors duration-150 outline-none
              focus-visible:ring-[3px] focus-visible:ring-[#9db3ff] focus-visible:ring-offset-2
              ${activeTab === tab.id ? 'text-ink' : 'text-muted hover:text-ink'}
            `.trim().replace(/\s+/g, ' ')}
          >
            <tab.Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Greeting Subtitle */}
      <p className="text-sm text-[#4b5572] text-center leading-normal px-2 font-medium">
        {activeTab === 'guru'
          ? 'Masuk untuk mengisi nilai dan mencetak rapor kelas Anda.'
          : activeTab === 'guru_mapel'
          ? 'Masuk untuk menginput nilai mata pelajaran yang ditugaskan.'
          : 'Kelola akun guru, tahun ajaran, dan data sekolah.'}
      </p>
    </div>
  );
};
