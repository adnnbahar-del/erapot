import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppData, UserSession, Siswa, KelasSiswa, Mapel, TujuanPembelajaran, LingkupMateri, NilaiFormatif, NilaiSumatifLM, NilaiSumatifSemester, Ekstrakurikuler, NilaiEkskul, TemaKokurikuler, PenilaianKokurikuler, Kokurikuler, KaihRecord, Kehadiran, CatatanWali, MutasiRecord, Sekolah } from '../types';
import { callApi } from '../lib/api';
import { normalisasiKaih } from '../lib/kaih';
import { getStatusFinalisasi } from '../lib/kunciNilaiService';
import { catatLogAktivitas } from '../lib/logAktivitasService';
import {
  getAllMapel,
  seedDefaultMapel,
  tambahMapelAdmin,
  updateMapelAdmin,
  deleteMapelAdmin,
  toggleMapelKelas as toggleMapelKelasService,
} from '../lib/mapelService';

interface AppContextType {
  data: AppData | null;
  session: UserSession | null;
  isLoading: boolean;
  isSaving: boolean;
  saveStatusText: string;
  hasUnsavedChanges: boolean;
  setSession: (session: UserSession | null) => void;
  refreshData: () => Promise<void>;
  updateSekolah: (sekolah: Partial<Sekolah>) => Promise<void>;
  updateKelasWali: (kelasId: string, namaWali: string, nipWali: string) => Promise<void>;
  addSiswa: (siswa: Partial<Siswa>, kelasSiswa?: Partial<KelasSiswa>) => Promise<void>;
  updateSiswa: (siswaId: string, siswa: Partial<Siswa>, kelasSiswa?: Partial<KelasSiswa>) => Promise<void>;
  deleteSiswa: (siswaId: string) => Promise<void>;
  importSiswaList: (siswaList: any[]) => Promise<void>;
  // Kurikulum
  addMapel: (mapel: Partial<Mapel>) => Promise<void>;
  updateMapel: (id: string, mapel: Partial<Mapel>) => Promise<void>;
  deleteMapel: (id: string) => Promise<void>;
  toggleMapelKelas: (mapelId: string, kelasId: string, aktifDiKelas: boolean) => Promise<void>;
  seedMapelDefault: () => Promise<void>;
  addTP: (tp: Partial<TujuanPembelajaran>) => Promise<void>;
  updateTP: (id: string, tp: Partial<TujuanPembelajaran>) => Promise<void>;
  deleteTP: (id: string) => Promise<void>;
  addLM: (lm: Partial<LingkupMateri>) => Promise<void>;
  updateLM: (id: string, lm: Partial<LingkupMateri>) => Promise<void>;
  deleteLM: (id: string) => Promise<void>;
  // Kokurikuler
  saveTema: (tema: Partial<TemaKokurikuler>) => Promise<TemaKokurikuler>;
  reorderTema: (ids: string[]) => Promise<void>;
  deleteTema: (id: string) => Promise<void>;
  copyTema: (dariKelasId: string) => Promise<void>;
  salinTemaKeRombelLain: (dariRombelId: string, keRombelIds: string[]) => Promise<void>;
  savePenilaianKoku: (rows: Partial<PenilaianKokurikuler>[]) => Promise<void>;
  // Rombel & Tingkat
  pindahRombelSiswa: (siswaId: string, rombelAsalId: string, rombelTujuanId: string, alasan?: string) => Promise<void>;
  tambahRombel: (tingkat: number, namaWali?: string, nipWali?: string) => Promise<void>;
  toggleRombelAktif: (rombelId: string, aktif: boolean) => Promise<void>;
  kunciTpLmPerTingkat: (tingkat: number, terkunci: boolean) => Promise<void>;
  ubahModeKelas: (tingkat: number, mode: 'tunggal' | 'rombel') => Promise<void>;
  migrateKeRombel: () => Promise<any>;
  // Penilaian & Nilai
  queueBatchUpsert: (sheetName: string, items: any[], keyFields: string[]) => void;
  flushSaveQueue: () => Promise<void>;
  // Finalisasi Status (Tahap 4)
  isClassFinalized: boolean;
  refreshFinalisasi: () => Promise<void>;
  // Modals & Notifications
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  confirmModal: (title: string, message: string, onConfirm: () => void) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<UserSession | null>(() => {
    const raw = sessionStorage.getItem('erapot_user');
    return raw ? JSON.parse(raw) : null;
  });

  const [data, setData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatusText, setSaveStatusText] = useState<string>('Tersimpan');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isClassFinalized, setIsClassFinalized] = useState<boolean>(false);

  const refreshFinalisasi = useCallback(async () => {
    if (!session?.kelasId) {
      setIsClassFinalized(false);
      return;
    }
    const currentTAId = session.tahunAjaranId || data?.activeTahunAjaranId || (data?.tahunAjaran?.find(t => t.aktif)?.id) || '';
    try {
      const fin = await getStatusFinalisasi(session.kelasId, currentTAId);
      setIsClassFinalized(fin?.status === 'final');
    } catch {
      setIsClassFinalized(false);
    }
  }, [session?.kelasId, session?.tahunAjaranId]);

  useEffect(() => {
    refreshFinalisasi();
  }, [refreshFinalisasi]);

  // Debounced save queue
  const saveQueueRef = useRef<{ sheetName: string; items: any[]; keyFields: string[] }[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notification & Modal State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    let finalMessage = message;
    if (
      message &&
      (message.includes('Missing or insufficient permissions') ||
        message.includes('permission-denied') ||
        message.includes('insufficient permissions'))
    ) {
      console.error('[Firebase Permission Error]:', message);
      finalMessage = 'Anda tidak punya izin menyimpan data ini. Keluar lalu masuk lagi, atau hubungi admin.';
    }
    setNotification({ message: finalMessage, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === finalMessage ? null : curr));
    }, 4000);
  }, []);

  const confirmModal = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(null);
      },
    });
  }, []);

  const setSession = (sess: UserSession | null) => {
    setSessionState(sess);
    if (!sess) {
      sessionStorage.removeItem('erapot_token');
      sessionStorage.removeItem('erapot_user');
      setData(null);
    }
  };

  const refreshData = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const res = await callApi<AppData>('getAll', { kelas_id: session.kelasId }, session.token);
      if (res && Array.isArray(res.kaih)) {
        res.kaih = res.kaih.map((k) => {
          const { tahun, periode } = normalisasiKaih(k);
          return {
            ...k,
            tahun,
            periode,
          };
        });
      }
      if (res) {
        // Pastikan mapel Kurikulum Merdeka default terpasang
        const masterMapel = await getAllMapel();
        res.mapel = masterMapel;
      }
      setData(res);
    } catch (err: any) {
      notify(err.message || 'Gagal memuat data dari spreadsheet.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [session, notify]);

  useEffect(() => {
    if (session) {
      refreshData();
    } else {
      setIsLoading(false);
    }
  }, [session, refreshData]);

  // Window unload listener if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges || isSaving) {
        e.preventDefault();
        e.returnValue = 'Ada perubahan yang belum tersimpan ke server. Yakin ingin keluar?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isSaving]);

  // Mapping dari nama sheet / argumen fungsi ke key properti AppData
  const SHEET_TO_STATE_KEY: Record<string, string> = {
    catatan_wali: 'catatanWali',
    catatanWali: 'catatanWali',
    nilai_ekskul: 'nilaiEkskul',
    nilaiEkskul: 'nilaiEkskul',
    nilai_formatif: 'formatif',
    formatif: 'formatif',
    nilai_sumatif_lm: 'sumatifLM',
    sumatif_lm: 'sumatifLM',
    sumatifLM: 'sumatifLM',
    nilai_sumatif_semester: 'sumatifSemester',
    sumatif_semester: 'sumatifSemester',
    sumatifSemester: 'sumatifSemester',
    lingkup_materi: 'lm',
    lm: 'lm',
    tp: 'tp',
    tujuanPembelajaran: 'tp',
    tema_kokurikuler: 'temaKokurikuler',
    temaKokurikuler: 'temaKokurikuler',
    kokurikuler: 'kokurikuler',
    penilaianKokurikuler: 'penilaianKokurikuler',
    kaih: 'kaih',
    kehadiran: 'kehadiran',
    siswa: 'siswa',
    kelas_siswa: 'kelasSiswa',
    kelasSiswa: 'kelasSiswa',
    mutasi: 'mutasi',
  };

  // Execute queued saves (debounce 800 ms & upsertMany)
  const processSaveQueue = useCallback(async () => {
    if (saveQueueRef.current.length === 0) return;
    const batch = [...saveQueueRef.current];
    saveQueueRef.current = [];

    setIsSaving(true);
    setSaveStatusText('Menyimpan perubahan…');

    try {
      for (const task of batch) {
        await callApi('upsertMany', {
          sheetName: task.sheetName,
          items: task.items,
          keyFields: task.keyFields,
          kelas_id: session?.kelasId,
        });

        // Catat log aktivitas HANYA satu kali setelah aksi simpan berhasil ke server
        catatLogAktivitas({
          uid: session?.token,
          nama: session?.namaWali || 'Pengguna',
          peran: session?.peran || 'guru',
          aksi: 'Ubah Nilai / Data',
          target: `${task.sheetName} (Kelas ${session?.kelas || '-'})`,
          kelasId: session?.kelasId,
          nilaiBaru: `${task.items.length} data tersimpan`,
        });
      }
      setSaveStatusText('Tersimpan');
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setSaveStatusText('Gagal menyimpan');
      notify(err.message || 'Gagal menyimpan data otomatis.', 'error');
      // Re-queue on failure
      saveQueueRef.current = [...batch, ...saveQueueRef.current];
      setHasUnsavedChanges(true);
    } finally {
      setIsSaving(false);
    }
  }, [session, notify]);

  const flushSaveQueue = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await processSaveQueue();
  }, [processSaveQueue]);

  const queueBatchUpsert = useCallback(
    (sheetName: string, items: any[], keyFields: string[]) => {
      if (session?.hanya_lihat || isClassFinalized) {
        notify('Rapor kelas telah difinalkan atau dalam mode arsip. Perubahan tidak disimpan.', 'info');
        return;
      }

      setHasUnsavedChanges(true);
      setSaveStatusText('Menunggu antrean simpan…');

      const currentTAId = session?.tahunAjaranId || data?.activeTahunAjaranId || (data?.tahunAjaran?.find(t => t.aktif)?.id) || '';
      const enrichedItems = items.map((it) => ({
        ...it,
        tahun_ajaran_id: it.tahun_ajaran_id || currentTAId,
        kelas_id: it.kelas_id || session?.kelasId,
        kelasId: it.kelasId || session?.kelasId,
      }));

      // Update in-memory state immediately for instant feedback
      const targetStateKey = SHEET_TO_STATE_KEY[sheetName] || sheetName;
      setData((prev) => {
        if (!prev) return prev;
        const currentArr = (prev as any)[targetStateKey] || (prev as any)[sheetName] || [];
        const nextArr = [...currentArr];

        for (const item of enrichedItems) {
          const idx = nextArr.findIndex((entry) =>
            keyFields.every((k) => String(entry[k]) === String(item[k]))
          );
          if (idx >= 0) {
            nextArr[idx] = { ...nextArr[idx], ...item };
          } else {
            nextArr.push({ ...item });
          }
        }
        return {
          ...prev,
          [targetStateKey]: nextArr,
          [sheetName]: nextArr,
        };
      });

      // Add to debounce queue (800 ms debounce sesuai spesifikasi)
      saveQueueRef.current.push({ sheetName, items: enrichedItems, keyFields });
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(processSaveQueue, 800);
    },
    [session, data, isClassFinalized, notify, processSaveQueue]
  );

  // Data Sekolah
  const updateSekolah = async (patch: Partial<Sekolah>) => {
    if (!data) return;
    const updated = { ...data.sekolah, ...patch, id: data.sekolah.id || 'sekolah_1' };
    setData({ ...data, sekolah: updated });
    await callApi('upsert', { sheetName: 'sekolah', item: updated, keyFields: ['id'] });
    notify('Data sekolah berhasil disimpan.', 'success');
  };

  // Wali Kelas
  const updateKelasWali = async (kelasId: string, namaWali: string, nipWali: string) => {
    if (!data) return;
    const kelasList = data.kelas.map((k) => (k.id === kelasId ? { ...k, nama_wali: namaWali, nip_wali: nipWali } : k));
    setData({ ...data, kelas: kelasList });
    const target = kelasList.find((k) => k.id === kelasId);
    if (target) {
      await callApi('upsert', { sheetName: 'kelas', item: target, keyFields: ['id'] });
      notify('Data wali kelas berhasil disimpan.', 'success');
    }
  };

  // Siswa CRUD
  const addSiswa = async (siswaData: Partial<Siswa>, kelasSiswaData?: Partial<KelasSiswa>) => {
    if (!data || !session) return;
    const activeRoster = data.kelasSiswa.filter((ks) => ks.kelas_id === session.kelasId);
    if (activeRoster.length >= 50) {
      throw new Error(`Kelas ${session.kelas} sudah berisi 50 siswa. Batas maksimal adalah 50 siswa. Hapus atau pindahkan siswa sebelum menambah yang baru.`);
    }

    const newSiswaId = 'sis_' + Math.random().toString(36).substring(2);
    const newSiswa: Siswa = {
      id: newSiswaId,
      kelasId: session.kelasId,
      kelas_id: session.kelasId,
      nis: siswaData.nis || '',
      nisn: siswaData.nisn || '',
      nama: siswaData.nama || '',
      jk: siswaData.jk || 'L',
      tempat_lahir: siswaData.tempat_lahir || '',
      tanggal_lahir: siswaData.tanggal_lahir || '',
      agama: siswaData.agama || 'Islam',
      pendidikan_sebelumnya: siswaData.pendidikan_sebelumnya || '',
      alamat: siswaData.alamat || '',
      nama_ayah: siswaData.nama_ayah || '',
      nama_ibu: siswaData.nama_ibu || '',
      pekerjaan_ayah: siswaData.pekerjaan_ayah || '',
      pekerjaan_ibu: siswaData.pekerjaan_ibu || '',
      alamat_ortu_jalan: siswaData.alamat_ortu_jalan || '',
      alamat_ortu_desa: siswaData.alamat_ortu_desa || '',
      alamat_ortu_kecamatan: siswaData.alamat_ortu_kecamatan || '',
      alamat_ortu_kabupaten: siswaData.alamat_ortu_kabupaten || '',
      alamat_ortu_provinsi: siswaData.alamat_ortu_provinsi || '',
      nama_wali: siswaData.nama_wali || '',
      pekerjaan_wali: siswaData.pekerjaan_wali || '',
      alamat_wali: siswaData.alamat_wali || '',
      telepon: siswaData.telepon || '',
    };

    const newKelasSiswa: KelasSiswa = {
      id: `ks_${session.kelasId}_${newSiswaId}`,
      kelas_id: session.kelasId,
      kelasId: session.kelasId,
      rombel_id: session.kelasId,
      siswa_id: newSiswaId,
      no_urut: activeRoster.length + 1,
      tinggi_badan: kelasSiswaData?.tinggi_badan || '',
      berat_badan: kelasSiswaData?.berat_badan || '',
      pendengaran: kelasSiswaData?.pendengaran || 'Baik',
      penglihatan: kelasSiswaData?.penglihatan || 'Baik',
      gigi: kelasSiswaData?.gigi || 'Baik',
      kesehatan_lain: kelasSiswaData?.kesehatan_lain || '',
      prestasi_kesenian: kelasSiswaData?.prestasi_kesenian || '',
      prestasi_olahraga: kelasSiswaData?.prestasi_olahraga || '',
      prestasi_sains: kelasSiswaData?.prestasi_sains || '',
    };

    await callApi('upsert', { sheetName: 'siswa', item: newSiswa, keyFields: ['id'] });
    await callApi('upsert', { sheetName: 'kelas_siswa', item: newKelasSiswa, keyFields: ['kelas_id', 'siswa_id'] });

    setData({
      ...data,
      siswa: [...data.siswa, newSiswa],
      kelasSiswa: [...data.kelasSiswa, newKelasSiswa],
    });
    notify('Siswa berhasil ditambahkan.', 'success');
  };

  const updateSiswa = async (siswaId: string, siswaPatch: Partial<Siswa>, ksPatch?: Partial<KelasSiswa>) => {
    if (!data || !session) return;
    const existingSiswa = data.siswa.find((s) => s.id === siswaId);
    if (!existingSiswa) return;
    const updatedSiswa = {
      ...existingSiswa,
      ...siswaPatch,
      kelasId: existingSiswa.kelasId || existingSiswa.kelas_id || session.kelasId,
      kelas_id: existingSiswa.kelas_id || existingSiswa.kelasId || session.kelasId,
    };

    const existingKS = data.kelasSiswa.find((ks) => ks.kelas_id === session.kelasId && ks.siswa_id === siswaId);
    const updatedKS = existingKS
      ? {
          ...existingKS,
          ...ksPatch,
          kelasId: existingKS.kelasId || session.kelasId,
          kelas_id: session.kelasId,
        }
      : null;

    await callApi('upsert', { sheetName: 'siswa', item: updatedSiswa, keyFields: ['id'] });
    if (updatedKS) {
      await callApi('upsert', { sheetName: 'kelas_siswa', item: updatedKS, keyFields: ['kelas_id', 'siswa_id'] });
    }

    setData({
      ...data,
      siswa: data.siswa.map((s) => (s.id === siswaId ? updatedSiswa : s)),
      kelasSiswa: updatedKS
        ? data.kelasSiswa.map((ks) => (ks.kelas_id === session.kelasId && ks.siswa_id === siswaId ? updatedKS : ks))
        : data.kelasSiswa,
    });
    notify('Data siswa berhasil diperbarui.', 'success');
  };

  const deleteSiswa = async (siswaId: string) => {
    if (!data || !session) return;
    await callApi('delete', { sheetName: 'kelas_siswa', id: siswaId, keyField: 'siswa_id' });
    await callApi('delete', { sheetName: 'siswa', id: siswaId, keyField: 'id' });

    setData({
      ...data,
      siswa: data.siswa.filter((s) => s.id !== siswaId),
      kelasSiswa: data.kelasSiswa.filter((ks) => !(ks.kelas_id === session.kelasId && ks.siswa_id === siswaId)),
    });
    notify('Siswa berhasil dihapus dari kelas.', 'success');
  };

  const importSiswaList = async (siswaList: any[]) => {
    if (!data || !session) return;
    await callApi('importSiswa', { kelas_id: session.kelasId, siswaList });
    await refreshData();
    notify(`Berhasil mengimpor ${siswaList.length} siswa.`, 'success');
  };

  // Kurikulum Handlers
  const addMapel = async (item: Partial<Mapel>) => {
    if (!data) return;
    try {
      const created = await tambahMapelAdmin({
        kode: item.kode || item.singkatan || '',
        nama: item.nama || '',
        kelompok: item.kelompok || 'wajib',
        faseBerlaku: item.faseBerlaku || ['A', 'B', 'C'],
        urutanRapor: item.urutanRapor || (data.mapel.length + 1),
        aktif: item.aktif !== false,
        varianAgama: item.varianAgama,
      });
      await callApi('upsert', { sheetName: 'mapel', item: created, keyFields: ['id'] });
      setData({ ...data, mapel: [...data.mapel, created] });
      notify('Mata pelajaran berhasil ditambahkan.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal menambahkan mata pelajaran', 'error');
      throw err;
    }
  };

  const updateMapel = async (id: string, patch: Partial<Mapel>) => {
    if (!data) return;
    try {
      const updated = await updateMapelAdmin(id, patch);
      await callApi('upsert', { sheetName: 'mapel', item: updated, keyFields: ['id'] });
      setData({ ...data, mapel: data.mapel.map((m) => (m.id === id ? updated : m)) });
      notify('Mata pelajaran berhasil diperbarui.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal memperbarui mata pelajaran', 'error');
      throw err;
    }
  };

  const deleteMapel = async (id: string) => {
    if (!data) return;
    try {
      await deleteMapelAdmin(id);
      await callApi('delete', { sheetName: 'mapel', id, keyField: 'id' });
      setData({ ...data, mapel: data.mapel.filter((m) => m.id !== id) });
      notify('Mata pelajaran berhasil dihapus.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal menghapus mata pelajaran', 'error');
      throw err;
    }
  };

  const toggleMapelKelas = async (mapelId: string, kelasId: string, aktifDiKelas: boolean) => {
    if (!data) return;
    try {
      const updatedList = await toggleMapelKelasService(mapelId, kelasId, aktifDiKelas);
      const target = updatedList.find((m) => m.id === mapelId);
      if (target) {
        await callApi('upsert', { sheetName: 'mapel', item: target, keyFields: ['id'] });
      }
      setData({ ...data, mapel: updatedList });
      notify(
        `Mata pelajaran berhasil ${aktifDiKelas ? 'diaktifkan' : 'dinonaktifkan'} untuk kelas ini.`,
        'success'
      );
    } catch (err: any) {
      notify(err.message || 'Gagal mengubah status mata pelajaran kelas', 'error');
      throw err;
    }
  };

  const seedMapelDefault = async () => {
    if (!data) return;
    try {
      const list = await seedDefaultMapel();
      setData({ ...data, mapel: list });
      notify('Mata pelajaran default berhasil disinkronkan.', 'success');
    } catch (err: any) {
      notify(err.message || 'Gagal sinkronisasi mapel default', 'error');
    }
  };

  const addTP = async (tpData: Partial<TujuanPembelajaran>) => {
    if (!data) return;
    const newId = 'tp_' + Math.random().toString(36).substring(2);
    const newTP: TujuanPembelajaran = {
      id: newId,
      mapel_id: tpData.mapel_id || '',
      urutan: tpData.urutan || (data.tp.filter((t) => t.mapel_id === tpData.mapel_id).length + 1),
      deskripsi: tpData.deskripsi || '',
    };
    await callApi('upsert', { sheetName: 'tujuan_pembelajaran', item: newTP, keyFields: ['id'] });
    setData({ ...data, tp: [...data.tp, newTP] });
    notify('Tujuan pembelajaran berhasil ditambahkan.', 'success');
  };

  const updateTP = async (id: string, patch: Partial<TujuanPembelajaran>) => {
    if (!data) return;
    const target = data.tp.find((t) => t.id === id);
    if (!target) return;
    const updated = { ...target, ...patch };
    await callApi('upsert', { sheetName: 'tujuan_pembelajaran', item: updated, keyFields: ['id'] });
    setData({ ...data, tp: data.tp.map((t) => (t.id === id ? updated : t)) });
    notify('Tujuan pembelajaran berhasil diperbarui.', 'success');
  };

  const deleteTP = async (id: string) => {
    if (!data) return;
    await callApi('delete', { sheetName: 'tujuan_pembelajaran', id, keyField: 'id' });
    setData({ ...data, tp: data.tp.filter((t) => t.id !== id) });
    notify('Tujuan pembelajaran berhasil dihapus.', 'success');
  };

  const addLM = async (lmData: Partial<LingkupMateri>) => {
    if (!data) return;
    const newId = 'lm_' + Math.random().toString(36).substring(2);
    const newLM: LingkupMateri = {
      id: newId,
      mapel_id: lmData.mapel_id || '',
      urutan: lmData.urutan || (data.lm.filter((l) => l.mapel_id === lmData.mapel_id).length + 1),
      nama: lmData.nama || '',
    };
    await callApi('upsert', { sheetName: 'lingkup_materi', item: newLM, keyFields: ['id'] });
    setData({ ...data, lm: [...data.lm, newLM] });
    notify('Lingkup materi berhasil ditambahkan.', 'success');
  };

  const updateLM = async (id: string, patch: Partial<LingkupMateri>) => {
    if (!data) return;
    const target = data.lm.find((l) => l.id === id);
    if (!target) return;
    const updated = { ...target, ...patch };
    await callApi('upsert', { sheetName: 'lingkup_materi', item: updated, keyFields: ['id'] });
    setData({ ...data, lm: data.lm.map((l) => (l.id === id ? updated : l)) });
    notify('Lingkup materi berhasil diperbarui.', 'success');
  };

  const deleteLM = async (id: string) => {
    if (!data) return;
    await callApi('delete', { sheetName: 'lingkup_materi', id, keyField: 'id' });
    setData({ ...data, lm: data.lm.filter((l) => l.id !== id) });
    notify('Lingkup materi berhasil dihapus.', 'success');
  };

  // Kokurikuler Handlers
  const saveTema = async (temaData: Partial<TemaKokurikuler>): Promise<TemaKokurikuler> => {
    if (!session) throw new Error('Sesi tidak aktif.');
    if (session.hanya_lihat) throw new Error('Arsip — hanya baca: tema kokurikuler tidak dapat diubah.');
    const saved = await callApi<TemaKokurikuler>('saveTema', {
      ...temaData,
      kelas_id: session.kelasId,
    }, session.token);

    setData((prev) => {
      if (!prev) return prev;
      const existing = prev.temaKokurikuler || [];
      const idx = existing.findIndex((t) => t.id === saved.id);
      let nextList: TemaKokurikuler[];
      if (idx >= 0) {
        nextList = existing.map((t) => (t.id === saved.id ? saved : t));
      } else {
        nextList = [...existing, saved];
      }
      nextList.sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
      return { ...prev, temaKokurikuler: nextList };
    });
    notify('Tema kokurikuler berhasil disimpan.', 'success');
    return saved;
  };

  const reorderTema = async (ids: string[]) => {
    if (!session) return;
    await callApi('reorderTema', { kelas_id: session.kelasId, ids }, session.token);
    setData((prev) => {
      if (!prev) return prev;
      const map = new Map(ids.map((id, index) => [id, index + 1]));
      const nextList = (prev.temaKokurikuler || []).map((t) => ({
        ...t,
        urutan: map.get(t.id) ?? t.urutan,
      }));
      nextList.sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
      return { ...prev, temaKokurikuler: nextList };
    });
  };

  const deleteTema = async (id: string) => {
    if (!session) return;
    await callApi('deleteTema', { id }, session.token);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        temaKokurikuler: (prev.temaKokurikuler || []).filter((t) => t.id !== id),
        penilaianKokurikuler: (prev.penilaianKokurikuler || []).filter((p) => p.tema_id !== id),
      };
    });
    notify('Tema kokurikuler berhasil dihapus.', 'success');
  };

  const copyTema = async (dariKelasId: string) => {
    if (!session) return;
    const res = await callApi<{ copiedCount: number }>('copyTema', {
      dari_kelas_id: dariKelasId,
      ke_kelas_id: session.kelasId,
    }, session.token);
    await refreshData();
    notify(`Berhasil menyalin ${res?.copiedCount || 0} tema.`, 'success');
  };

  const savePenilaianKoku = async (rows: Partial<PenilaianKokurikuler>[]) => {
    if (!session || rows.length === 0) return;
    if (session.hanya_lihat) {
      notify('Arsip — hanya baca: penilaian tidak dapat diubah.', 'info');
      return;
    }
    setIsSaving(true);
    setSaveStatusText('Menyimpan…');
    try {
      await callApi('savePenilaianKoku', { rows }, session.token);
      setData((prev) => {
        if (!prev) return prev;
        const nextPenilaian = [...(prev.penilaianKokurikuler || [])];
        for (const r of rows) {
          const idx = nextPenilaian.findIndex((p) => p.tema_id === r.tema_id && p.siswa_id === r.siswa_id);
          if (idx >= 0) {
            nextPenilaian[idx] = { ...nextPenilaian[idx], ...r };
          } else {
            nextPenilaian.push({
              id: 'pk_' + Math.random().toString(36).substring(2),
              tema_id: r.tema_id!,
              siswa_id: r.siswa_id!,
              dpl_kuat: r.dpl_kuat || '',
              dpl_penguatan: r.dpl_penguatan || '',
              deskripsi_manual: r.deskripsi_manual || '',
            });
          }
        }
        return { ...prev, penilaianKokurikuler: nextPenilaian };
      });
      setSaveStatusText('Tersimpan');
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setSaveStatusText('Gagal menyimpan, mencoba lagi…');
      notify(err.message || 'Gagal menyimpan penilaian kokurikuler.', 'error');
      setHasUnsavedChanges(true);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const pindahRombelSiswa = async (siswaId: string, rombelAsalId: string, rombelTujuanId: string, alasan?: string) => {
    const res = await callApi<{ success: boolean; message: string }>('pindahRombelSiswa', {
      siswa_id: siswaId,
      rombel_asal_id: rombelAsalId,
      rombel_tujuan_id: rombelTujuanId,
      alasan,
    });
    await refreshData();
    notify(res?.message || 'Siswa berhasil dipindahkan.', 'success');
  };

  const tambahRombel = async (tingkat: number, namaWali?: string, nipWali?: string) => {
    const res = await callApi<{ success: boolean; rombel: any }>('tambahRombel', {
      tingkat,
      nama_wali: namaWali,
      nip_wali: nipWali,
    });
    await refreshData();
    notify(`Rombel ${res?.rombel?.nama || ''} berhasil ditambahkan.`, 'success');
  };

  const toggleRombelAktif = async (rombelId: string, aktif: boolean) => {
    await callApi('toggleRombelAktif', { rombel_id: rombelId, aktif });
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rombel: (prev.rombel || []).map((r) => (r.id === rombelId ? { ...r, aktif } : r)),
      };
    });
    notify(`Status rombel berhasil di${aktif ? 'aktifkan' : 'nonaktifkan'}.`, 'success');
  };

  const kunciTpLmPerTingkat = async (tingkat: number, terkunci: boolean) => {
    await callApi('kunciTpLmPerTingkat', { tingkat, terkunci });
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        kunciTpLm: {
          ...(prev.kunciTpLm || {}),
          [tingkat]: terkunci,
        },
      };
    });
    notify(`TP & LM Tingkat ${tingkat} berhasil di${terkunci ? 'kunci' : 'buka'}.`, 'success');
  };

  const salinTemaKeRombelLain = async (dariRombelId: string, keRombelIds: string[]) => {
    const res = await callApi<{ success: boolean; totalCopied: number }>('salinTemaKeRombelLain', {
      dari_rombel_id: dariRombelId,
      ke_rombel_ids: keRombelIds,
    });
    await refreshData();
    notify(`Berhasil menyalin ${res?.totalCopied || 0} tema ke rombel tujuan.`, 'success');
  };

  const ubahModeKelas = async (tingkat: number, mode: 'tunggal' | 'rombel') => {
    await callApi('ubahModeKelas', { tingkat, mode });
    await refreshData();
    notify(`Mode kelas Tingkat ${tingkat} berhasil diubah ke ${mode === 'tunggal' ? 'Satu kelas (tanpa rombel)' : 'Dibagi rombel'}.`, 'success');
  };

  const migrateKeRombel = async () => {
    const res = await callApi<{ success: boolean; summary: any }>('migrateKeRombel');
    await refreshData();
    notify('Migrasi ke sistem rombel berhasil.', 'success');
    return res?.summary;
  };

  return (
    <AppContext.Provider
      value={{
        data,
        session,
        isLoading,
        isSaving,
        saveStatusText,
        hasUnsavedChanges,
        setSession,
        flushSaveQueue,
        refreshData,
        updateSekolah,
        updateKelasWali,
        addSiswa,
        updateSiswa,
        deleteSiswa,
        importSiswaList,
        addMapel,
        updateMapel,
        deleteMapel,
        toggleMapelKelas,
        seedMapelDefault,
        addTP,
        updateTP,
        deleteTP,
        addLM,
        updateLM,
        deleteLM,
        saveTema,
        reorderTema,
        deleteTema,
        copyTema,
        salinTemaKeRombelLain,
        savePenilaianKoku,
        pindahRombelSiswa,
        tambahRombel,
        toggleRombelAktif,
        kunciTpLmPerTingkat,
        ubahModeKelas,
        migrateKeRombel,
        queueBatchUpsert,
        isClassFinalized,
        refreshFinalisasi,
        notify,
        confirmModal,
      }}
    >
      {children}

      {/* Floating Global Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-medium transition-all animate-bounce"
             style={{
               backgroundColor:
                 notification.type === 'success'
                   ? '#0f9d58'
                   : notification.type === 'error'
                   ? '#dc2626'
                   : '#1e3a8a',
             }}>
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-white/80 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Custom Confirmation Dialog Modal (Replacing native confirm()) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow transition"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
