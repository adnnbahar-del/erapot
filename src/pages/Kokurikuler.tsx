import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DPL, DPLType, deskripsiOtomatis, kokurikulerRapor } from '../lib/kokurikuler';
import { TemaKokurikuler, PenilaianKokurikuler, Siswa } from '../types';
import {
  Compass,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Pencil,
  Eye,
  Eraser,
  X,
  Users,
} from 'lucide-react';

export const Kokurikuler: React.FC = () => {
  const { data, session, saveTema, reorderTema, deleteTema, copyTema, salinTemaKeRombelLain, savePenilaianKoku, notify } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active theme tab state
  const [activeTemaId, setActiveTemaId] = useState<string>('');

  // Save indicator state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');

  // Preview selected student
  const [previewSiswaId, setPreviewSiswaId] = useState<string>('');

  // Modals state
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<TemaKokurikuler | null>(null);
  const [themeForm, setThemeForm] = useState({
    nama: '',
    keterangan: '',
    tampil_di_rapor: true,
  });

  const [deleteConfirmTheme, setDeleteConfirmTheme] = useState<TemaKokurikuler | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [selectedCopyKelasId, setSelectedCopyKelasId] = useState('');

  // Salin tema ke rombel lain di tingkat yang sama
  const [isCopyRombelModalOpen, setIsCopyRombelModalOpen] = useState(false);
  const [selectedTargetRombels, setSelectedTargetRombels] = useState<string[]>([]);
  const [isCopyingRombel, setIsCopyingRombel] = useState(false);

  const [isApplyAllModalOpen, setIsApplyAllModalOpen] = useState(false);
  const [applyAllForm, setApplyAllForm] = useState<{
    dpl_kuat: string;
    dpl_penguatan: string;
    timpa_terisi: boolean;
  }>({
    dpl_kuat: DPL[0],
    dpl_penguatan: DPL[1],
    timpa_terisi: false,
  });

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // In-line editing description state
  const [editingDescSiswaId, setEditingDescSiswaId] = useState<string | null>(null);
  const [descInputVal, setDescInputVal] = useState<string>('');

  // Debounce save timer ref
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRowsRef = useRef<Map<string, Partial<PenilaianKokurikuler>>>(new Map());

  // Enrolled students in active class
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

  // Themes list for this class
  const classThemes = useMemo(() => {
    if (!data || !session) return [];
    return (data.temaKokurikuler || [])
      .filter((t) => t.kelas_id === session.kelasId)
      .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
  }, [data, session]);

  // Sync active theme with query param or first theme
  useEffect(() => {
    if (classThemes.length === 0) {
      setActiveTemaId('');
      return;
    }
    const paramTema = searchParams.get('tema');
    if (paramTema && classThemes.some((t) => t.id === paramTema)) {
      setActiveTemaId(paramTema);
    } else if (!activeTemaId || !classThemes.some((t) => t.id === activeTemaId)) {
      setActiveTemaId(classThemes[0].id);
    }
  }, [classThemes, searchParams, activeTemaId]);

  // Set initial preview student
  useEffect(() => {
    if (enrolledStudents.length > 0 && !previewSiswaId) {
      setPreviewSiswaId(enrolledStudents[0].id);
    }
  }, [enrolledStudents, previewSiswaId]);

  const currentTema = useMemo(() => {
    return classThemes.find((t) => t.id === activeTemaId) || null;
  }, [classThemes, activeTemaId]);

  // Local state of assessments for current theme
  const [localRows, setLocalRows] = useState<Record<string, {
    dpl_kuat: string;
    dpl_penguatan: string;
    deskripsi_manual: string;
    dplChangedAfterManual?: boolean;
  }>>({});

  // Sync localRows when currentTema or data.penilaianKokurikuler changes
  useEffect(() => {
    if (!currentTema || !data) return;
    const initialMap: Record<string, {
      dpl_kuat: string;
      dpl_penguatan: string;
      deskripsi_manual: string;
      dplChangedAfterManual?: boolean;
    }> = {};

    enrolledStudents.forEach((s) => {
      const pen = (data.penilaianKokurikuler || []).find(
        (p) => p.tema_id === currentTema.id && p.siswa_id === s.id
      );
      initialMap[s.id] = {
        dpl_kuat: pen?.dpl_kuat || '',
        dpl_penguatan: pen?.dpl_penguatan || '',
        deskripsi_manual: pen?.deskripsi_manual || '',
        dplChangedAfterManual: false,
      };
    });
    setLocalRows(initialMap);
  }, [currentTema?.id, data?.penilaianKokurikuler, enrolledStudents]);

  // Trigger debounced batch save
  const triggerSave = useCallback((updatedRows: { tema_id: string; siswa_id: string; dpl_kuat: string; dpl_penguatan: string; deskripsi_manual: string }[]) => {
    // Only queue rows where DPL kuat != DPL penguatan (or both empty)
    const validToSave = updatedRows.filter((r) => {
      if (r.dpl_kuat && r.dpl_penguatan && r.dpl_kuat === r.dpl_penguatan) return false;
      return true;
    });

    if (validToSave.length === 0) return;

    validToSave.forEach((r) => {
      pendingRowsRef.current.set(`${r.tema_id}_${r.siswa_id}`, r);
    });

    setSaveStatus('saving');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const rowsToSend = Array.from(pendingRowsRef.current.values());
      pendingRowsRef.current.clear();

      try {
        await savePenilaianKoku(rowsToSend);
        setSaveStatus('saved');
      } catch (e) {
        setSaveStatus('error');
      }
    }, 1500);
  }, [savePenilaianKoku]);

  if (!data || !session) return null;

  // Handler update single student DPL or manual description
  const handleRowChange = (
    siswaId: string,
    field: 'dpl_kuat' | 'dpl_penguatan' | 'deskripsi_manual',
    value: string
  ) => {
    if (!currentTema) return;

    const curr = localRows[siswaId] || { dpl_kuat: '', dpl_penguatan: '', deskripsi_manual: '' };
    const updated = { ...curr, [field]: value };

    // Check if DPL changed after manual edit
    if ((field === 'dpl_kuat' || field === 'dpl_penguatan') && curr.deskripsi_manual) {
      updated.dplChangedAfterManual = true;
    }

    setLocalRows((prev) => ({
      ...prev,
      [siswaId]: updated,
    }));

    // Trigger save if valid
    triggerSave([{
      tema_id: currentTema.id,
      siswa_id: siswaId,
      dpl_kuat: updated.dpl_kuat,
      dpl_penguatan: updated.dpl_penguatan,
      deskripsi_manual: updated.deskripsi_manual,
    }]);
  };

  const handleResetManualToAuto = (siswaId: string) => {
    if (!currentTema) return;
    const curr = localRows[siswaId];
    if (!curr) return;
    const updated = {
      ...curr,
      deskripsi_manual: '',
      dplChangedAfterManual: false,
    };
    setLocalRows((prev) => ({
      ...prev,
      [siswaId]: updated,
    }));
    triggerSave([{
      tema_id: currentTema.id,
      siswa_id: siswaId,
      dpl_kuat: updated.dpl_kuat,
      dpl_penguatan: updated.dpl_penguatan,
      deskripsi_manual: '',
    }]);
  };

  // Open theme modal for Add or Edit
  const handleOpenThemeModal = (theme?: TemaKokurikuler) => {
    if (theme) {
      setEditingTheme(theme);
      setThemeForm({
        nama: theme.nama,
        keterangan: theme.keterangan || '',
        tampil_di_rapor: theme.tampil_di_rapor !== false,
      });
    } else {
      setEditingTheme(null);
      setThemeForm({
        nama: '',
        keterangan: '',
        tampil_di_rapor: true,
      });
    }
    setIsThemeModalOpen(true);
  };

  const handleSaveThemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeForm.nama.trim()) {
      notify('Nama tema wajib diisi.', 'error');
      return;
    }

    try {
      const saved = await saveTema({
        id: editingTheme ? editingTheme.id : undefined,
        nama: themeForm.nama.trim(),
        keterangan: themeForm.keterangan.trim(),
        tampil_di_rapor: themeForm.tampil_di_rapor,
      });
      setIsThemeModalOpen(false);
      setActiveTemaId(saved.id);
      setSearchParams({ tema: saved.id });
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan tema.', 'error');
    }
  };

  // Reorder theme (Naik / Turun)
  const handleMoveTheme = async (themeId: string, direction: 'up' | 'down') => {
    const idx = classThemes.findIndex((t) => t.id === themeId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= classThemes.length) return;

    const newOrder = [...classThemes];
    const [moved] = newOrder.splice(idx, 1);
    newOrder.splice(targetIdx, 0, moved);

    const ids = newOrder.map((t) => t.id);
    await reorderTema(ids);
  };

  // Delete theme confirmation
  const handleDeleteThemePrompt = (theme: TemaKokurikuler) => {
    setDeleteConfirmTheme(theme);
  };

  const handleConfirmDeleteTheme = async () => {
    if (!deleteConfirmTheme) return;
    try {
      await deleteTema(deleteConfirmTheme.id);
      setDeleteConfirmTheme(null);
      const remaining = classThemes.filter((t) => t.id !== deleteConfirmTheme.id);
      if (remaining.length > 0) {
        setActiveTemaId(remaining[0].id);
        setSearchParams({ tema: remaining[0].id });
      } else {
        setActiveTemaId('');
        setSearchParams({});
      }
    } catch (err: any) {
      notify(err.message || 'Gagal menghapus tema.', 'error');
    }
  };

  // Apply to all students in current theme
  const handleApplyToAllSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTema || enrolledStudents.length === 0) return;
    if (applyAllForm.dpl_kuat === applyAllForm.dpl_penguatan) {
      notify('DPL yang sudah kuat dan DPL yang perlu penguatan harus berbeda.', 'error');
      return;
    }

    const updatedMap = { ...localRows };
    const rowsToSave: { tema_id: string; siswa_id: string; dpl_kuat: string; dpl_penguatan: string; deskripsi_manual: string }[] = [];

    enrolledStudents.forEach((s) => {
      const curr = updatedMap[s.id];
      const isFilled = curr && curr.dpl_kuat && curr.dpl_penguatan;

      if (!isFilled || applyAllForm.timpa_terisi) {
        const nextVal = {
          dpl_kuat: applyAllForm.dpl_kuat,
          dpl_penguatan: applyAllForm.dpl_penguatan,
          deskripsi_manual: curr?.deskripsi_manual || '',
          dplChangedAfterManual: curr?.deskripsi_manual ? true : false,
        };
        updatedMap[s.id] = nextVal;
        rowsToSave.push({
          tema_id: currentTema.id,
          siswa_id: s.id,
          dpl_kuat: nextVal.dpl_kuat,
          dpl_penguatan: nextVal.dpl_penguatan,
          deskripsi_manual: nextVal.deskripsi_manual,
        });
      }
    });

    setLocalRows(updatedMap);
    triggerSave(rowsToSave);
    setIsApplyAllModalOpen(false);
    notify(`Berhasil menerapkan dimensi ke siswa pada tema ini.`, 'success');
  };

  // Reset/Empty all assessments in current theme
  const handleConfirmResetCurrentTheme = () => {
    if (!currentTema) return;
    const updatedMap = { ...localRows };
    const rowsToSave: { tema_id: string; siswa_id: string; dpl_kuat: string; dpl_penguatan: string; deskripsi_manual: string }[] = [];

    enrolledStudents.forEach((s) => {
      updatedMap[s.id] = {
        dpl_kuat: '',
        dpl_penguatan: '',
        deskripsi_manual: '',
        dplChangedAfterManual: false,
      };
      rowsToSave.push({
        tema_id: currentTema.id,
        siswa_id: s.id,
        dpl_kuat: '',
        dpl_penguatan: '',
        deskripsi_manual: '',
      });
    });

    setLocalRows(updatedMap);
    triggerSave(rowsToSave);
    setIsResetConfirmOpen(false);
    notify(`Penilaian tema "${currentTema.nama}" telah dikosongkan.`, 'success');
  };

  // Copy themes from previous semester
  const availableCopyClasses = (data.kelas || []).filter(
    (k) => k.id !== session.kelasId && (data.temaKokurikuler || []).some((t) => t.kelas_id === k.id)
  );

  const handleCopyThemesSubmit = async () => {
    if (!selectedCopyKelasId) return;
    try {
      await copyTema(selectedCopyKelasId);
      setIsCopyModalOpen(false);
    } catch (err: any) {
      notify(err.message || 'Gagal menyalin tema.', 'error');
    }
  };

  // Calculate theme progress count: "X / Y terisi"
  const getThemeProgress = (temaId: string) => {
    if (enrolledStudents.length === 0) return '0 / 0 terisi';
    const filled = enrolledStudents.filter((s) => {
      // If active tema, check localRows for real-time reactivity
      if (temaId === activeTemaId) {
        const row = localRows[s.id];
        return row && row.dpl_kuat && row.dpl_penguatan && row.dpl_kuat !== row.dpl_penguatan;
      }
      const pen = (data.penilaianKokurikuler || []).find(
        (p) => p.tema_id === temaId && p.siswa_id === s.id
      );
      return pen && pen.dpl_kuat && pen.dpl_penguatan && pen.dpl_kuat !== pen.dpl_penguatan;
    }).length;
    return `${filled} / ${enrolledStudents.length} terisi`;
  };

  // Selected student for preview
  const previewStudent = enrolledStudents.find((s) => s.id === previewSiswaId) || enrolledStudents[0] || null;

  // Generate preview items using kokurikulerRapor
  const previewReportItems = useMemo(() => {
    if (!previewStudent || classThemes.length === 0) return [];
    // Merge localRows for active theme into penilaian list for preview
    const mergedPenilaian = (data.penilaianKokurikuler || []).filter(
      (p) => p.tema_id !== activeTemaId
    );
    if (currentTema) {
      Object.entries(localRows).forEach(([sId, r]) => {
        mergedPenilaian.push({
          tema_id: currentTema.id,
          siswa_id: sId,
          dpl_kuat: r.dpl_kuat,
          dpl_penguatan: r.dpl_penguatan,
          deskripsi_manual: r.deskripsi_manual,
        });
      });
    }

    return kokurikulerRapor(previewStudent, classThemes, mergedPenilaian);
  }, [previewStudent, classThemes, data.penilaianKokurikuler, activeTemaId, currentTema, localRows]);

  const tingkatAngka = session?.tingkatAngka || parseInt(session?.kelas || '1', 10) || 1;
  const tingkatId = `tingkat_${tingkatAngka}`;
  const otherRombelsInTingkat = useMemo(() => {
    if (!data?.rombel || !session) return [];
    const myId = session.rombelId || session.kelasId;
    return data.rombel.filter(
      (r) => r.tingkat_id === tingkatId && r.id !== myId && r.aktif
    );
  }, [data?.rombel, session, tingkatId]);

  const handleCopyRombelSubmit = async () => {
    if (selectedTargetRombels.length === 0) {
      notify('Pilih minimal satu rombel tujuan.', 'error');
      return;
    }
    setIsCopyingRombel(true);
    try {
      const sumberId = session?.rombelId || session?.kelasId || '';
      await salinTemaKeRombelLain(sumberId, selectedTargetRombels);
      notify('Tema kokurikuler berhasil disalin ke rombel tujuan', 'success');
      setIsCopyRombelModalOpen(false);
    } catch (err: any) {
      notify(err.message || 'Gagal menyalin tema ke rombel lain', 'error');
    } finally {
      setIsCopyingRombel(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
            <Compass size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">Tema Kokurikuler</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-700">
                P5 & 8 DPL
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola tema dan isi penilaian capaian 8 Dimensi Profil Lulusan untuk dicetak di rapor
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Save Status Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-600">
            {saveStatus === 'saving' && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Menyimpan…</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span className="text-emerald-700 font-medium">Tersimpan</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle size={13} className="text-rose-600" />
                <span className="text-rose-700 font-medium">Gagal menyimpan, mencoba lagi…</span>
              </>
            )}
          </div>

          {/* Copy from other semester */}
          {availableCopyClasses.length > 0 && (
            <button
              onClick={() => {
                setSelectedCopyKelasId(availableCopyClasses[0].id);
                setIsCopyModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
            >
              <Copy size={14} />
              <span>Salin Tema Semester Lalu</span>
            </button>
          )}

          {/* Tombol Salin Tema ke Rombel Lain di Tingkat Ini */}
          {otherRombelsInTingkat.length > 0 && classThemes.length > 0 && (
            <button
              onClick={() => {
                setSelectedTargetRombels(otherRombelsInTingkat.map((r) => r.id));
                setIsCopyRombelModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition shadow-2xs"
            >
              <Copy size={14} />
              <span>Salin tema ke rombel lain di tingkat ini</span>
            </button>
          )}

          {/* + Tambah Tema Button */}
          <button
            onClick={() => handleOpenThemeModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Plus size={15} />
            <span>+ Tambah Tema</span>
          </button>
        </div>
      </div>

      {/* Empty State: Belum Ada Siswa */}
      {enrolledStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto mb-3.5 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Users size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Belum ada siswa di kelas ini</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
            Belum ada siswa di kelas ini. Tambahkan siswa di menu Data Siswa.
          </p>
          <Link
            to="/data-siswa"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
          >
            Buka Menu Data Siswa →
          </Link>
        </div>
      ) : classThemes.length === 0 ? (
        /* Empty State: Belum Ada Tema */
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto mb-3.5 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <Compass size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Belum ada tema kokurikuler</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
            Belum ada tema kokurikuler. Tambahkan tema yang disepakati sekolah, misalnya “Lingkungan Sehat, Saya Kuat”.
          </p>
          <button
            onClick={() => handleOpenThemeModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Plus size={15} />
            <span>+ Tambah Tema</span>
          </button>
        </div>
      ) : (
        <>
          {/* Bagian A: Theme Tabs & Management Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {classThemes.map((tema, index) => {
                const isActive = tema.id === activeTemaId;
                const progressText = getThemeProgress(tema.id);
                return (
                  <div
                    key={tema.id}
                    onClick={() => {
                      setActiveTemaId(tema.id);
                      setSearchParams({ tema: tema.id });
                    }}
                    className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer text-xs font-bold transition whitespace-nowrap border ${
                      isActive
                        ? 'bg-purple-50 text-purple-900 border-purple-300 shadow-2xs'
                        : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  >
                    <span>{tema.nama}</span>

                    {/* Progress Badge */}
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        isActive
                          ? 'bg-purple-200/80 text-purple-900'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {progressText}
                    </span>

                    {/* Tampil di Rapor indicator */}
                    {!tema.tampil_di_rapor && (
                      <span className="text-[10px] text-amber-600 font-semibold italic">
                        (Tidak di rapor)
                      </span>
                    )}

                    {/* Reorder & Menu icons on active tab */}
                    {isActive && (
                      <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-purple-200">
                        {index > 0 && (
                          <button
                            title="Geser Naik"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveTheme(tema.id, 'up');
                            }}
                            className="p-1 hover:bg-purple-200 rounded text-purple-700"
                          >
                            <ArrowUp size={12} />
                          </button>
                        )}
                        {index < classThemes.length - 1 && (
                          <button
                            title="Geser Turun"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveTheme(tema.id, 'down');
                            }}
                            className="p-1 hover:bg-purple-200 rounded text-purple-700"
                          >
                            <ArrowDown size={12} />
                          </button>
                        )}
                        <button
                          title="Ubah Tema"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenThemeModal(tema);
                          }}
                          className="p-1 hover:bg-purple-200 rounded text-purple-700"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          title="Hapus Tema"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteThemePrompt(tema);
                          }}
                          className="p-1 hover:bg-rose-100 rounded text-rose-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Theme Details Banner & Quick Table Controls */}
            {currentTema && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-semibold text-slate-800">Keterangan:</span>
                  <span className="text-slate-500">
                    {currentTema.keterangan || 'Tidak ada keterangan khusus.'}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">
                    Status Rapor:{' '}
                    {currentTema.tampil_di_rapor ? (
                      <strong className="text-emerald-600 font-semibold">Tampil di Rapor</strong>
                    ) : (
                      <strong className="text-slate-400 font-semibold">Disembunyikan</strong>
                    )}
                  </span>
                </div>

                {/* Quick actions for current theme table */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsApplyAllModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold shadow-2xs transition"
                  >
                    <Copy size={13} />
                    <span>Terapkan ke Semua Siswa</span>
                  </button>

                  <button
                    onClick={() => setIsResetConfirmOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold shadow-2xs transition"
                  >
                    <Eraser size={13} />
                    <span>Kosongkan Penilaian Tema Ini</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bagian B: Tabel Penilaian Tema yang Dipilih (Excel Style) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[860px]">
                <thead>
                  <tr className="text-black font-bold text-center border-b border-slate-300">
                    {/* No Header */}
                    <th className="bg-koku-no sticky left-0 z-20 w-12 py-3 px-2 border-r border-slate-300 text-center">
                      No
                    </th>
                    {/* Nama Header */}
                    <th className="bg-koku-no sticky left-12 z-20 min-w-[190px] py-3 px-3 border-r border-slate-300 text-center">
                      Nama
                    </th>
                    {/* DPL yang Sudah Kuat */}
                    <th className="bg-koku-kuat min-w-[190px] py-3 px-3 border-r border-slate-300 text-center">
                      DPL yang<br />Sudah Kuat
                    </th>
                    {/* DPL yang Perlu Penguatan */}
                    <th className="bg-koku-penguatan min-w-[190px] py-3 px-3 border-r border-slate-300 text-center">
                      DPL yang<br />Perlu Penguatan
                    </th>
                    {/* Tema Header */}
                    <th className="bg-koku-tema min-w-[160px] py-3 px-3 border-r border-slate-300 text-center">
                      Tema
                    </th>
                    {/* Deskripsi Header */}
                    <th className="bg-koku-deskripsi min-w-[320px] py-3 px-4 text-center">
                      Deskripsi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {enrolledStudents.map((siswa, idx) => {
                    const rowData = localRows[siswa.id] || {
                      dpl_kuat: '',
                      dpl_penguatan: '',
                      deskripsi_manual: '',
                    };

                    const hasKuat = !!rowData.dpl_kuat;
                    const hasPenguatan = !!rowData.dpl_penguatan;
                    const isSame = hasKuat && hasPenguatan && rowData.dpl_kuat === rowData.dpl_penguatan;
                    const isComplete = hasKuat && hasPenguatan && !isSame;
                    const isManual = !!rowData.deskripsi_manual;

                    // Compute automatic description
                    const autoText = deskripsiOtomatis(
                      siswa.nama,
                      rowData.dpl_kuat,
                      rowData.dpl_penguatan,
                      currentTema?.nama || ''
                    );

                    const displayedDesc = isManual ? rowData.deskripsi_manual : autoText;

                    return (
                      <tr
                        key={siswa.id}
                        className={`transition ${
                          isSame
                            ? 'bg-rose-50/70 border-2 border-rose-500'
                            : idx % 2 === 0
                            ? 'bg-white hover:bg-slate-50/80'
                            : 'bg-slate-50/40 hover:bg-slate-50'
                        }`}
                      >
                        {/* No - Sticky */}
                        <td className="sticky left-0 z-10 bg-inherit py-3 px-2 text-center font-bold text-slate-700 border-r border-slate-200">
                          {siswa.no_urut || idx + 1}
                        </td>

                        {/* Nama - Sticky */}
                        <td className="sticky left-12 z-10 bg-inherit py-3 px-3 font-bold text-slate-900 border-r border-slate-200">
                          <div className="flex flex-col">
                            <span>{siswa.nama}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              NISN: {siswa.nisn || '-'}
                            </span>
                            {!isComplete && !isSame && (
                              <span className="inline-block mt-1 w-fit px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 text-slate-600">
                                Belum diisi
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Dropdown DPL Kuat */}
                        <td className="py-2.5 px-3 border-r border-slate-200 align-top">
                          <select
                            value={rowData.dpl_kuat}
                            onChange={(e) => handleRowChange(siswa.id, 'dpl_kuat', e.target.value)}
                            className="w-full text-xs font-medium py-1.5 px-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-400 outline-hidden"
                          >
                            <option value="">-- Pilih DPL Kuat --</option>
                            {DPL.map((dpl) => (
                              <option key={dpl} value={dpl}>
                                {dpl}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Dropdown DPL Penguatan */}
                        <td className="py-2.5 px-3 border-r border-slate-200 align-top">
                          <select
                            value={rowData.dpl_penguatan}
                            onChange={(e) => handleRowChange(siswa.id, 'dpl_penguatan', e.target.value)}
                            className="w-full text-xs font-medium py-1.5 px-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-400 outline-hidden"
                          >
                            <option value="">-- Pilih DPL Penguatan --</option>
                            {DPL.map((dpl) => (
                              <option key={dpl} value={dpl}>
                                {dpl}
                              </option>
                            ))}
                          </select>

                          {/* Error Validation: DPL Kuat == DPL Penguatan */}
                          {isSame && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-rose-600">
                              <AlertCircle size={12} />
                              <span>Pilih dimensi yang berbeda.</span>
                            </div>
                          )}
                        </td>

                        {/* Tema (Read-only) */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium text-xs align-top">
                          {currentTema?.nama}
                        </td>

                        {/* Deskripsi (Editable) */}
                        <td className="py-2.5 px-3.5 align-top">
                          {editingDescSiswaId === siswa.id ? (
                            <div className="space-y-1.5">
                              <textarea
                                value={descInputVal}
                                onChange={(e) => setDescInputVal(e.target.value)}
                                rows={3}
                                className="w-full text-xs p-2 bg-white rounded-lg border border-purple-400 focus:ring-2 focus:ring-purple-300 outline-hidden"
                                placeholder="Tuliskan deskripsi kokurikuler..."
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    handleRowChange(siswa.id, 'deskripsi_manual', descInputVal.trim());
                                    setEditingDescSiswaId(null);
                                  }}
                                  className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px]"
                                >
                                  Simpan
                                </button>
                                <button
                                  onClick={() => setEditingDescSiswaId(null)}
                                  className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px]"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="group relative">
                              <div
                                onClick={() => {
                                  setEditingDescSiswaId(siswa.id);
                                  setDescInputVal(displayedDesc || autoText);
                                }}
                                title="Klik untuk mengedit deskripsi manual"
                                className="cursor-pointer text-xs text-slate-700 leading-relaxed hover:bg-purple-50/60 p-1.5 rounded transition border border-transparent hover:border-purple-200"
                              >
                                {displayedDesc || (
                                  <span className="text-slate-400 italic">
                                    Pilih kedua DPL untuk membuat deskripsi otomatis
                                  </span>
                                )}
                              </div>

                              {/* Manual edit indicators and action buttons */}
                              <div className="flex items-center flex-wrap gap-2 mt-1">
                                {isManual && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">
                                    <Pencil size={10} />
                                    <span>Deskripsi Manual</span>
                                  </span>
                                )}

                                {isManual && (
                                  <button
                                    onClick={() => handleResetManualToAuto(siswa.id)}
                                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                  >
                                    <RotateCcw size={11} />
                                    <span>Kembalikan ke otomatis</span>
                                  </button>
                                )}
                              </div>

                              {/* Warning: DPL changed after manual edit */}
                              {rowData.dplChangedAfterManual && isManual && (
                                <div className="mt-1.5 p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center justify-between gap-2">
                                  <span>
                                    Deskripsi manual tidak ikut berubah. Kembalikan ke otomatis?
                                  </span>
                                  <button
                                    onClick={() => handleResetManualToAuto(siswa.id)}
                                    className="font-bold underline text-amber-900 whitespace-nowrap"
                                  >
                                    Ya, reset
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bagian C: Pratinjau Rapor Kokurikuler */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Pratinjau Blok Rapor Kokurikuler</h3>
                  <p className="text-xs text-slate-500">
                    Tampilan persis gabungan semua tema aktif yang akan dicetak di rapor PDF
                  </p>
                </div>
              </div>

              {/* Student selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Pilih Siswa:</label>
                <select
                  value={previewSiswaId}
                  onChange={(e) => setPreviewSiswaId(e.target.value)}
                  className="text-xs font-bold py-1.5 px-3 bg-slate-50 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-400 outline-hidden"
                >
                  {enrolledStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.no_urut}. {s.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview Box Formatted Exactly Like Rapor PDF */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 max-w-4xl mx-auto">
              <h4 className="text-xs font-bold text-slate-900 mb-2">Kokurikuler</h4>

              {previewReportItems.length === 0 ? (
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-400 italic">
                  -
                </div>
              ) : previewReportItems.length === 1 ? (
                <div className="p-3.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 leading-relaxed shadow-2xs">
                  {previewReportItems[0].deskripsi}
                </div>
              ) : (
                <div className="overflow-x-auto bg-white border border-slate-300 rounded-lg shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-bold">
                        <th className="py-2 px-2.5 text-center w-[6%] border-r border-slate-300">No</th>
                        <th className="py-2 px-3 w-[28%] border-r border-slate-300">Tema</th>
                        <th className="py-2 px-3 w-[66%]">Deskripsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewReportItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 text-center font-semibold text-slate-600 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-800 border-r border-slate-200">
                            {item.tema}
                          </td>
                          <td className="py-2 px-3 text-slate-800 leading-relaxed">
                            {item.deskripsi}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* --- MODAL DIALOGS --- */}

      {/* 1. Modal Tambah / Edit Tema */}
      {isThemeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {editingTheme ? 'Ubah Tema Kokurikuler' : 'Tambah Tema Kokurikuler Baru'}
              </h3>
              <button
                onClick={() => setIsThemeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveThemeSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Tema <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={themeForm.nama}
                  onChange={(e) => setThemeForm({ ...themeForm, nama: e.target.value })}
                  placeholder="Contoh: Lingkungan Sehat, Saya Kuat"
                  className="w-full text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-400 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <textarea
                  rows={2}
                  value={themeForm.keterangan}
                  onChange={(e) => setThemeForm({ ...themeForm, keterangan: e.target.value })}
                  placeholder="Penjelasan fokus projek atau tujuan..."
                  className="w-full text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-400 outline-hidden font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="tampil_di_rapor"
                  checked={themeForm.tampil_di_rapor}
                  onChange={(e) => setThemeForm({ ...themeForm, tampil_di_rapor: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
                <label htmlFor="tampil_di_rapor" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Tampilkan di rapor
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsThemeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs"
                >
                  Simpan Tema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Konfirmasi Hapus Tema */}
      {deleteConfirmTheme && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 animate-scaleIn">
            <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-3">
              <Trash2 size={22} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              Hapus Tema "{deleteConfirmTheme.nama}"?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              {(() => {
                const filledCount = (data.penilaianKokurikuler || []).filter(
                  (p) => p.tema_id === deleteConfirmTheme.id && p.dpl_kuat && p.dpl_penguatan
                ).length;
                if (filledCount > 0) {
                  return `Tema ini sudah berisi penilaian ${filledCount} siswa. Hapus tema beserta penilaiannya?`;
                }
                return `Apakah Anda yakin ingin menghapus tema ini secara permanen?`;
              })()}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTheme(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTheme}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Hapus Tema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Terapkan ke Semua Siswa */}
      {isApplyAllModalOpen && currentTema && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Terapkan Dimensi ke Semua Siswa
              </h3>
              <button
                onClick={() => setIsApplyAllModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyToAllSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DPL yang Sudah Kuat
                </label>
                <select
                  value={applyAllForm.dpl_kuat}
                  onChange={(e) => setApplyAllForm({ ...applyAllForm, dpl_kuat: e.target.value })}
                  className="w-full text-xs font-medium py-2 px-3 bg-slate-50 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-400 outline-hidden"
                >
                  {DPL.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DPL yang Perlu Penguatan
                </label>
                <select
                  value={applyAllForm.dpl_penguatan}
                  onChange={(e) => setApplyAllForm({ ...applyAllForm, dpl_penguatan: e.target.value })}
                  className="w-full text-xs font-medium py-2 px-3 bg-slate-50 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-400 outline-hidden"
                >
                  {DPL.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="timpa_terisi"
                  checked={applyAllForm.timpa_terisi}
                  onChange={(e) => setApplyAllForm({ ...applyAllForm, timpa_terisi: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="timpa_terisi" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Timpa yang sudah terisi
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApplyAllModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
                >
                  Terapkan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Konfirmasi Kosongkan Penilaian */}
      {isResetConfirmOpen && currentTema && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 animate-scaleIn">
            <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-3">
              <Eraser size={22} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              Kosongkan Penilaian Tema "{currentTema.nama}"?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              Tindakan ini akan mengosongkan pilihan DPL dan deskripsi untuk semua siswa di tema ini.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetCurrentTheme}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Kosongkan Penilaian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal Salin Tema dari Semester Lain */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 animate-scaleIn">
            <div className="px-1 py-1 flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">
                Salin Tema dari Semester Sebelumnya
              </h3>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Tema akan disalin (tanpa penilaian) ke semester ini. Nama tema yang sudah ada akan dilewati.
            </p>

            <div className="space-y-3 mb-5">
              <label className="block text-xs font-bold text-slate-700">Pilih Kelas Sumber:</label>
              <select
                value={selectedCopyKelasId}
                onChange={(e) => setSelectedCopyKelasId(e.target.value)}
                className="w-full text-xs font-bold py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-400 outline-hidden"
              >
                {availableCopyClasses.map((k) => (
                  <option key={k.id} value={k.id}>
                    Kelas {k.tingkat} - {k.nama_wali}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCopyThemesSubmit}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs"
              >
                Salin Tema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Salin Tema ke Rombel Lain di Tingkat Ini */}
      {isCopyRombelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 animate-scaleIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">
                Salin Tema ke Rombel Lain (Tingkat {tingkatAngka})
              </h3>
              <button
                onClick={() => setIsCopyRombelModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Daftar tema kokurikuler di kelas <strong>{session?.kelas}</strong> akan disalin ke rombel terpilih. Tema yang sudah ada tidak akan diduplikasi.
            </p>

            <div className="space-y-2 mb-5">
              <label className="block text-xs font-bold text-slate-700">Pilih Rombel Tujuan:</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {otherRombelsInTingkat.map((r) => {
                  const isChecked = selectedTargetRombels.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white cursor-pointer transition text-xs font-medium text-slate-800 border border-transparent hover:border-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTargetRombels([...selectedTargetRombels, r.id]);
                          } else {
                            setSelectedTargetRombels(selectedTargetRombels.filter((id) => id !== r.id));
                          }
                        }}
                        className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                      />
                      <span>
                        <strong className="text-purple-700">Kelas {r.nama}</strong> {r.nama_wali ? `· ${r.nama_wali}` : ''}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCopyRombelModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isCopyingRombel || selectedTargetRombels.length === 0}
                onClick={handleCopyRombelSubmit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs"
              >
                <Copy size={14} />
                <span>{isCopyingRombel ? 'Menyalin...' : 'Salin Tema Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
