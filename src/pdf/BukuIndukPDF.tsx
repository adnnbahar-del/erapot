import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { PAPER_SIZES } from './pdfStyles';
import { Siswa, Sekolah } from '../types';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#000000',
    lineHeight: 1.25,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    textDecoration: 'underline',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    padding: 4,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tableCell: {
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tableCellLast: {
    padding: 4,
  },
});

export const BukuIndukPDFDocument: React.FC<{
  paperSize?: 'F4' | 'A4';
  sekolah: Sekolah;
  siswa: Siswa;
  tingkatKelas: string;
  semester: number;
  tahunAjaran: string;
  mapelScores: { nama: string; nilai: number | string }[];
  ekskulList: { nama: string; keterangan: string }[];
  kehadiran: { sakit: number; izin: number; alpa: number };
}> = ({
  paperSize = 'F4',
  sekolah,
  siswa,
  tingkatKelas,
  semester,
  tahunAjaran,
  mapelScores,
  ekskulList,
  kehadiran,
}) => {
  const size = paperSize === 'A4' ? PAPER_SIZES.A4 : PAPER_SIZES.F4;

  return (
    <Document title={`Buku_Induk_${siswa.nama}`}>
      <Page size={size} style={styles.page}>
        <Text style={styles.title}>LEMBAR BUKU INDUK PESERTA DIDIK</Text>

        {/* Identitas Singkat */}
        <View style={{ marginBottom: 10, padding: 8, borderWidth: 1, borderColor: '#000000' }}>
          <View style={{ flexDirection: 'row', marginBottom: 2 }}>
            <Text style={{ width: 120, fontWeight: 'bold' }}>Nama Peserta Didik</Text>
            <Text style={{ width: 10 }}>:</Text>
            <Text style={{ flex: 1, fontWeight: 'bold' }}>{siswa.nama}</Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 2 }}>
            <Text style={{ width: 120, fontWeight: 'bold' }}>NIS / NISN</Text>
            <Text style={{ width: 10 }}>:</Text>
            <Text style={{ flex: 1 }}>{siswa.nis || '-'} / {siswa.nisn || '-'}</Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 2 }}>
            <Text style={{ width: 120, fontWeight: 'bold' }}>Sekolah / Kelas</Text>
            <Text style={{ width: 10 }}>:</Text>
            <Text style={{ flex: 1 }}>{sekolah.nama} / Kelas {tingkatKelas} (Sem. {semester})</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ width: 120, fontWeight: 'bold' }}>Tahun Pelajaran</Text>
            <Text style={{ width: 10 }}>:</Text>
            <Text style={{ flex: 1 }}>{tahunAjaran}</Text>
          </View>
        </View>

        {/* Tabel Nilai Mapel */}
        <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>I. NILAI HASIL BELAJAR (RAPOR)</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeader, { width: '8%' }]}>No</Text>
            <Text style={[styles.tableHeader, { width: '62%' }]}>Mata Pelajaran</Text>
            <Text style={[styles.tableHeader, { width: '30%', borderRightWidth: 0 }]}>Nilai Akhir</Text>
          </View>
          {mapelScores.map((m, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>{i + 1}</Text>
              <Text style={[styles.tableCell, { width: '62%' }]}>{m.nama}</Text>
              <Text style={[styles.tableCellLast, { width: '30%', textAlign: 'center', fontWeight: 'bold' }]}>
                {m.nilai}
              </Text>
            </View>
          ))}
        </View>

        {/* Ekskul */}
        <Text style={{ fontWeight: 'bold', marginTop: 6, marginBottom: 4 }}>II. KEGIATAN EKSTRAKURIKULER</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeader, { width: '8%' }]}>No</Text>
            <Text style={[styles.tableHeader, { width: '42%' }]}>Ekstrakurikuler</Text>
            <Text style={[styles.tableHeader, { width: '50%', borderRightWidth: 0 }]}>Keterangan</Text>
          </View>
          {ekskulList.map((e, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>{idx + 1}</Text>
              <Text style={[styles.tableCell, { width: '42%', fontWeight: 'bold' }]}>{e.nama}</Text>
              <Text style={[styles.tableCellLast, { width: '50%' }]}>{e.keterangan || '-'}</Text>
            </View>
          ))}
        </View>

        {/* Kehadiran */}
        <Text style={{ fontWeight: 'bold', marginTop: 6, marginBottom: 4 }}>III. KETIDAKHADIRAN</Text>
        <View style={[styles.table, { width: '50%' }]}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: '60%' }]}>Sakit</Text>
            <Text style={[styles.tableCellLast, { width: '40%', textAlign: 'center' }]}>{kehadiran.sakit} hari</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: '60%' }]}>Izin</Text>
            <Text style={[styles.tableCellLast, { width: '40%', textAlign: 'center' }]}>{kehadiran.izin} hari</Text>
          </View>
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.tableCell, { width: '60%' }]}>Tanpa Keterangan</Text>
            <Text style={[styles.tableCellLast, { width: '40%', textAlign: 'center' }]}>{kehadiran.alpa} hari</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
