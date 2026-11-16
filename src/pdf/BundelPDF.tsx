import React from 'react';
import { Document } from '@react-pdf/renderer';
import { SampulPage, IdentitasSekolahPage } from './SampulPDF';
import { IdentitasSiswaPage } from './IdentitasPDF';
import { RaporPage, RaporPDFProps } from './RaporPDF';
import { KaihPage } from './KaihPDF';
import { KaihRecord } from '../types';

export interface BundelPDFProps extends RaporPDFProps {
  kaihRecord: KaihRecord;
}

export const BundelPDFDocument: React.FC<BundelPDFProps> = (props) => {
  return (
    <Document title={`Bundel_Lengkap_${props.siswa.nama}`}>
      {/* 1. Sampul Luar */}
      <SampulPage paperSize={props.paperSize} siswa={props.siswa} />

      {/* 2. Data Sekolah */}
      <IdentitasSekolahPage paperSize={props.paperSize} sekolah={props.sekolah} />

      {/* 3. Biodata Siswa */}
      <IdentitasSiswaPage
        paperSize={props.paperSize}
        sekolah={props.sekolah}
        siswa={props.siswa}
        includeStamp={props.includeStamp}
      />

      {/* 4. Rapor Hasil Belajar */}
      <RaporPage {...props} />

      {/* 5. Rekap 7 KAIH */}
      <KaihPage
        paperSize={props.paperSize}
        sekolah={props.sekolah}
        siswa={props.siswa}
        tingkatKelas={props.tingkatKelas}
        kaih={props.kaihRecord}
        namaWali={props.namaWali}
        nipWali={props.nipWali}
        tahun={props.tahunAjaran}
        includeStamp={props.includeStamp}
      />
    </Document>
  );
};
