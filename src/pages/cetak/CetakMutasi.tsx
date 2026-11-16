import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MutasiPDFDocument } from '../../pdf/MutasiPDF';
import { downloadSinglePDF, getPDFBlobUrl, downloadBulkZIP } from '../../lib/pdfGenerator';
import { GitCompare, FileDown, Archive, Eye, X } from 'lucide-react';

export const CetakMutasi: React.FC = () => {
  const { data, session, notify } = useApp();
  const [paperSize, setPaperSize] = useState<'F4' | 'A4'>('F4');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  if (!data || !session) return null;

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
    return <MutasiPDFDocument paperSize={paperSize} sekolah={data.sekolah} siswa={s} />;
  };

  const handlePreview = async (s: typeof enrolledStudents[0]) => {
    const url = await getPDFBlobUrl(getElement(s));
    setPreviewUrl(url);
    setPreviewTitle(`Pratinjau Lembar Mutasi: ${s.nama}`);
  };

  const handleDownloadSingle = async (s: typeof enrolledStudents[0]) => {
    const numStr = String(s.no_urut || 1).padStart(2, '0');
    const safeName = s.nama.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `Mutasi_${numStr}_${safeName}.pdf`;

    await downloadSinglePDF(getElement(s), filename);
    notify(`Lembar Mutasi ${s.nama} berhasil diunduh.`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-kemdikbud-dark">
            <GitCompare size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Cetak Keterangan Pindah Sekolah (Mutasi)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Lembar mutasi resmi 3 slot keluar dan 3 slot masuk sesuai standar rapor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
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
      </div>

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
