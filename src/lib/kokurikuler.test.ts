import { describe, it, expect } from 'vitest';
import { DPL, deskripsiOtomatis, kokurikulerRapor } from './kokurikuler';

describe('kokurikuler.ts - Logika Penilaian & Rapor Kokurikuler (P5)', () => {
  it('DPL memiliki 8 dimensi dengan urutan tetap', () => {
    expect(DPL).toHaveLength(8);
    expect(DPL[0]).toBe('Keimanan dan Ketakwaan');
    expect(DPL[1]).toBe('Kewargaan');
    expect(DPL[2]).toBe('Penalaran Kritis');
    expect(DPL[3]).toBe('Kreativitas');
    expect(DPL[4]).toBe('Kolaborasi');
    expect(DPL[5]).toBe('Kemandirian');
    expect(DPL[6]).toBe('Kesehatan');
    expect(DPL[7]).toBe('Komunikasi');
  });

  it('deskripsiOtomatis() menghasilkan format narasi sesuai spesifikasi', () => {
    const text = deskripsiOtomatis(
      'AHMAD FAHRI',
      'Kolaborasi',
      'Kemandirian',
      'Lingkungan Sehat, Saya Kuat'
    );
    expect(text).toBe(
      'Ananda AHMAD FAHRI sudah kuat dalam dimensi Kolaborasi dan perlu penguatan dalam Kemandirian pada tema Lingkungan Sehat, Saya Kuat.'
    );
  });

  it('dua tema tampil + satu tema tidak tampil -> hanya dua baris, urut sesuai urutan', () => {
    const siswa = { id: 's1', nama: 'SITI AMINAH' };
    const temaList = [
      { id: 't2', nama: 'Tema 2', urutan: 2, tampil_di_rapor: true },
      { id: 't1', nama: 'Tema 1', urutan: 1, tampil_di_rapor: true },
      { id: 't3', nama: 'Tema 3 Tidak Tampil', urutan: 3, tampil_di_rapor: false },
    ];
    const penilaianList = [
      { tema_id: 't1', siswa_id: 's1', dpl_kuat: 'Kolaborasi', dpl_penguatan: 'Kreativitas' },
      { tema_id: 't2', siswa_id: 's1', dpl_kuat: 'Kewargaan', dpl_penguatan: 'Komunikasi' },
      { tema_id: 't3', siswa_id: 's1', dpl_kuat: 'Kesehatan', dpl_penguatan: 'Kemandirian' },
    ];

    const hasil = kokurikulerRapor(siswa, temaList, penilaianList);
    expect(hasil).toHaveLength(2);
    expect(hasil[0].tema).toBe('Tema 1');
    expect(hasil[1].tema).toBe('Tema 2');
    expect(hasil[0].deskripsi).toContain('Tema 1');
    expect(hasil[1].deskripsi).toContain('Tema 2');
  });

  it('tema yang DPL-nya kosong untuk siswa itu -> dilewati', () => {
    const siswa = { id: 's1', nama: 'BUDI' };
    const temaList = [
      { id: 't1', nama: 'Tema 1', urutan: 1, tampil_di_rapor: true },
      { id: 't2', nama: 'Tema 2 Kosong', urutan: 2, tampil_di_rapor: true },
    ];
    const penilaianList = [
      { tema_id: 't1', siswa_id: 's1', dpl_kuat: 'Kolaborasi', dpl_penguatan: 'Kemandirian' },
      { tema_id: 't2', siswa_id: 's1', dpl_kuat: '', dpl_penguatan: '' },
    ];

    const hasil = kokurikulerRapor(siswa, temaList, penilaianList);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].tema).toBe('Tema 1');
  });

  it('deskripsi manual menggantikan deskripsi otomatis', () => {
    const siswa = { id: 's1', nama: 'SITI' };
    const temaList = [{ id: 't1', nama: 'Tema Alam', urutan: 1, tampil_di_rapor: true }];
    const customDesc = 'Catatan khusus pengamatan P5 siswa Siti selama berkebun.';
    const penilaianList = [
      {
        tema_id: 't1',
        siswa_id: 's1',
        dpl_kuat: 'Kolaborasi',
        dpl_penguatan: 'Kemandirian',
        deskripsi_manual: customDesc,
      },
    ];

    const hasil = kokurikulerRapor(siswa, temaList, penilaianList);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].deskripsi).toBe(customDesc);
  });

  it('tidak ada tema terisi -> mengembalikan array kosong', () => {
    const siswa = { id: 's1', nama: 'DENI' };
    const temaList = [{ id: 't1', nama: 'Tema 1', urutan: 1, tampil_di_rapor: true }];
    const penilaianList: any[] = [];

    const hasil = kokurikulerRapor(siswa, temaList, penilaianList);
    expect(hasil).toEqual([]);
  });

  it('uji alur 2 tema untuk 2 siswa: memastikan blok kokurikuler berisi 2 baris tema per siswa', () => {
    const siswa1 = { id: 's1', nama: 'AHMAD FAHRI' };
    const siswa2 = { id: 's2', nama: 'SITI AISYAH' };

    const temaList = [
      { id: 't1', nama: 'Lingkungan Sehat, Saya Kuat', urutan: 1, tampil_di_rapor: true },
      { id: 't2', nama: 'Teman Sejati Tanpa Perundungan', urutan: 2, tampil_di_rapor: true },
    ];

    const penilaianList = [
      // Siswa 1
      {
        tema_id: 't1',
        siswa_id: 's1',
        dpl_kuat: 'Keimanan dan Ketakwaan',
        dpl_penguatan: 'Kemandirian',
      },
      {
        tema_id: 't2',
        siswa_id: 's1',
        dpl_kuat: 'Penalaran Kritis',
        dpl_penguatan: 'Komunikasi',
      },
      // Siswa 2
      {
        tema_id: 't1',
        siswa_id: 's2',
        dpl_kuat: 'Kreativitas',
        dpl_penguatan: 'Kolaborasi',
      },
      {
        tema_id: 't2',
        siswa_id: 's2',
        dpl_kuat: 'Kesehatan',
        dpl_penguatan: 'Kewargaan',
      },
    ];

    // Siswa 1 rapor
    const rapor1 = kokurikulerRapor(siswa1, temaList, penilaianList);
    expect(rapor1).toHaveLength(2);
    expect(rapor1[0].tema).toBe('Lingkungan Sehat, Saya Kuat');
    expect(rapor1[0].deskripsi).toBe(
      'Ananda AHMAD FAHRI sudah kuat dalam dimensi Keimanan dan Ketakwaan dan perlu penguatan dalam Kemandirian pada tema Lingkungan Sehat, Saya Kuat.'
    );
    expect(rapor1[1].tema).toBe('Teman Sejati Tanpa Perundungan');
    expect(rapor1[1].deskripsi).toBe(
      'Ananda AHMAD FAHRI sudah kuat dalam dimensi Penalaran Kritis dan perlu penguatan dalam Komunikasi pada tema Teman Sejati Tanpa Perundungan.'
    );

    // Siswa 2 rapor
    const rapor2 = kokurikulerRapor(siswa2, temaList, penilaianList);
    expect(rapor2).toHaveLength(2);
    expect(rapor2[0].tema).toBe('Lingkungan Sehat, Saya Kuat');
    expect(rapor2[0].deskripsi).toBe(
      'Ananda SITI AISYAH sudah kuat dalam dimensi Kreativitas dan perlu penguatan dalam Kolaborasi pada tema Lingkungan Sehat, Saya Kuat.'
    );
    expect(rapor2[1].tema).toBe('Teman Sejati Tanpa Perundungan');
    expect(rapor2[1].deskripsi).toBe(
      'Ananda SITI AISYAH sudah kuat dalam dimensi Kesehatan dan perlu penguatan dalam Kewargaan pada tema Teman Sejati Tanpa Perundungan.'
    );
  });
});
