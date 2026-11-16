import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calculateRekapDanPeringkat, formatRataRata } from '../lib/rapor';
import { periodeBawaan, normalisasiKaih, isKaihLengkap, teksPeriode } from '../lib/kaih';
import { getMapelForSession } from '../lib/mapelService';
import {
  Users,
  BookOpen,
  TrendingUp,
  UserX,
  Trophy,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  UserPlus,
  FileSpreadsheet,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { data, session, isLoading } = useApp();
  const navigate = useNavigate();

  if (isLoading || !data || !session) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  // Filter students enrolled in current class session
  const classRoster = data.kelasSiswa.filter((ks) => ks.kelas_id === session.kelasId);
  const enrolledStudents = data.siswa.filter((s) =>
    classRoster.some((ks) => ks.siswa_id === s.id)
  );

  const studentCount = enrolledStudents.length;
  const maxStudents = 50;
  const studentPercentage = Math.round((studentCount / maxStudents) * 100);

  // Subject count (aktif sesuai fase kelas)
  const classMapel = getMapelForSession(data.mapel, session);
  const mapelCount = classMapel.length;

  // Calculate average grade across all students
  const siswaRekapInput = enrolledStudents.map((s) => {
    const scores = classMapel.map((m) => {
      // Find average of sumatif LM & Semester
      const lmValues = data.sumatifLM
        .filter((l) => {
          const isThisLM = data.lm.some((lm) => lm.id === l.lm_id && lm.mapel_id === m.id);
          return l.siswa_id === s.id && isThisLM;
        })
        .map((l) => l.nilai);

      const sem = data.sumatifSemester.find((ss) => ss.siswa_id === s.id && ss.mapel_id === m.id);
      const validLMs = lmValues.filter((v): v is number => typeof v === 'number');
      const naLM = validLMs.length ? validLMs.reduce((a, b) => a + b, 0) / validLMs.length : null;

      const semScores = [sem?.pts, sem?.pas].filter((v): v is number => typeof v === 'number');
      const naSem = semScores.length ? semScores.reduce((a, b) => a + b, 0) / semScores.length : null;

      const combined = [naLM, naSem].filter((v): v is number => typeof v === 'number');
      return combined.length ? Math.round(combined.reduce((a, b) => a + b, 0) / combined.length) : null;
    });

    return {
      id: s.id,
      nama: s.nama,
      nilaiMapel: scores,
    };
  });

  const rekapOutputs = calculateRekapDanPeringkat(siswaRekapInput, mapelCount);

  // Overall class average
  const validAvgs = rekapOutputs
    .map((r) => r.rataRata)
    .filter((v): v is number => typeof v === 'number');
  const classAverage = validAvgs.length
    ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length
    : null;

  // Top ranked student (Rank 1)
  const rank1Student = rekapOutputs.find((r) => r.peringkat === 1 && r.jumlah !== null);

  // Total class absences
  const totalAbsences = data.kehadiran
    .filter((k) => k.kelas_id === session.kelasId)
    .reduce((acc, curr) => acc + (Number(curr.sakit) || 0) + (Number(curr.izin) || 0) + (Number(curr.alpa) || 0), 0);

  // Kokurikuler Status
  const classThemes = (data.temaKokurikuler || []).filter((t) => t.kelas_id === session.kelasId);
  const activeReportThemes = classThemes.filter(
    (t) => t.tampil_di_rapor === true || String(t.tampil_di_rapor).toUpperCase() === 'TRUE'
  );

  let kokuStatus: 'Lengkap' | 'Periksa' | 'Belum ada tema' = 'Lengkap';
  let kokuDesc = '';
  let kokuPath = '/kokurikuler';

  if (classThemes.length === 0) {
    kokuStatus = 'Belum ada tema';
    kokuDesc = 'Belum ada tema kokurikuler';
  } else if (activeReportThemes.length === 0) {
    kokuStatus = 'Lengkap';
    kokuDesc = `${classThemes.length} tema (tidak ada yang tampil di rapor)`;
  } else if (studentCount === 0) {
    kokuStatus = 'Periksa';
    kokuDesc = 'Belum ada siswa terdaftar';
  } else {
    let incompleteThemeName = '';
    let missingCount = 0;
    let incompleteThemeId = '';

    for (const theme of activeReportThemes) {
      const themePenilaian = (data.penilaianKokurikuler || []).filter(
        (p) => p.tema_id === theme.id && p.dpl_kuat && p.dpl_penguatan
      );
      const filledStudentIds = new Set(themePenilaian.map((p) => p.siswa_id));
      const unassigned = enrolledStudents.filter((s) => !filledStudentIds.has(s.id)).length;
      if (unassigned > 0) {
        incompleteThemeName = theme.nama;
        missingCount = unassigned;
        incompleteThemeId = theme.id;
        break;
      }
    }

    if (missingCount > 0) {
      kokuStatus = 'Periksa';
      kokuDesc = `Tema “${incompleteThemeName}”: ${missingCount} siswa belum diisi`;
      kokuPath = `/kokurikuler?tema=${incompleteThemeId}`;
    } else {
      kokuStatus = 'Lengkap';
      kokuDesc = `Semua siswa lengkap (${activeReportThemes.length} tema rapor)`;
    }
  }

  // 7 KAIH Status (memeriksa periode bawaan semester aktif)
  const bawaanKaih = periodeBawaan(session.tahunAjaran, session.semester as 1 | 2);
  const activeKaihRecords = (data.kaih || []).filter((k) => {
    const norm = normalisasiKaih(k);
    return (
      k.kelas_id === session.kelasId &&
      norm.tahun === bawaanKaih.tahun &&
      norm.periode === bawaanKaih.periode
    );
  });

  const kaihStudentMap = new Map<string, any>();
  activeKaihRecords.forEach((k) => kaihStudentMap.set(k.siswa_id, k));

  let kaihStatus: 'Lengkap' | 'Periksa' = 'Lengkap';
  let kaihDesc = '';

  if (studentCount === 0) {
    kaihStatus = 'Periksa';
    kaihDesc = 'Belum ada siswa terdaftar';
  } else {
    const incompleteCount = enrolledStudents.filter(
      (s) => !isKaihLengkap(kaihStudentMap.get(s.id))
    ).length;

    if (incompleteCount === 0) {
      kaihStatus = 'Lengkap';
      kaihDesc = `Semua ${studentCount} siswa lengkap (${teksPeriode(bawaanKaih.tahun, bawaanKaih.periode)})`;
    } else {
      kaihStatus = 'Periksa';
      kaihDesc = `${incompleteCount} siswa belum lengkap (${teksPeriode(bawaanKaih.tahun, bawaanKaih.periode)})`;
    }
  }

  // Status kelengkapan rapor
  const checklist = [
    {
      item: 'Data Sekolah & Siswa',
      status: data.sekolah.nama && studentCount > 0 ? 'Lengkap' : 'Periksa',
      desc: studentCount === 0 ? 'Belum ada siswa terdaftar' : `${studentCount} siswa terdaftar`,
      path: '/data-siswa',
    },
    {
      item: 'Tujuan Pembelajaran & Lingkup Materi',
      status: data.tp.length > 0 && data.lm.length > 0 ? 'Lengkap' : 'Periksa',
      desc: `${data.tp.length} TP · ${data.lm.length} LM terdata`,
      path: '/tujuan-pembelajaran',
    },
    {
      item: 'Asesmen Formatif (Capaian Kompetensi)',
      status:
        studentCount > 0 && data.formatif.length >= studentCount
          ? 'Lengkap'
          : 'Periksa',
      desc: studentCount === 0 ? 'Menunggu input siswa' : `${data.formatif.length} catatan terisi`,
      path: '/asesmen-formatif',
    },
    {
      item: 'Asesmen Sumatif (Lingkup Materi & Semester)',
      status:
        studentCount > 0 && data.sumatifLM.length >= studentCount
          ? 'Lengkap'
          : 'Periksa',
      desc: studentCount === 0 ? 'Menunggu input siswa' : `${data.sumatifLM.length} nilai sumatif terisi`,
      path: '/asesmen-sumatif',
    },
    {
      item: 'Kokurikuler',
      status: kokuStatus,
      desc: kokuDesc,
      path: kokuPath,
    },
    {
      item: '7 Kebiasaan Anak Hebat (KAIH)',
      status: kaihStatus,
      desc: kaihDesc,
      path: '/input-7-kaih',
    },
    {
      item: 'Catatan Wali Kelas & Kehadiran',
      status:
        studentCount > 0 && data.catatanWali.length >= studentCount
          ? 'Lengkap'
          : 'Periksa',
      desc: `${data.catatanWali.length} catatan terisi`,
      path: '/penilaian',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-kemdikbud-dark to-kemdikbud-hover rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-white/20 text-blue-100 uppercase tracking-wider mb-2">
            Tahun Ajaran {session.tahunAjaran} · Semester {session.semester === 1 ? 'I (Ganjil)' : 'II (Genap)'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black">
            Selamat Datang, {session.namaWali}
          </h2>
          <p className="text-sm text-blue-100 mt-1">
            Wali Kelas {session.kelas} (Fase {session.fase}) — {data.sekolah.nama}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/data-siswa')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-kemdikbud-accent text-white font-bold text-xs hover:bg-orange-600 shadow transition"
          >
            <UserPlus size={16} />
            <span>Kelola Siswa</span>
          </button>
          <button
            onClick={() => navigate('/nilai-akhir')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition"
          >
            <FileSpreadsheet size={16} />
            <span>Rekap Nilai</span>
          </button>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Jumlah Siswa dengan Progress Quota 50 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Jumlah Siswa
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-kemdikbud-dark">
              <Users size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 tabular-nums">
                {studentCount}
              </span>
              <span className="text-sm font-semibold text-slate-400 tabular-nums">
                / {maxStudents} siswa
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  studentCount >= maxStudents
                    ? 'bg-red-500'
                    : studentCount > 40
                    ? 'bg-amber-500'
                    : 'bg-kemdikbud-dark'
                }`}
                style={{ width: `${Math.min(studentPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Jumlah Mata Pelajaran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Mata Pelajaran
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <BookOpen size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {mapelCount}
            </span>
            <span className="text-xs text-slate-400 block mt-1 font-medium">
              Mapel Aktif Fase {session.fase || 'A'}
            </span>
          </div>
        </div>

        {/* Card 3: Rata-rata Kelas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rata-rata Kelas
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {formatRataRata(classAverage)}
            </span>
            <span className="text-xs text-slate-400 block mt-1 font-medium">
              Dari seluruh nilai rapor
            </span>
          </div>
        </div>

        {/* Card 4: Total Ketidakhadiran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ketidakhadiran
            </span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <UserX size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {totalAbsences}
            </span>
            <span className="text-xs text-slate-400 block mt-1 font-medium">
              Hari akumulasi (S/I/A)
            </span>
          </div>
        </div>
      </div>

      {/* Empty State Banner if 0 students */}
      {studentCount === 0 && (
        <div className="bg-white rounded-2xl border border-blue-200/80 p-8 shadow-xs text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 text-kemdikbud-dark rounded-2xl flex items-center justify-center">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Belum ada siswa terdaftar di Kelas {session.kelas}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Database baru terpasang bersih tanpa data siswa. Tambahkan siswa secara manual atau impor dari file Excel raport lama (<code>app_RAPOR TAHUN 2025_Fase C.6_PWS.xlsm</code>).
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate('/data-siswa')}
              className="px-5 py-2.5 rounded-xl bg-kemdikbud-dark text-white text-xs font-bold shadow hover:bg-kemdikbud-hover transition"
            >
              + Tambah Siswa Manual
            </button>
            <button
              onClick={() => navigate('/data-siswa')}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition"
            >
              Impor dari File Excel (.xlsm)
            </button>
          </div>
        </div>
      )}

      {/* Grid: Siswa Peringkat 1 & Kelengkapan Rapor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Siswa Peringkat 1 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Peringkat 1 Kelas
              </h3>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-500">
                <Trophy size={20} />
              </div>
            </div>

            {rank1Student ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
                    Bintang Prestasi Kelas
                  </div>
                  <h4 className="text-lg font-black text-slate-900">
                    {rank1Student.nama}
                  </h4>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Jumlah Nilai:</span>
                    <strong className="text-slate-900 tabular-nums">{rank1Student.jumlah}</strong>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Rata-rata:</span>
                    <strong className="text-emerald-700 font-bold tabular-nums">
                      {rank1Student.rataRataFormatted}
                    </strong>
                  </div>
                </div>
                <p className="text-xs text-slate-500 italic leading-relaxed">
                  "{rank1Student.prestasiAkademikText}"
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                {studentCount === 0
                  ? 'Belum ada data siswa.'
                  : 'Nilai akhir belum cukup untuk menghitung peringkat.'}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/nilai-akhir')}
            className="w-full mt-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 transition"
          >
            <span>Lihat Semua Peringkat</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Tabel Kelengkapan Rapor */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Kelengkapan Rapor Kelas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Status pengisian komponen data rapor semester aktif
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                  <th className="pb-2.5">Komponen Rapor</th>
                  <th className="pb-2.5">Keterangan</th>
                  <th className="pb-2.5 text-center">Status</th>
                  <th className="pb-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checklist.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 font-semibold text-slate-800">{c.item}</td>
                    <td className="py-3 text-slate-500">{c.desc}</td>
                    <td className="py-3 text-center">
                      {c.status === 'Lengkap' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={12} />
                          Lengkap
                        </span>
                      ) : c.status === 'Belum ada tema' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <HelpCircle size={12} />
                          Belum ada tema
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle size={12} />
                          Periksa
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => navigate(c.path)}
                        className="text-blue-600 hover:text-blue-800 font-bold text-xs"
                      >
                        Buka →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
