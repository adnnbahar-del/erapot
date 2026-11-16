import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  calcNALingkupMateri,
  calcNAAkhirSemester,
  calcNilaiRapor,
  generateDeskripsiKompetensi,
  generateDeskripsiKokurikuler,
  calculateRekapDanPeringkat,
} from '../../lib/rapor';
import { kokurikulerRapor } from '../../lib/kokurikuler';
import { periodeBawaan, normalisasiKaih } from '../../lib/kaih';
import { KaihRecord } from '../../types';
import { labelRapor, parseRombelNama, faseDariTingkat } from '../../lib/rombel';
import { getMapelForSession } from '../../lib/mapelService';
import { RaporPDFDocument, RaporPage } from '../../pdf/RaporPDF';
import { BundelPDFDocument } from '../../pdf/BundelPDF';
import { downloadSinglePDF, getPDFBlobUrl, downloadBulkZIP } from '../../lib/pdfGenerator';
import { Document } from '@react-pdf/renderer';
import {
  Printer,
  FileDown,
  Archive,
  Eye,
  X,
  FileText,
  PackageCheck,
  RefreshCw,
  Lock,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  getStatusFinalisasi,
  finalkanRaporKelas,
  type FinalisasiRaporDoc,
} from '../../lib/kunciNilaiService';

export const CetakRapor: React.FC = () => {
  const { data, session, notify, refreshFinalisasi } = useApp();

  const [paperSize, setPaperSize] = useState<'F4' | 'A4'>('F4');
  const [includeStamp, setIncludeStamp] = useState<boolean>(true);

  // Finalisasi Rapor State (Tahap 4)
  const [finalisasiInfo, setFinalisasiInfo] = useState<FinalisasiRaporDoc | null>(null);
  const [modalFinalisasi, setModalFinalisasi] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  // Preview Modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // Bulk Progress State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');

  const loadFinalisasi = async () => {
    if (!session?.kelasId) return;
    const currentTAId = session.tahunAjaranId || 'ta_2025_1';
    try {
      const res = await getStatusFinalisasi(session.kelasId, currentTAId);
      setFinalisasiInfo(res);
    } catch {}
  };

  React.useEffect(() => {
    loadFinalisasi();
  }, [session?.kelasId, session?.tahunAjaranId]);

  const handleFinalkanRapor = async () => {
    if (!session?.kelasId) return;
    const currentTAId = session.tahunAjaranId || 'ta_2025_1';
    setIsFinalizing(true);
    try {
      const res = await finalkanRaporKelas({
        kelasId: session.kelasId,
        kelasNama: session.kelas,
        tahunAjaranId: currentTAId,
        userUid: session.token,
        userNama: session.namaWali,
      });
      setFinalisasiInfo(res);
      await refreshFinalisasi();
      setModalFinalisasi(false);
      notify('Rapor kelas berhasil difinalkan! Seluruh nilai dan data kelas kini terkunci.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal memfinalkan rapor.', 'error');
    } finally {
      setIsFinalizing(false);
    }
  };

  if (!data || !session) return null;

  const classMapel = getMapelForSession(data.mapel, session);

  const currentClassRoster = data.kelasSiswa.filter((ks) => ks.kelas_id === session.kelasId);
  const enrolledStudents = data.siswa
    .filter((s) => currentClassRoster.some((ks) => ks.siswa_id === s.id))
    .map((s) => {
      const ks = currentClassRoster.find((item) => item.siswa_id === s.id);
      return {
        ...s,
        no_urut: ks?.no_urut || 0,
      };
    })
    .sort((a, b) => a.no_urut - b.no_urut);

  // Pre-calculate rekap peringkat
  const studentScoresGrid = useMemo(() => {
    return enrolledStudents.map((s) => {
      const scores = classMapel.map((m) => {
        const mapelLMs = data.lm.filter((l) => l.mapel_id === m.id);
        const lmValues = mapelLMs.map((lm) => {
          const entry = data.sumatifLM.find((row) => row.siswa_id === s.id && row.lm_id === lm.id);
          return entry ? entry.nilai : null;
        });

        const semEntry = data.sumatifSemester.find((row) => row.siswa_id === s.id && row.mapel_id === m.id);
        const naLM = calcNALingkupMateri(lmValues);
        const naAkhir = calcNAAkhirSemester(semEntry?.pts, semEntry?.pas);
        return calcNilaiRapor(naLM, naAkhir);
      });

      return { id: s.id, nama: s.nama, nilaiMapel: scores };
    });
  }, [enrolledStudents, classMapel, data.lm, data.sumatifLM, data.sumatifSemester]);

  const rekapOutputs = useMemo(() => {
    return calculateRekapDanPeringkat(studentScoresGrid, classMapel.length);
  }, [studentScoresGrid, classMapel.length]);

  // Helper to compile full rapor props for a student
  const getStudentRaporProps = (s: typeof enrolledStudents[0]) => {
    const mapelList = classMapel.map((m, mIdx) => {
      const mapelLMs = data.lm.filter((l) => l.mapel_id === m.id);
      const lmValues = mapelLMs.map((lm) => {
        const entry = data.sumatifLM.find((row) => row.siswa_id === s.id && row.lm_id === lm.id);
        return entry ? entry.nilai : null;
      });

      const semEntry = data.sumatifSemester.find((row) => row.siswa_id === s.id && row.mapel_id === m.id);
      const naLM = calcNALingkupMateri(lmValues);
      const naAkhir = calcNAAkhirSemester(semEntry?.pts, semEntry?.pas);
      const nilaiAkhir = calcNilaiRapor(naLM, naAkhir);

      // Formatif Capaian
      const mapelTPs = data.tp.filter((t) => t.mapel_id === m.id);
      const tpsWithData = mapelTPs.map((tp) => {
        const f = data.formatif.find((row) => row.siswa_id === s.id && row.tp_id === tp.id);
        return {
          deskripsi: tp.deskripsi,
          kktp: f ? f.kktp : 1,
          tampil: f ? f.tampil : 1,
        };
      });

      const { tercapaiText, perluBimbinganText } = generateDeskripsiKompetensi(s.nama, tpsWithData);

      return {
        no: mIdx + 1,
        nama: m.nama,
        nilaiAkhir: nilaiAkhir !== null ? nilaiAkhir : '-',
        capaianTercapai: tercapaiText,
        capaianPerluBimbingan: perluBimbinganText,
      };
    });

    // Kokurikuler
    const kokurikulerList = kokurikulerRapor(
      s,
      data.temaKokurikuler || [],
      data.penilaianKokurikuler || []
    );
    const kokurikulerText = kokurikulerList.length > 0 ? kokurikulerList[0].deskripsi : '';

    // Prestasi Akademik
    const rekap = rekapOutputs.find((r) => r.id === s.id);
    const prestasiAkademikText = rekap?.prestasiAkademikText || '-';

    // Ekskul
    const ekskuls = data.nilaiEkskul
      .filter((e) => e.siswa_id === s.id && e.kelas_id === session.kelasId)
      .map((e) => ({
        nama: data.ekskul.find((item) => item.id === e.ekskul_id)?.nama || 'Ekstrakurikuler',
        keterangan: e.deskripsi,
      }));

    // Kehadiran
    const keh = data.kehadiran.find((k) => k.siswa_id === s.id && k.kelas_id === session.kelasId) || {
      sakit: 0,
      izin: 0,
      alpa: 0,
    };

    // Catatan Wali
    const cat = data.catatanWali.find((c) => c.siswa_id === s.id && c.kelas_id === session.kelasId);
    const catatanWaliText = cat?.catatan || 'Tingkatkan terus prestasi belajarmu.';
    const keputusanNaik = session.semester === 2 ? (cat?.keputusan_naik || 'Naik ke Kelas VII (Tujuh)') : null;

    const waliObj = data.kelas.find((k) => k.id === session.kelasId);

    // 7 KAIH (Bundel Lengkap memakai periode bawaan semester aktif)
    const bawaanKaih = periodeBawaan(session.tahunAjaran, session.semester as 1 | 2);
    const foundKaih = data.kaih.find((k) => {
      const norm = normalisasiKaih(k);
      return (
        k.siswa_id === s.id &&
        k.kelas_id === session.kelasId &&
        norm.tahun === bawaanKaih.tahun &&
        norm.periode === bawaanKaih.periode
      );
    });

    const kaihRecord: KaihRecord = foundKaih || {
      siswa_id: s.id,
      kelas_id: session.kelasId,
      tahun: bawaanKaih.tahun,
      periode: bawaanKaih.periode,
      bangun_pagi: 'Sudah Terbiasa',
      beribadah: 'Sudah Terbiasa',
      berolahraga: 'Mulai Terbiasa',
      makan_sehat: 'Sudah Terbiasa',
      gemar_belajar: 'Mulai Terbiasa',
      bermasyarakat: 'Sudah Terbiasa',
      tidur_cepat: 'Sudah Terbiasa',
    };

    const { tingkat, huruf } = parseRombelNama(session.kelas);
    const formattedKelas = labelRapor(tingkat, huruf, data.sekolah.format_kelas_rapor || 'romawi');
    const computedFase = faseDariTingkat(tingkat);

    return {
      paperSize,
      sekolah: data.sekolah,
      siswa: s,
      tingkatKelas: formattedKelas,
      fase: computedFase,
      semester: session.semester,
      tahunAjaran: session.tahunAjaran,
      namaWali: session.namaWali,
      nipWali: waliObj?.nip_wali || '',
      mapelList,
      kokurikulerList,
      kokurikulerText,
      prestasiAkademikText,
      ekskulList: ekskuls,
      kehadiran: { sakit: keh.sakit || 0, izin: keh.izin || 0, alpa: keh.alpa || 0 },
      catatanWali: catatanWaliText,
      keputusanNaik,
      includeStamp,
      kaihRecord,
    };
  };

  // 1. Single Student Preview
  const handlePreviewStudent = async (s: typeof enrolledStudents[0]) => {
    const props = getStudentRaporProps(s);
    const url = await getPDFBlobUrl(<RaporPDFDocument {...props} />);
    setPreviewUrl(url);
    setPreviewTitle(`Pratinjau Rapor: ${s.nama}`);
  };

  // 2. Single Student Download
  const handleDownloadSingle = async (s: typeof enrolledStudents[0]) => {
    const props = getStudentRaporProps(s);
    const numStr = String(s.no_urut || 1).padStart(2, '0');
    const safeName = s.nama.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `Rapor_${session.kelas}_${numStr}_${safeName}.pdf`;

    await downloadSinglePDF(<RaporPDFDocument {...props} />, filename);
    notify(`Rapor ${s.nama} berhasil diunduh.`, 'success');
  };

  // 3. Bundel Lengkap Single Student Download
  const handleDownloadBundelSingle = async (s: typeof enrolledStudents[0]) => {
    const props = getStudentRaporProps(s);
    const numStr = String(s.no_urut || 1).padStart(2, '0');
    const safeName = s.nama.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `Bundel_Rapor_${session.kelas}_${numStr}_${safeName}.pdf`;

    await downloadSinglePDF(<BundelPDFDocument {...props} />, filename);
    notify(`Bundel Lengkap ${s.nama} berhasil diunduh.`, 'success');
  };

  // 4. Unduh Semua ZIP
  const handleDownloadBulkZIP = async () => {
    if (enrolledStudents.length === 0) return;
    setIsProcessing(true);
    const semName = session.semester === 1 ? 'Ganjil' : 'Genap';
    const cleanTA = session.tahunAjaran.replace('/', '-');
    const zipName = `Rapor_Kelas_${session.kelas}_${cleanTA}_${semName}.zip`;

    const tasks = enrolledStudents.map((s) => {
      const props = getStudentRaporProps(s);
      const numStr = String(s.no_urut || 1).padStart(2, '0');
      const safeName = s.nama.replace(/[/\\?%*:|"<>]/g, '_');
      return {
        element: <RaporPDFDocument {...props} />,
        filename: `Rapor_${session.kelas}_${numStr}_${safeName}.pdf`,
      };
    });

    try {
      await downloadBulkZIP(tasks, zipName, (curr, tot) => {
        setProgressText(`Membuat PDF ${curr} / ${tot}…`);
      });
      notify('Semua rapor berhasil diunduh dalam file ZIP!', 'success');
    } catch (err: any) {
      notify('Gagal membuat ZIP rapor', 'error');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  // 5. Unduh Bundel Lengkap ZIP (All students in ZIP)
  const handleDownloadBulkBundelZIP = async () => {
    if (enrolledStudents.length === 0) return;
    setIsProcessing(true);
    const semName = session.semester === 1 ? 'Ganjil' : 'Genap';
    const cleanTA = session.tahunAjaran.replace('/', '-');
    const zipName = `Bundel_Lengkap_Kelas_${session.kelas}_${cleanTA}_${semName}.zip`;

    const tasks = enrolledStudents.map((s) => {
      const props = getStudentRaporProps(s);
      const numStr = String(s.no_urut || 1).padStart(2, '0');
      const safeName = s.nama.replace(/[/\\?%*:|"<>]/g, '_');
      return {
        element: <BundelPDFDocument {...props} />,
        filename: `Bundel_${numStr}_${safeName}.pdf`,
      };
    });

    try {
      await downloadBulkZIP(tasks, zipName, (curr, tot) => {
        setProgressText(`Membuat Bundel PDF ${curr} / ${tot}…`);
      });
      notify('Semua bundel lengkap berhasil diunduh dalam file ZIP!', 'success');
    } catch (err: any) {
      notify('Gagal membuat ZIP bundel', 'error');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  // 6. Unduh Satu PDF Gabungan (Semua Siswa)
  const handleDownloadCombinedPDF = async () => {
    if (enrolledStudents.length === 0) return;
    setIsProcessing(true);
    setProgressText(`Menyiapkan PDF Gabungan ${enrolledStudents.length} siswa…`);

    const semName = session.semester === 1 ? 'Ganjil' : 'Genap';
    const cleanTA = session.tahunAjaran.replace('/', '-');
    const filename = `Rapor_Gabungan_Kelas_${session.kelas}_${cleanTA}_${semName}.pdf`;

    try {
      const combinedDoc = (
        <Document title={filename}>
          {enrolledStudents.map((s) => {
            const props = getStudentRaporProps(s);
            return <RaporPage key={s.id} {...props} />;
          })}
        </Document>
      );

      await downloadSinglePDF(combinedDoc, filename);
      notify('PDF gabungan seluruh kelas berhasil diunduh!', 'success');
    } catch (err: any) {
      notify('Gagal membuat PDF gabungan', 'error');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-kemdikbud-dark">
            <Printer size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Cetak Rapor Hasil Belajar Siswa
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelas {session.kelas} · {session.tahunAjaran} Semester {session.semester === 1 ? 'Ganjil' : 'Genap'}
            </p>
          </div>
        </div>

        {/* Paper Size & Stamp Options */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setPaperSize('F4')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                paperSize === 'F4' ? 'bg-white text-kemdikbud-dark shadow-xs' : 'text-slate-600'
              }`}
            >
              F4 / Folio (8.5×13")
            </button>
            <button
              onClick={() => setPaperSize('A4')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                paperSize === 'A4' ? 'bg-white text-kemdikbud-dark shadow-xs' : 'text-slate-600'
              }`}
            >
              A4
            </button>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 border border-slate-300 px-3 py-2 rounded-xl text-slate-700 font-semibold select-none">
            <input
              type="checkbox"
              checked={includeStamp}
              onChange={(e) => setIncludeStamp(e.target.checked)}
              className="w-4 h-4 rounded text-kemdikbud-dark"
            />
            <span>Sertakan TTD & Stempel</span>
          </label>
        </div>
      </div>

      {/* Status Finalisasi & Kunci Rapor (Tahap 4) */}
      {finalisasiInfo?.status === 'final' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                  Final
                </span>
                <span className="text-xs font-bold text-emerald-900">
                  Rapor Kelas {session.kelas} Telah Difinalkan
                </span>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Tanggal Finalisasi: <strong>{finalisasiInfo.tanggalFinal ? new Date(finalisasiInfo.tanggalFinal).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) : '—'}</strong>
                {finalisasiInfo.difinalkanOlehNama ? ` oleh ${finalisasiInfo.difinalkanOlehNama}` : ''}.
                Seluruh nilai, deskripsi, kehadiran, dan 7 KAIH terkunci (hanya admin yang dapat membuka kunci).
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100/90 text-emerald-800 text-xs font-bold border border-emerald-300">
              <CheckCircle2 size={14} />
              <span>Cetak PDF Aktif</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-900">
                Finalisasi Rapor Kelas {session.kelas}
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Pastikan seluruh capaian pembelajaran, asesmen sumatif, kehadiran, dan 7 KAIH siswa telah lengkap sebelum memfinalkan rapor.
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalFinalisasi(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Lock size={14} />
            <span>Finalkan Rapor Kelas</span>
          </button>
        </div>
      )}

      {/* Modal Konfirmasi Finalisasi */}
      {modalFinalisasi && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-card-rise">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <Lock size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Finalkan Rapor Kelas {session.kelas}?
            </h3>
            <div className="text-xs text-slate-600 mt-2 space-y-2 leading-relaxed">
              <p>
                Setelah difinalkan:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 font-medium">
                <li>Seluruh nilai formatif dan sumatif kelas ini akan <strong>dikunci</strong>.</li>
                <li>Deskripsi capaian kompetensi, kokurikuler, dan catatan wali kelas <strong>tidak dapat diubah</strong> lagi oleh wali kelas maupun guru mapel.</li>
                <li>Hanya <strong>Admin Sekolah</strong> yang dapat membuka kunci kembali dengan wajib mengisi alasan.</li>
                <li>Anda tetap dapat mengunduh dan mencetak berkas PDF kapan saja.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalFinalisasi(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isFinalizing}
                onClick={handleFinalkanRapor}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isFinalizing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Memproses…</span>
                  </>
                ) : (
                  <span>Ya, Finalkan Rapor</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mass Action Banner Buttons */}
      <div className="bg-gradient-to-r from-kemdikbud-dark to-kemdikbud-hover rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
            Fitur Unduh Massal Otomatis
          </span>
          <h4 className="text-lg font-black">
            Cetak Sekaligus untuk Seluruh Siswa ({enrolledStudents.length} Siswa)
          </h4>
          <p className="text-xs text-blue-100 mt-0.5">
            Unduh berkas PDF siap cetak dalam arsip ZIP atau satu file gabungan panjang
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            disabled={isProcessing || enrolledStudents.length === 0}
            onClick={handleDownloadBulkZIP}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-kemdikbud-accent hover:bg-orange-600 text-white font-bold text-xs shadow transition disabled:opacity-50"
          >
            <Archive size={15} />
            <span>Unduh Semua (ZIP)</span>
          </button>

          <button
            disabled={isProcessing || enrolledStudents.length === 0}
            onClick={handleDownloadCombinedPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 shadow transition disabled:opacity-50"
          >
            <FileDown size={15} />
            <span>Satu PDF Gabungan</span>
          </button>

          <button
            disabled={isProcessing || enrolledStudents.length === 0}
            onClick={handleDownloadBulkBundelZIP}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition disabled:opacity-50"
          >
            <PackageCheck size={15} />
            <span>Unduh Bundel Lengkap (ZIP)</span>
          </button>
        </div>
      </div>

      {/* Bulk Processing Progress Indicator */}
      {isProcessing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-blue-800 text-xs font-bold animate-pulse">
          <RefreshCw size={18} className="animate-spin text-kemdikbud-dark shrink-0" />
          <span>{progressText || 'Sedang memproses berkas PDF… Harap tunggu…'}</span>
        </div>
      )}

      {/* Student List Table with Individual Download & Preview Buttons */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-3">NIS</th>
                <th className="py-3 px-3">NISN</th>
                <th className="py-3 px-3">Nama Peserta Didik</th>
                <th className="py-3 px-3 text-center">Format Nama File PDF</th>
                <th className="py-3 px-3 text-right min-w-[260px]">Aksi Cetak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrolledStudents.length > 0 ? (
                enrolledStudents.map((s) => {
                  const numStr = String(s.no_urut || 1).padStart(2, '0');
                  const safeName = s.nama.replace(/[/\\?%*:|"<>]/g, '_');
                  const fileNameDisplay = `Rapor_${numStr}_${safeName}.pdf`;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 text-center font-bold text-slate-500 tabular-nums">
                        {numStr}
                      </td>
                      <td className="py-3 px-3 tabular-nums font-mono text-slate-600">
                        {s.nis || '-'}
                      </td>
                      <td className="py-3 px-3 tabular-nums font-mono font-semibold text-slate-800">
                        {s.nisn || '-'}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{s.nama}</td>
                      <td className="py-3 px-3 text-center">
                        <code className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-600 font-mono">
                          {fileNameDisplay}
                        </code>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePreviewStudent(s)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] transition"
                            title="Pratinjau Rapor di Layar"
                          >
                            <Eye size={13} />
                            <span>Pratinjau</span>
                          </button>
                          <button
                            onClick={() => handleDownloadSingle(s)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] transition"
                            title="Unduh PDF Rapor Anak Ini"
                          >
                            <FileDown size={13} />
                            <span>Unduh PDF</span>
                          </button>
                          <button
                            onClick={() => handleDownloadBundelSingle(s)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-[11px] transition"
                            title="Unduh Bundel (Sampul + Identitas + Rapor + 7 KAIH)"
                          >
                            <PackageCheck size={13} />
                            <span>Bundel</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    Belum ada siswa terdaftar di Kelas {session.kelas}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PDF Modal Preview */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-3.5 bg-kemdikbud-dark text-white flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileText size={16} />
                <span>{previewTitle}</span>
              </h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-white/80 hover:text-white"
              >
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
