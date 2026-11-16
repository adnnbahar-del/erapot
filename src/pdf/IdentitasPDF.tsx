import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { PAPER_SIZES } from './pdfStyles';
import { Siswa, Sekolah } from '../types';

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingLeft: 42,
    paddingRight: 42,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
    lineHeight: 1.3,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    textDecoration: 'underline',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  numCol: {
    width: 20,
    fontWeight: 'bold',
  },
  labelCol: {
    width: 170,
  },
  colonCol: {
    width: 12,
  },
  valCol: {
    flex: 1,
  },
  subLabelCol: {
    width: 150,
    paddingLeft: 12,
  },
  footerSign: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 20,
  },
  photoBox: {
    width: 75,
    height: 100,
    borderWidth: 1,
    borderColor: '#666666',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 8,
    color: '#888888',
    marginLeft: 30,
  },
  signBlock: {
    width: 200,
    textAlign: 'center',
  },
});

export const IdentitasSiswaPage: React.FC<{
  paperSize?: 'F4' | 'A4';
  sekolah: Sekolah;
  siswa: Siswa;
  includeStamp?: boolean;
}> = ({ paperSize = 'F4', sekolah, siswa, includeStamp = true }) => {
  const size = paperSize === 'A4' ? PAPER_SIZES.A4 : PAPER_SIZES.F4;
  const jkText = siswa.jk === 'L' ? 'Laki-Laki' : 'Perempuan';

  return (
    <Page size={size} style={styles.page}>
      <Text style={styles.title}>KETERANGAN TENTANG DIRI PESERTA DIDIK</Text>

      <View style={{ marginTop: 8 }}>
        <View style={styles.row}>
          <Text style={styles.numCol}>1.</Text>
          <Text style={styles.labelCol}>Nama Peserta Didik (Lengkap)</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={[styles.valCol, { fontWeight: 'bold' }]}>{siswa.nama}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>2.</Text>
          <Text style={styles.labelCol}>Nomor Induk Siswa (NIS)</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.nis || '-'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>3.</Text>
          <Text style={styles.labelCol}>Nomor Induk Siswa Nasional (NISN)</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.nisn || '-'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>4.</Text>
          <Text style={styles.labelCol}>Tempat, Tanggal Lahir</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>
            {siswa.tempat_lahir ? `${siswa.tempat_lahir}, ` : ''}{siswa.tanggal_lahir || '-'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>5.</Text>
          <Text style={styles.labelCol}>Jenis Kelamin</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{jkText}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>6.</Text>
          <Text style={styles.labelCol}>Agama</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.agama || 'Islam'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>7.</Text>
          <Text style={styles.labelCol}>Pendidikan Sebelumnya</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.pendidikan_sebelumnya || 'TK / RA'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>8.</Text>
          <Text style={styles.labelCol}>Alamat Peserta Didik</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.alamat || '-'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>9.</Text>
          <Text style={styles.labelCol}>Nama Orang Tua</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol} />
        </View>
        <View style={styles.row}>
          <Text style={styles.numCol} />
          <Text style={styles.subLabelCol}>a. Ayah</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.nama_ayah || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.numCol} />
          <Text style={styles.subLabelCol}>b. Ibu</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.nama_ibu || '-'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>10.</Text>
          <Text style={styles.labelCol}>Pekerjaan Orang Tua</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol} />
        </View>
        <View style={styles.row}>
          <Text style={styles.numCol} />
          <Text style={styles.subLabelCol}>a. Ayah</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.pekerjaan_ayah || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.numCol} />
          <Text style={styles.subLabelCol}>b. Ibu</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.pekerjaan_ibu || '-'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>11.</Text>
          <Text style={styles.labelCol}>Alamat Orang Tua</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>
            {siswa.alamat_ortu_desa ? `${siswa.alamat_ortu_desa}, Kec. ${siswa.alamat_ortu_kecamatan}, ${siswa.alamat_ortu_kabupaten}` : siswa.alamat || '-'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.numCol}>12.</Text>
          <Text style={styles.labelCol}>Wali Peserta Didik (Jika Ada)</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol} />
        </View>
        <View style={styles.row}>
          <Text style={styles.numCol} />
          <Text style={styles.subLabelCol}>a. Nama Wali</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.nama_wali || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.numCol} />
          <Text style={styles.subLabelCol}>b. Pekerjaan Wali</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.pekerjaan_wali || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.numCol} />
          <Text style={styles.subLabelCol}>c. Alamat Wali</Text>
          <Text style={styles.colonCol}>:</Text>
          <Text style={styles.valCol}>{siswa.alamat_wali || '-'}</Text>
        </View>
      </View>

      <View style={styles.footerSign}>
        <View style={styles.photoBox}>
          <Text>Pas Foto</Text>
          <Text>3 x 4 cm</Text>
        </View>

        <View style={styles.signBlock}>
          <Text>{sekolah.tempat_rapor}</Text>
          <Text>Kepala Sekolah,</Text>
          <View style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
            {includeStamp && sekolah.ttd_kepsek_url ? (
              <Image src={sekolah.ttd_kepsek_url} style={{ maxHeight: 40, maxWidth: 80 }} />
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

export const IdentitasPDFDocument: React.FC<{
  paperSize?: 'F4' | 'A4';
  sekolah: Sekolah;
  siswa: Siswa;
  includeStamp?: boolean;
}> = (props) => {
  return (
    <Document title={`Identitas_${props.siswa.nama}`}>
      <IdentitasSiswaPage {...props} />
    </Document>
  );
};
