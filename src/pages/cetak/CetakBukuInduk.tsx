import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BukuIndukPDFDocument } from '../../pdf/BukuIndukPDF';
import { downloadSinglePDF, getPDFBlobUrl, downloadBulkZIP } from '../../lib/pdfGenerator';
import { calcNALingkupMateri, calcNAAkhirSemester, calcNilaiRapor } from '../../lib/rapor';
import { labelRapor, parseRombelNama } from '../../lib/rombel';
import { getMapelForSession } from '../../lib/mapelService';
import { BookMarked, FileDown, Archive, Eye, X, RefreshCw } from 'lucide-react';

export const CetakBukuInduk: React.FC = () => {
  const { data, session, notify } = useApp();
  const [paperSize, setPaperSize] = useState<'F4' | 'A4'>('F4');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');

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

  const getElement = (s: typeof enrolledStudents[0]) => {
    const mapelScores = classMapel.map((m) => {
      const mapelLMs = data.lm.filter((l) => l.mapel_id === m.id);
      const lmValues = mapelLMs.map((lm) => {
        const entry = data.sumatifLM.find((row) => row.siswa_id === s.id && row.lm_id === lm.id);
        return entry ? entry.nilai : null;
      });

      const semEntry = data.sumatifSemester.find((row) => row.siswa_id === s.id && row.mapel_id === m.id);
      const naLM = calcNALingkupMateri(lmValues);
      const naAkhir = calcNAAkhirSemester(semEntry?.pts, semEntry?.pas);
      const score = calcNilaiRapor(naLM, naAkhir);
      return {
        nama: m.nama,
        nilai: score !== null ? score : '-',
      };
    });

    const ekskuls = data.nilaiEkskul
      .filter((e) => e.siswa_id === s.id && e.kelas_id === session.kelasId)
      .map((e) => ({
        nama: data.ekskul.find((item) => item.id === e.ekskul_id)?.nama || 'Ekstrakurikuler',
        keterangan: e.deskripsi,
      }));

    const keh = data.kehadiran.find((k) => k.siswa_id === s.id && k.kelas_id === session.kelasId) || {
      sakit: 0,
      izin: 0,
      alpa: 0,
    };

    const { tingkat, huruf } = parseRombelNama(session.kelas);
    const formattedKelas = labelRapor(tingkat, huruf, data.sekolah.format_kelas_rapor || 'romawi');

    return (
      <BukuIndukPDFDocument
        paperSize={paperSize}
        sekolah={data.sekolah}
        siswa={s}
        tingkatKelas={formattedKelas}
        semester={session.semester}
        tahunAjaran={session.tahunAjaran}
        mapelScores={mapelScores}
        ekskulList={ekskuls}
        kehadiran={{ sakit: keh.sakit || 0, izin: keh.izin || 0, alpa: keh.alpa || 0 }}
      />
    );
  };

  const handlePreview = async (s: typeof enrolledStudents[0]) => {
    const el = getElement(s);
    const url = await getPDFBlobUrl(el);
    setPreviewUrl(url);
    setPreviewTitle(`Pratinjau Buku Induk: ${s.nama}`);
  };

  const handleDownloadSingle = async (s: typeof enrolledStudents[0]) => {
    const el = getElement(s);
    const numStr = String(s.no_urut || 1).padStart(2, '0');
    const safeName = s.nama.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `Buku_Induk_${numStr}_${safeName}.pdf`;

    await downloadSinglePDF(el, filename);
    notify(`Buku Induk ${s.nama} berhasil diunduh.`, 'success');
  };

  const handleDownloadBulkZIP = async () => {
    if (enrolledStudents.length === 0) return;
    setIsProcessing(true);
    const cleanTA = session.tahunAjaran.replace('/', '-');
    const zipName = `Buku_Induk_Kelas_${session.kelas}_${cleanTA}.zip`;

    const tasks = enrolledStudents.map((s) => {
      const numStr = String(s.no_urut || 1).padStart(2, '0');
      const safeName = s.nama.replace(/[/\\?%*:|"<>]/g, '_');
      return {
        element: getElement(s),
        filename: `Buku_Induk_${numStr}_${safeName}.pdf`,
      };
    });

    try {
      await downloadBulkZIP(tasks, zipName, (curr, tot) => {
        setProgressText(`Membuat PDF ${curr} / ${tot}…`);
      });
      notify('Semua lembar Buku Induk berhasil diunduh (ZIP)!', 'success');
    } catch (err: any) {
      notify('Gagal membuat ZIP', 'error');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-kemdikbud-dark">
            <BookMarked size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Cetak Lembar Buku Induk Siswa
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rekapitulasi resmi nilai raport, ekstrakurikuler, dan kehadiran untuk arsip buku induk
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white font-bold text-xs shadow transition disabled:opacity-50"
          >
            <Archive size={15} />
            <span>Unduh Semua (ZIP)</span>
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-blue-800 text-xs font-bold animate-pulse">
          <RefreshCw size={18} className="animate-spin text-kemdikbud-dark shrink-0" />
          <span>{progressText}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-3">NIS</th>
                <th className="py-3 px-3">NISN</th>
                <th className="py-3 px-3">Nama Peserta Didik</th>
                <th className="py-3 px-3 text-right w-44">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrolledStudents.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 text-center font-bold text-slate-500 tabular-nums">
                    {String(s.no_urut || 1).padStart(2, '0')}
                  </td>
                  <td className="py-3 px-3 tabular-nums font-mono text-slate-600">{s.nis || '-'}</td>
                  <td className="py-3 px-3 tabular-nums font-mono font-semibold text-slate-800">{s.nisn || '-'}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">{s.nama}</td>
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
              ))}
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
