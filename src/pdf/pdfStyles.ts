import { StyleSheet } from '@react-pdf/renderer';

export const PAPER_SIZES = {
  F4: [612, 936] as [number, number], // 8.5 x 13 inches in points (Folio / F4)
  A4: [595.28, 841.89] as [number, number], // Standard A4 in points
};

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingLeft: 42,
    paddingRight: 42,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.25,
  },
  // Header Rapor
  headerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 6,
  },
  headerCol: {
    width: '48%',
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  headerLabel: {
    width: 100,
    fontWeight: 'bold',
  },
  headerColon: {
    width: 10,
  },
  headerValue: {
    flex: 1,
  },
  // Table
  table: {
    width: '100%',
    borderStyle: 'solid',
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
    textAlign: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tableCell: {
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    fontSize: 8.5,
  },
  tableCellLast: {
    padding: 3,
    fontSize: 8.5,
  },
  // Section Titles
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 3,
  },
  boxContainer: {
    borderWidth: 1,
    borderColor: '#000000',
    padding: 5,
    marginBottom: 6,
  },
  // Signatures
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  signatureCol: {
    width: '32%',
    textAlign: 'center',
  },
  signatureSpacer: {
    height: 44,
  },
  signatureName: {
    fontWeight: 'bold',
    textDecoration: 'underline',
  },
});
