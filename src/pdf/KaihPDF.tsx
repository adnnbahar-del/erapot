import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { Siswa, Sekolah, KaihRecord } from '../types';
import { Periode, bulanRomawiPeriode, tanggalTtdBawaan, teksPeriode, normalisasiKaih } from '../lib/kaih';

const PAPER_SIZES = {
  F4: [612, 936] as [number, number],
  A4: [595.28, 841.89] as [number, number],
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
    lineHeight: 1.25,
  },
  kopContainer: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  kopLine1: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  kopLine2: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  kopSchool: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  kopAddress: {
    fontSize: 7.5,
    color: '#333333',
    marginTop: 1,
    textAlign: 'center',
  },
  titleDoc: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  nomorSurat: {
    fontSize: 8.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  bioRow: {
    flexDirection: 'row',
    marginBottom: 2,
    fontSize: 8.5,
  },
  bioLabel: {
    width: '28%',
  },
  bioColon: {
    width: '3%',
  },
  bioVal: {
    width: '69%',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    marginTop: 6,
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 18,
    alignItems: 'center',
  },
  tableHeader: {
    fontSize: 8.5,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tableCell: {
    fontSize: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tableCellLast: {
    fontSize: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  signContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  signCol: {
    width: '30%',
    textAlign: 'center',
    fontSize: 8.5,
  },
  signSpacer: {
    height: 40,
  },
});

export interface KaihPDFProps {
  paperSize?: 'F4' | 'A4';
  sekolah: Sekolah;
  siswa: Siswa;
  tingkatKelas: string;
  kaih: KaihRecord;
  namaWali: string;
  nipWali: string;
  tahun: string;
  tahunPeriode?: number;
  periode?: Periode;
  tanggalTandaTangan?: string;
  includeStamp?: boolean;
}

export const KaihPage: React.FC<KaihPDFProps> = ({
  paperSize = 'F4',
  sekolah,
  siswa,
  tingkatKelas,
  kaih,
  namaWali,
  nipWali,
  tahun,
  tahunPeriode,
  periode,
  tanggalTandaTangan,
  includeStamp = true,
}) => {
  const size = paperSize === 'A4' ? PAPER_SIZES.A4 : PAPER_SIZES.F4;

  // Resolusi tahun dan periode
  const norm = normalisasiKaih(kaih);
  const finalTahun = tahunPeriode || norm.tahun || Number(tahun.split('/')[0]) || 2025;
  const finalPeriode: Periode = (periode || norm.periode || 'JUL-DES') as Periode;

  // Nomor surat: 421.2 / 045 / 2025 / {bulan romawi} / {tahun}
  const romawi = bulanRomawiPeriode(finalPeriode);

  // Tanggal tanda tangan bawaan jika tidak diisi manual
  const tempat = sekolah.tempat_rapor?.includes(',')
    ? sekolah.tempat_rapor.split(',')[0].trim()
    : sekolah.desa || sekolah.kabupaten || 'Sukaraja';
  const defaultTtd = `${tempat}, ${tanggalTtdBawaan(finalTahun, finalPeriode)}`;
  const ttdText = tanggalTandaTangan && tanggalTandaTangan.trim() ? tanggalTandaTangan : defaultTtd;

  const habits = [
    { no: 1, name: 'Bangun Pagi', status: kaih.bangun_pagi },
    { no: 2, name: 'Beribadah', status: kaih.beribadah },
    { no: 3, name: 'Berolahraga', status: kaih.berolahraga },
    { no: 4, name: 'Makan Sehat dan Bergizi', status: kaih.makan_sehat },
    { no: 5, name: 'Gemar Belajar', status: kaih.gemar_belajar },
    { no: 6, name: 'Bermasyarakat', status: kaih.bermasyarakat },
    { no: 7, name: 'Tidur Cepat', status: kaih.tidur_cepat },
  ];

  return (
    <Page size={size} style={styles.page}>
      <View style={styles.kopContainer}>
        <Text style={styles.kopLine1}>PEMERINTAH KABUPATEN TANGGAMUS</Text>
        <Text style={styles.kopLine2}>DINAS PENDIDIKAN DAN KEBUDAYAAN</Text>
        <Text style={styles.kopSchool}>{sekolah.nama}</Text>
        <Text style={styles.kopAddress}>
          {sekolah.alamat}, Desa {sekolah.desa}, Kec. {sekolah.kecamatan}, Kab. Tanggamus, Lampung {sekolah.kode_pos}
        </Text>
      </View>

      <Text style={styles.titleDoc}>REKAP 7 KEBIASAAN ANAK HEBAT INDONESIA</Text>
      <Text style={styles.nomorSurat}>Nomor : 421.2 / 045 / 2025 / {romawi} / {finalTahun}</Text>

      <View style={{ marginBottom: 6 }}>
        <View style={styles.bioRow}>
          <Text style={styles.bioLabel}>Nama Peserta Didik</Text>
          <Text style={styles.bioColon}>:</Text>
          <Text style={[styles.bioVal, { fontWeight: 'bold' }]}>{siswa.nama}</Text>
        </View>
        <View style={styles.bioRow}>
          <Text style={styles.bioLabel}>Tempat, Tanggal Lahir</Text>
          <Text style={styles.bioColon}>:</Text>
          <Text style={styles.bioVal}>{siswa.tempat_lahir}, {siswa.tanggal_lahir}</Text>
        </View>
        <View style={styles.bioRow}>
          <Text style={styles.bioLabel}>Nomor Induk / NISN</Text>
          <Text style={styles.bioColon}>:</Text>
          <Text style={styles.bioVal}>{siswa.nis || '-'} / {siswa.nisn || '-'}</Text>
        </View>
        <View style={styles.bioRow}>
          <Text style={styles.bioLabel}>Kelas</Text>
          <Text style={styles.bioColon}>:</Text>
          <Text style={styles.bioVal}>{tingkatKelas}</Text>
        </View>
        <View style={styles.bioRow}>
          <Text style={styles.bioLabel}>Nama Orang Tua</Text>
          <Text style={styles.bioColon}>:</Text>
          <Text style={styles.bioVal}>{siswa.nama_ayah || siswa.nama_ibu || '-'}</Text>
        </View>
        <View style={styles.bioRow}>
          <Text style={styles.bioLabel}>Alamat</Text>
          <Text style={styles.bioColon}>:</Text>
          <Text style={styles.bioVal}>{siswa.alamat || '-'}</Text>
        </View>
        <View style={styles.bioRow}>
          <Text style={styles.bioLabel}>Periode Penilaian</Text>
          <Text style={styles.bioColon}>:</Text>
          <Text style={[styles.bioVal, { fontWeight: 'bold' }]}>{teksPeriode(finalTahun, finalPeriode)}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableRow}>
          <Text style={[styles.tableHeader, { width: '8%' }]}>No</Text>
          <Text style={[styles.tableHeader, { width: '52%' }]}>7 Kebiasaan Anak Hebat Indonesia</Text>
          <Text style={[styles.tableHeader, { width: '40%', borderRightWidth: 0 }]}>
            Keterangan Penerapan
          </Text>
        </View>
        {habits.map((h) => (
          <View key={h.no} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>{h.no}</Text>
            <Text style={[styles.tableCell, { width: '52%', fontWeight: 'bold' }]}>{h.name}</Text>
            <Text style={[styles.tableCellLast, { width: '40%', textAlign: 'center', fontWeight: 'bold' }]}>
              {h.status || 'Belum Terbiasa'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.signContainer} wrap={false}>
        <View style={styles.signCol}>
          <Text>Mengetahui,</Text>
          <Text>Orang Tua / Wali,</Text>
          <View style={styles.signSpacer} />
          <Text style={{ borderBottomWidth: 1, borderBottomColor: '#000000', marginHorizontal: 10 }}>
            ................................................
          </Text>
        </View>

        <View style={styles.signCol}>
          <Text>{ttdText}</Text>
          <Text>Guru / Wali Kelas {tingkatKelas},</Text>
          <View style={styles.signSpacer} />
          <Text style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{namaWali}</Text>
          <Text>NIP. {nipWali || '-'}</Text>
        </View>

        <View style={styles.signCol}>
          <Text>Mengetahui,</Text>
          <Text>Kepala Sekolah,</Text>
          <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
            {includeStamp && sekolah.ttd_kepsek_url ? (
              <Image src={sekolah.ttd_kepsek_url} style={{ maxHeight: 35, maxWidth: 70 }} />
            ) : null}
          </View>
          <Text style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
            {sekolah.kepala_sekolah}
          </Text>
          <Text>NIP. {sekolah.nip_kepala_sekolah}</Text>
        </View>
      </View>
    </Page>
  );
};

export const KaihPDFDocument: React.FC<KaihPDFProps> = (props) => {
  return (
    <Document title={`7KAIH_${props.siswa.nama}`}>
      <KaihPage {...props} />
    </Document>
  );
};
