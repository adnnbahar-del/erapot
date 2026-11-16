import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Printer,
  FileDown,
  Archive,
  School,
  ExternalLink,
  CheckSquare,
  Square,
  RefreshCw,
  FolderArchive,
  Info,
} from 'lucide-react';
import { Rombel, Siswa, KaihRecord } from '../../types';
import { labelRapor, parseRombelNama, faseDariTingkat } from '../../lib/rombel';
import { getMapelForSession } from '../../lib/mapelService';
import {
  calcNALingkupMateri,
  calcNAAkhirSemester,
  calcNilaiRapor,
  generateDeskripsiKompetensi,
  calculateRekapDanPeringkat,
} from '../../lib/rapor';
import { kokurikulerRapor } from '../../lib/kokurikuler';
import { periodeBawaan, normalisasiKaih } from '../../lib/kaih';
import { RaporPDFDocument } from '../../pdf/RaporPDF';
import { downloadBulkZIP } from '../../lib/pdfGenerator';

export const CetakSemua: React.FC = () => {
  const { data, session, setSession, notify } = useApp();
  const navigate = useNavigate();

  const [selectedRombelIds, setSelectedRombelIds] = useState<string[]>([]);
  const [paperSize, setPaperSize] = useState<'F4' | 'A4'>('F4');
  const [includeStamp, setIncludeStamp] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');

  const rombelList = useMemo(() => {
    return (data?.rombel || [])
      .filter((r) => r.aktif)
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [data?.rombel]);

  // Group per tingkat 1..6
  const tingkatGroups = useMemo(() => {
    return [1, 2, 3, 4, 5, 6].map((t) => {
      const list = rombelList.filter((r) => {
        const tAngka = r.tingkat_angka || parseInt(r.nama, 10);
        return tAngka === t;
      });
      return {
        tingkat: t,
        fase: faseDariTingkat(t),
        rombels: list,
      };
    });
  }, [rombelList]);

  // Default select all active rombels
  useState(() => {
    if (rombelList.length > 0) {
      setSelectedRombelIds(rombelList.map((r) => r.id));
    }
  });

  const handleSelectAll = () => {
    if (selectedRombelIds.length === rombelList.length) {
      setSelectedRombelIds([]);
    } else {
      setSelectedRombelIds(rombelList.map((r) => r.id));
    }
  };

  const handleToggleTingkat = (rombelsInTingkat: Rombel[]) => {
    const idsInTingkat = rombelsInTingkat.map((r) => r.id);
    const allSelected = idsInTingkat.every((id) => selectedRombelIds.includes(id));

    if (allSelected) {
      setSelectedRombelIds(selectedRombelIds.filter((id) => !idsInTingkat.includes(id)));
    } else {
      const combined = new Set([...selectedRombelIds, ...idsInTingkat]);
      setSelectedRombelIds(Array.from(combined));
    }
  };

  const handleToggleRombel = (id: string) => {
    if (selectedRombelIds.includes(id)) {
      setSelectedRombelIds(selectedRombelIds.filter((item) => item !== id));
    } else {
      setSelectedRombelIds([...selectedRombelIds, id]);
    }
  };

  const handleOpenPrintForClass = (r: Rombel) => {
    if (session) {
      const tingkatAngka = r.tingkat_angka || parseInt(r.nama, 10) || 1;
      setSession({
        ...session,
        rombelId: r.id,
        rombelNama: r.nama,
        kelas: r.nama,
        kelasId: r.id,
        tingkatAngka,
        huruf: r.huruf || 'A',
        fase: faseDariTingkat(tingkatAngka),
        namaWali: r.nama_wali || 'Wali Kelas',
      });
      navigate('/cetak/rapor');
    }
  };

  // Helper untuk membuat elemen RaporPDFDocument bagi siswa di suatu rombel
  const generateStudentProps = (s: Siswa, r: Rombel) => {
    if (!data) return null;

    const tingkatAngka = r.tingkat_angka || parseInt(r.nama, 10) || 1;
    const tingkatId = `tingkat_${tingkatAngka}`;
    const formattedKelas = labelRapor(
      tingkatAngka,
      r.huruf || 'A',
      data.sekolah.format_kelas_rapor || 'romawi'
    );
    const computedFase = faseDariTingkat(tingkatAngka);

    const classMapel = getMapelForSession(data.mapel, {
      fase: computedFase,
      kelasId: r.id,
      peran: 'guru',
    });

    const roster = data.kelasSiswa.filter((ks) => ks.rombel_id === r.id || ks.kelas_id === r.id);
    const enrolledStudents = data.siswa
      .filter((st) => roster.some((ks) => ks.siswa_id === st.id))
      .map((st) => {
        const ks = roster.find((item) => item.siswa_id === st.id);
        return { ...st, no_urut: ks?.no_urut || 0 };
      })
      .sort((a, b) => a.no_urut - b.no_urut);

    const studentScoresGrid = enrolledStudents.map((st) => {
      const scores = classMapel.map((m) => {
        const mapelLMs = data.lm.filter((l) => l.mapel_id === m.id);
        const lmValues = mapelLMs.map((lm) => {
          const entry = data.sumatifLM.find((row) => row.siswa_id === st.id && row.lm_id === lm.id);
          return entry ? entry.nilai : null;
        });
        const semEntry = data.sumatifSemester.find((row) => row.siswa_id === st.id && row.mapel_id === m.id);
        const naLM = calcNALingkupMateri(lmValues);
        const naAkhir = calcNAAkhirSemester(semEntry?.pts, semEntry?.pas);
        return calcNilaiRapor(naLM, naAkhir);
      });
      return { id: st.id, nama: st.nama, nilaiMapel: scores };
    });

    const rekapOutputs = calculateRekapDanPeringkat(studentScoresGrid, classMapel.length);

    const activeTahun =
      data.tahunAjaran.find((t) => t.id === data.activeTahunAjaranId) || data.tahunAjaran[0];
    const semester = activeTahun?.semester || 1;
    const tahunAjaran = activeTahun?.tahun || '2025/2026';

    const mapelList = classMapel.map((m, mIdx) => {
      const mapelLMs = data.lm.filter((l) => l.mapel_id === m.id).sort((a, b) => a.urutan - b.urutan);
      const lmValues = mapelLMs.map((lm) => {
        const entry = data.sumatifLM.find((row) => row.siswa_id === s.id && row.lm_id === lm.id);
        return entry ? entry.nilai : null;
      });

      const semEntry = data.sumatifSemester.find(
        (row) => row.siswa_id === s.id && row.mapel_id === m.id
      );
      const naLM = calcNALingkupMateri(lmValues);
      const naAkhir = calcNAAkhirSemester(semEntry?.pts, semEntry?.pas);
      const nilaiAkhir = calcNilaiRapor(naLM, naAkhir);

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

    const kokurikulerList = kokurikulerRapor(
      s,
      data.temaKokurikuler || [],
      data.penilaianKokurikuler || []
    );
    const kokurikulerText = kokurikulerList.length > 0 ? kokurikulerList[0].deskripsi : '';

    const rekap = rekapOutputs.find((item) => item.id === s.id);
    const prestasiAkademikText = rekap?.prestasiAkademikText || '-';

    const ekskuls = data.nilaiEkskul
      .filter((e) => e.siswa_id === s.id && (e.rombel_id === r.id || e.kelas_id === r.id))
      .map((e) => ({
        nama: data.ekskul.find((item) => item.id === e.ekskul_id)?.nama || 'Ekstrakurikuler',
        keterangan: e.deskripsi,
      }));

    const keh = data.kehadiran.find(
      (k) => k.siswa_id === s.id && (k.rombel_id === r.id || k.kelas_id === r.id)
    ) || { sakit: 0, izin: 0, alpa: 0 };

    const cat = data.catatanWali.find(
      (c) => c.siswa_id === s.id && (c.rombel_id === r.id || c.kelas_id === r.id)
    );
    const catatanWaliText = cat?.catatan || 'Tingkatkan terus prestasi belajarmu.';
    const keputusanNaik =
      semester === 2 ? cat?.keputusan_naik || 'Naik ke Kelas Berikutnya' : null;

    const bawaanKaih = periodeBawaan(tahunAjaran, semester as 1 | 2);
    const foundKaih = data.kaih.find((k) => {
      const norm = normalisasiKaih(k);
      return (
        k.siswa_id === s.id &&
        (k.rombel_id === r.id || k.kelas_id === r.id) &&
        norm.tahun === bawaanKaih.tahun &&
        norm.periode === bawaanKaih.periode
      );
    });

    const kaihRecord: KaihRecord = foundKaih || {
      siswa_id: s.id,
      kelas_id: r.id,
      rombel_id: r.id,
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

    return {
      paperSize,
      sekolah: data.sekolah,
      siswa: s,
      tingkatKelas: formattedKelas,
      fase: computedFase,
      semester: (semester === 'Genap' || semester === 2) ? 2 : 1,
      tahunAjaran,
      namaWali: r.nama_wali || 'Wali Kelas',
      nipWali: r.nip_wali || '',
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

  // Unduh ZIP Rapor Semua Kelas (Folder per Rombel)
  const handleDownloadZipAll = async () => {
    if (!data) return;
    const selectedRombels = rombelList.filter((r) => selectedRombelIds.includes(r.id));
    if (selectedRombels.length === 0) {
      notify('Pilih minimal satu rombel untuk diunduh.', 'error');
      return;
    }

    setIsProcessing(true);
    setProgressText('Menyiapkan daftar siswa dan rapor...');

    try {
      const activeTahun =
        data.tahunAjaran.find((t) => t.id === data.activeTahunAjaranId) || data.tahunAjaran[0];
      const semName = activeTahun?.semester === 1 ? 'Ganjil' : 'Genap';
      const cleanTA = (activeTahun?.tahun || '2025-2026').replace('/', '-');
      const rootFolder = `Rapor_${cleanTA}_${semName}`;
      const zipName = `${rootFolder}_Semua_Rombel.zip`;

      const tasks: { element: React.ReactElement; filename: string }[] = [];

      for (const r of selectedRombels) {
        const roster = data.kelasSiswa.filter((ks) => ks.rombel_id === r.id || ks.kelas_id === r.id);
        const enrolledStudents = data.siswa
          .filter((st) => roster.some((ks) => ks.siswa_id === st.id))
          .map((st) => {
            const ks = roster.find((item) => item.siswa_id === st.id);
            return { ...st, no_urut: ks?.no_urut || 0 };
          })
          .sort((a, b) => a.no_urut - b.no_urut);

        for (const s of enrolledStudents) {
          const props = generateStudentProps(s, r);
          if (!props) continue;

          const numStr = String(s.no_urut || 1).padStart(2, '0');
          const safeName = s.nama.replace(/[/\\?%*:|"<>]/g, '_');
          // Format sesuai prompt: Rapor_2025-2026_Ganjil/1A/Rapor_01_NAMA.pdf
          const folderRombelPath = `${rootFolder}/${r.nama}/Rapor_${numStr}_${safeName}.pdf`;

          tasks.push({
            element: <RaporPDFDocument {...props} />,
            filename: folderRombelPath,
          });
        }
      }

      if (tasks.length === 0) {
        notify('Tidak ada siswa di rombel terpilih.', 'error');
        setIsProcessing(false);
        return;
      }

      await downloadBulkZIP(tasks, zipName, (curr, tot) => {
        setProgressText(`Membuat PDF rapor ${curr} / ${tot}…`);
      });

      notify(`Semua rapor (${tasks.length} PDF) berhasil diunduh dalam file ZIP!`, 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal membuat file ZIP rapor', 'error');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Printer size={22} className="text-navy-500" />
            <span>Cetak Rapor Semua Rombel (1A – 6C)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pilih tingkat atau centang rombel secara selektif untuk mengunduh satu paket ZIP terstruktur per folder
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
            <span className="text-slate-500 pl-1">Kertas:</span>
            <button
              onClick={() => setPaperSize('F4')}
              className={`px-2.5 py-1 rounded-lg transition ${
                paperSize === 'F4' ? 'bg-white text-navy-800 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              F4
            </button>
            <button
              onClick={() => setPaperSize('A4')}
              className={`px-2.5 py-1 rounded-lg transition ${
                paperSize === 'A4' ? 'bg-white text-navy-800 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              A4
            </button>
          </div>

          <button
            onClick={handleDownloadZipAll}
            disabled={isProcessing || selectedRombelIds.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>{progressText || 'Memproses ZIP...'}</span>
              </>
            ) : (
              <>
                <FolderArchive size={16} />
                <span>Unduh ZIP Rapor Terpilih ({selectedRombelIds.length} Rombel)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Struktur ZIP */}
      <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-blue-900 font-medium">
          <Info size={18} className="text-blue-600 shrink-0" />
          <span>
            Berkas ZIP akan terorganisir rapi dalam folder per rombel:
            <code className="mx-1 px-1.5 py-0.5 bg-white border border-blue-200 rounded font-mono font-bold text-blue-800">
              Rapor_[Tahun]_[Semester]/[Rombel]/Rapor_01_NAMA.pdf
            </code>
          </span>
        </div>
        <button
          onClick={handleSelectAll}
          className="px-3 py-1.5 bg-white text-blue-700 hover:bg-blue-100 rounded-lg font-bold border border-blue-200 shrink-0 transition"
        >
          {selectedRombelIds.length === rombelList.length ? 'Batal Pilih Semua' : 'Pilih Semua Rombel'}
        </button>
      </div>

      {/* Grid Pilihan Tingkat & Rombel */}
      <div className="space-y-4">
        {tingkatGroups.map(({ tingkat, fase, rombels }) => {
          const idsInTingkat = rombels.map((r) => r.id);
          const allInTingkatSelected =
            idsInTingkat.length > 0 && idsInTingkat.every((id) => selectedRombelIds.includes(id));
          const someInTingkatSelected =
            idsInTingkat.some((id) => selectedRombelIds.includes(id)) && !allInTingkatSelected;

          return (
            <div
              key={tingkat}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
            >
              {/* Header Tingkat dengan Checkbox Cepat */}
              <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleTingkat(rombels)}
                    className="text-kemdikbud-dark hover:text-blue-800 transition"
                  >
                    {allInTingkatSelected ? (
                      <CheckSquare size={20} className="text-kemdikbud-dark" />
                    ) : someInTingkatSelected ? (
                      <div className="w-5 h-5 rounded border-2 border-kemdikbud-dark bg-blue-100 flex items-center justify-center text-[10px] font-bold text-kemdikbud-dark">
                        -
                      </div>
                    ) : (
                      <Square size={20} className="text-slate-400" />
                    )}
                  </button>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Tingkat {tingkat} · Fase {fase}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {rombels.filter((r) => selectedRombelIds.includes(r.id)).length} dari{' '}
                      {rombels.length} rombel dipilih
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleTingkat(rombels)}
                  className="text-xs font-bold text-blue-700 hover:underline"
                >
                  {allInTingkatSelected ? 'Hapus Centang Tingkat' : 'Pilih Semua di Tingkat Ini'}
                </button>
              </div>

              {/* Rombel Cards */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {rombels.map((r) => {
                  const isChecked = selectedRombelIds.includes(r.id);
                  const countSiswa = data.kelasSiswa.filter(
                    (ks) => ks.rombel_id === r.id || ks.kelas_id === r.id
                  ).length;

                  return (
                    <div
                      key={r.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'border-blue-400 bg-blue-50/40 shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRombel(r.id)}
                          className="rounded text-kemdikbud-dark focus:ring-blue-500 h-4 w-4"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-xs">Kelas {r.nama}</span>
                            <span className="text-[10px] text-slate-400">({countSiswa} siswa)</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {r.nama_wali || 'Wali belum diatur'}
                          </div>
                        </div>
                      </label>

                      <button
                        onClick={() => handleOpenPrintForClass(r)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-kemdikbud-dark hover:bg-blue-100 transition shrink-0"
                        title="Buka halaman Cetak Rapor untuk rombel ini"
                      >
                        <ExternalLink size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
