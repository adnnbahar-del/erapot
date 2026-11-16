// src/lib/inisialisasiService.ts
// Layanan Inisialisasi Data Lengkap E-Rapor SD Kurikulum Merdeka (Firebase Spark Plan & Offline Fallback)
//
// Meliputi:
// 1. 18 Kelas Kurikulum Merdeka (Tingkat 1–6: tanpa rombel, A, B)
// 2. 9 Mata Pelajaran Kurikulum Merdeka Default per Fase
// 3. Tahun Ajaran 2025/2026 Ganjil (Aktif) & Genap
// 4. Data Profil Sekolah (SD Negeri 1 Sukaraja)
// 5. Data Siswa Sampel (Kelas 6A & Kelas 4; Kelas 1B tetap kosong untuk uji impor Excel)
// 6. Akun Admin (adnnbahar@gmail.com / 12345678) & Wali Kelas

import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './firebase';
import { seedDanBersihkanKelas, SEED_18_KELAS, siapkanSemuaAkunWali } from './kelasService';
import { seedDefaultMapel, SEED_DEFAULT_MAPEL } from './mapelService';
import { getAllTahunAjaran, DEFAULT_TA_LIST } from './tahunAjaranService';
import { catatLogAktivitas } from './logAktivitasService';

export interface HasilInisialisasi {
  sukses: boolean;
  pesan: string;
  totalKelas: number;
  totalMapel: number;
  totalTahunAjaran: number;
  totalAkunWali: number;
  totalSiswa: number;
  waktu: string;
}

export interface PratinjauInisialisasi {
  daftarKelas: { id: string; nama: string; fase: string; emailWali: string }[];
  daftarMapel: { id: string; kode: string; nama: string; kelompok: string }[];
  tahunAjaran: { tahun: string; semester: string; status: string };
  sekolah: { nama: string; npsn: string; kepala_sekolah: string };
  totalAkunWali: number;
}

export function dapatkanPratinjauInisialisasi(): PratinjauInisialisasi {
  return {
    daftarKelas: SEED_18_KELAS.map((k) => ({
      id: k.id,
      nama: k.nama,
      fase: k.fase,
      emailWali: `kelas-${(k.nama || k.id).toLowerCase().replace(/^kelas\s*/i, '').replace(/\s+/g, '')}-v1@erapor.local`,
    })),
    daftarMapel: SEED_DEFAULT_MAPEL.map((m) => ({
      id: m.id,
      kode: m.kode || '',
      nama: m.nama,
      kelompok: m.kelompok || 'wajib',
    })),
    tahunAjaran: {
      tahun: '2025/2026',
      semester: '1 (Ganjil)',
      status: 'Aktif',
    },
    sekolah: {
      nama: DEFAULT_SEKOLAH_DOC.nama,
      npsn: DEFAULT_SEKOLAH_DOC.npsn,
      kepala_sekolah: DEFAULT_SEKOLAH_DOC.kepala_sekolah,
    },
    totalAkunWali: 18,
  };
}

const DEFAULT_SEKOLAH_DOC = {
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
  format_kelas_rapor: 'romawi',
  logo_url: '',
  ttd_kepsek_url: '',
  stempel_url: '',
};

export const SISWA_SAMPEL_DEFAULT = [
  { id: 's_6a_1', nis: '20200601', nisn: '0145892341', nama: 'Ahmad Rizky Pratama', jk: 'L', tempat_lahir: 'Tanggamus', tanggal_lahir: '2013-05-12', agama: 'Islam', pendidikan_sebelumnya: 'TK Al-Hidayah', alamat: 'Jl. Merdeka No. 12', nama_ayah: 'Suryanto', nama_ibu: 'Rahayu', pekerjaan_ayah: 'Wiraswasta', pekerjaan_ibu: 'Ibu Rumah Tangga', alamat_ortu_jalan: 'Jl. Merdeka No. 12', kelasId: 'kelas_6a' },
  { id: 's_6a_2', nis: '20200602', nisn: '0145892342', nama: 'Bunga Citra Lestari', jk: 'P', tempat_lahir: 'Bandar Lampung', tanggal_lahir: '2013-08-20', agama: 'Islam', pendidikan_sebelumnya: 'TK Pertiwi', alamat: 'Jl. Kenanga No. 4', nama_ayah: 'Bambang', nama_ibu: 'Siti Aminah', pekerjaan_ayah: 'PNS', pekerjaan_ibu: 'Guru', alamat_ortu_jalan: 'Jl. Kenanga No. 4', kelasId: 'kelas_6a' },
  { id: 's_6a_3', nis: '20200603', nisn: '0145892343', nama: 'Dimas Arya Putra', jk: 'L', tempat_lahir: 'Tanggamus', tanggal_lahir: '2013-11-15', agama: 'Islam', pendidikan_sebelumnya: 'RA Kartini', alamat: 'Dusun Sukaraja', nama_ayah: 'Hendra', nama_ibu: 'Dewi Sartika', pekerjaan_ayah: 'Petani', pekerjaan_ibu: 'Pedagang', alamat_ortu_jalan: 'Dusun Sukaraja', kelasId: 'kelas_6a' },
  { id: 's_6a_4', nis: '20200604', nisn: '0145892344', nama: 'Fajar Ramadhan', jk: 'L', tempat_lahir: 'Pringsewu', tanggal_lahir: '2013-07-09', agama: 'Islam', pendidikan_sebelumnya: 'TK Aisyiyah', alamat: 'Jl. Melati No. 8', nama_ayah: 'Rahmat', nama_ibu: 'Yuliana', pekerjaan_ayah: 'Karyawan Swasta', pekerjaan_ibu: 'Ibu Rumah Tangga', alamat_ortu_jalan: 'Jl. Melati No. 8', kelasId: 'kelas_6a' },
  { id: 's_6a_5', nis: '20200605', nisn: '0145892345', nama: 'Gita Nur Haliza', jk: 'P', tempat_lahir: 'Tanggamus', tanggal_lahir: '2013-03-25', agama: 'Islam', pendidikan_sebelumnya: 'TK Tunas Bangsa', alamat: 'Jl. Mawar No. 3', nama_ayah: 'Agus Salim', nama_ibu: 'Mariana', pekerjaan_ayah: 'Wiraswasta', pekerjaan_ibu: 'Wiraswasta', alamat_ortu_jalan: 'Jl. Mawar No. 3', kelasId: 'kelas_6a' },
  // 2 Siswa di Kelas 4
  { id: 's_4_1', nis: '20220401', nisn: '0165892351', nama: 'Bagas Prasetya', jk: 'L', tempat_lahir: 'Tanggamus', tanggal_lahir: '2015-02-14', agama: 'Islam', pendidikan_sebelumnya: 'TK Pertiwi', alamat: 'Jl. Cempaka No. 5', nama_ayah: 'Prasetyo', nama_ibu: 'Endang', pekerjaan_ayah: 'Wiraswasta', pekerjaan_ibu: 'Ibu Rumah Tangga', alamat_ortu_jalan: 'Jl. Cempaka No. 5', kelasId: 'kelas_4' },
  { id: 's_4_2', nis: '20220402', nisn: '0165892352', nama: 'Cantika Dewi', jk: 'P', tempat_lahir: 'Tanggamus', tanggal_lahir: '2015-09-18', agama: 'Islam', pendidikan_sebelumnya: 'RA Al-Ikhlas', alamat: 'Jl. Anggrek No. 10', nama_ayah: 'Santoso', nama_ibu: 'Lestari', pekerjaan_ayah: 'PNS', pekerjaan_ibu: 'PNS', alamat_ortu_jalan: 'Jl. Anggrek No. 10', kelasId: 'kelas_4' },
];

export async function inisialisasiDataDefault(pelaksana?: { uid: string; nama: string; peran: string }): Promise<HasilInisialisasi> {
  const waktu = new Date().toISOString();

  // 1. Inisialisasi 18 Kelas Kurikulum Merdeka
  const resKelas = await seedDanBersihkanKelas();

  // 2. Inisialisasi Akun Wali Kelas untuk Setiap Rombel
  const resWali = await siapkanSemuaAkunWali();

  // 3. Inisialisasi 9 Mapel Kurikulum Merdeka
  const mapelList = await seedDefaultMapel();

  // 4. Inisialisasi Tahun Ajaran
  const taList = await getAllTahunAjaran();

  // 5. Inisialisasi Pengaturan Sekolah & Semester Aktif di Firestore
  if (isFirebaseConfigured) {
    const batch = writeBatch(db);

    // Profil Sekolah
    batch.set(doc(db, 'pengaturan', 'sekolah'), DEFAULT_SEKOLAH_DOC, { merge: true });

    // Semester Aktif
    batch.set(
      doc(db, 'pengaturan', 'aktif'),
      {
        tahunAjaran: '2025/2026',
        semester: 1,
        tahunAjaranId: 'ta_2025_2026_ganjil',
        tanggalRapor: '2025-12-20',
        updatedAt: waktu,
      },
      { merge: true }
    );

    // Pastikan akun pelaksana / admin tersimpan di users/{uid}
    const adminUid = pelaksana?.uid || auth.currentUser?.uid;
    if (adminUid) {
      batch.set(
        doc(db, 'users', adminUid),
        {
          uid: adminUid,
          nama: pelaksana?.nama || 'Administrator (Adnan Bahar)',
          username: 'admin',
          email: auth.currentUser?.email || 'adnanbahar.ar@gmail.com',
          peran: 'admin',
          aktif: true,
          updatedAt: waktu,
        },
        { merge: true }
      );
    }

    // Siswa Sampel ke Firestore jika belum ada
    for (const s of SISWA_SAMPEL_DEFAULT) {
      batch.set(doc(db, 'siswa', s.id), s, { merge: true });
      batch.set(
        doc(db, 'kelasSiswa', `ks_${s.id}`),
        {
          id: `ks_${s.id}`,
          siswa_id: s.id,
          kelas_id: s.kelasId,
          rombel_id: s.kelasId,
          tahun_ajaran_id: 'ta_2025_2026_ganjil',
          aktif: true,
        },
        { merge: true }
      );
    }

    await batch.commit();
  }

  // Sinkronkan ke local database untuk testing/offline
  try {
    const raw = localStorage.getItem('erapot_sd_local_database_v1');
    let dbObj: any = raw ? JSON.parse(raw) : {};

    dbObj.sekolah = { ...DEFAULT_SEKOLAH_DOC, ...(dbObj.sekolah || {}) };
    dbObj.mapel = mapelList;
    dbObj.tahunAjaran = taList.map((t) => ({
      id: t.id,
      tahun: t.tahun,
      semester: t.semester === 'Ganjil' ? 1 : 2,
      tanggal_rapor: t.tanggal_rapor || '2025-12-20',
      aktif: t.aktif,
    }));
    dbObj.activeTahunAjaranId = 'ta_2025_2026_ganjil';

    const existingSiswaMap = new Map((dbObj.siswa || []).map((s: any) => [s.id, s]));
    for (const s of SISWA_SAMPEL_DEFAULT) {
      existingSiswaMap.set(s.id, s);
    }
    dbObj.siswa = Array.from(existingSiswaMap.values());

    const existingKsMap = new Map((dbObj.kelasSiswa || []).map((ks: any) => [ks.id, ks]));
    for (let i = 0; i < SISWA_SAMPEL_DEFAULT.length; i++) {
      const s = SISWA_SAMPEL_DEFAULT[i];
      existingKsMap.set(`ks_${s.id}`, {
        id: `ks_${s.id}`,
        siswa_id: s.id,
        kelas_id: s.kelasId,
        rombel_id: s.kelasId,
        tahun_ajaran_id: 'ta_2025_2026_ganjil',
        no_urut: i + 1,
        aktif: true,
      });
    }
    dbObj.kelasSiswa = Array.from(existingKsMap.values());
    localStorage.setItem('erapot_sd_local_database_v1', JSON.stringify(dbObj));
  } catch {}

  // Catat ke log aktivitas
  await catatLogAktivitas({
    uid: pelaksana?.uid || auth.currentUser?.uid || 'admin',
    nama: pelaksana?.nama || 'Administrator',
    peran: pelaksana?.peran || 'admin',
    aksi: 'Inisialisasi Data Default',
    target: '18 Kelas, Mapel, TA & Akun Wali',
    nilaiBaru: `18 Kelas, ${resWali.dibuat} akun wali baru, 9 Mapel, TA 2025/2026 Ganjil`,
  });

  return {
    sukses: true,
    pesan: 'Inisialisasi data produksi berhasil disimpan ke Firestore.',
    totalKelas: resKelas.daftar18Kelas.length || 18,
    totalMapel: mapelList.length,
    totalTahunAjaran: taList.length,
    totalAkunWali: resWali.total || 18,
    totalSiswa: SISWA_SAMPEL_DEFAULT.length,
    waktu,
  };
}
