import React from 'react';
import { Page, Text, View, Document, Image } from '@react-pdf/renderer';
import { pdfStyles, PAPER_SIZES } from './pdfStyles';
import { Siswa, Sekolah } from '../types';

export interface RaporPDFProps {
  paperSize?: 'F4' | 'A4';
  sekolah: Sekolah;
  siswa: Siswa;
  tingkatKelas: string;
  fase: string;
  semester: number;
  tahunAjaran: string;
  namaWali: string;
  nipWali: string;
  mapelList: {
    no: number;
    nama: string;
    nilaiAkhir: number | string;
    capaianTercapai: string;
    capaianPerluBimbingan: string;
  }[];
  kokurikulerList?: { tema: string; deskripsi: string }[];
  kokurikulerText?: string;
  prestasiAkademikText: string;
  ekskulList: { nama: string; keterangan: string }[];
  kehadiran: { sakit: number; izin: number; alpa: number };
  catatanWali: string;
  keputusanNaik?: string | null;
  includeStamp?: boolean;
}

export const RaporPage: React.FC<RaporPDFProps> = ({
  paperSize = 'F4',
  sekolah,
  siswa,
  tingkatKelas,
  fase,
  semester,
  tahunAjaran,
  namaWali,
  nipWali,
  mapelList,
  kokurikulerList,
  kokurikulerText,
  prestasiAkademikText,
  ekskulList,
  kehadiran,
  catatanWali,
  keputusanNaik,
  includeStamp = true,
}) => {
  const size = paperSize === 'A4' ? PAPER_SIZES.A4 : PAPER_SIZES.F4;
  const semesterText = semester === 1 ? '1 (Satu) / Ganjil' : '2 (Dua) / Genap';

  const finalKokurikulerList: { tema: string; deskripsi: string }[] =
    kokurikulerList !== undefined
      ? kokurikulerList
      : kokurikulerText && kokurikulerText.trim()
      ? [{ tema: '', deskripsi: kokurikulerText.trim() }]
      : [];

  return (
    <Page size={size} style={pdfStyles.page}>
      {/* Kepala Rapor */}
      <View style={pdfStyles.headerBox}>
        <View style={pdfStyles.headerCol}>
          <View style={pdfStyles.headerRow}>
            <Text style={pdfStyles.headerLabel}>Nama Peserta Didik</Text>
            <Text style={pdfStyles.headerColon}>:</Text>
            <Text style={[pdfStyles.headerValue, { fontWeight: 'bold' }]}>{siswa.nama}</Text>
          </View>
          <View style={pdfStyles.headerRow}>
            <Text style={pdfStyles.headerLabel}>NISN / NIS</Text>
            <Text style={pdfStyles.headerColon}>:</Text>
            <Text style={pdfStyles.headerValue}>{siswa.nisn || '-'} / {siswa.nis || '-'}</Text>
          </View>
          <View style={pdfStyles.headerRow}>
            <Text style={pdfStyles.headerLabel}>Sekolah</Text>
            <Text style={pdfStyles.headerColon}>:</Text>
            <Text style={pdfStyles.headerValue}>{sekolah.nama}</Text>
          </View>
          <View style={pdfStyles.headerRow}>
            <Text style={pdfStyles.headerLabel}>Alamat</Text>
            <Text style={pdfStyles.headerColon}>:</Text>
            <Text style={pdfStyles.headerValue}>{sekolah.alamat}, {sekolah.desa}</Text>
          </View>
        </View>

        <View style={pdfStyles.headerCol}>
          <View style={pdfStyles.headerRow}>
            <Text style={pdfStyles.headerLabel}>Kelas / Fase</Text>
            <Text style={pdfStyles.headerColon}>:</Text>
            <Text style={pdfStyles.headerValue}>{tingkatKelas} / {fase}</Text>
          </View>
          <View style={pdfStyles.headerRow}>
            <Text style={pdfStyles.headerLabel}>Semester</Text>
            <Text style={pdfStyles.headerColon}>:</Text>
            <Text style={pdfStyles.headerValue}>{semesterText}</Text>
          </View>
          <View style={pdfStyles.headerRow}>
            <Text style={pdfStyles.headerLabel}>Tahun Pelajaran</Text>
            <Text style={pdfStyles.headerColon}>:</Text>
            <Text style={pdfStyles.headerValue}>{tahunAjaran}</Text>
          </View>
        </View>
      </View>

      {/* Judul Laporan */}
      <Text style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 10, marginBottom: 8 }}>
        LAPORAN HASIL BELAJAR (RAPOR)
      </Text>

      {/* Tabel Mata Pelajaran & Capaian Kompetensi */}
      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableRow}>
          <Text style={[pdfStyles.tableHeader, { width: '6%' }]}>No</Text>
          <Text style={[pdfStyles.tableHeader, { width: '26%' }]}>Mata Pelajaran</Text>
          <Text style={[pdfStyles.tableHeader, { width: '10%' }]}>Nilai Akhir</Text>
          <Text style={[pdfStyles.tableHeader, { width: '58%', borderRightWidth: 0 }]}>
            Capaian Kompetensi
          </Text>
        </View>

        {mapelList.map((m) => (
          <View key={m.no} style={pdfStyles.tableRow} wrap={false}>
            <Text style={[pdfStyles.tableCell, { width: '6%', textAlign: 'center' }]}>
              {m.no}
            </Text>
            <Text style={[pdfStyles.tableCell, { width: '26%', fontWeight: 'bold' }]}>
              {m.nama}
            </Text>
            <Text style={[pdfStyles.tableCell, { width: '10%', textAlign: 'center', fontWeight: 'bold' }]}>
              {m.nilaiAkhir}
            </Text>
            <View style={[pdfStyles.tableCellLast, { width: '58%' }]}>
              {m.capaianTercapai ? (
                <Text style={{ marginBottom: m.capaianPerluBimbingan ? 3 : 0, lineHeight: 1.2 }}>
                  {m.capaianTercapai}
                </Text>
              ) : null}
              {m.capaianPerluBimbingan ? (
                <Text style={{ lineHeight: 1.2, color: '#222222' }}>
                  {m.capaianPerluBimbingan}
                </Text>
              ) : null}
              {!m.capaianTercapai && !m.capaianPerluBimbingan ? (
                <Text style={{ fontStyle: 'italic', color: '#666666' }}>-</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* Kokurikuler (P5) */}
      <View style={{ marginBottom: 6 }}>
        <Text style={pdfStyles.sectionTitle}>Kokurikuler</Text>
        {finalKokurikulerList.length === 0 ? (
          <View style={pdfStyles.boxContainer} wrap={false}>
            <Text style={{ lineHeight: 1.3 }}>-</Text>
          </View>
        ) : finalKokurikulerList.length === 1 ? (
          <View style={pdfStyles.boxContainer} wrap={false}>
            <Text style={{ lineHeight: 1.3 }}>
              {finalKokurikulerList[0].deskripsi}
            </Text>
          </View>
        ) : (
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tableHeader, { width: '6%' }]}>No</Text>
              <Text style={[pdfStyles.tableHeader, { width: '28%' }]}>Tema</Text>
              <Text style={[pdfStyles.tableHeader, { width: '66%', borderRightWidth: 0 }]}>
                Deskripsi
              </Text>
            </View>
            {finalKokurikulerList.map((item, idx) => (
              <View key={idx} style={pdfStyles.tableRow} wrap={false}>
                <Text style={[pdfStyles.tableCell, { width: '6%', textAlign: 'center' }]}>
                  {idx + 1}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: '28%', fontWeight: 'bold' }]}>
                  {item.tema}
                </Text>
                <Text style={[pdfStyles.tableCellLast, { width: '66%', lineHeight: 1.3 }]}>
                  {item.deskripsi}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Prestasi Akademik */}
      <View style={{ marginBottom: 6 }} wrap={false}>
        <Text style={pdfStyles.sectionTitle}>Prestasi Akademik</Text>
        <View style={pdfStyles.boxContainer}>
          <Text style={{ fontWeight: 'bold' }}>
            {prestasiAkademikText || '-'}
          </Text>
        </View>
      </View>

      {/* Ekstrakurikuler */}
      <View style={{ marginBottom: 6 }} wrap={false}>
        <Text style={pdfStyles.sectionTitle}>Ekstrakurikuler</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableRow}>
            <Text style={[pdfStyles.tableHeader, { width: '8%' }]}>No</Text>
            <Text style={[pdfStyles.tableHeader, { width: '32%' }]}>Kegiatan Ekstrakurikuler</Text>
            <Text style={[pdfStyles.tableHeader, { width: '60%', borderRightWidth: 0 }]}>Keterangan</Text>
          </View>
          {ekskulList.length > 0 ? (
            ekskulList.map((ek, i) => (
              <View key={i} style={pdfStyles.tableRow}>
                <Text style={[pdfStyles.tableCell, { width: '8%', textAlign: 'center' }]}>{i + 1}</Text>
                <Text style={[pdfStyles.tableCell, { width: '32%', fontWeight: 'bold' }]}>{ek.nama}</Text>
                <Text style={[pdfStyles.tableCellLast, { width: '60%' }]}>{ek.keterangan || '-'}</Text>
              </View>
            ))
          ) : (
            <View style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tableCell, { width: '8%', textAlign: 'center' }]}>1</Text>
              <Text style={[pdfStyles.tableCell, { width: '32%' }]}>Pramuka</Text>
              <Text style={[pdfStyles.tableCellLast, { width: '60%' }]}>Baik, aktif dalam setiap kegiatan kepramukaan.</Text>
            </View>
          )}
        </View>
      </View>

      {/* Ketidakhadiran & Catatan Wali Kelas */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }} wrap={false}>
        <View style={{ width: '38%' }}>
          <Text style={pdfStyles.sectionTitle}>Ketidakhadiran</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tableCell, { width: '65%' }]}>Sakit</Text>
              <Text style={[pdfStyles.tableCellLast, { width: '35%', textAlign: 'center' }]}>
                {kehadiran.sakit} hari
              </Text>
            </View>
            <View style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tableCell, { width: '65%' }]}>Izin</Text>
              <Text style={[pdfStyles.tableCellLast, { width: '35%', textAlign: 'center' }]}>
                {kehadiran.izin} hari
              </Text>
            </View>
            <View style={[pdfStyles.tableRow, { borderBottomWidth: 0 }]}>
              <Text style={[pdfStyles.tableCell, { width: '65%' }]}>Tanpa Keterangan</Text>
              <Text style={[pdfStyles.tableCellLast, { width: '35%', textAlign: 'center' }]}>
                {kehadiran.alpa} hari
              </Text>
            </View>
          </View>
        </View>

        <View style={{ width: '58%' }}>
          <Text style={pdfStyles.sectionTitle}>Catatan Wali Kelas</Text>
          <View style={[pdfStyles.boxContainer, { minHeight: 52 }]}>
            <Text style={{ lineHeight: 1.3, fontStyle: 'italic' }}>
              "{catatanWali || 'Pertahankan semangat belajar dan prestasimu.'}"
            </Text>
          </View>
        </View>
      </View>

      {/* Keputusan Kenaikan Kelas */}
      {semester === 2 && keputusanNaik && (
        <View style={{ marginBottom: 6 }} wrap={false}>
          <Text style={pdfStyles.sectionTitle}>Keputusan</Text>
          <View style={pdfStyles.boxContainer}>
            <Text style={{ fontWeight: 'bold' }}>
              Berdasarkan pencapaian seluruh kompetensi, peserta didik dinyatakan: {keputusanNaik}
            </Text>
          </View>
        </View>
      )}

      {/* Tanggapan Orang Tua */}
      <View style={{ marginBottom: 8 }} wrap={false}>
        <Text style={pdfStyles.sectionTitle}>Tanggapan Orang Tua / Wali Murid</Text>
        <View style={[pdfStyles.boxContainer, { height: 35 }]}>
          <Text style={{ color: '#888888', fontSize: 7.5 }}>
            Catatan/tanggapan orang tua/wali terhadap hasil belajar peserta didik:
          </Text>
        </View>
      </View>

      {/* Tanda Tangan */}
      <View style={pdfStyles.signatureContainer} wrap={false}>
        <View style={pdfStyles.signatureCol}>
          <Text>Mengetahui,</Text>
          <Text>Orang Tua / Wali,</Text>
          <View style={pdfStyles.signatureSpacer} />
          <Text style={{ borderBottomWidth: 1, borderBottomColor: '#000000', marginHorizontal: 10 }}>
            ................................................
          </Text>
        </View>

        <View style={pdfStyles.signatureCol}>
          <Text>Mengetahui,</Text>
          <Text>Kepala Sekolah,</Text>
          <View style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
            {includeStamp && sekolah.ttd_kepsek_url ? (
              <Image src={sekolah.ttd_kepsek_url} style={{ maxHeight: 40, maxWidth: 80 }} />
            ) : null}
          </View>
          <Text style={pdfStyles.signatureName}>{sekolah.kepala_sekolah}</Text>
          <Text>NIP. {sekolah.nip_kepala_sekolah}</Text>
        </View>

        <View style={pdfStyles.signatureCol}>
          <Text>{sekolah.tempat_rapor}</Text>
          <Text>Wali Kelas {tingkatKelas},</Text>
          <View style={pdfStyles.signatureSpacer} />
          <Text style={pdfStyles.signatureName}>{namaWali}</Text>
          <Text>NIP. {nipWali || '-'}</Text>
        </View>
      </View>
    </Page>
  );
};

export const RaporPDFDocument: React.FC<RaporPDFProps> = (props) => {
  return (
    <Document title={`Rapor_${props.siswa.nama}`}>
      <RaporPage {...props} />
    </Document>
  );
};
