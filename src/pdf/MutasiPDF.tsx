import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { PAPER_SIZES } from './pdfStyles';
import { Siswa, Sekolah } from '../types';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#000000',
    lineHeight: 1.2,
  },
  title: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    textDecoration: 'underline',
  },
  sectionHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    backgroundColor: '#e5e7eb',
    padding: 4,
    marginBottom: 6,
  },
  slotBox: {
    borderWidth: 1,
    borderColor: '#000000',
    padding: 6,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  label: {
    width: 140,
  },
  colon: {
    width: 10,
  },
  val: {
    flex: 1,
  },
  signRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  signBlock: {
    width: '45%',
    textAlign: 'center',
  },
});

export const MutasiPDFDocument: React.FC<{
  paperSize?: 'F4' | 'A4';
  sekolah: Sekolah;
  siswa: Siswa;
}> = ({ paperSize = 'F4', sekolah, siswa }) => {
  const size = paperSize === 'A4' ? PAPER_SIZES.A4 : PAPER_SIZES.F4;

  return (
    <Document title={`Mutasi_${siswa.nama}`}>
      <Page size={size} style={styles.page}>
        <Text style={styles.title}>KETERANGAN PINDAH SEKOLAH PESERTA DIDIK</Text>

        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontWeight: 'bold' }}>Nama Siswa: {siswa.nama} (NIS: {siswa.nis || '-'} / NISN: {siswa.nisn || '-'})</Text>
        </View>

        {/* BAGIAN I: KELUAR (3 SLOT) */}
        <Text style={styles.sectionHeader}>I. KELUAR DARI SEKOLAH INI</Text>
        {[1, 2, 3].map((slot) => (
          <View key={slot} style={styles.slotBox} wrap={false}>
            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Slot #{slot}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>1. Tanggal Keluar</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.val}>................................................</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>2. Kelas yang Ditinggalkan</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.val}>................................................</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>3. Sebab-Sebab Keluar</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.val}>................................................</Text>
            </View>
            <View style={styles.signRow}>
              <View style={styles.signBlock}>
                <Text>Tanda Tangan Orang Tua / Wali,</Text>
                <View style={{ height: 24 }} />
                <Text>................................................</Text>
              </View>
              <View style={styles.signBlock}>
                <Text>Kepala Sekolah,</Text>
                <View style={{ height: 24 }} />
                <Text style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{sekolah.kepala_sekolah}</Text>
                <Text>NIP. {sekolah.nip_kepala_sekolah}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* BAGIAN II: MASUK (3 SLOT) */}
        <Text style={[styles.sectionHeader, { marginTop: 4 }]}>II. MASUK KE SEKOLAH INI</Text>
        {[1, 2, 3].map((slot) => (
          <View key={slot} style={styles.slotBox} wrap={false}>
            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Slot #{slot}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>1. Nama Siswa / No Induk</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.val}>................................................</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>2. Sekolah Asal</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.val}>................................................</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>3. Diterima Tanggal / di Kelas</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.val}>................................................</Text>
            </View>
            <View style={styles.signRow}>
              <View style={{ width: '45%' }} />
              <View style={styles.signBlock}>
                <Text>Kepala Sekolah,</Text>
                <View style={{ height: 24 }} />
                <Text style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{sekolah.kepala_sekolah}</Text>
                <Text>NIP. {sekolah.nip_kepala_sekolah}</Text>
              </View>
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
};
