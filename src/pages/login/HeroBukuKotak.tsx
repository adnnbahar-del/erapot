// src/pages/login/HeroBukuKotak.tsx
// Panel kiri desktop. Tahap 1: garis oranye vertikal dijadikan elemen dekoratif
// "buku catatan" yang jelas (lengkap dengan 2 lubang jilid di kiri).

import React from 'react';

export const HeroBukuKotak: React.FC = () => {
  return (
    <aside
      aria-hidden="true"
      className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-navy-900 text-white select-none min-h-screen py-14 pr-12 xl:pr-14 pl-[116px] xl:pl-[124px]"
      style={{
        backgroundColor: '#081a57',
        backgroundImage: `
          radial-gradient(900px 500px at 20% 0%, rgba(53,82,196,.55), transparent 60%),
          linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, 22px 22px, 22px 22px',
      }}
    >
      {/* ── Dekorasi Tepi Buku Kotak ─────────────────────────────────────────── */}
      {/* Garis margin oranye — kini bagian dari ilustrasi "buku kotak" */}
      <div
        aria-hidden="true"
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{ left: '92px', width: '2px', backgroundColor: 'rgba(242,163,58,0.55)' }}
      />
      {/* Lubang jilid buku atas */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none flex flex-col gap-[56px]"
        style={{ left: '72px', top: '80px' }}
      >
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="w-[14px] h-[14px] rounded-full border-2"
            style={{ borderColor: 'rgba(242,163,58,0.45)', backgroundColor: 'rgba(0,0,0,0.25)' }}
          />
        ))}
      </div>

      {/* ── Merek ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3.5 relative z-10">
        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md">
          <img
            src="/logo/tut-wuri-handayani.png"
            alt="Logo Tut Wuri Handayani"
            className="w-8 h-8 object-contain"
          />
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-[0.04em] text-white uppercase leading-tight font-sans">
            E-RAPOR SD
          </h1>
          <p className="text-xs font-bold tracking-[0.1em] uppercase text-[#aab6e6] leading-none mt-0.5">
            KURIKULUM MERDEKA
          </p>
        </div>
      </div>

      {/* ── Headline & Lembar Rapor ───────────────────────────────────────────── */}
      <div className="my-auto py-8 relative z-10 max-w-[500px]">
        <h2 className="font-display text-[34px] xl:text-[44px] 2xl:text-[48px] font-bold text-white leading-[1.08] max-w-[470px]">
          Rapor rapi, <span className="text-amber">tepat waktu</span>, tanpa rumus Excel.
        </h2>

        <p className="mt-4 text-base text-[#c3ccf0] leading-[1.6]">
          Isi asesmen, kokurikuler, dan 7 KAIH. Deskripsi capaian tersusun otomatis, dan rapor
          siap diunduh per anak atau satu rombel.
        </p>

        {/* Lembar Rapor HTML/CSS */}
        <div className="mt-9 relative inline-block">
          <div
            className="w-[360px] bg-[#fbfcff] rounded-[10px] p-[18px] pb-4 shadow-sheet border border-line/60 text-ink relative animate-float-report"
            style={{ boxShadow: '0 24px 50px rgba(2,8,35,0.55)' }}
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted mb-0.5">
              LAPORAN HASIL BELAJAR
            </div>
            <div className="text-sm font-bold text-ink mb-3.5">
              Peserta Didik · Kelas 6A · Fase C
            </div>
            <div className="space-y-2 text-xs">
              {[
                { nama: 'Pendidikan Pancasila', nilai: 88, pct: '88%' },
                { nama: 'Bahasa Indonesia',     nilai: 86, pct: '86%' },
                { nama: 'Matematika',           nilai: 84, pct: '84%' },
              ].map((m) => (
                <div key={m.nama} className="flex items-center justify-between text-slate-700">
                  <span className="font-medium">{m.nama}</span>
                  <span className="flex-1 mx-2 border-b border-dashed border-[#d6dcec]" />
                  <div className="flex items-center gap-2">
                    <span className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                      <span className="block h-full bg-navy-500 rounded-full" style={{ width: m.pct }} />
                    </span>
                    <span className="font-bold text-navy-900 tabular-nums">{m.nilai}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cap SIAP CETAK */}
            <div className="absolute -bottom-3.5 -right-3.5 w-[78px] h-[78px] rounded-full border-2 border-guru bg-white text-guru flex flex-col items-center justify-center shadow-lg transform rotate-[14deg] select-none">
              <div className="w-[68px] h-[68px] rounded-full border border-guru/40 flex flex-col items-center justify-center">
                <span className="text-[10px] font-extrabold tracking-[0.08em] leading-tight text-center">
                  SIAP<br />CETAK
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chip Fitur ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2.5 relative z-10 pt-4">
        {['3 peran pengguna', 'PDF per anak & ZIP', 'Berbasis Firebase'].map((text) => (
          <span
            key={text}
            className="text-xs py-1.5 px-3 rounded-full border border-white/22 text-[#dbe2ff] font-medium backdrop-blur-xs"
          >
            {text}
          </span>
        ))}
      </div>
    </aside>
  );
};
