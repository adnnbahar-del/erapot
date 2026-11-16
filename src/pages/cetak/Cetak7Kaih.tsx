import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { KaihPDFDocument } from '../../pdf/KaihPDF';
import { downloadSinglePDF, getPDFBlobUrl, downloadBulkZIP } from '../../lib/pdfGenerator';
import { HeartHandshake, FileDown, Archive, Eye, X, RefreshCw, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import {
  Periode,
  periodeBawaan,
  tanggalTtdBawaan,
  normalisasiKaih,
  isKaihLengkap,
} from '../../lib/kaih';
import { PilihPeriodeKaih } from '../../components/PilihPeriodeKaih';
import { KaihRecord } from '../../types';
import { labelRapor, parseRombelNama } from '../../lib/rombel';

export const Cetak7Kaih: React.FC = () => {
  const { data, session, notify, confirmModal } = useApp();
  const [paperSize, setPaperSize] = useState<'F4' | 'A4'>('F4');
  const [includeStamp, setIncludeStamp] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');

  const storageKey = session ? `kaih_selected_periode_${session.kelasId}` : '';

  // Inisialisasi periode & tahun dari localStorage atau bawaan semester aktif
  const [{ tahun: selectedTahun, periode: selectedPeriode }, setPeriodeState] = useState<{
    tahun: number;
    periode: Periode;
  }>(() => {
    const bawaan = session
      ? periodeBawaan(session.tahunAjaran, session.semester as 1 | 2)
      : { tahun: 2025, periode: 'JUL-DES' as Periode };
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.tahun && (parsed.periode === 'JAN-JUN' || parsed.periode === 'JUL-DES')) {
            return { tahun: Number(parsed.tahun), periode: parsed.periode as Periode };
          }
        }
      } catch {
        // ignore
      }
    }
    return bawaan;
  });

  // Tempat & Tanggal tanda tangan bawaan
  const tempatSekolah = data?.sekolah?.tempat_rapor?.includes(',')
    ? data.sekolah.tempat_rapor.split(',')[0].trim()
    : data?.sekolah?.desa || data?.sekolah?.kabupaten || 'Sukaraja';

  const defaultTtd = `${tempatSekolah}, ${tanggalTtdBawaan(selectedTahun, selectedPeriode)}`;
  const [customTanggal, setCustomTanggal] = useState<string>(defaultTtd);
  const [isCustomDateDirty, setIsCustomDateDirty] = useState<boolean>(false);

  const handlePeriodeChange = (newPeriode: Periode) => {
    setPeriodeState((prev) => {
      const next = { ...prev, periode: newPeriode };
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
    if (!isCustomDateDirty) {
      setCustomTanggal(`${tempatSekolah}, ${tanggalTtdBawaan(selectedTahun, newPeriode)}`);
    }
  };

  const handleTahunChange = (newTahun: number) => {
    setPeriodeState((prev) => {
      const next = { ...prev, tahun: newTahun };
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
    if (!isCustomDateDirty) {
      setCustomTanggal(`${tempatSekolah}, ${tanggalTtdBawaan(newTahun, selectedPeriode)}`);
    }
  };

  const enrolledStudents = useMemo(() => {
    if (!data || !session) return [];
    const currentClassRoster = data.kelasSiswa.filter((ks) => ks.kelas_id === session.kelasId);
    return data.siswa
      .filter((s) => currentClassRoster.some((ks) => ks.siswa_id === s.id))
      .map((s) => {
        const ks = currentClassRoster.find((item) => item.siswa_id === s.id);
        return {
          ...s,
          no_urut: ks?.no_urut || 0,
        };
      })
      .sort((a, b) => a.no_urut - b.no_urut);
  }, [data, session]);

  // Map KAIH records untuk periode yang sedang dipilih
  const kaihMap = useMemo(() => {
    const map = new Map<string, KaihRecord>();
    if (!data || !session) return map;
    (data.kaih || [])
      .filter((k) => k.kelas_id === session.kelasId)
      .forEach((k) => {
        const norm = normalisasiKaih(k);
        if (norm.tahun === selectedTahun && norm.periode === selectedPeriode) {
          map.set(k.siswa_id, {
            ...k,
            tahun: norm.tahun,
            periode: norm.periode,
          });
        }
      });
    return map;
  }, [data, session, selectedTahun, selectedPeriode]);

  if (!data || !session) return null;

  const getKaihRecord = (s: typeof enrolledStudents[0]): KaihRecord => {
    return (
      kaihMap.get(s.id) || {
        siswa_id: s.id,
        kelas_id: session.kelasId,
        tahun: selectedTahun,
        periode: selectedPeriode,
        bangun_pagi: '',
        beribadah: '',
        berolahraga: '',
        makan_sehat: '',
        gemar_belajar: '',
        bermasyarakat: '',
        tidur_cepat: '',
      }
    );
  };

  const getElement = (s: typeof enrolledStudents[0]) => {
    const rec = getKaihRecord(s);
    const waliObj = data.kelas.find((k) => k.id === session.kelasId);
    const { tingkat, huruf } = parseRombelNama(session.kelas);
    const formattedKelas = labelRapor(tingkat, huruf, data.sekolah.format_kelas_rapor || 'romawi');

    return (
      <KaihPDFDocument
        paperSize={paperSize}
        sekolah={data.sekolah}
        siswa={s}
        tingkatKelas={formattedKelas}
        kaih={rec}
        namaWali={session.namaWali}
        nipWali={waliObj?.nip_wali || ''}
        tahun={session.tahunAjaran}
        tahunPeriode={selectedTahun}
        periode={selectedPeriode}
        tanggalTandaTangan={customTanggal}
        includeStamp={includeStamp}
      />
    );
  };

  const handlePreview = async (s: typeof enrolledStudents[0]) => {
    const el = getElement(s);
    const url = await getPDFBlobUrl(el);
    setPreviewUrl(url);
    setPreviewTitle(`Pratinjau 7 KAIH: ${s.nama}`);
  };

  // Unduh Single PDF dengan format: 7KAIH_{noUrut}_{NAMA_SISWA}_{JAN-JUN|JUL-DES}_{tahun}.pdf
  const executeDownloadSingle = async (s: typeof enrolledStudents[0]) => {
    const el = getElement(s);
    const numStr = String(s.no_urut || 1).padStart(2, '0');
    const safeName = s.nama.replace(/[/\\?%*:|"<> ]/g, '_').toUpperCase();
    const filename = `7KAIH_${numStr}_${safeName}_${selectedPeriode}_${selectedTahun}.pdf`;

    await downloadSinglePDF(el, filename);
    notify(`Lembar 7 KAIH ${s.nama} berhasil diunduh.`, 'success');
  };

  const handleDownloadSingle = (s: typeof enrolledStudents[0]) => {
    const rec = getKaihRecord(s);
    if (!isKaihLengkap(rec)) {
      confirmModal(
        'Penilaian Belum Lengkap',
        `Siswa "${s.nama}" belum dinilai pada periode ${selectedPeriode} ${selectedTahun}. Tetap unduh lembar penilaian?`,
        () => executeDownloadSingle(s)
      );
    } else {
      executeDownloadSingle(s);
    }
  };

  // Unduh Bulk ZIP dengan format: 7KAIH_Kelas_{tingkat}_{JAN-JUN|JUL-DES}_{tahun}.zip
  const executeDownloadBulkZIP = async () => {
    if (enrolledStudents.length === 0) return;
    setIsProcessing(true);
    const zipName = `7KAIH_Kelas_${session.kelas}_${selectedPeriode}_${selectedTahun}.zip`;

    const tasks = enrolledStudents.map((s) => {
      const numStr = String(s.no_urut || 1).padStart(2, '0');
      const safeName = s.nama.replace(/[/\\?%*:|"<> ]/g, '_').toUpperCase();
      return {
        element: getElement(s),
        filename: `7KAIH_${numStr}_${safeName}_${selectedPeriode}_${selectedTahun}.pdf`,
      };
    });

    try {
      await downloadBulkZIP(tasks, zipName, (curr, tot) => {
        setProgressText(`Membuat PDF ${curr} / ${tot}…`);
      });
      notify('Semua berkas 7 KAIH berhasil diunduh dalam file ZIP!', 'success');
    } catch {
      notify('Gagal membuat ZIP 7 KAIH', 'error');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleDownloadBulkZIP = () => {
    if (enrolledStudents.length === 0) return;

    // Hitung berapa siswa yang belum dinilai lengkap
    const unratedStudents = enrolledStudents.filter((s) => !isKaihLengkap(getKaihRecord(s)));
    if (unratedStudents.length > 0) {
      confirmModal(
        'Peringatan Penilaian Belum Lengkap',
        `${unratedStudents.length} siswa belum dinilai pada periode ini. Tetap unduh semua berkas?`,
        () => executeDownloadBulkZIP()
      );
    } else {
      executeDownloadBulkZIP();
    }
  };

  return (
    <div className="space-y-6">
      {/* Kartu Header Kontrol */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shrink-0 mt-0.5">
            <HeartHandshake size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Cetak Lembar 7 Kebiasaan Anak Hebat (KAIH)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Format resmi Disdikbud Tanggamus lengkap dengan kop dan 3 tanda tangan
            </p>

            {/* Pilihan Periode Penilaian dan Tahun Bersama */}
            <PilihPeriodeKaih
              tahun={selectedTahun}
              periode={selectedPeriode}
              onPeriodeChange={handlePeriodeChange}
              onTahunChange={handleTahunChange}
              tahunAjaran={session.tahunAjaran}
              semester={session.semester as 1 | 2}
              mode="cetak"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs self-start md:self-auto">
          {/* Pilihan Kertas */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setPaperSize('F4')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                paperSize === 'F4' ? 'bg-kemdikbud-dark text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              F4
            </button>
            <button
              onClick={() => setPaperSize('A4')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                paperSize === 'A4' ? 'bg-kemdikbud-dark text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              A4
            </button>
          </div>

          <button
            disabled={isProcessing || enrolledStudents.length === 0}
            onClick={handleDownloadBulkZIP}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
          >
            <Archive size={15} />
            <span>Unduh Semua (ZIP)</span>
          </button>
        </div>
      </div>

      {/* Baris Opsi Cetak: Tanggal Tanda Tangan & Stempel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Calendar size={15} className="text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-700 whitespace-nowrap">Tanggal Tanda Tangan:</span>
          <input
            type="text"
            value={customTanggal}
            onChange={(e) => {
              setCustomTanggal(e.target.value);
              setIsCustomDateDirty(true);
            }}
            placeholder="Contoh: Sukaraja, 20 Desember 2025"
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />
          {isCustomDateDirty && (
            <button
              type="button"
              onClick={() => {
                setCustomTanggal(defaultTtd);
                setIsCustomDateDirty(false);
              }}
              className="text-[11px] text-rose-600 hover:underline shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 select-none">
          <input
            type="checkbox"
            checked={includeStamp}
            onChange={(e) => setIncludeStamp(e.target.checked)}
            className="rounded text-rose-600 focus:ring-rose-500"
          />
          <span>Sertakan Tanda Tangan & Stempel Digital</span>
        </label>
      </div>

      {isProcessing && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-bold animate-pulse">
          <RefreshCw size={18} className="animate-spin text-rose-600 shrink-0" />
          <span>{progressText}</span>
        </div>
      )}

      {/* Table Daftar Siswa */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-3">NIS</th>
                <th className="py-3 px-3">NISN</th>
                <th className="py-3 px-3">Nama Peserta Didik</th>
                <th className="py-3 px-3 text-center w-36">Status Penilaian</th>
                <th className="py-3 px-3 text-right w-44">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrolledStudents.length > 0 ? (
                enrolledStudents.map((s) => {
                  const rec = getKaihRecord(s);
                  const isComplete = isKaihLengkap(rec);
                  const hasAny = Boolean(
                    rec.bangun_pagi ||
                      rec.beribadah ||
                      rec.berolahraga ||
                      rec.makan_sehat ||
                      rec.gemar_belajar ||
                      rec.bermasyarakat ||
                      rec.tidur_cepat
                  );

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 text-center font-bold text-slate-500 tabular-nums">
                        {String(s.no_urut || 1).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-3 tabular-nums font-mono text-slate-600">{s.nis || '-'}</td>
                      <td className="py-3 px-3 tabular-nums font-mono font-semibold text-slate-800">{s.nisn || '-'}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{s.nama}</td>
                      <td className="py-3 px-3 text-center">
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={12} />
                            <span>Lengkap</span>
                          </span>
                        ) : hasAny ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle size={12} />
                            <span>Belum Lengkap</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                            <span>Belum Dinilai</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePreview(s)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] transition"
                          >
                            <Eye size={13} />
                            <span>Pratinjau</span>
                          </button>
                          <button
                            onClick={() => handleDownloadSingle(s)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] transition"
                          >
                            <FileDown size={13} />
                            <span>Unduh PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Belum ada siswa terdaftar di kelas ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-3.5 bg-kemdikbud-dark text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">{previewTitle}</h3>
              <button onClick={() => setPreviewUrl(null)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-slate-200 p-2">
              <iframe src={previewUrl} className="w-full h-full rounded-lg border-0" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
