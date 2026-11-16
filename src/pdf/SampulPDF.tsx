import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { PAPER_SIZES } from './pdfStyles';
import { Siswa, Sekolah } from '../types';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    color: '#000000',
  },
  coverContainer: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 30,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleTop: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  subTitleTop: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  middleBox: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 40,
  },
  studentNameBox: {
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '80%',
    alignItems: 'center',
    marginBottom: 16,
  },
  studentName: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  studentNis: {
    fontSize: 10,
    textAlign: 'center',
  },
  bottomBox: {
    alignItems: 'center',
  },
  govTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 1.4,
  },
  schoolPageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    textDecoration: 'underline',
  },
  schoolTableRow: {
    flexDirection: 'row',
    marginBottom: 10,
    fontSize: 9.5,
  },
  schoolTableLabel: {
    width: 140,
    fontWeight: 'bold',
  },
  schoolTableColon: {
    width: 15,
  },
  schoolTableValue: {
    flex: 1,
  },
});

export const SampulPage: React.FC<{ paperSize?: 'F4' | 'A4'; siswa: Siswa }> = ({
  paperSize = 'F4',
  siswa,
}) => {
  const size = paperSize === 'A4' ? PAPER_SIZES.A4 : PAPER_SIZES.F4;
  return (
    <Page size={size} style={styles.page}>
      <View style={styles.coverContainer}>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.titleTop}>RAPOR PESERTA DIDIK</Text>
          <Text style={styles.subTitleTop}>SEKOLAH DASAR (SD)</Text>
        </View>

        <View style={{ marginVertical: 30, alignItems: 'center' }}>
          <Text style={{ fontSize: 44, color: '#444444' }}>★</Text>
        </View>

        <View style={styles.middleBox}>
          <Text style={{ fontSize: 10, marginBottom: 8 }}>Nama Peserta Didik:</Text>
          <View style={styles.studentNameBox}>
            <Text style={styles.studentName}>{siswa.nama}</Text>
          </View>

          <Text style={{ fontSize: 10, marginBottom: 4 }}>NIS / NISN:</Text>
          <Text style={styles.studentNis}>{siswa.nis || '-'} / {siswa.nisn || '-'}</Text>
        </View>

        <View style={styles.bottomBox}>
          <Text style={styles.govTitle}>KEMENTERIAN PENDIDIKAN DAN KEBUDAYAAN</Text>
          <Text style={styles.govTitle}>REPUBLIK INDONESIA</Text>
        </View>
      </View>
    </Page>
  );
};

export const IdentitasSekolahPage: React.FC<{ paperSize?: 'F4' | 'A4'; sekolah: Sekolah }> = ({
  paperSize = 'F4',
  sekolah,
}) => {
  const size = paperSize === 'A4' ? PAPER_SIZES.A4 : PAPER_SIZES.F4;
  return (
    <Page size={size} style={styles.page}>
      <Text style={styles.schoolPageTitle}>RAPOR PESERTA DIDIK SEKOLAH DASAR</Text>

      <View style={{ marginTop: 20 }}>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>Nama Sekolah</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={[styles.schoolTableValue, { fontWeight: 'bold' }]}>{sekolah.nama}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>NPSN</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.npsn || '-'}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>NSS</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.nss || '-'}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>Alamat Sekolah</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.alamat}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>Kode Pos</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.kode_pos || '-'}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>Desa / Kelurahan</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.desa}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>Kecamatan</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.kecamatan}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>Kabupaten / Kota</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.kabupaten}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>Provinsi</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.provinsi}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>Website</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.website || '-'}</Text>
        </View>
        <View style={styles.schoolTableRow}>
          <Text style={styles.schoolTableLabel}>E-mail</Text>
          <Text style={styles.schoolTableColon}>:</Text>
          <Text style={styles.schoolTableValue}>{sekolah.email || '-'}</Text>
        </View>
      </View>
    </Page>
  );
};

export const SampulPDFDocument: React.FC<{
  paperSize?: 'F4' | 'A4';
  sekolah: Sekolah;
  siswa: Siswa;
}> = ({ paperSize = 'F4', sekolah, siswa }) => {
  return (
    <Document title={`Sampul_${siswa.nama}`}>
      <SampulPage paperSize={paperSize} siswa={siswa} />
      <IdentitasSekolahPage paperSize={paperSize} sekolah={sekolah} />
    </Document>
  );
};
