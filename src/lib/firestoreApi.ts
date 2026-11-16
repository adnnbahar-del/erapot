// src/lib/firestoreApi.ts
// Penanganan data utama aplikasi yang terhubung langsung ke Cloud Firestore e-rapot-sd

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { tambahEstimasiTulis } from './firestoreWriteCounter';
import type { AppData, Semester, Tingkat } from '../types';

function sanitizePayload(obj: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

export const DEFAULT_TINGKAT_DATA: Tingkat[] = [
  { id: 'tingkat_1', angka: 1, romawi: 'I', fase: 'A', modeKelas: 'rombel' },
  { id: 'tingkat_2', angka: 2, romawi: 'II', fase: 'A', modeKelas: 'rombel' },
  { id: 'tingkat_3', angka: 3, romawi: 'III', fase: 'B', modeKelas: 'tunggal' },
  { id: 'tingkat_4', angka: 4, romawi: 'IV', fase: 'B', modeKelas: 'tunggal' },
  { id: 'tingkat_5', angka: 5, romawi: 'V', fase: 'C', modeKelas: 'tunggal' },
  { id: 'tingkat_6', angka: 6, romawi: 'VI', fase: 'C', modeKelas: 'rombel' },
];

export const DEFAULT_PROFIL_SEKOLAH = {
  id: 'sekolah_1',
  nama: 'SD NEGERI 1 SUKARAJA',
  npsn: '10817923',
  nss: '101120601001',
  alamat: 'Jalan Pasar Sukaraja',
  kode_pos: '35387',
  desa: 'Sukaraja',
  kecamatan: 'Semaka',
  kabupaten: 'Kabupaten Tanggamus',
  provinsi: 'Lampung',
  website: 'https://sdn1sukaraja.sch.id',
  email: 'sdn1sukaraja@gmail.com',
  kepala_sekolah: 'NGADINO, S.Pd',
  nip_kepala_sekolah: '197005092000071001',
  tempat_rapor: 'Sukaraja, 20 Desember 2025',
  format_kelas_rapor: 'romawi' as const,
  logo_url: '',
  ttd_kepsek_url: '',
  stempel_url: '',
};

export const SHEET_TO_COLLECTION: Record<string, string> = {
  sekolah: 'pengaturan',
  kelas: 'kelas',
  siswa: 'siswa',
  kelas_siswa: 'kelasSiswa',
  kelasSiswa: 'kelasSiswa',
  mapel: 'mapel',
  tujuan_pembelajaran: 'tp',
  tujuanPembelajaran: 'tp',
  tp: 'tp',
  lingkup_materi: 'lm',
  lingkupMateri: 'lm',
  lm: 'lm',
  nilai_formatif: 'formatif',
  formatif: 'formatif',
  nilai_sumatif_lm: 'sumatifLM',
  sumatif_lm: 'sumatifLM',
  sumatifLM: 'sumatifLM',
  nilai_sumatif_semester: 'sumatifSemester',
  sumatif_semester: 'sumatifSemester',
  sumatifSemester: 'sumatifSemester',
  nilai: 'nilai',
  ekstrakurikuler: 'ekstrakurikuler',
  nilai_ekskul: 'nilaiEkskul',
  nilaiEkskul: 'nilaiEkskul',
  tema_kokurikuler: 'temaKokurikuler',
  temaKokurikuler: 'temaKokurikuler',
  kokurikuler: 'kokurikuler',
  kaih: 'kaih',
  kehadiran: 'kehadiran',
  catatan_wali: 'catatanWali',
  catatanWali: 'catatanWali',
  mutasi: 'mutasi',
};

/**
 * Mengambil seluruh data aplikasi untuk sesi aktif langsung dari Cloud Firestore.
 */
export async function fetchAppDataFirestore(kelasId?: string): Promise<AppData> {
  // 1. Profil Sekolah & Pengaturan Aktif
  let sekolah = { ...DEFAULT_PROFIL_SEKOLAH };
  try {
    const sekSnap = await getDoc(doc(db, 'pengaturan', 'sekolah'));
    if (sekSnap.exists()) {
      sekolah = { ...sekolah, ...sekSnap.data() };
    }
  } catch {}

  let activeTahunAjaranId = 'ta_2025_2026_ganjil';
  try {
    const aktSnap = await getDoc(doc(db, 'pengaturan', 'aktif'));
    if (aktSnap.exists()) {
      const ad = aktSnap.data();
      if (ad.tahunAjaranId) activeTahunAjaranId = ad.tahunAjaranId;
    }
  } catch {}

  // 2. Tahun Ajaran
  let tahunAjaranList: any[] = [];
  try {
    const taSnap = await getDocs(query(collection(db, 'tahunAjaran'), orderBy('tahun', 'desc')));
    tahunAjaranList = taSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {}

  // 3. Kelas / Rombel
  let rombelList: any[] = [];
  try {
    const kSnap = await getDocs(query(collection(db, 'kelas'), orderBy('urutan')));
    rombelList = kSnap.docs.map((d) => {
      const kd = d.data();
      return {
        id: d.id,
        tingkat_id: `tingkat_${kd.tingkat}`,
        tingkat: kd.tingkat,
        angka: kd.tingkat,
        huruf: kd.rombel || '',
        nama: kd.nama,
        label: kd.label || kd.nama,
        tahun_ajaran_id: activeTahunAjaranId,
        nama_wali: kd.waliNama || kd.namaWali || '',
        nip_wali: kd.nipWali || '',
        aktif: kd.aktif !== false,
        urutan: kd.urutan,
      };
    });
  } catch {}

  // 4. Mapel
  let mapelList: any[] = [];
  try {
    const mSnap = await getDocs(query(collection(db, 'mapel'), orderBy('urutanRapor')));
    mapelList = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {}

  // 5. Siswa & KelasSiswa
  let siswaList: any[] = [];
  let kelasSiswaList: any[] = [];
  try {
    const sSnap = await getDocs(collection(db, 'siswa'));
    siswaList = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const ksSnap = await getDocs(collection(db, 'kelasSiswa'));
    kelasSiswaList = ksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {}

  // 6. TP & LM
  let tpList: any[] = [];
  let lmList: any[] = [];
  try {
    const tpSnap = await getDocs(collection(db, 'tp'));
    tpList = tpSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const lmSnap = await getDocs(collection(db, 'lm'));
    lmList = lmSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {}

  // 7. Formatif, Sumatif, Nilai Akhir
  let formatifList: any[] = [];
  let sumatifLMList: any[] = [];
  let sumatifSemesterList: any[] = [];
  let nilaiList: any[] = [];
  try {
    const fSnap = await getDocs(collection(db, 'formatif'));
    formatifList = fSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const slmSnap = await getDocs(collection(db, 'sumatifLM'));
    sumatifLMList = slmSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const ssSnap = await getDocs(collection(db, 'sumatifSemester'));
    sumatifSemesterList = ssSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const nSnap = await getDocs(collection(db, 'nilai'));
    nilaiList = nSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {}

  // 8. Ekstrakurikuler, Kokurikuler, KAIH, Kehadiran, Catatan Wali, Mutasi
  let ekskulList: any[] = [];
  let nilaiEkskulList: any[] = [];
  let temaKokuList: any[] = [];
  let kokuList: any[] = [];
  let kaihList: any[] = [];
  let kehadiranList: any[] = [];
  let catatanWaliList: any[] = [];
  let mutasiList: any[] = [];

  try {
    const eSnap = await getDocs(collection(db, 'ekstrakurikuler'));
    ekskulList = eSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const neSnap = await getDocs(collection(db, 'nilaiEkskul'));
    nilaiEkskulList = neSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const tkSnap = await getDocs(collection(db, 'temaKokurikuler'));
    temaKokuList = tkSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const kokuSnap = await getDocs(collection(db, 'kokurikuler'));
    kokuList = kokuSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const kaihSnap = await getDocs(collection(db, 'kaih'));
    kaihList = kaihSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const kehSnap = await getDocs(collection(db, 'kehadiran'));
    kehadiranList = kehSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const cwSnap = await getDocs(collection(db, 'catatanWali'));
    catatanWaliList = cwSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const mutSnap = await getDocs(collection(db, 'mutasi'));
    mutasiList = mutSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {}

  return {
    sekolah: sekolah as any,
    tahunAjaran: tahunAjaranList,
    activeTahunAjaranId,
    currentKelasId: kelasId || '',
    tingkat: DEFAULT_TINGKAT_DATA,
    rombel: rombelList,
    kunciTpLm: {},
    kelas: rombelList as any,
    siswa: siswaList,
    kelasSiswa: kelasSiswaList,
    mapel: mapelList,
    tp: tpList,
    lm: lmList,
    formatif: formatifList,
    sumatifLM: sumatifLMList,
    sumatifSemester: sumatifSemesterList,
    ekskul: ekskulList,
    nilaiEkskul: nilaiEkskulList,
    temaKokurikuler: temaKokuList,
    penilaianKokurikuler: kokuList as any,
    kokurikuler: kokuList as any,
    kaih: kaihList,
    kehadiran: kehadiranList,
    catatanWali: catatanWaliList,
    mutasi: mutasiList,
  };
}

/**
 * Menangani operasi CRUD aplikasi yang diarahkan ke Cloud Firestore.
 */
export async function handleFirestoreCrud(
  action: string,
  payload: any,
  token?: string
): Promise<any> {
  if (action === 'getAll') {
    return fetchAppDataFirestore(payload?.kelas_id);
  }

  if (action === 'upsert') {
    const { sheetName, item, keyFields } = payload;
    const cleanItem = sanitizePayload(item);
    if (sheetName === 'sekolah') {
      await setDoc(doc(db, 'pengaturan', 'sekolah'), cleanItem, { merge: true });
      tambahEstimasiTulis(1);
      return { success: true };
    }

    const colName = SHEET_TO_COLLECTION[sheetName] || sheetName;
    let docId = cleanItem.id;
    if (!docId && keyFields?.length) {
      docId = keyFields.map((k: string) => cleanItem[k]).filter(Boolean).join('_');
    }
    if (!docId) {
      docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    await setDoc(doc(db, colName, String(docId)), { ...cleanItem, id: docId }, { merge: true });
    tambahEstimasiTulis(1);
    return { success: true, item: { ...cleanItem, id: docId } };
  }

  if (action === 'upsertMany') {
    const { sheetName, items, keyFields } = payload;
    if (!items || items.length === 0) return { count: 0 };

    const colName = SHEET_TO_COLLECTION[sheetName] || sheetName;
    const batch = writeBatch(db);

    for (const it of items) {
      const cleanIt = sanitizePayload(it);
      let docId = cleanIt.id;
      if (!docId && keyFields?.length) {
        docId = keyFields.map((k: string) => cleanIt[k]).filter(Boolean).join('_');
      }
      if (!docId) {
        docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      }
      const ref = doc(db, colName, String(docId));
      batch.set(ref, { ...cleanIt, id: docId }, { merge: true });
    }

    await batch.commit();
    tambahEstimasiTulis(items.length);
    return { count: items.length };
  }

  if (action === 'delete') {
    const { sheetName, id, keyField } = payload;
    if (!id) return { success: false };
    const colName = SHEET_TO_COLLECTION[sheetName] || sheetName;
    if (colName === 'kelasSiswa' && keyField === 'siswa_id') {
      try {
        const q = query(collection(db, 'kelasSiswa'), where('siswa_id', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const b = writeBatch(db);
          snap.forEach((d) => b.delete(d.ref));
          await b.commit();
          tambahEstimasiTulis(snap.size);
          return { success: true };
        }
      } catch {}
    }
    await deleteDoc(doc(db, colName, String(id)));
    tambahEstimasiTulis(1);
    return { success: true };
  }

  if (action === 'importSiswa') {
    const { kelas_id, siswaList } = payload;
    if (!siswaList || !siswaList.length) return { count: 0 };

    const batch = writeBatch(db);
    for (let i = 0; i < siswaList.length; i++) {
      const s = siswaList[i];
      const sId = s.id || `s_${Date.now()}_${i}`;
      batch.set(doc(db, 'siswa', sId), { ...s, id: sId, kelasId: kelas_id, kelas_id }, { merge: true });

      const ksId = `ks_${kelas_id}_${sId}`;
      batch.set(
        doc(db, 'kelasSiswa', ksId),
        {
          id: ksId,
          siswa_id: sId,
          kelas_id,
          kelasId: kelas_id,
          rombel_id: kelas_id,
          no_urut: s.no_urut || i + 1,
          aktif: true,
        },
        { merge: true }
      );
    }
    await batch.commit();
    tambahEstimasiTulis(siswaList.length * 2);
    return { count: siswaList.length };
  }

  if (action === 'saveTema') {
    const item = payload;
    const docId = item.id || `tema_${Date.now()}`;
    await setDoc(doc(db, 'temaKokurikuler', docId), { ...item, id: docId }, { merge: true });
    return { ...item, id: docId };
  }

  if (action === 'reorderTema') {
    const { ids } = payload;
    if (!ids || !ids.length) return { success: true };
    const batch = writeBatch(db);
    for (let i = 0; i < ids.length; i++) {
      batch.update(doc(db, 'temaKokurikuler', ids[i]), { urutan: i + 1 });
    }
    await batch.commit();
    return { success: true };
  }

  if (action === 'deleteTema') {
    const { id } = payload;
    if (id) await deleteDoc(doc(db, 'temaKokurikuler', id));
    return { success: true };
  }

  if (action === 'savePenilaianKoku') {
    const { rows } = payload;
    if (!rows || !rows.length) return { success: true };
    const batch = writeBatch(db);
    for (const r of rows) {
      const docId = r.id || `${r.tema_id}_${r.siswa_id}`;
      batch.set(doc(db, 'kokurikuler', docId), { ...r, id: docId }, { merge: true });
    }
    await batch.commit();
    return { success: true };
  }

  if (action === 'pindahRombelSiswa') {
    const { siswa_id, rombel_tujuan_id } = payload;
    const ksSnap = await getDocs(
      query(collection(db, 'kelasSiswa'), where('siswa_id', '==', siswa_id))
    );
    if (!ksSnap.empty) {
      const ksDoc = ksSnap.docs[0];
      await updateDoc(doc(db, 'kelasSiswa', ksDoc.id), {
        kelas_id: rombel_tujuan_id,
        rombel_id: rombel_tujuan_id,
      });
    }
    await updateDoc(doc(db, 'siswa', siswa_id), { kelasId: rombel_tujuan_id });
    return { success: true, message: 'Siswa berhasil dipindahkan.' };
  }

  return null;
}
